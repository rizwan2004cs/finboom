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
export function accountBalance(
  account: Pick<Account, "id" | "opening_balance" | "opening_date">,
  transactions: Pick<Transaction, "account_id" | "type" | "amount" | "date">[],
): number {
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

/* ------------------------------------------------------------------------ */
/* Credit cards                                                              */
/* ------------------------------------------------------------------------ */

export function isCreditCard(account: Pick<Account, "type">): boolean {
  return account.type === "credit_card"
}

/** Money you actually hold: cash + bank accounts, cards excluded. */
export function cashAndBankAccounts<T extends Pick<Account, "type">>(accounts: T[]): T[] {
  return accounts.filter((a) => !isCreditCard(a))
}

/** Amount owed on a card — the negative of its ledger balance (0 when the
 *  card is in credit or fully paid). */
export function cardOutstanding(balance: number): number {
  return balance < 0 ? -balance : 0
}

/** Remaining credit, or null when the card has no limit recorded. */
export function cardAvailable(account: Pick<Account, "credit_limit">, balance: number): number | null {
  const limit = Number(account.credit_limit)
  if (!account.credit_limit || !Number.isFinite(limit) || limit <= 0) return null
  return Math.max(0, limit + balance)
}

function toISODate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`
}

/** Next bill due date (ISO) on or after `today`, clamped to month length. */
export function nextBillDueDate(
  account: Pick<Account, "bill_due_day">,
  today: Date = new Date(),
): string | null {
  const day = Number(account.bill_due_day)
  if (!account.bill_due_day || !Number.isFinite(day) || day < 1 || day > 31) return null
  const y = today.getFullYear()
  const m = today.getMonth()
  const clamp = (year: number, month: number) =>
    new Date(year, month, Math.min(day, new Date(year, month + 1, 0).getDate()))
  const thisMonth = clamp(y, m)
  const todayMidnight = new Date(y, m, today.getDate())
  return toISODate(thisMonth >= todayMidnight ? thisMonth : clamp(y, m + 1))
}

/** Whole days from `today` to an ISO date (negative when in the past). */
export function daysUntil(iso: string, today: Date = new Date()): number {
  const target = new Date(`${iso}T00:00:00`)
  const base = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  return Math.round((target.getTime() - base.getTime()) / 86_400_000)
}

export interface CardSummary {
  account: Account
  balance: number
  outstanding: number
  available: number | null
  dueDate: string | null
  daysToDue: number | null
}

/** Per-card dues and due dates, plus the total owed across cards. */
export function summarizeCards(
  accounts: Account[],
  transactions: Transaction[],
  today: Date = new Date(),
): { cards: CardSummary[]; totalOutstanding: number; nextDue: CardSummary | null } {
  const cards = accounts.filter(isCreditCard).map((account) => {
    const balance = accountBalance(account, transactions)
    const dueDate = nextBillDueDate(account, today)
    return {
      account,
      balance,
      outstanding: cardOutstanding(balance),
      available: cardAvailable(account, balance),
      dueDate,
      daysToDue: dueDate ? daysUntil(dueDate, today) : null,
    }
  })
  const totalOutstanding = cards.reduce((s, c) => s + c.outstanding, 0)
  const withDues = cards.filter((c) => c.outstanding > 0 && c.dueDate)
  const nextDue = withDues.length
    ? withDues.reduce((a, b) => ((a.dueDate as string) <= (b.dueDate as string) ? a : b))
    : null
  return { cards, totalOutstanding, nextDue }
}

/** Why an expense of `spend` can't be tagged to `account` at `balance`, or
 *  null when it can. Cash/bank can't go below zero; a card can't go past its
 *  credit limit (no limit recorded = unlimited). */
export function spendGuardError(
  account: Pick<Account, "name" | "type" | "credit_limit">,
  balance: number,
  spend: number,
): string | null {
  const fmt = (n: number) => `₹${n.toLocaleString("en-IN")}`
  if (isCreditCard(account)) {
    const available = cardAvailable(account, balance)
    if (available !== null && spend > available) {
      return `${account.name} has only ${fmt(available)} credit left of its ${fmt(Number(account.credit_limit))} limit — this would exceed it. Pick another account or "Not tracked".`
    }
    return null
  }
  if (balance < spend) {
    return `${account.name} has only ${fmt(balance)} — this would overdraw it. Pick another account or "Not tracked".`
  }
  return null
}

/** Dues on a card that were incurred before it was tracked (its opening
 *  outstanding) and have not yet been cleared by bill payments. Payments are
 *  applied to these oldest dues first. Those spends were never logged as
 *  expenses, so the payment that clears them is the expense. */
export function untrackedCardDues(
  card: Pick<Account, "id" | "type" | "opening_balance" | "opening_date">,
  transactions: Pick<Transaction, "account_id" | "type" | "date" | "amount" | "category">[],
): number {
  if (!isCreditCard(card)) return 0
  const opening = Math.max(0, -Number(card.opening_balance))
  if (opening === 0) return 0
  const paid = transactions
    .filter(
      (t) =>
        t.account_id === card.id &&
        t.type === "income" &&
        t.category === TRANSFER_CATEGORY &&
        t.date >= card.opening_date,
    )
    .reduce((sum, t) => sum + Number(t.amount), 0)
  return Math.max(0, opening - paid)
}
