"use client"

import { useState } from "react"
import { useUser } from "@/hooks/use-auth"
import { useProfile } from "@/hooks/use-profile"
import { fetchTable } from "@/lib/offline"
import { accountLedger, isAccountMovement, isCreditCard, withoutAccountMovements } from "@/lib/finance/accounts"
import { todayLocalISO } from "@/lib/utils"
import { ACCOUNT_MOVEMENT_CATEGORIES, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { downloadStatementPdf, type StatementRow } from "@/lib/statement/pdf"
import { CustomSelect } from "@/components/custom-select"
import type { Account, Transaction } from "@/lib/types"
import { X, Download, Loader2 } from "lucide-react"

// Download a bank-style PDF statement for a duration: whole profile or one
// account (with running balance), with a category analysis at the end. Used
// from the Transactions page and from each Cash & Bank account card.

type RangePreset = "this_week" | "this_month" | "last_month" | "all" | "custom"

const PRESETS: { id: RangePreset; label: string }[] = [
  { id: "this_week", label: "This week" },
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "all", label: "All time" },
  { id: "custom", label: "Custom dates" },
]

// Transfer/adjustment legs appear in ledgers too, so they need labels.
const CATEGORY_LABELS: Record<string, string> = Object.fromEntries(
  [...EXPENSE_CATEGORIES, ...INCOME_CATEGORIES, ...ACCOUNT_MOVEMENT_CATEGORIES].map((c) => [c.id, c.label])
)

function presetRange(preset: RangePreset): { from: string; to: string } {
  const today = todayLocalISO()
  const now = new Date(`${today}T00:00:00`)
  const iso = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
  if (preset === "this_week") {
    const start = new Date(now)
    // Week starts Monday.
    start.setDate(now.getDate() - ((now.getDay() + 6) % 7))
    return { from: iso(start), to: today }
  }
  if (preset === "this_month") return { from: `${today.slice(0, 7)}-01`, to: today }
  if (preset === "last_month") {
    const first = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    const last = new Date(now.getFullYear(), now.getMonth(), 0)
    return { from: iso(first), to: iso(last) }
  }
  return { from: "0000-01-01", to: today }
}

/** Category-wise income/expense. Transfers and adjustments are not real
 *  cashflow, so they are skipped — the same rule as every on-screen breakdown. */
function categorySummaryOf(
  txs: Array<Pick<Transaction, "type" | "category" | "amount">>
): Array<{ category: string; income: number; expense: number }> {
  const map = new Map<string, { income: number; expense: number }>()
  for (const t of txs) {
    if (isAccountMovement(t)) continue
    const key = CATEGORY_LABELS[t.category] || t.category
    const entry = map.get(key) ?? { income: 0, expense: 0 }
    if (t.type === "income") entry.income += Number(t.amount)
    else entry.expense += Number(t.amount)
    map.set(key, entry)
  }
  return [...map.entries()]
    .map(([category, v]) => ({ category, ...v }))
    .sort((a, b) => b.expense + b.income - (a.expense + a.income))
}

interface Props {
  onClose: () => void
  accounts: Account[]
  /** Preselect one account ("" = whole profile). */
  initialAccountId?: string
}

export function StatementModal({ onClose, accounts, initialAccountId }: Props) {
  const { user } = useUser()
  const { activeProfile } = useProfile()
  const [accountId, setAccountId] = useState(initialAccountId ?? "")
  const [preset, setPreset] = useState<RangePreset>("this_month")
  const [customFrom, setCustomFrom] = useState("")
  const [customTo, setCustomTo] = useState(todayLocalISO())
  const [error, setError] = useState("")
  const [working, setWorking] = useState(false)

  async function download() {
    if (!user || !activeProfile) return
    let from: string, to: string
    if (preset === "custom") {
      if (!customFrom || !customTo || customFrom > customTo) {
        setError("Pick a valid from/to range.")
        return
      }
      from = customFrom
      to = customTo
    } else {
      ;({ from, to } = presetRange(preset))
    }
    setError("")
    setWorking(true)
    try {
      const allTx = (await fetchTable<Transaction>("transactions", user.id)).filter(
        (t) => t.profile_id === activeProfile.id
      )
      const fmt = (d: string) =>
        new Date(`${d}T00:00:00`).toLocaleDateString("en-IN", {
          day: "numeric",
          month: "short",
          year: "numeric",
        })
      const inRangeAll = allTx
        .filter((t) => t.date >= from && t.date <= to)
        .sort((a, b) => a.date.localeCompare(b.date))
      const periodLabel = `${fmt(preset === "all" ? (inRangeAll[0]?.date ?? to) : from)} – ${fmt(to)}`
      const account = accountId ? accounts.find((a) => a.id === accountId) : undefined
      const stamp = to.replaceAll("-", "")

      if (account) {
        // Account scope: full ledger for correct running balances, then trim
        // to the period; opening balance = balance just before the period.
        const ledger = accountLedger(account, allTx).slice().reverse() // oldest first
        const before = ledger.filter((r) => r.transaction.date < from)
        const inRange = ledger.filter(
          (r) => r.transaction.date >= from && r.transaction.date <= to
        )
        const opening =
          before.length > 0 ? before[before.length - 1].balanceAfter : Number(account.opening_balance)
        const closing = inRange.length > 0 ? inRange[inRange.length - 1].balanceAfter : opening
        const rows: StatementRow[] = inRange.map(({ transaction: t, balanceAfter }) => ({
          date: t.date,
          description: t.description || CATEGORY_LABELS[t.category] || t.category,
          debit: t.type === "expense" ? Number(t.amount) : undefined,
          credit: t.type === "income" ? Number(t.amount) : undefined,
          balance: balanceAfter,
        }))
        // Money in/out here include transfer legs on purpose: they must
        // reconcile opening → closing. Only the category analysis skips them.
        const card = isCreditCard(account)
        downloadStatementPdf({
          heading: `${account.name} — ${card ? "Card" : "Account"} Statement`,
          profileName: activeProfile.name,
          periodLabel,
          rows,
          card,
          openingBalance: opening,
          closingBalance: closing,
          totalIn: rows.reduce((s, r) => s + (r.credit ?? 0), 0),
          totalOut: rows.reduce((s, r) => s + (r.debit ?? 0), 0),
          categorySummary: categorySummaryOf(inRange.map((r) => r.transaction)),
          fileName: `FinBoom-${account.name.replace(/\s+/g, "-")}-statement-${stamp}.pdf`,
        })
      } else {
        const rows: StatementRow[] = inRangeAll.map((t) => ({
          date: t.date,
          description: t.description || CATEGORY_LABELS[t.category] || t.category,
          category: CATEGORY_LABELS[t.category] || t.category,
          debit: t.type === "expense" ? Number(t.amount) : undefined,
          credit: t.type === "income" ? Number(t.amount) : undefined,
        }))
        // Transfer/adjustment legs stay in the listing but are not income or
        // expense, so the totals match the Transactions page for the period.
        const cashflow = withoutAccountMovements(inRangeAll)
        downloadStatementPdf({
          heading: "Transactions Statement",
          profileName: activeProfile.name,
          periodLabel,
          rows,
          totalIn: cashflow.reduce((s, t) => s + (t.type === "income" ? Number(t.amount) : 0), 0),
          totalOut: cashflow.reduce((s, t) => s + (t.type === "expense" ? Number(t.amount) : 0), 0),
          categorySummary: categorySummaryOf(inRangeAll),
          fileName: `FinBoom-transactions-statement-${stamp}.pdf`,
        })
      }
      onClose()
    } catch {
      setError("Could not generate the statement. Please try again.")
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 z-60 flex items-end sm:items-center justify-center">
      <button aria-label="Close" className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full sm:max-w-sm glass-elevated rounded-t-3xl sm:rounded-2xl shadow-xl">
        <div className="flex items-center justify-between p-5 border-b border-black/[0.04] dark:border-white/[0.06]">
          <h2 className="text-lg font-bold text-[#1d1d1f] dark:text-white">Download Statement</h2>
          <button onClick={onClose} aria-label="Close" className="p-2 rounded-full hover:bg-black/5 dark:hover:bg-white/10 transition-all">
            <X className="w-5 h-5 text-[#86868b]" />
          </button>
        </div>

        <div className="p-5 pb-8 sm:pb-5 space-y-4">
          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Account</label>
            <CustomSelect
              value={accountId}
              onChange={setAccountId}
              options={[
                { value: "", label: "All transactions" },
                ...accounts.map((a) => ({ value: a.id, label: isCreditCard(a) ? `${a.name} (card)` : a.name })),
              ]}
              className="mt-1"
              variant="glass"
            />
          </div>

          <div>
            <label className="text-sm font-medium text-[#1d1d1f] dark:text-[#98989d]">Duration</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {PRESETS.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPreset(p.id)}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                    preset === p.id
                      ? "bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f]"
                      : "bg-black/[0.04] dark:bg-white/[0.06] text-[#6e6e73] dark:text-[#98989d] hover:bg-black/[0.08] dark:hover:bg-white/[0.1]"
                  }`}
                >
                  {p.label}
                </button>
              ))}
            </div>
          </div>

          {preset === "custom" && (
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-[#86868b]">From</label>
                <input
                  type="date"
                  value={customFrom}
                  max={customTo}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm text-[#1d1d1f] dark:text-white outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
              <div>
                <label className="text-xs text-[#86868b]">To</label>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="mt-1 w-full px-3 py-2.5 rounded-xl bg-white/60 dark:bg-white/[0.06] border border-black/10 dark:border-white/10 text-sm text-[#1d1d1f] dark:text-white outline-none focus:ring-2 focus:ring-accent/40"
                />
              </div>
            </div>
          )}

          {error && <p className="text-xs text-red-600 dark:text-red-400">{error}</p>}

          <button
            onClick={download}
            disabled={working}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-[#1d1d1f] dark:bg-white text-white dark:text-[#1d1d1f] font-medium hover:opacity-90 transition-all disabled:opacity-50"
          >
            {working ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            Download PDF
          </button>
        </div>
      </div>
    </div>
  )
}
