import { Pool } from 'pg';

let pool: Pool | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  return connectionString;
}

export function getIntelligenceDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
    });
  }

  return pool;
}

export async function ensureIntelligenceTables(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const db = getIntelligenceDbPool();

      await db.query(`
        CREATE TABLE IF NOT EXISTS "accessTokens" (
          id BIGSERIAL PRIMARY KEY,
          account_id TEXT NOT NULL,
          name TEXT NOT NULL,
          "key" TEXT NOT NULL
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "accessTokens_account_id_idx"
        ON "accessTokens" (account_id)
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS "intelligence_models" (
          id BIGSERIAL PRIMARY KEY,
          title TEXT NOT NULL,
          provider TEXT NOT NULL,
          model TEXT NOT NULL,
          description TEXT,
          currency TEXT NOT NULL DEFAULT 'USD',
          "inputPrice" DOUBLE PRECISION NOT NULL DEFAULT 0,
          "outputPrice" DOUBLE PRECISION NOT NULL DEFAULT 0
        )
      `);

      await db.query(`
        ALTER TABLE "intelligence_models"
        ADD COLUMN IF NOT EXISTS "inputPrice" DOUBLE PRECISION NOT NULL DEFAULT 0
      `);

      await db.query(`
        ALTER TABLE "intelligence_models"
        ADD COLUMN IF NOT EXISTS "outputPrice" DOUBLE PRECISION NOT NULL DEFAULT 0
      `);

      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "intelligence_models_provider_model_unique"
        ON "intelligence_models" (provider, model)
      `);

      await db.query(`
        DROP TABLE IF EXISTS "intelligence_log" CASCADE
      `);

      await db.query(`
        DROP TABLE IF EXISTS "intelligence_fallbacks" CASCADE
      `);

      await db.query(`
        DROP TABLE IF EXISTS "intelligenceAccess" CASCADE
      `);

      await db.query(`
        DROP TABLE IF EXISTS "intelligence_access" CASCADE
      `);

      await db.query(`
        CREATE TABLE "intelligence_access" (
          id BIGSERIAL PRIMARY KEY,
          account_id TEXT NOT NULL,
          key_hash TEXT NOT NULL UNIQUE,
          type TEXT NOT NULL DEFAULT 'open',
          available_to JSONB NOT NULL DEFAULT '[]'::jsonb,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          max_tokens INTEGER,
          token_balance DOUBLE PRECISION NOT NULL DEFAULT 0,
          status TEXT NOT NULL DEFAULT 'prod',
          updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT intelligence_access_type_check CHECK (type IN ('open', 'hybrid', 'closed'))
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "intelligence_access_account_id_idx"
        ON "intelligence_access" (account_id)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "intelligence_access_key_hash_idx"
        ON "intelligence_access" (key_hash)
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS "intelligence_settings" (
          id BIGSERIAL PRIMARY KEY,
          account_id TEXT NOT NULL UNIQUE,
          dev_mode BOOLEAN NOT NULL DEFAULT FALSE,
          created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS "intelligence_devlog" (
          id BIGSERIAL PRIMARY KEY,
          account_id TEXT,
          access_id TEXT,
          request_id TEXT NOT NULL,
          request_method TEXT NOT NULL,
          request_url TEXT NOT NULL,
          request_headers JSONB NOT NULL DEFAULT '{}'::jsonb,
          request_body JSONB,
          request_query JSONB NOT NULL DEFAULT '{}'::jsonb,
          request_context JSONB,
          response_status INTEGER,
          response_body JSONB,
          error_message TEXT,
          error_stack TEXT,
          created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "intelligence_devlog_account_id_idx"
        ON "intelligence_devlog" (account_id)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "intelligence_devlog_access_id_idx"
        ON "intelligence_devlog" (access_id)
      `);

      await db.query(`
        DROP TABLE IF EXISTS "intelligence_log" CASCADE
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS "intelligence_log" (
          id BIGSERIAL PRIMARY KEY,
          access_id BIGINT NOT NULL REFERENCES "intelligence_access" (id) ON DELETE CASCADE,
          details JSONB NOT NULL DEFAULT '{}'::jsonb,
          "from" TEXT,
          balance_used DOUBLE PRECISION,
          dev_details JSONB,
          logged_on TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS "openflow_usage_log" (
          id BIGSERIAL PRIMARY KEY,
          account_id TEXT NOT NULL,
          token_last4 TEXT NOT NULL,
          model_used TEXT NOT NULL,
          provider TEXT NOT NULL,
          used_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "openflow_usage_log_account_id_idx"
        ON "openflow_usage_log" (account_id)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "openflow_usage_log_used_at_idx"
        ON "openflow_usage_log" (used_at)
      `);
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}
