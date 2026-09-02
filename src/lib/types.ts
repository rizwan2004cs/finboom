export interface Asset {
  id: string
  user_id: string
  profile_id: string
  name: string
  asset_class: string
  current_value: number
  invested_value: number
  currency: string
  units?: number
  notes?: string
  created_at: string
  updated_at: string
}

export interface Liability {
  id: string
  user_id: string
  profile_id: string
  name: string
  liability_type: string
  outstanding_amount: number
  original_amount: number
  interest_rate: number
  emi_amount?: number
  currency: string
  start_date?: string
  end_date?: string
  notes?: string
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  user_id: string
  profile_id: string
  type: 'income' | 'expense'
  category: string
  amount: number
  currency: string
  description?: string
  date: string
  /** Cash/bank account the money moved through (null = not tracked). */
  account_id?: string | null
  /** Shared id linking the two legs of an account-to-account transfer. */
  transfer_group_id?: string | null
  created_at: string
}

/** A money account under Cash & Bank — the built-in Cash In Hand or a
 *  user-added bank account. Balance is always derived client-side:
 *  opening_balance + Σ income − Σ expense of transactions tagged with it. */
export interface Account {
  id: string
  user_id: string
  profile_id?: string | null
  name: string
  type: "bank" | "cash" | "credit_card"
  /** For credit cards: an outstanding amount is stored as a NEGATIVE opening
   *  balance, so the derived balance stays "money in minus money out". */
  opening_balance: number
  opening_date: string
  /** Credit cards only. */
  credit_limit?: number | null
  /** Credit cards only: day of month the bill is due (1–31). */
  bill_due_day?: number | null
  created_at: string
  updated_at: string
}

export interface Budget {
  id: string
  user_id: string
  profile_id: string
  month: string
  category: string
  amount: number
  created_at: string
  updated_at: string
}

export interface Goal {
  id: string
  user_id: string
  profile_id: string
  name: string
  target_amount: number
  current_amount: number
  currency: string
  target_date: string
  inflation_rate: number
  linked_assets: string[]
  notes?: string
  created_at: string
  updated_at: string
}

export interface Sip {
  id: string
  user_id: string
  profile_id: string
  name: string
  fund_name?: string
  amount: number
  currency: string
  sip_day: number
  active: boolean
  reminder_enabled: boolean
  notes?: string
  created_at: string
  updated_at: string
}

/** Marks a single SIP as paid/fulfilled for a calendar month (YYYY-MM). */
export interface SipPayment {
  id: string
  user_id: string
  sip_id: string
  month: string
  paid_date: string
  amount?: number | null
  transaction_id?: string | null
  /** "skipped" = intentionally not invested this month; no expense row. Defaults to "paid". */
  status?: "paid" | "skipped"
  created_at: string
  updated_at: string
}

/** A feature idea on the personal Feature Board — something the owner wants
 *  to build into the app later. */
export interface FeatureIdea {
  id: string
  user_id: string
  title: string
  description?: string | null
  status: "idea" | "planned" | "done"
  created_at: string
  updated_at: string
}

export interface Snapshot {
  id: string
  user_id: string
  profile_id: string
  total_assets: number
  total_liabilities: number
  net_worth: number
  asset_breakdown: Record<string, number>
  currency: string
  snapshot_date: string
  created_at: string
}

export interface Profile {
  id: string
  user_id: string
  name: string
  type: 'personal' | 'spouse' | 'parent' | 'child' | 'business'
  is_default: boolean
  created_at: string
}

export interface SharedAccess {
  id: string
  profile_id: string
  owner_user_id: string
  shared_with_email: string
  permission: 'view' | 'edit'
  created_at: string
}

export interface HealthCheck {
  has_term_insurance: boolean
  term_insurance_cover: number
  has_health_insurance: boolean
  health_insurance_cover: number
  emergency_fund_months: number
  monthly_expenses: number
}

export interface Party {
  id: string
  user_id: string
  name: string
  phone?: string
  notes?: string
  created_at: string
}

export interface PartyTransaction {
  id: string
  user_id: string
  party_id: string
  type: 'lent' | 'received_back' | 'borrowed' | 'paid_back'
  amount: number
  currency: string
  date: string
  due_date?: string
  notes?: string
  linked_transaction_id?: string
  // For received_back/paid_back: the specific lent/borrowed entry this
  // repayment settles (set by the entry-level Settle button). Unlinked
  // repayments are allocated FIFO across the party's open obligations.
  settles_transaction_id?: string
  created_at: string
  party?: Party
}

export interface AppNotification {
  id: string
  user_id: string
  type: 'overdue_payment' | 'due_approaching' | 'goal_milestone' | 'large_transaction' | 'sip_reminder' | 'budget_exceeded'
  title: string
  body: string
  data: Record<string, unknown>
  read: boolean
  hidden?: boolean
  dedupe_key?: string
  created_at: string
}

export interface PushSubscriptionRecord {
  id: string
  user_id: string
  endpoint: string
  keys_p256dh: string
  keys_auth: string
  created_at: string
}
