// Default money source per profile, UPI-style.
//
// Two layers: an explicit PRIMARY account (starred on the Cash & Bank page)
// always wins; otherwise the LAST-USED account (written by the transaction
// modals and the assistant on every save) fills in. Both live in
// localStorage — same convention the modals already used for last-used.

import type { Account } from "@/lib/types"
import { isCreditCard } from "@/lib/finance/accounts"

export function primaryAccountKey(profileId: string): string {
  return `finboom_primary_account_${profileId}`
}

export function lastAccountKey(profileId: string): string {
  return `finboom_last_account_${profileId}`
}

export function getPrimaryAccountId(profileId: string): string {
  try {
    return localStorage.getItem(primaryAccountKey(profileId)) || ""
  } catch {
    return ""
  }
}

export function setPrimaryAccountId(profileId: string, accountId: string | null): void {
  try {
    if (accountId) localStorage.setItem(primaryAccountKey(profileId), accountId)
    else localStorage.removeItem(primaryAccountKey(profileId))
  } catch {
    /* storage unavailable */
  }
}

export function getLastAccountId(profileId: string): string {
  try {
    return localStorage.getItem(lastAccountKey(profileId)) || ""
  } catch {
    return ""
  }
}

type AccountRef = { id: string; type: Account["type"] }

/** The account a new transaction should default to: primary, else last-used.
 *  When `accounts` is given, candidates must exist in it (a deleted account
 *  can leave a stale id behind). For money coming IN (`direction: "in"`) a
 *  credit card is never a sensible default — the last-used key gets a card
 *  id after any card expense — so cards are skipped. */
export function getPreferredAccountId(
  profileId: string,
  accounts?: AccountRef[],
  direction: "in" | "out" = "out",
): string {
  const candidates = [getPrimaryAccountId(profileId), getLastAccountId(profileId)]
  for (const id of candidates) {
    if (!id) continue
    if (!accounts) return id
    const account = accounts.find((a) => a.id === id)
    if (!account) continue
    if (direction === "in" && isCreditCard(account)) continue
    return id
  }
  return ""
}

/** Drop `accountId` from both keys (call when the account is deleted). */
export function forgetAccountId(profileId: string, accountId: string): void {
  try {
    for (const key of [primaryAccountKey(profileId), lastAccountKey(profileId)]) {
      if (localStorage.getItem(key) === accountId) localStorage.removeItem(key)
    }
  } catch {
    /* storage unavailable */
  }
}
