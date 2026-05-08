// Indian Asset Classes
export const ASSET_CLASSES = [
  { id: 'stocks', label: 'Stocks (Indian)', icon: 'TrendingUp' },
  { id: 'mutual_funds', label: 'Mutual Funds', icon: 'PieChart' },
  { id: 'fixed_deposits', label: 'Fixed Deposits', icon: 'Lock' },
  { id: 'ppf', label: 'PPF', icon: 'Shield' },
  { id: 'epf', label: 'EPF / PF', icon: 'ShieldCheck' },
  { id: 'nps', label: 'NPS', icon: 'Landmark' },
  { id: 'ssy', label: 'Sukanya Samriddhi (SSY)', icon: 'Heart' },
  { id: 'sgb', label: 'Sovereign Gold Bonds', icon: 'Award' },
  { id: 'gold', label: 'Physical Gold', icon: 'Gem' },
  { id: 'silver', label: 'Silver', icon: 'CircleDot' },
  { id: 'real_estate', label: 'Real Estate', icon: 'Home' },
  { id: 'crypto', label: 'Cryptocurrency', icon: 'Bitcoin' },
  { id: 'savings_account', label: 'Savings Account', icon: 'Wallet' },
  { id: 'recurring_deposit', label: 'Recurring Deposit', icon: 'RefreshCw' },
  { id: 'bonds', label: 'Bonds / Debentures', icon: 'FileText' },
  { id: 'elss', label: 'ELSS (Tax Saving MF)', icon: 'Receipt' },
  { id: 'ulip', label: 'ULIP', icon: 'Umbrella' },
  { id: 'lic', label: 'LIC / Insurance', icon: 'ShieldPlus' },
  { id: 'us_stocks', label: 'US Stocks', icon: 'Globe' },
  { id: 'international', label: 'International Assets', icon: 'Globe2' },
  { id: 'cash', label: 'Cash', icon: 'Banknote' },
  { id: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const

export type AssetClassId = typeof ASSET_CLASSES[number]['id']

export const LIABILITY_TYPES = [
  { id: 'home_loan', label: 'Home Loan', icon: 'Home' },
  { id: 'car_loan', label: 'Car Loan', icon: 'Car' },
  { id: 'personal_loan', label: 'Personal Loan', icon: 'User' },
  { id: 'education_loan', label: 'Education Loan', icon: 'GraduationCap' },
  { id: 'credit_card', label: 'Credit Card Debt', icon: 'CreditCard' },
  { id: 'gold_loan', label: 'Gold Loan', icon: 'Gem' },
  { id: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const

export type LiabilityTypeId = typeof LIABILITY_TYPES[number]['id']

export const EXPENSE_CATEGORIES = [
  { id: 'rent', label: 'Rent', icon: 'Home' },
  { id: 'groceries', label: 'Groceries', icon: 'ShoppingCart' },
  { id: 'utilities', label: 'Utilities', icon: 'Zap' },
  { id: 'transport', label: 'Transport', icon: 'Car' },
  { id: 'food', label: 'Food & Dining', icon: 'UtensilsCrossed' },
  { id: 'health', label: 'Health & Medical', icon: 'Stethoscope' },
  { id: 'education', label: 'Education', icon: 'GraduationCap' },
  { id: 'entertainment', label: 'Entertainment', icon: 'Film' },
  { id: 'shopping', label: 'Shopping', icon: 'ShoppingBag' },
  { id: 'insurance', label: 'Insurance Premium', icon: 'Shield' },
  { id: 'emi', label: 'EMI', icon: 'CreditCard' },
  { id: 'investment', label: 'Investment', icon: 'TrendingUp' },
  { id: 'subscriptions', label: 'Subscriptions', icon: 'Repeat' },
  { id: 'personal', label: 'Personal Care', icon: 'Sparkles' },
  { id: 'travel', label: 'Travel', icon: 'Plane' },
  { id: 'gifts', label: 'Gifts & Donations', icon: 'Gift' },
  { id: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const

export const INCOME_CATEGORIES = [
  { id: 'salary', label: 'Salary', icon: 'Briefcase' },
  { id: 'freelance', label: 'Freelance', icon: 'Laptop' },
  { id: 'business', label: 'Business Income', icon: 'Building2' },
  { id: 'rental', label: 'Rental Income', icon: 'Home' },
  { id: 'interest', label: 'Interest', icon: 'Percent' },
  { id: 'dividends', label: 'Dividends', icon: 'DollarSign' },
  { id: 'capital_gains', label: 'Capital Gains', icon: 'TrendingUp' },
  { id: 'gift', label: 'Gift / Bonus', icon: 'Gift' },
  { id: 'other', label: 'Other', icon: 'MoreHorizontal' },
] as const

export const PARTY_TRANSACTION_TYPES = [
  { id: 'lent', label: 'I Gave (Lent)', icon: 'ArrowUpRight', description: 'Money you gave to someone' },
  { id: 'received_back', label: 'Received Back', icon: 'ArrowDownLeft', description: 'Money returned to you' },
  { id: 'borrowed', label: 'I Took (Borrowed)', icon: 'ArrowDownRight', description: 'Money you borrowed' },
  { id: 'paid_back', label: 'Paid Back', icon: 'ArrowUpLeft', description: 'Money you returned' },
] as const

export type PartyTransactionTypeId = typeof PARTY_TRANSACTION_TYPES[number]['id']

export const CURRENCIES = [
  { code: 'INR', symbol: '₹', name: 'Indian Rupee' },
  { code: 'USD', symbol: '$', name: 'US Dollar' },
  { code: 'EUR', symbol: '€', name: 'Euro' },
  { code: 'GBP', symbol: '£', name: 'British Pound' },
  { code: 'SGD', symbol: 'S$', name: 'Singapore Dollar' },
  { code: 'AED', symbol: 'د.إ', name: 'UAE Dirham' },
  { code: 'AUD', symbol: 'A$', name: 'Australian Dollar' },
  { code: 'CAD', symbol: 'C$', name: 'Canadian Dollar' },
  { code: 'JPY', symbol: '¥', name: 'Japanese Yen' },
  { code: 'CHF', symbol: 'Fr', name: 'Swiss Franc' },
] as const
