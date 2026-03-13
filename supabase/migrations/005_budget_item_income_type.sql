-- Migration 005: Add income_type to budget_items
-- Expand the income_type enum with new values for income classification
-- Add income_type column to budget_items for tracking income type per budget item

-- Add new enum values
ALTER TYPE income_type ADD VALUE IF NOT EXISTS 'gift';
ALTER TYPE income_type ADD VALUE IF NOT EXISTS 'reimbursement';
ALTER TYPE income_type ADD VALUE IF NOT EXISTS 'refund';

-- Add income_type column to budget_items (nullable — only relevant for income items)
ALTER TABLE budget_items ADD COLUMN IF NOT EXISTS income_type income_type;
