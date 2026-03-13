-- Add is_variable flag to budget_items for tracking spending-based items (food, gas, etc.)
-- Variable items show remaining budget rather than full amount
ALTER TABLE budget_items ADD COLUMN is_variable boolean DEFAULT false;
