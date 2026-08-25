import { prisma } from '@/core/database/prisma';
import { stringUuid } from '@/core/data/uuid';
import { getCurrentAccountId } from '@/services/account-profile';
import type { ExternalDatabase } from '@/services/database/types';

type DatabaseDelegate = {
  findMany: (...args: any[]) => Promise<any[]>;
  create: (...args: any[]) => Promise<any>;
  delete: (...args: any[]) => Promise<any>;
};

function getDatabaseDelegate(): DatabaseDelegate | null {
  const maybeDelegate = (prisma as any)?.database;
  if (maybeDelegate?.findMany && maybeDelegate?.create && maybeDelegate?.delete) {
    return maybeDelegate as DatabaseDelegate;
  }

  return null;
}

function normalizeDate(value: Date | string | null) {
  if (!value) {
    return undefined;
  }

  return (value instanceof Date ? value : new Date(value)).toISOString();
}

function mapDatabase(record: {
  id: string;
  title: string;
  description: string;
  connectionType: string;
  connectionStatus: string;
  credentails: string;
  authConfig: unknown;
  lastValidatedAt: Date | string | null;
  createdAt: Date | string;
  updatedAt: Date | string;
}): ExternalDatabase {
  return {
    id: record.id,
    title: record.title,
    description: record.description,
    connectionType: record.connectionType as ExternalDatabase['connectionType'],
    connectionStatus: record.connectionStatus as ExternalDatabase['connectionStatus'],
    credentails: record.credentails,
    authConfig: record.authConfig as ExternalDatabase['authConfig'],
    lastValidatedAt: normalizeDate(record.lastValidatedAt),
    createdAt: normalizeDate(record.createdAt),
    updatedAt: normalizeDate(record.updatedAt),
  };
}

export async function getDatabaseById(id: string) {
  const accountId = await getCurrentAccountId();
  if (!accountId) return null;

  const delegate = getDatabaseDelegate();

  if (delegate) {
    const record = await (delegate as any).findFirst?.({
      where: {
        id,
        authzAccesses: {
          some: {
            toAccountId: accountId,
            status: 'active',
          },
        },
      },
    });
    if (!record) {
      return null;
    }

    return mapDatabase(record);
  }

  const records = await prisma.$queryRawUnsafe<Array<{
    id: string;
    title: string;
    description: string;
    connectionType: string;
    connectionStatus: string;
    credentails: string;
    authConfig: unknown;
    lastValidatedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>>(
    `SELECT id, title, description, "connectionType", "connectionStatus", credentails, "authConfig", "lastValidatedAt", "createdAt", "updatedAt"
     FROM "databases"
     WHERE id = $1
       AND EXISTS (
         SELECT 1
         FROM "authz_access" AS access
         WHERE access."database_id" = "databases".id
           AND access."to_account_id" = $2
           AND access.status = 'active'
       )
     LIMIT 1`,
    id,
    accountId
  );

  if (!records[0]) {
    return null;
  }

  return mapDatabase(records[0]);
}

export async function getDatabases() {
  const accountId = await getCurrentAccountId();
  if (!accountId) return [];

  const delegate = getDatabaseDelegate();

  if (delegate) {
    const records = await delegate.findMany({
      where: {
        authzAccesses: {
          some: {
            toAccountId: accountId,
            status: 'active',
          },
        },
      },
      orderBy: { title: 'asc' },
    });

    return records.map(mapDatabase);
  }

  const records = await prisma.$queryRawUnsafe<Array<{
    id: string;
    title: string;
    description: string;
    connectionType: string;
    connectionStatus: string;
    credentails: string;
    authConfig: unknown;
    lastValidatedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>>(
    `SELECT id, title, description, "connectionType", "connectionStatus", credentails, "authConfig", "lastValidatedAt", "createdAt", "updatedAt"
     FROM "databases"
     AND EXISTS (
       SELECT 1
       FROM "authz_access" AS access
       WHERE access."database_id" = "databases".id
         AND access."to_account_id" = $1
         AND access.status = 'active'
     )
     ORDER BY title ASC`,
    accountId
  );

  return records.map(mapDatabase);
}

export async function createDatabase(data: Omit<ExternalDatabase, 'id'>) {
  const delegate = getDatabaseDelegate();

  if (delegate) {
    const record = await delegate.create({
      data: {
        id: stringUuid(),
        title: data.title,
        description: data.description,
        connectionType: data.connectionType,
        connectionStatus: data.connectionStatus,
        credentails: data.credentails,
        authConfig: data.authConfig,
        lastValidatedAt: data.lastValidatedAt ? new Date(data.lastValidatedAt) : null,
      },
    });

    return mapDatabase(record);
  }

  const id = stringUuid();
  const now = new Date();
  const lastValidatedAt = data.lastValidatedAt ? new Date(data.lastValidatedAt) : null;

  await prisma.$executeRawUnsafe(
    `INSERT INTO "databases" (id, title, description, "connectionType", "connectionStatus", credentails, "authConfig", "lastValidatedAt", "createdAt", "updatedAt")
     VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8, $9, $10)`,
    id,
    data.title,
    data.description,
    data.connectionType,
    data.connectionStatus,
    data.credentails,
    JSON.stringify(data.authConfig),
    lastValidatedAt,
    now,
    now
  );

  const [record] = await prisma.$queryRawUnsafe<Array<{
    id: string;
    title: string;
    description: string;
    connectionType: string;
    connectionStatus: string;
    credentails: string;
    authConfig: unknown;
    lastValidatedAt: Date | string | null;
    createdAt: Date | string;
    updatedAt: Date | string;
  }>>(
    `SELECT id, title, description, "connectionType", "connectionStatus", credentails, "authConfig", "lastValidatedAt", "createdAt", "updatedAt"
     FROM "databases"
     WHERE id = $1
     LIMIT 1`,
    id
  );

  if (!record) {
    throw new Error('Failed to persist database connection.');
  }

  return mapDatabase(record);
}

export async function updateDatabaseConnectionStatus(
  id: string,
  connectionStatus: ExternalDatabase['connectionStatus'],
  checkedAt: string
) {
  const record = await prisma.database.update({
    where: { id },
    data: {
      connectionStatus,
      lastValidatedAt: new Date(checkedAt),
    },
  });

  return mapDatabase(record);
}

export async function deleteDatabase(id: string) {
  const delegate = getDatabaseDelegate();

  if (delegate) {
    await delegate.delete({ where: { id } });
    return;
  }

  await prisma.$executeRawUnsafe(`DELETE FROM "databases" WHERE id = $1`, id);
}
