-- Enable pgcrypto extension for random_bytes
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateFunction: Generate string-based access ID
CREATE OR REPLACE FUNCTION generate_access_id() RETURNS TEXT AS $$
BEGIN
  RETURN 'acc_' || encode(gen_random_bytes(10), 'hex');
END;
$$ LANGUAGE plpgsql;

-- Step 1: Create temporary table to store ID mappings
CREATE TABLE IF NOT EXISTS _intelligence_access_id_mapping (
  old_id BIGINT PRIMARY KEY,
  new_id TEXT NOT NULL UNIQUE
);

-- Step 2: Generate new IDs for existing records
INSERT INTO _intelligence_access_id_mapping (old_id, new_id)
SELECT id, generate_access_id()
FROM "intelligence_access"
ON CONFLICT (old_id) DO NOTHING;

-- Step 3: Create new intelligence_access table with TEXT id
CREATE TABLE "intelligence_access_new" (
  id TEXT PRIMARY KEY,
  account_id TEXT NOT NULL,
  key_hash TEXT NOT NULL UNIQUE,
  type TEXT NOT NULL,
  available_to JSONB NOT NULL,
  details JSONB NOT NULL DEFAULT '[]'::jsonb,
  max_tokens INTEGER,
  token_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'unpublished',
  created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 4: Copy data with new IDs
INSERT INTO "intelligence_access_new" (
  id,
  account_id,
  key_hash,
  type,
  available_to,
  details,
  max_tokens,
  token_balance,
  status,
  created_at,
  updated_at
)
SELECT
  mapping.new_id,
  old_table.account_id,
  old_table.key_hash,
  old_table.type,
  old_table.available_to,
  CASE 
    WHEN old_table.details::text = '{}'::text THEN '[]'::jsonb
    ELSE old_table.details
  END,
  old_table.max_tokens,
  old_table.token_balance,
  CASE 
    WHEN old_table.status = 'prod' THEN 'unpublished'
    ELSE old_table.status
  END,
  COALESCE(old_table.updated_at, CURRENT_TIMESTAMP),
  old_table.updated_at
FROM "intelligence_access" old_table
INNER JOIN _intelligence_access_id_mapping mapping ON old_table.id = mapping.old_id;

-- Step 5: Create new intelligence_log table with TEXT access_id
CREATE TABLE "intelligence_log_new" (
  id BIGSERIAL PRIMARY KEY,
  access_id TEXT NOT NULL,
  details JSONB NOT NULL,
  "from" TEXT,
  balance_used DOUBLE PRECISION,
  dev_details JSONB,
  logged_on TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- Step 6: Copy log data with updated access_id references
INSERT INTO "intelligence_log_new" (
  access_id,
  details,
  "from",
  balance_used,
  dev_details,
  logged_on
)
SELECT
  mapping.new_id,
  old_log.details,
  old_log."from",
  old_log.balance_used,
  old_log.dev_details,
  old_log.logged_on
FROM "intelligence_log" old_log
INNER JOIN _intelligence_access_id_mapping mapping ON old_log.access_id = mapping.old_id;

-- Step 7: Drop old tables
DROP TABLE IF EXISTS "intelligence_log";
DROP TABLE IF EXISTS "intelligence_access";

-- Step 8: Rename new tables
ALTER TABLE "intelligence_access_new" RENAME TO "intelligence_access";
ALTER TABLE "intelligence_log_new" RENAME TO "intelligence_log";

-- Step 9: Create indexes
CREATE INDEX IF NOT EXISTS "intelligence_access_account_id_idx" ON "intelligence_access"(account_id);
CREATE INDEX IF NOT EXISTS "intelligence_access_key_hash_idx" ON "intelligence_access"(key_hash);
CREATE INDEX IF NOT EXISTS "intelligence_log_access_id_idx" ON "intelligence_log"(access_id);

-- Step 10: Add foreign key constraint
ALTER TABLE "intelligence_log" 
ADD CONSTRAINT "intelligence_log_access_id_fkey" 
FOREIGN KEY (access_id) 
REFERENCES "intelligence_access"(id) 
ON DELETE CASCADE;

-- Step 11: Clean up
DROP TABLE IF EXISTS _intelligence_access_id_mapping;
DROP FUNCTION IF EXISTS generate_access_id();
