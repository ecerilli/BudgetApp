# Household Finance App — Product Specification
**Version:** 1.0 | **Date:** March 2026 | **Status:** Ready for Development

---

## Stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | React + Vite | Fast dev server, modern tooling |
| Styling | Tailwind CSS | Utility-first, consistent design tokens |
| Database | Supabase (Postgres) | Relational model, real-time subscriptions |
| Auth | Supabase Auth | Magic link login — no passwords needed |
| Hosting | Vercel | Auto-deploy on push to main branch |
| Version Control | GitHub | `main` = prod, `dev` = staging with preview URLs |
| Plaid (Phase 2) | Plaid API | Balance sync + transaction feed |

---

## Overview

A personal household finance tracking app for two users, migrated from a Google Sheets workflow. The app replicates and improves on three core views: a financial snapshot dashboard, a monthly cash flow tracker, and a budget management screen.

The defining UX mechanic from the spreadsheet is preserved: line items remain visible after they are paid, but are visually dimmed and excluded from running totals. This replaces the current Google Apps Script color-based approach with a proper `is_paid` boolean on each entry.

Phase 1 is fully manual — all balances and transactions are entered by the user. Phase 2 introduces Plaid to auto-update account balances and pull transaction feeds for reconciliation.

---

## Database Schema

All tables are scoped to `household_id`. Row Level Security (RLS) must be enabled on all tables — policies should allow authenticated users to read and write only rows belonging to their household.

### `households`
Top-level container. Every piece of data belongs to a household.

```sql
CREATE TABLE households (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name       text NOT NULL,
  created_at timestamptz DEFAULT now()
);
```

### `profiles`
Links a Supabase Auth user to a household. Created automatically on first sign-in via a database trigger.

```sql
CREATE TABLE profiles (
  id           uuid PRIMARY KEY REFERENCES auth.users(id),
  household_id uuid REFERENCES households(id),
  display_name text,
  created_at   timestamptz DEFAULT now()
);
```

### `accounts`
Every financial account tracked on the Summary dashboard. Balances are manually updated; `updated_at` is stored for display.

```sql
CREATE TYPE account_type AS ENUM (
  'cash', 'credit', 'retirement',
  'investment', '529', 'other'
);

CREATE TABLE accounts (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id uuid REFERENCES households(id),
  name         text NOT NULL,
  type         account_type NOT NULL,
  balance      numeric(12,2) DEFAULT 0,
  updated_at   timestamptz DEFAULT now(),
  notes        text,
  sort_order   int DEFAULT 0
);
```

### `budget_items`
Recurring line items — the source of truth for projected amounts. Maps to the Monthly Budget sheet. The `months_active` array controls which months an entry is generated for (e.g. `[6]` for a June-only expense, `[3,6,9,12]` for quarterly).

```sql
CREATE TYPE item_frequency AS ENUM (
  'monthly', 'quarterly', 'yearly', 'one_time'
);

CREATE TYPE item_category AS ENUM (
  'housing', 'utilities', 'car', 'food',
  'subscriptions', 'misc', 'business',
  'taxes', 'savings', 'income'
);

CREATE TABLE budget_items (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id   uuid REFERENCES households(id),
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
```

### `cashflow_entries`
One row per `budget_item` per month per year. Auto-generated from `budget_items` at the start of each year. This is where the paid mechanic lives — `is_paid` dims the row and excludes it from totals. `projected_amount` is seeded from the budget item but can be overridden per-month.

```sql
CREATE TABLE cashflow_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     uuid REFERENCES households(id),
  budget_item_id   uuid REFERENCES budget_items(id),
  year             int NOT NULL,
  month            int NOT NULL CHECK (month BETWEEN 1 AND 12),
  projected_amount numeric(12,2) NOT NULL,
  actual_amount    numeric(12,2),
  is_paid          boolean DEFAULT false,
  paid_date        timestamptz,
  notes            text,
  UNIQUE (budget_item_id, year, month)
);
```

### `income_entries`
Tracks income sources per month — salary, freelance, business revenue. Separate from `cashflow_entries` because income has different display logic and will eventually map to Plaid deposits differently than expenses.

```sql
CREATE TABLE income_entries (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id     uuid REFERENCES households(id),
  source_name      text NOT NULL,
  year             int NOT NULL,
  month            int NOT NULL,
  projected_amount numeric(12,2),
  actual_amount    numeric(12,2),
  received         boolean DEFAULT false,
  received_date    timestamptz,
  notes            text
);
```

### `transactions` — Phase 2 stub
Raw Plaid transaction feed. `matched_entry_id` links a transaction to a `cashflow_entry` once reconciled. Create the table now so the schema is ready; leave it empty until Plaid is integrated.

```sql
CREATE TABLE transactions (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id         uuid REFERENCES households(id),
  plaid_transaction_id text UNIQUE,
  account_id           uuid REFERENCES accounts(id),
  amount               numeric(12,2),
  date                 date,
  description          text,
  category             text,
  matched_entry_id     uuid REFERENCES cashflow_entries(id),
  created_at           timestamptz DEFAULT now()
);
```

### RLS Policies
Apply this pattern to every table. Replace `accounts` with each table name.

```sql
ALTER TABLE accounts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "household members can read"
  ON accounts FOR SELECT
  USING (
    household_id = (
      SELECT household_id FROM profiles
      WHERE id = auth.uid()
    )
  );

CREATE POLICY "household members can write"
  ON accounts FOR ALL
  USING (
    household_id = (
      SELECT household_id FROM profiles
      WHERE id = auth.uid()
    )
  );
```

---

## Application Views

### Dashboard (Summary)
The homepage. Mirrors the Summary sheet.

| Section | Content | Behavior |
|---|---|---|
| Cash Snapshot | Total cash, CC balance, net cash | Computed from accounts table |
| Account Balances | All cash accounts with balance + last updated | Tap to edit balance inline |
| Credit Cards | All CC balances with due dates | Tap to edit balance inline |
| Retirement & Investments | IRA, 401k, HSA, crypto, 529s | Tap to edit balance inline |
| Net Worth | Sum of all asset categories less CC debt | Auto-calculated, read-only |
| Income Tracker | Freelance/project invoices with status | Add, edit, mark received |
| Tax Installments | Quarterly tax payments with due dates | Mark paid, shows remaining |

### Cash Flow — Monthly View
The primary day-to-day screen. Mirrors the Projected Cash Flow sheet.

- **Month navigation** — left/right arrows, defaults to current month
- **Line items** — each `cashflow_entry` as a row: name, projected amount, actual amount, paid toggle
- **Mark as paid** — tap toggle to dim row and exclude from totals; tap again to unmark
- **Edit amounts** — tap any amount to edit inline; changes only that month's entry
- **Add entry** — ad-hoc line items can be added per month without touching `budget_items`
- **Running totals** — header bar shows total projected, total paid, remaining (paid items excluded)
- **Category grouping** — rows grouped by category with group subtotals
- **Income section** — separate section below expenses showing `income_entries` for the month
- **Savings projection** — income minus unpaid expenses; updates live as items are marked paid

### Budget Settings
Edited infrequently. Mirrors the Monthly Budget sheet — the template that generates entries each year.

- List all `budget_items` grouped by category with monthly amount and frequency
- Tap to edit `monthly_amount` — does not retroactively change past `cashflow_entries`
- Set `months_active` for non-monthly items (e.g. quarterly insurance)
- Full CRUD on `budget_items`
- **Generate Year** button — auto-generates all `cashflow_entries` for a selected year
- CC flag toggle per item

### Auth / Onboarding
Magic link login via Supabase Auth. No password required. On first login, user is prompted to create a new household or join an existing one via invite code.

---

## Key Behaviors & Logic

### The Paid Mechanic
The core UX carried over from the spreadsheet:

- Paid items remain fully visible — not hidden or archived
- Paid items are visually dimmed (reduced opacity + strikethrough on amount)
- Running totals and remaining balance exclude paid items
- `paid_date` is recorded automatically when marked paid
- Either household member can mark/unmark any item; changes sync in real-time

### Year Generation
At the start of each year (or on demand from Budget Settings):

1. Iterate all `active = true` budget items for the household
2. For each item, create one `cashflow_entry` per month in `months_active`
3. Set `projected_amount` from `budget_item.monthly_amount` at time of generation
4. All entries start with `is_paid = false`
5. Existing entries for the year are not overwritten — generation is additive

### Real-Time Sync
Use Supabase Realtime subscriptions on `cashflow_entries` and `accounts`. When one partner marks an item paid, the other sees it update live without refreshing.

### Net Worth Calculation
Computed client-side from the `accounts` table:

- Total cash = sum of accounts where `type = 'cash'`
- Total CC debt = sum of accounts where `type = 'credit'` (stored positive, displayed negative)
- Net cash = total cash − total CC debt
- Total retirement = sum of `retirement` + `investment` + `529` accounts
- Net worth = net cash + house equity + total retirement

---

## Phase 2 — Plaid Integration

Plaid is a read-only bank connection API — it does not move money.

### Account Balance Sync
- Connect each `accounts` row to a Plaid `account_id`
- Nightly or on-demand sync pulls current balance and updates `accounts.balance`
- The "last updated" timestamp on the dashboard becomes automatic

### Transaction Feed + Reconciliation
- Plaid pulls recent transactions into the `transactions` table
- App presents unmatched transactions in a reconciliation queue
- User matches a transaction to a `cashflow_entry` — marks it paid and sets `actual_amount`
- Unmatched transactions can be dismissed or added as new entries

The `transactions` table is already stubbed in the schema. No Plaid-specific code should be written in Phase 1, but the data model is ready for it.

> **Note:** Plaid requires a paid account for production. A free development sandbox is available during development.

---

## Recommended Build Order

| Step | Task | Notes |
|---|---|---|
| 1 | Supabase project + schema | Run all `CREATE TABLE` and RLS statements |
| 2 | GitHub repo + Vercel connection | Connect `main` branch to Vercel auto-deploy |
| 3 | React + Vite scaffold | Tailwind configured, Supabase client initialized, env vars set |
| 4 | Auth flow | Magic link login, profile creation, household create/join |
| 5 | Accounts CRUD | Dashboard account sections — display, inline edit, last updated |
| 6 | Net worth calculation | Computed view from accounts table |
| 7 | Budget items CRUD | Budget Settings screen — full CRUD, category grouping |
| 8 | Year generation | Generate `cashflow_entries` from `budget_items` for selected year |
| 9 | Cash Flow view | Monthly view with navigation, grouping, running totals |
| 10 | Paid mechanic | Toggle `is_paid`, dim rows, exclude from totals |
| 11 | Inline editing | Edit projected/actual amounts per `cashflow_entry` |
| 12 | Real-time sync | Supabase Realtime subscriptions on key tables |
| 13 | Income entries | Income section on cash flow view + income CRUD |
| 14 | Polish + mobile | Responsive layout, loading states, error handling |

---

## Environment Variables

Required in both `.env.local` (local dev) and the Vercel dashboard (production). Never commit `.env` to GitHub.

```
# .env.local
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key

# Phase 2 only
VITE_PLAID_CLIENT_ID=your-plaid-client-id
VITE_PLAID_SECRET=your-plaid-secret
VITE_PLAID_ENV=sandbox  # or development, production
```

---

## Agent Notes

- **RLS will silently block all queries** if policies are not set up immediately after creating tables. This is the most common source of "data not loading" issues with Supabase.
- **Supabase free tier pauses projects** after 1 week of inactivity. Fine for active development, worth knowing.
- **Vercel env vars must be added in the Vercel dashboard** separately from `.env.local`. A missing env var is the most common cause of broken production deploys.
- **Initialize the Supabase client once** in `lib/supabase.js` and import it everywhere — do not instantiate it per-component.
- **Use Supabase Realtime channel subscriptions**, not polling. Subscribe on mount, unsubscribe on unmount.
- **`months_active` controls entry generation** — when generating `cashflow_entries`, check if the month is in this array before creating the entry.
- **`projected_amount` is set at generation time** and can drift independently from the budget item — do not re-derive it from `budget_items` at query time.
- **Store all monetary values as `numeric(12,2)`**, never as floats. Treat them as strings in JavaScript until displayed.
