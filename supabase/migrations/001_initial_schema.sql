-- ============================================================
-- Household Finance App — Initial Schema
-- ============================================================
-- Run this in the Supabase SQL Editor after creating your project.
-- This creates all tables, types, RLS policies, and triggers.
-- ============================================================

-- ==================== ENUMS ====================

CREATE TYPE account_type AS ENUM (
  'cash', 'credit', 'retirement',
  'investment', '529', 'other'
);

CREATE TYPE item_frequency AS ENUM (
  'monthly', 'quarterly', 'yearly', 'one_time'
);

CREATE TYPE item_category AS ENUM (
  'housing', 'utilities', 'car', 'food',
  'subscriptions', 'misc', 'business',
  'taxes', 'savings', 'income'
);

CREATE TYPE income_type AS ENUM (
  'w2', '1099', 'untaxed'
);

-- ==================== TABLES ====================

-- Top-level container. Every piece of data belongs to a household.
CREATE TABLE households (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name                 text NOT NULL,
  auto_sync_budget     boolean DEFAULT false,
  estimated_tax_rate   numeric(5,2) DEFAULT 25,
  created_at           timestamptz DEFAULT now()
);

-- Links a Supabase Auth user to a household.
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  household_id uuid REFERENCES households(id),
  display_name text,
  created_at   timestamptz DEFAULT now()
);

-- Financial accounts tracked on the dashboard.
CREATE TABLE accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES households(id) NOT NULL,
  name         text NOT NULL,
  type         account_type NOT NULL,
  balance      numeric(12,2) DEFAULT 0,
  updated_at   timestamptz DEFAULT now(),
  notes        text,
  sort_order   int DEFAULT 0
);

-- Recurring line items — source of truth for projected amounts.
CREATE TABLE budget_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   uuid REFERENCES households(id) NOT NULL,
  name           text NOT NULL,
  category       item_category NOT NULL,
  monthly_amount numeric(12,2) NOT NULL,
  frequency      item_frequency DEFAULT 'monthly',
  months_active  int[] DEFAULT '{1,2,3,4,5,6,7,8,9,10,11,12}',
  is_income      boolean DEFAULT false,
  cc_paid        boolean DEFAULT false,
  active         boolean DEFAULT true,
  sort_order     int DEFAULT 0
);

-- One row per budget_item per month per year.
-- Ad-hoc entries have budget_item_id = NULL and use their own name/category.
CREATE TABLE cashflow_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     uuid REFERENCES households(id) NOT NULL,
  budget_item_id   uuid REFERENCES budget_items(id),
  year             int NOT NULL,
  month            int NOT NULL CHECK (month BETWEEN 1 AND 12),
  projected_amount numeric(12,2) NOT NULL,
  actual_amount    numeric(12,2),
  is_paid          boolean DEFAULT false,
  paid_date        timestamptz,
  notes            text,
  name             text,
  category         item_category,
  UNIQUE (budget_item_id, year, month)
);

-- Income sources — each income stream with type classification.
CREATE TABLE income_sources (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   uuid REFERENCES households(id) NOT NULL,
  name           text NOT NULL,
  income_type    income_type NOT NULL,
  monthly_target numeric(12,2) DEFAULT 0,
  active         boolean DEFAULT true,
  sort_order     int DEFAULT 0
);

-- Individual invoices/payments under an income source.
CREATE TABLE income_payments (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     uuid REFERENCES households(id) NOT NULL,
  income_source_id uuid REFERENCES income_sources(id) NOT NULL,
  description      text NOT NULL,
  amount           numeric(12,2) NOT NULL,
  year             int NOT NULL,
  month            int NOT NULL CHECK (month BETWEEN 1 AND 12),
  received         boolean DEFAULT false,
  received_date    timestamptz,
  notes            text
);

-- Phase 2 stub — Plaid transaction feed.
CREATE TABLE transactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         uuid REFERENCES households(id) NOT NULL,
  plaid_transaction_id text UNIQUE,
  account_id           uuid REFERENCES accounts(id),
  amount               numeric(12,2),
  date                 date,
  description          text,
  category             text,
  matched_entry_id     uuid REFERENCES cashflow_entries(id),
  created_at           timestamptz DEFAULT now()
);

-- ==================== ROW LEVEL SECURITY ====================

ALTER TABLE households ENABLE ROW LEVEL SECURITY;
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE budget_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE cashflow_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE income_payments ENABLE ROW LEVEL SECURITY;
ALTER TABLE transactions ENABLE ROW LEVEL SECURITY;

-- Profiles: users can read/write their own profile
CREATE POLICY "users can read own profile"
  ON profiles FOR SELECT
  USING (id = auth.uid());

CREATE POLICY "users can update own profile"
  ON profiles FOR UPDATE
  USING (id = auth.uid());

CREATE POLICY "users can insert own profile"
  ON profiles FOR INSERT
  WITH CHECK (id = auth.uid());

-- Households: members can read their household
CREATE POLICY "household members can read"
  ON households FOR SELECT
  USING (
    id = (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

CREATE POLICY "household members can update"
  ON households FOR UPDATE
  USING (
    id = (SELECT household_id FROM profiles WHERE id = auth.uid())
  );

-- Anyone authenticated can create a household (for onboarding)
CREATE POLICY "authenticated users can create households"
  ON households FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- Helper function for household membership check
CREATE OR REPLACE FUNCTION user_household_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT household_id FROM profiles WHERE id = auth.uid();
$$;

-- Accounts
CREATE POLICY "household members can read accounts"
  ON accounts FOR SELECT
  USING (household_id = user_household_id());

CREATE POLICY "household members can manage accounts"
  ON accounts FOR ALL
  USING (household_id = user_household_id());

-- Budget Items
CREATE POLICY "household members can read budget_items"
  ON budget_items FOR SELECT
  USING (household_id = user_household_id());

CREATE POLICY "household members can manage budget_items"
  ON budget_items FOR ALL
  USING (household_id = user_household_id());

-- Cashflow Entries
CREATE POLICY "household members can read cashflow_entries"
  ON cashflow_entries FOR SELECT
  USING (household_id = user_household_id());

CREATE POLICY "household members can manage cashflow_entries"
  ON cashflow_entries FOR ALL
  USING (household_id = user_household_id());

-- Income Sources
CREATE POLICY "household members can read income_sources"
  ON income_sources FOR SELECT
  USING (household_id = user_household_id());

CREATE POLICY "household members can manage income_sources"
  ON income_sources FOR ALL
  USING (household_id = user_household_id());

-- Income Payments
CREATE POLICY "household members can read income_payments"
  ON income_payments FOR SELECT
  USING (household_id = user_household_id());

CREATE POLICY "household members can manage income_payments"
  ON income_payments FOR ALL
  USING (household_id = user_household_id());

-- Transactions (Phase 2)
CREATE POLICY "household members can read transactions"
  ON transactions FOR SELECT
  USING (household_id = user_household_id());

CREATE POLICY "household members can manage transactions"
  ON transactions FOR ALL
  USING (household_id = user_household_id());

-- ==================== TRIGGERS ====================

-- Auto-create a profile row when a new user signs up
CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, display_name)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'display_name', NEW.email)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ==================== INDEXES ====================

CREATE INDEX idx_accounts_household ON accounts(household_id);
CREATE INDEX idx_budget_items_household ON budget_items(household_id);
CREATE INDEX idx_cashflow_entries_household_year_month ON cashflow_entries(household_id, year, month);
CREATE INDEX idx_cashflow_entries_budget_item ON cashflow_entries(budget_item_id);
CREATE INDEX idx_income_sources_household ON income_sources(household_id);
CREATE INDEX idx_income_payments_household_year_month ON income_payments(household_id, year, month);
CREATE INDEX idx_income_payments_source ON income_payments(income_source_id);
CREATE INDEX idx_transactions_household ON transactions(household_id);
