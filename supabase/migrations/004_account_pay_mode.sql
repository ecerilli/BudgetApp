-- Add pay_mode column to accounts (for CC payment preference per card)
ALTER TABLE accounts
  ADD COLUMN IF NOT EXISTS pay_mode text NOT NULL DEFAULT 'full'
  CHECK (pay_mode IN ('full', 'statement'));
