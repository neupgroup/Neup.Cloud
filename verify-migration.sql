-- Verification Script for Intelligence Log Transaction System
-- Run this to verify the migration was successful

-- 1. Check table structure
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_name = 'intelligence_log'
ORDER BY ordinal_position;

-- 2. Check constraints
SELECT 
    constraint_name,
    constraint_type
FROM information_schema.table_constraints
WHERE table_name = 'intelligence_log';

-- 3. Check indexes
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE tablename = 'intelligence_log';

-- 4. Verify data migration (all existing rows should have type='discharge')
SELECT 
    type,
    COUNT(*) as count
FROM intelligence_log
GROUP BY type;

-- 5. Test balance calculation query
SELECT 
    access_id,
    SUM(
        CASE 
            WHEN type = 'recharge' THEN balance
            WHEN type = 'discharge' THEN -balance
            WHEN type = 'transaction' THEN balance
            ELSE 0
        END
    ) as calculated_balance,
    COUNT(*) as transaction_count
FROM intelligence_log
GROUP BY access_id
LIMIT 5;

-- 6. Show sample records
SELECT 
    id,
    access_id,
    type,
    balance,
    logged_on
FROM intelligence_log
ORDER BY id DESC
LIMIT 10;
