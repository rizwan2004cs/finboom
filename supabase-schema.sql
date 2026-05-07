-- FinBoom Database Schema
-- Run this in your Supabase SQL Editor

-- Profiles table (family/business profiles)
CREATE TABLE IF NOT EXISTS profiles (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL DEFAULT 'personal' CHECK (type IN ('personal', 'spouse', 'parent', 'child', 'business')),
  is_default BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Assets table
CREATE TABLE IF NOT EXISTS assets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  asset_class TEXT NOT NULL,
  current_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  invested_value DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  units DECIMAL(15,4),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Liabilities table
CREATE TABLE IF NOT EXISTS liabilities (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  liability_type TEXT NOT NULL,
  outstanding_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  original_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  interest_rate DECIMAL(5,2) DEFAULT 0,
  emi_amount DECIMAL(15,2),
  currency TEXT NOT NULL DEFAULT 'INR',
  start_date DATE,
  end_date DATE,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Transactions (income & expenses)
CREATE TABLE IF NOT EXISTS transactions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  category TEXT NOT NULL,
  amount DECIMAL(15,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'INR',
  description TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Goals
CREATE TABLE IF NOT EXISTS goals (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  target_amount DECIMAL(15,2) NOT NULL,
  current_amount DECIMAL(15,2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  target_date DATE NOT NULL,
  inflation_rate DECIMAL(5,2) DEFAULT 6.0,
  linked_assets UUID[] DEFAULT '{}',
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Net Worth Snapshots
CREATE TABLE IF NOT EXISTS snapshots (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  total_assets DECIMAL(15,2) NOT NULL DEFAULT 0,
  total_liabilities DECIMAL(15,2) NOT NULL DEFAULT 0,
  net_worth DECIMAL(15,2) NOT NULL DEFAULT 0,
  asset_breakdown JSONB DEFAULT '{}',
  currency TEXT NOT NULL DEFAULT 'INR',
  snapshot_date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Shared Access
CREATE TABLE IF NOT EXISTS shared_access (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  owner_user_id TEXT NOT NULL,
  shared_with_email TEXT NOT NULL,
  permission TEXT NOT NULL DEFAULT 'view' CHECK (permission IN ('view', 'edit')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Health Check data
CREATE TABLE IF NOT EXISTS health_checks (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id TEXT NOT NULL,
  profile_id UUID REFERENCES profiles(id) ON DELETE CASCADE,
  has_term_insurance BOOLEAN DEFAULT false,
  term_insurance_cover DECIMAL(15,2) DEFAULT 0,
  has_health_insurance BOOLEAN DEFAULT false,
  health_insurance_cover DECIMAL(15,2) DEFAULT 0,
  emergency_fund_months DECIMAL(4,1) DEFAULT 0,
  monthly_expenses DECIMAL(15,2) DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Row Level Security (RLS) Policies
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE assets ENABLE ROW LEVEL SECURITY;
ALTER TABLE liabilities ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE shared_access ENABLE ROW LEVEL SECURITY;
ALTER TABLE health_checks ENABLE ROW LEVEL SECURITY;

-- Policies - users can only access their own data
CREATE POLICY "Users can manage own profiles" ON profiles FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY "Users can manage own assets" ON assets FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY "Users can manage own liabilities" ON liabilities FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY "Users can manage own transactions" ON transactions FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY "Users can manage own goals" ON goals FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY "Users can manage own snapshots" ON snapshots FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY "Users can manage own shared_access" ON shared_access FOR ALL USING (owner_user_id = current_setting('request.jwt.claims')::json->>'sub');
CREATE POLICY "Users can manage own health_checks" ON health_checks FOR ALL USING (user_id = current_setting('request.jwt.claims')::json->>'sub');

-- Indexes for performance
CREATE INDEX idx_assets_user_id ON assets(user_id);
CREATE INDEX idx_assets_profile_id ON assets(profile_id);
CREATE INDEX idx_liabilities_user_id ON liabilities(user_id);
CREATE INDEX idx_transactions_user_id ON transactions(user_id);
CREATE INDEX idx_transactions_date ON transactions(date);
CREATE INDEX idx_goals_user_id ON goals(user_id);
CREATE INDEX idx_snapshots_user_id ON snapshots(user_id);
CREATE INDEX idx_snapshots_date ON snapshots(snapshot_date);
