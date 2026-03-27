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
          price JSONB NOT NULL DEFAULT '{}'::jsonb
        )
      `);

      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "intelligence_models_provider_model_unique"
        ON "intelligence_models" (provider, model)
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS "intelligenceAccess" (
          id BIGSERIAL PRIMARY KEY,
          prompt_id TEXT NOT NULL,
          account_id TEXT NOT NULL,
          token_hash TEXT NOT NULL,
          model TEXT,
          "primaryModel" TEXT,
          "fallbackModel" TEXT,
          "maxTokens" INTEGER,
          "defPrompt" TEXT,
          balance BIGINT NOT NULL DEFAULT 0
        )
      `);

      await db.query(`
        ALTER TABLE "intelligenceAccess"
        ADD COLUMN IF NOT EXISTS "primaryModel" TEXT
      `);

      await db.query(`
        ALTER TABLE "intelligenceAccess"
        ADD COLUMN IF NOT EXISTS "fallbackModel" TEXT
      `);

      await db.query(`
        UPDATE "intelligenceAccess"
        SET "primaryModel" = model
        WHERE "primaryModel" IS NULL
          AND model IS NOT NULL
      `);

      await db.query(`
        ALTER TABLE "intelligenceAccess"
        ADD COLUMN IF NOT EXISTS "primaryAccessKey" BIGINT
      `);

      await db.query(`
        ALTER TABLE "intelligenceAccess"
        ADD COLUMN IF NOT EXISTS "fallbackAccessKey" BIGINT
      `);

      await db.query(`
        ALTER TABLE "intelligenceAccess"
        ADD COLUMN IF NOT EXISTS "primaryModelConfig" JSONB
      `);

      await db.query(`
        ALTER TABLE "intelligenceAccess"
        ADD COLUMN IF NOT EXISTS "fallbackModelConfig" JSONB
      `);

      await db.query(`
        CREATE UNIQUE INDEX IF NOT EXISTS "intelligenceAccess_account_prompt_unique"
        ON "intelligenceAccess" (account_id, prompt_id)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "intelligenceAccess_primaryAccessKey_idx"
        ON "intelligenceAccess" ("primaryAccessKey")
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS "intelligenceAccess_fallbackAccessKey_idx"
        ON "intelligenceAccess" ("fallbackAccessKey")
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
          balance BIGINT
        )
      `);
    })().catch((error) => {
      schemaReadyPromise = null;
      throw error;
    });
  }

  await schemaReadyPromise;
}
