import { randomUUID } from 'crypto';
import { Pool, type QueryResult, type QueryResultRow } from 'pg';

let pool: Pool | null = null;
let schemaReadyPromise: Promise<void> | null = null;

function getConnectionString(): string {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error('Missing DATABASE_URL');
  }

  return connectionString;
}

function getAppDbPool(): Pool {
  if (!pool) {
    pool = new Pool({
      connectionString: getConnectionString(),
    });
  }

  return pool;
}

export async function ensureAppTables(): Promise<void> {
  if (!schemaReadyPromise) {
    schemaReadyPromise = (async () => {
      const db = getAppDbPool();

      await db.query(`
        CREATE TABLE IF NOT EXISTS domains (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL UNIQUE,
          status TEXT NOT NULL DEFAULT 'pending',
          "addedAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          "verificationCode" TEXT,
          verified BOOLEAN NOT NULL DEFAULT FALSE
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS environment_variables (
          id TEXT PRIMARY KEY,
          key TEXT NOT NULL,
          value TEXT NOT NULL,
          "targetType" TEXT NOT NULL,
          "selectedTargets" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
          "isConfidential" BOOLEAN NOT NULL DEFAULT FALSE,
          "protectValue" BOOLEAN NOT NULL DEFAULT FALSE,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS environment_variables_key_idx
        ON environment_variables (key)
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS errors (
          id TEXT PRIMARY KEY,
          message TEXT NOT NULL,
          level TEXT NOT NULL DEFAULT 'ERROR',
          source TEXT NOT NULL,
          timestamp TIMESTAMP NOT NULL DEFAULT NOW(),
          stack TEXT
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS errors_timestamp_idx
        ON errors (timestamp DESC)
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS command_sets (
          id TEXT PRIMARY KEY,
          "userId" TEXT NOT NULL,
          name TEXT NOT NULL,
          description TEXT,
          commands JSONB NOT NULL DEFAULT '[]'::jsonb,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS command_sets_user_id_idx
        ON command_sets ("userId")
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS webservices (
          id TEXT PRIMARY KEY,
          name TEXT,
          type TEXT NOT NULL,
          "created_on" TIMESTAMP NOT NULL DEFAULT NOW(),
          "updated_on" TIMESTAMP,
          "created_by" TEXT NOT NULL,
          value JSONB NOT NULL DEFAULT '{}'::jsonb,
          "serverId" TEXT,
          "serverName" TEXT
        )
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS webservices_type_created_on_idx
        ON webservices (type, "created_on" DESC)
      `);

      await db.query(`
        CREATE INDEX IF NOT EXISTS webservices_server_id_created_on_idx
        ON webservices ("serverId", "created_on" DESC)
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS nginx_configurations (
          "serverId" TEXT PRIMARY KEY,
          "serverIp" TEXT NOT NULL,
          "configName" TEXT NOT NULL,
          blocks JSONB NOT NULL DEFAULT '[]'::jsonb,
          "domainRedirects" JSONB,
          "updatedAt" TIMESTAMP NOT NULL DEFAULT NOW()
        )
      `);

      await db.query(`
        CREATE TABLE IF NOT EXISTS live_sessions (
          id TEXT PRIMARY KEY,
          "createdAt" TIMESTAMP NOT NULL DEFAULT NOW(),
          cwd TEXT NOT NULL DEFAULT '~',
          status TEXT NOT NULL DEFAULT 'active',
          history JSONB NOT NULL DEFAULT '[]'::jsonb,
          "serverLogId" TEXT,
          "serverId" TEXT
        )
      `);
    })();
  }

  await schemaReadyPromise;
}

export async function queryAppDb<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params: unknown[] = []
): Promise<QueryResult<T>> {
  await ensureAppTables();
  return getAppDbPool().query<T>(text, params);
}

export function createRecordId(): string {
  return randomUUID();
}

export function toIsoString(value: Date | string | null | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}
