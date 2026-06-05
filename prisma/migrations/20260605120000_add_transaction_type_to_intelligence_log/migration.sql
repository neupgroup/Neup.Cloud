-- Migration: 20260605120000_add_transaction_type_to_intelligence_log
-- Description: Add transaction type field and rename balance_used to balance

-- Step 1: Add the type column with default value
ALTER TABLE "intelligence_log" 
ADD COLUMN "type" TEXT NOT NULL DEFAULT 'discharge';

-- Step 2: Rename balance_used to balance
ALTER TABLE "intelligence_log" 
RENAME COLUMN "balance_used" TO "balance";

-- Step 3: Add check constraint for valid transaction types
ALTER TABLE "intelligence_log" 
ADD CONSTRAINT "intelligence_log_type_check" 
CHECK ("type" IN ('recharge', 'discharge', 'transaction'));

-- Step 4: Create index on type for better query performance
CREATE INDEX IF NOT EXISTS "intelligence_log_type_idx" ON "intelligence_log" ("type");
