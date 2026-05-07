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
  created_at: string
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
