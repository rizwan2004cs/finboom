import type { Account, Asset, Liability, Transaction } from "@/lib/types"
import { accountBalance, cardOutstanding, isCreditCard } from "./accounts"

/** The ONE net worth formula. Every screen, snapshot, cron job and report must
 *  go through here so the number is identical everywhere:
 *
 *    net worth = (investments + cash & bank) − (loans + credit card dues)
 */
export type NetWorthAsset = Pick<Asset, "current_value">
export type NetWorthLiability = Pick<Liability, "outstanding_amount">
export type NetWorthAccount = Pick<Account, "id" | "type" | "opening_balance" | "opening_date">
export type NetWorthTransaction = Pick<Transaction, "account_id" | "type" | "amount" | "date">

export interface NetWorthBreakdown {
  /** Σ current value of tracked investments (assets table). */
  investments: number
  /** Σ live balances of cash + bank accounts. */
  cashAndBank: number
  /** Σ outstanding on loans (liabilities table). */
  loans: number
  /** Σ outstanding on credit cards. */
  cardDues: number
  totalAssets: number
  totalLiabilities: number
  netWorth: number
}

export function computeNetWorth(input: {
  assets: NetWorthAsset[]
  liabilities: NetWorthLiability[]
  accounts?: NetWorthAccount[]
  transactions?: NetWorthTransaction[]
}): NetWorthBreakdown {
  const accounts = input.accounts ?? []
  const transactions = input.transactions ?? []

  const investments = input.assets.reduce((s, a) => s + Number(a.current_value), 0)
  const loans = input.liabilities.reduce((s, l) => s + Number(l.outstanding_amount), 0)

  let cashAndBank = 0
  let cardDues = 0
  for (const account of accounts) {
    const balance = accountBalance(account, transactions)
    if (isCreditCard(account)) cardDues += cardOutstanding(balance)
    else cashAndBank += balance
  }

  const totalAssets = investments + cashAndBank
  const totalLiabilities = loans + cardDues
  return {
    investments,
    cashAndBank,
    loans,
    cardDues,
    totalAssets,
    totalLiabilities,
    netWorth: totalAssets - totalLiabilities,
  }
}

/** Keys stored inside snapshot `asset_breakdown` (prefixed `_` so the asset
 *  split chart ignores them) recording how the snapshot's totals were built. */
export const NET_WORTH_SNAPSHOT_META = {
  cashAndBank: "_cash_and_bank",
  cardDues: "_card_dues",
} as const
