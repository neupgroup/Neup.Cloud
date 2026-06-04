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
        DROP TABLE IF EXISTS "intelligenceLog" CASCADE
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
          type TEXT NOT NULL,
          available_to JSONB NOT NULL DEFAULT '[]'::jsonb,
          details JSONB NOT NULL DEFAULT '[]'::jsonb,
          max_token INTEGER,
          created_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TIMESTAMP(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
          CONSTRAINT intelligence_access_type_check CHECK (type IN ('open', 'model_def', 'model_key_def', 'prompt_def'))
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "intelligence_access_account_id_idx"
        ON "intelligence_access" (account_id)
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
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'intelligenceAccess_primaryAccessKey_fkey'
          ) THEN
            ALTER TABLE "intelligenceAccess"
            ADD CONSTRAINT "intelligenceAccess_primaryAccessKey_fkey"
            FOREIGN KEY ("primaryAccessKey")
            REFERENCES "accessTokens" (id)
            ON DELETE SET NULL;
          END IF;
        END $$;
      `);

      await db.query(`
        DO $$
        BEGIN
          IF NOT EXISTS (
            SELECT 1
            FROM pg_constraint
            WHERE conname = 'intelligenceAccess_fallbackAccessKey_fkey'
          ) THEN
            ALTER TABLE "intelligenceAccess"
            ADD CONSTRAINT "intelligenceAccess_fallbackAccessKey_fkey"
            FOREIGN KEY ("fallbackAccessKey")
            REFERENCES "accessTokens" (id)
            ON DELETE SET NULL;
          END IF;
        END $$;
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS "intelligenceLog" (
          id BIGSERIAL PRIMARY KEY,
          access_id BIGINT NOT NULL REFERENCES "intelligenceAccess" (id) ON DELETE CASCADE,
          query TEXT,
          response TEXT,
          context TEXT,
          modal TEXT,
          currency TEXT,
          cost DOUBLE PRECISION,
          "inputTokens" BIGINT,
          "outputTokens" BIGINT,
          balance DOUBLE PRECISION
        )
      `);

      await db.query(`
        ALTER TABLE "intelligenceLog"
        ALTER COLUMN balance TYPE DOUBLE PRECISION
        USING balance::double precision
      `);

      await db.query(`
        ALTER TABLE "intelligenceLog"
        ADD COLUMN IF NOT EXISTS currency TEXT
      `);

      await db.query(`
        ALTER TABLE "intelligenceLog"
        ADD COLUMN IF NOT EXISTS cost DOUBLE PRECISION
      `);

      await db.query(`
        ALTER TABLE "intelligenceLog"
        ADD COLUMN IF NOT EXISTS "inputTokens" BIGINT
      `);

      await db.query(`
        ALTER TABLE "intelligenceLog"
        ADD COLUMN IF NOT EXISTS "outputTokens" BIGINT
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
