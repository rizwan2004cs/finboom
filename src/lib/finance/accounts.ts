import type { Account, Transaction } from "@/lib/types"
import { ADJUSTMENT_CATEGORY, TRANSFER_CATEGORY } from "@/lib/constants"

/** True for transactions that only move money between your own accounts
 *  (transfers) or correct an account balance (adjustments). They affect
 *  account balances but are NOT real income or expenses, so every cashflow,
 *  spending, budget, and savings aggregation must skip them. */
export function isAccountMovement(t: Pick<Transaction, "category">): boolean {
  return t.category === TRANSFER_CATEGORY || t.category === ADJUSTMENT_CATEGORY
}

/** Real income/expense transactions only — account movements stripped. */
export function withoutAccountMovements<T extends Pick<Transaction, "category">>(
  transactions: T[],
): T[] {
  return transactions.filter((t) => !isAccountMovement(t))
}

/** +amount for money in, −amount for money out of an account. */
function signedAmount(t: Pick<Transaction, "type" | "amount">): number {
  return t.type === "income" ? Number(t.amount) : -Number(t.amount)
}

/** Live balance of an account: opening balance plus every transaction tagged
 *  with it (regular income/expense, transfer legs, and adjustments alike).
 *  Transactions dated before the opening as-of date are skipped — the opening
 *  balance already reflects them, so applying them again would double-count
 *  (ISO date strings compare lexicographically). */
export function accountBalance(account: Account, transactions: Transaction[]): number {
  let balance = Number(account.opening_balance)
  for (const t of transactions) {
    if (t.account_id !== account.id || t.date < account.opening_date) continue
    balance += signedAmount(t)
  }
  return balance
}

export interface LedgerRow {
  transaction: Transaction
  /** Account balance after this transaction was applied. */
  balanceAfter: number
}

/** Ledger for one account, newest first, with a running balance per row.
 *  Rows are applied oldest→newest (date, then created_at for same-day order)
 *  starting from the opening balance, then reversed for display. */
export function accountLedger(account: Account, transactions: Transaction[]): LedgerRow[] {
  const tagged = transactions
    .filter((t) => t.account_id === account.id && t.date >= account.opening_date)
    .sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1
      const ca = a.created_at || ""
      const cb = b.created_at || ""
      return ca < cb ? -1 : ca > cb ? 1 : 0
    })

  let running = Number(account.opening_balance)
  const rows: LedgerRow[] = tagged.map((t) => {
    running += signedAmount(t)
    return { transaction: t, balanceAfter: running }
  })
  return rows.reverse()
}
