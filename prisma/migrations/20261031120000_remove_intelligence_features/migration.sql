-- Remove Intelligence feature data structures.
DELETE FROM "authz_role_capability"
WHERE capability_id IN (
  SELECT id FROM "authz_capability" WHERE name LIKE 'cloud:intelligence:%'
);
DELETE FROM "authz_capability" WHERE name LIKE 'cloud:intelligence:%';

DROP TABLE IF EXISTS "intelligence_log" CASCADE;
DROP TABLE IF EXISTS "intelligence_access" CASCADE;
DROP TABLE IF EXISTS "intelligence_models" CASCADE;
DROP TABLE IF EXISTS "intelligenceLog" CASCADE;
DROP TABLE IF EXISTS "intelligenceAccess" CASCADE;
DROP TABLE IF EXISTS "intelligence_fallbacks" CASCADE;
DROP TABLE IF EXISTS "intelligence_access_new" CASCADE;
DROP TABLE IF EXISTS "intelligence_log_new" CASCADE;
DROP TABLE IF EXISTS "_intelligence_access_id_mapping" CASCADE;
DROP TABLE IF EXISTS "accessTokens" CASCADE;
DROP TABLE IF EXISTS "openflow_usage_log" CASCADE;
DROP TABLE IF EXISTS "intelligence_settings" CASCADE;
DROP TABLE IF EXISTS "intelligence_devlog" CASCADE;
