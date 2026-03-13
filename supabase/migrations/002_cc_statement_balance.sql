-- Add statement_balance to accounts for credit card accounts
-- This allows tracking both the full balance and the statement balance
ALTER TABLE accounts ADD COLUMN statement_balance numeric(12,2) DEFAULT 0;
