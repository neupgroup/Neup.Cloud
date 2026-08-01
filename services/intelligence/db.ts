import 'server-only';

import { Pool, type QueryResultRow } from 'pg';

let pool: Pool | null = null;

function getPool(): Pool {
  if (!pool) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error('DATABASE_URL is not configured.');
    }

    pool = new Pool({ connectionString });
  }

  return pool;
}

export async function getIntelligenceDbPool(): Promise<Pool> {
  return getPool();
}

export async function ensureIntelligenceTables(): Promise<void> {
  const db = getPool();

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

  await db.query('CREATE INDEX IF NOT EXISTS "intelligence_devlog_account_id_idx" ON "intelligence_devlog" (account_id)');
  await db.query('CREATE INDEX IF NOT EXISTS "intelligence_devlog_access_id_idx" ON "intelligence_devlog" (access_id)');
}

export type { QueryResultRow };
