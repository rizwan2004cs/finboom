import type { createAdminClient } from "@/utils/supabase/admin"
import type { Snapshot } from "@/lib/types"
import { computeNetWorth, NET_WORTH_SNAPSHOT_META, type NetWorthBreakdown } from "./net-worth"

/** Comparing a live net worth against an older snapshot.
 *
 *  Snapshots taken before the formula change stored `investments − loans`
 *  (no cash & bank, no card dues). Snapshots taken since record the extra
 *  terms under `NET_WORTH_SNAPSHOT_META` keys in `asset_breakdown`. Diffing a
 *  new-formula number against an old-formula baseline shows a bogus jump equal
 *  to the user's whole cash balance, so every "change since" surface must pick
 *  the like-for-like value through these helpers. */

export type BaselineSnapshot = Pick<Snapshot, "net_worth" | "asset_breakdown">

/** True when the snapshot was written with the current formula. Presence of
 *  the meta key is what matters — a profile with no bank accounts legitimately
 *  stores `_cash_and_bank: 0`. */
export function snapshotUsesCurrentFormula(s: BaselineSnapshot): boolean {
  const breakdown = s.asset_breakdown
  if (!breakdown || typeof breakdown !== "object") return false
  return NET_WORTH_SNAPSHOT_META.cashAndBank in breakdown
}

/** The live net worth expressed in the same formula as `baseline`. */
export function netWorthComparableTo(
  wealth: NetWorthBreakdown,
  baseline: BaselineSnapshot | null | undefined,
): number {
  if (!baseline || snapshotUsesCurrentFormula(baseline)) return wealth.netWorth
  return wealth.investments - wealth.loans
}

/** A snapshot row's net worth expressed in the same formula as `baseline`
 *  (row-vs-row, e.g. the snapshots list). */
export function snapshotNetWorthComparableTo(
  s: BaselineSnapshot,
  baseline: BaselineSnapshot | null | undefined,
): number {
  const netWorth = Number(s.net_worth)
  if (!baseline || snapshotUsesCurrentFormula(baseline)) return netWorth
  if (!snapshotUsesCurrentFormula(s)) return netWorth
  // Strip the terms the old formula never had.
  const cashAndBank = Number(s.asset_breakdown[NET_WORTH_SNAPSHOT_META.cashAndBank] ?? 0)
  const cardDues = Number(s.asset_breakdown[NET_WORTH_SNAPSHOT_META.cardDues] ?? 0)
  return netWorth - cashAndBank + cardDues
}

export interface ProfileNetWorthReport {
  id: string
  name: string
  /** Live, current formula (what the dashboard shows). */
  netWorth: number
  /** Live, restated in this profile's baseline formula — diff this. */
  comparableNetWorth: number
  /** Null when this profile has no snapshot on or before the cutoff. */
  previousNetWorth: number | null
}

export interface UserNetWorthReport {
  totalAssets: number
  totalLiabilities: number
  /** Live net worth in the CURRENT formula — equals totalAssets − totalLiabilities. */
  netWorth: number
  /** Live net worth restated in each profile's baseline formula; diff THIS
   *  against previousNetWorth, never `netWorth`. */
  comparableNetWorth: number
  /** Sum of per-profile baselines, in a formula comparable to `netWorth`.
   *  Null when any profile lacks a baseline — a partial sum would be diffed
   *  against the full live number. */
  previousNetWorth: number | null
  profiles: ProfileNetWorthReport[]
}

type AdminClient = ReturnType<typeof createAdminClient>

/** User-wide net worth for the report crons. Live and baseline are both
 *  computed per profile (snapshots are per-profile rows) and summed, so a user
 *  with several profiles is never diffed against a single profile's snapshot.
 *  Mirrors the per-profile queries in api/cron/monthly-snapshot. */
export async function loadUserNetWorthReport(
  supabase: AdminClient,
  userId: string,
  profiles: { id: string; name: string }[],
  cutoffISO?: string,
): Promise<UserNetWorthReport> {
  const report: UserNetWorthReport = {
    totalAssets: 0,
    totalLiabilities: 0,
    netWorth: 0,
    comparableNetWorth: 0,
    previousNetWorth: 0,
    profiles: [],
  }
  let previousTotal: number | null = 0

  for (const profile of profiles) {
    const [{ data: assets }, { data: liabilities }, { data: accounts }, { data: transactions }] =
      await Promise.all([
        supabase
          .from("assets")
          .select("current_value")
          .eq("user_id", userId)
          .eq("profile_id", profile.id),
        supabase
          .from("liabilities")
          .select("outstanding_amount")
          .eq("user_id", userId)
          .eq("profile_id", profile.id),
        supabase
          .from("accounts")
          .select("id, type, opening_balance, opening_date")
          .eq("user_id", userId)
          .eq("profile_id", profile.id),
        supabase
          .from("transactions")
          .select("account_id, type, amount, date")
          .eq("user_id", userId)
          .eq("profile_id", profile.id)
          .not("account_id", "is", null),
      ])

    const wealth = computeNetWorth({
      assets: assets || [],
      liabilities: liabilities || [],
      accounts: accounts || [],
      transactions: transactions || [],
    })

    let query = supabase
      .from("snapshots")
      .select("net_worth, asset_breakdown, snapshot_date")
      .eq("user_id", userId)
      .eq("profile_id", profile.id)
    if (cutoffISO) query = query.lte("snapshot_date", cutoffISO)
    const { data: snapshots } = await query.order("snapshot_date", { ascending: false }).limit(1)
    const baseline = (snapshots?.[0] as BaselineSnapshot | undefined) ?? null

    const comparable = netWorthComparableTo(wealth, baseline)
    const previousNetWorth = baseline ? Number(baseline.net_worth) : null

    report.totalAssets += wealth.totalAssets
    report.totalLiabilities += wealth.totalLiabilities
    report.netWorth += wealth.netWorth
    report.comparableNetWorth += comparable
    if (previousTotal !== null && previousNetWorth !== null) previousTotal += previousNetWorth
    else previousTotal = null
    report.profiles.push({ id: profile.id, name: profile.name, netWorth: wealth.netWorth, comparableNetWorth: comparable, previousNetWorth })
  }

  report.previousNetWorth = report.profiles.length ? previousTotal : null
  return report
}
