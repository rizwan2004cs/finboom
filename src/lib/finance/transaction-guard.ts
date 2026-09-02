import type { Account, Transaction } from "@/lib/types"
import { CREDIT_CARD_BILL_CATEGORY, EXPENSE_CATEGORIES, INCOME_CATEGORIES } from "@/lib/constants"
import { isValidISODate, todayLocalISO } from "@/lib/utils"
import { accountBalance, spendGuardError } from "./accounts"

/* Shared validation for writing a regular income/expense transaction. Every
 * surface that creates or edits one (transaction modal, party modal, assistant
 * actions, API routes) must run the same checks so they agree on what is
 * allowed. Pure functions — safe to import from server code. */

export const FUTURE_DATE_ERROR = "Pick a valid date — it cannot be in the future."

/** Why `date` can't be used for a transaction (optionally tagged to
 *  `account`), or null when it can. Rejects malformed/future dates and dates
 *  before the account's opening as-of date — those would be silently ignored
 *  by the account balance. ISO date strings compare lexicographically. */
export function transactionDateError(
  date: string,
  account?: Pick<Account, "name" | "opening_date"> | null,
  today: string = todayLocalISO(),
): string | null {
  if (!isValidISODate(date) || date > today) return FUTURE_DATE_ERROR
  if (account && date < account.opening_date) {
    return `${account.name} tracks its balance from ${account.opening_date} — pick a later date or "Not tracked".`
  }
  return null
}

/** Overdraft / credit-limit guard for spending `amountInr` from `account`.
 *  Pass `excludeTxId` when editing so the row's own old contribution to the
 *  balance is not counted against the new amount. Returns the user-facing
 *  reason, or null when the spend is allowed. */
export function spendGuardFor(
  account: Pick<Account, "id" | "name" | "type" | "opening_balance" | "opening_date" | "credit_limit">,
  allTransactions: Pick<Transaction, "id" | "account_id" | "type" | "amount" | "date">[],
  amountInr: number,
  excludeTxId?: string | null,
): string | null {
  const others = excludeTxId
    ? allTransactions.filter((t) => t.id !== excludeTxId)
    : allTransactions
  const balance = accountBalance(account, others)
  const spend = Math.round(Number(amountInr) * 100) / 100
  return spendGuardError(account, balance, spend)
}

const INCOME_IDS: ReadonlySet<string> = new Set(INCOME_CATEGORIES.map((c) => c.id))
// Card bill payments are recorded from Accounts → Transfer, never as a plain
// expense, so the picker id is excluded here alongside transfer/adjustment.
const EXPENSE_IDS: ReadonlySet<string> = new Set(
  EXPENSE_CATEGORIES.map((c) => c.id).filter((id) => id !== CREDIT_CARD_BILL_CATEGORY),
)

/** True when `category` is a pickable category for a `type` transaction.
 *  Transfer, adjustment and credit_card_bill are never valid here. */
export function isValidCategoryFor(type: Transaction["type"], category: string): boolean {
  if (type === "income") return INCOME_IDS.has(category)
  if (type === "expense") return EXPENSE_IDS.has(category)
  return false
}
