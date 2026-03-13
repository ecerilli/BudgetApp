# Household Finance App — Build Progress
**Last Updated:** March 13, 2026

---

## Original Implementation Plan vs. Current State

| Step | Task | Status | Notes |
|------|------|--------|-------|
| 1 | Supabase project + schema | ✅ Complete | Migrations 001–005 applied. Initial schema plus CC statement balance, variable budget items, account pay mode, and income type extensions. |
| 2 | GitHub repo + Vercel connection | ✅ Complete | Repo at `ecerilli/BudgetApp`, connected to Vercel auto-deploy on `master`. |
| 3 | React + Vite scaffold | ✅ Complete | React 19 + Vite 7 + TypeScript. Tailwind CSS v4 with `@tailwindcss/vite`. Supabase client initialized in `src/lib/supabase.ts`. Path alias `@/` configured. |
| 4 | Auth flow | ✅ Complete | Magic link login via Supabase Auth. New-user onboarding creates a household and profile. `AuthProvider` context with session handling and profile fetch. `ProtectedRoute` guard. |
| 5 | Accounts CRUD | ✅ Complete | Account list grouped by type (Cash, Credit, Retirement, Investment, 529, Other). Inline balance editing. Add account dialog. Right-click context menu with Edit (name + type) and Delete (with confirmation). CC cards show Statement + Balance columns with Pay Full / Pay Stmt toggle. |
| 6 | Net worth calculation | ✅ Complete | Summary cards on the Accounts page: Net Cash, CC Debt, Retirement, and Net Worth. All computed client-side from `useAccountsByType`. |
| 7 | Budget items CRUD | ✅ Complete | Budget Settings screen with full CRUD. Items grouped by category, sortable. Income vs. expense flag. Income type enum (W2, 1099, Untaxed, Gift, Reimbursement, Refund). Variable amount toggle. CC-paid flag. `months_active` controls which months the item generates entries for. |
| 8 | Year generation | ✅ Complete | "Generate Year" flow in Budget Settings via `useGenerateYear`. Creates `cashflow_entries` from `budget_items` for a selected year. Additive — does not overwrite existing entries. |
| 9 | Cash Flow view | ✅ Complete | **Monthly view:** navigation arrows, expense/income grouping, running totals, inline amount editing, mark paid toggle. **Year view (bonus):** spreadsheet-style 12-month grid with three panels — Expenses, Income, Savings. Column totals, row totals, inline actual-amount editing per cell. |
| 10 | Paid mechanic | ✅ Complete | Toggle `is_paid` on any entry. Paid rows are visually dimmed and struck through. Running totals and savings projections exclude paid fixed items. |
| 11 | Inline editing | ✅ Complete | Monthly view: click any projected or actual amount to edit. Year view: click any month cell to enter an actual amount. Account balances: click to edit inline. |
| 12 | Real-time sync | ⬜ Not Started | Supabase Realtime subscriptions on `cashflow_entries` and `accounts` are not yet implemented. Currently requires a page refresh for a second user to see changes. |
| 13 | Income entries | ⚠️ Partial | Income is tracked via `budget_items` with `is_income = true` and `income_type` (W2, 1099, etc.). The separate `income_entries` table from the spec exists in the schema but is not used — income flows through the same budget + cashflow entry pipeline as expenses. |
| 14 | Polish + mobile | ⬜ Not Started | Desktop layout is functional. No responsive mobile layout, no skeleton loading on all views, no comprehensive error boundaries. |

---

## Completed Beyond the Original Spec

These features were added during development and exceed the Phase 1 plan:

| Feature | Description |
|---------|-------------|
| **Year View** | Full 12-month spreadsheet view with Expenses / Income / Savings panels, per-cell inline editing, and column/row totals. |
| **CC Statement Balance** | Credit card accounts track both a running balance and a statement balance separately. |
| **Pay Mode Toggle** | Per-CC-card toggle between "Pay Full" (uses running balance) and "Pay Stmt" (uses statement balance) for accurate monthly cash flow projections. |
| **CC Rollover** | Unpaid CC balance from prior month rolls forward into the current month's cash flow calculation. |
| **Variable Budget Items** | Budget items can be flagged as variable, allowing the actual amount to be entered independently each month without a fixed projection. |
| **Income Type** | Income budget items carry a type: W2, 1099, Untaxed, Gift, Reimbursement, or Refund. |
| **W2 Half-Pay Mechanic** | W2 income rows support a "Mark ½ Received" step via right-click, reflecting bi-monthly or mid-month paycheck patterns. |
| **Quarterly Tax Row** | A computed "Quarterly Tax" row is auto-generated in the year view based on an `estimated_tax_rate` on the household, showing projected tax liability per quarter. |
| **Tax Rate Context Menu** | Right-click the Quarterly Tax row to update the household's estimated tax rate inline. |
| **Account Context Menu** | Right-click any account card to edit its name/type or delete it (with a confirmation dialog). |

---

## Database Migrations

| File | Description |
|------|-------------|
| `001_initial_schema.sql` | Core tables: `households`, `profiles`, `accounts`, `budget_items`, `cashflow_entries`, `income_entries`, `transactions` (stub). All RLS policies. Enums: `account_type`, `item_frequency`, `item_category`. |
| `002_cc_statement_balance.sql` | Adds `statement_balance` column to `accounts`. |
| `003_budget_item_variable.sql` | Adds `is_variable` column to `budget_items`. |
| `004_account_pay_mode.sql` | Adds `pay_mode` column (`full` \| `statement`) to `accounts`. |
| `005_budget_item_income_type.sql` | Adds `income_type` enum and column to `budget_items`. Expands `income_type` values. |

---

## What's Left (Phase 1 Completion)

### High Priority
- **Real-time sync (Step 12)** — Supabase Realtime subscriptions so both household members see live updates without refreshing.

### Medium Priority
- **Mobile layout (Step 14)** — The year view in particular needs responsive treatment. The bottom mobile nav in `AppNav` is scaffolded but the views are not optimized for small screens.
- **Loading + error states** — Some views have skeleton loaders; others show nothing during fetch. Standardize error boundaries and empty states.

### Low Priority / Phase 2
- **Income entries table** — The spec has a separate `income_entries` table for more granular income tracking (actual deposit reconciliation). Currently absorbed into `budget_items`.
- **Plaid integration** — Read-only balance sync and transaction feed for reconciliation. `transactions` table is already stubbed in the schema.
