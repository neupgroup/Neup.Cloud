'use server';

import { revalidatePath } from 'next/cache';
import {
  createDatabase as createDatabaseRecord,
  getDatabaseById,
  deleteDatabase as deleteDatabaseRecord,
  updateDatabaseConnectionStatus,
  getDatabases as getDatabasesData,
} from '@/services/database/data';
import type { CreateDatabaseConnectionInput, DatabaseShellQueryResult, ExternalDatabase } from './types';
import {
  buildCredentialsSummary,
  normalizeDatabaseConnectionInput,
  testDatabaseConnection,
} from '@/services/database/connection-service';
import {
  addConnectionTablePrimaryKey,
  createConnectionTableIndex,
  deleteConnectionTableRow,
  dropConnectionTable,
  dropConnectionTableColumn,
  dropConnectionTableIndex,
  executeConnectionShellQuery,
  updateConnectionTableRow,
} from '@/services/database/explorer';

function revalidateTablePaths(connectionId: string, tableName: string) {
  const encodedTableName = encodeURIComponent(tableName);

  revalidatePath(`/database/${connectionId}/table`);
  revalidatePath(`/database/${connectionId}/table/${encodedTableName}`);
  revalidatePath(`/database/${connectionId}/table/${encodedTableName}/properties`);
}

export async function getDatabaseShellMeta(
  connectionId: string
): Promise<Pick<ExternalDatabase, 'id' | 'title' | 'connectionType'> | null> {
  if (!connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  const connection = await getDatabaseById(connectionId);

  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    title: connection.title,
    connectionType: connection.connectionType,
  };
}

export async function getDatabaseConnectionMeta(
  connectionId: string
): Promise<
  Pick<
    ExternalDatabase,
    'id' | 'title' | 'description' | 'connectionType' | 'connectionStatus' | 'credentails' | 'lastValidatedAt'
  > | null
> {
  if (!connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  const connection = await getDatabaseById(connectionId);

  if (!connection) {
    return null;
  }

  return {
    id: connection.id,
    title: connection.title,
    description: connection.description,
    connectionType: connection.connectionType,
    connectionStatus: connection.connectionStatus,
    credentails: connection.credentails,
    lastValidatedAt: connection.lastValidatedAt,
  };
}

export async function getDatabases(): Promise<ExternalDatabase[]> {
  try {
    return await getDatabasesData();
  } catch (error) {
    console.error('Failed to load databases:', error);
    return [];
  }
}

export async function createDatabaseConnection(data: CreateDatabaseConnectionInput) {
  if (!data.title?.trim()) {
    throw new Error('Title is required.');
  }

  const normalized = normalizeDatabaseConnectionInput(data);

  await testDatabaseConnection(normalized.connectionType, normalized.authConfig);

  await createDatabaseRecord({
    title: data.title.trim(),
    description: data.description?.trim() || 'External database connection',
    connectionType: normalized.connectionType,
    connectionStatus: 'connected',
    authConfig: normalized.authConfig,
    credentails: buildCredentialsSummary(normalized.connectionType, normalized.authConfig),
    lastValidatedAt: new Date().toISOString(),
  });

  revalidatePath('/database');
}

export async function executeDatabaseShellQuery(connectionId: string, query: string): Promise<DatabaseShellQueryResult> {
  if (!connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  const connection = await getDatabaseById(connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  return executeConnectionShellQuery(connection, query);
}

export async function checkDatabaseConnection(connectionId: string): Promise<{
  success: boolean;
  message: string;
  checkedAt?: string;
}> {
  if (!connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  const connection = await getDatabaseById(connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  try {
    await testDatabaseConnection(connection.connectionType, connection.authConfig);

    const checkedAt = new Date().toISOString();
    await updateDatabaseConnectionStatus(connection.id, 'connected', checkedAt);

    revalidatePath('/database');
    revalidatePath(`/database/${connection.id}`);

    return {
      success: true,
      message: 'Connection is active and reachable.',
      checkedAt,
    };
  } catch (error) {
    const checkedAt = new Date().toISOString();
    await updateDatabaseConnectionStatus(connection.id, 'failed', checkedAt);

    revalidatePath('/database');
    revalidatePath(`/database/${connection.id}`);

    return {
      success: false,
      message: error instanceof Error ? error.message : 'Connection check failed.',
      checkedAt,
    };
  }
}

export async function deleteDatabaseConnection(connectionId: string): Promise<{ success: boolean; message: string }> {
  if (!connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  const connection = await getDatabaseById(connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await deleteDatabaseRecord(connection.id);

  revalidatePath('/database');

  return {
    success: true,
    message: `Deleted "${connection.title}" successfully.`,
  };
}

export async function createTableIndexAction(input: {
  connectionId: string;
  tableName: string;
  indexName: string;
  columnNames: string[];
  unique?: boolean;
}): Promise<{ success: boolean; message: string }> {
  if (!input.connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  if (!input.tableName?.trim()) {
    throw new Error('Table name is required.');
  }

  const connection = await getDatabaseById(input.connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await createConnectionTableIndex(connection, input.tableName, {
    indexName: input.indexName,
    columnNames: input.columnNames,
    unique: Boolean(input.unique),
  });

  revalidateTablePaths(connection.id, input.tableName);

  return {
    success: true,
    message: `Created ${input.unique ? 'unique ' : ''}index "${input.indexName}" on ${input.tableName}.`,
  };
}

export async function addTablePrimaryKeyAction(input: {
  connectionId: string;
  tableName: string;
  columnNames: string[];
  constraintName?: string;
}): Promise<{ success: boolean; message: string }> {
  if (!input.connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  if (!input.tableName?.trim()) {
    throw new Error('Table name is required.');
  }

  const connection = await getDatabaseById(input.connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await addConnectionTablePrimaryKey(connection, input.tableName, {
    columnNames: input.columnNames,
    constraintName: input.constraintName,
  });

  revalidateTablePaths(connection.id, input.tableName);

  return {
    success: true,
    message: `Added a primary key on ${input.tableName}.`,
  };
}

export async function dropTableColumnAction(input: {
  connectionId: string;
  tableName: string;
  columnName: string;
}): Promise<{ success: boolean; message: string }> {
  if (!input.connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  if (!input.tableName?.trim()) {
    throw new Error('Table name is required.');
  }

  const connection = await getDatabaseById(input.connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await dropConnectionTableColumn(connection, input.tableName, input.columnName);

  revalidateTablePaths(connection.id, input.tableName);

  return {
    success: true,
    message: `Dropped column "${input.columnName}" from ${input.tableName}.`,
  };
}

export async function dropTableIndexAction(input: {
  connectionId: string;
  tableName: string;
  indexName: string;
}): Promise<{ success: boolean; message: string }> {
  if (!input.connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  if (!input.tableName?.trim()) {
    throw new Error('Table name is required.');
  }

  const connection = await getDatabaseById(input.connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await dropConnectionTableIndex(connection, input.tableName, input.indexName);

  revalidateTablePaths(connection.id, input.tableName);

  return {
    success: true,
    message: `Dropped index "${input.indexName}" from ${input.tableName}.`,
  };
}

export async function deleteTableAction(input: {
  connectionId: string;
  tableName: string;
}): Promise<{ success: boolean; message: string }> {
  if (!input.connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  if (!input.tableName?.trim()) {
    throw new Error('Table name is required.');
  }

  const connection = await getDatabaseById(input.connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await dropConnectionTable(connection, input.tableName);

  revalidatePath(`/database/${connection.id}/table`);
  revalidatePath(`/database/${connection.id}`);

  return {
    success: true,
    message: `Deleted table "${input.tableName}".`,
  };
}

export async function updateTableRowAction(input: {
  connectionId: string;
  tableName: string;
  originalRow: Record<string, unknown>;
  updatedRow: Record<string, unknown>;
}): Promise<{ success: boolean; message: string }> {
  if (!input.connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  if (!input.tableName?.trim()) {
    throw new Error('Table name is required.');
  }

  const connection = await getDatabaseById(input.connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await updateConnectionTableRow(connection, input.tableName, input.originalRow, input.updatedRow);

  revalidateTablePaths(connection.id, input.tableName);

  return {
    success: true,
    message: 'Row updated.',
  };
}

export async function deleteTableRowAction(input: {
  connectionId: string;
  tableName: string;
  row: Record<string, unknown>;
}): Promise<{ success: boolean; message: string }> {
  if (!input.connectionId?.trim()) {
    throw new Error('Connection id is required.');
  }

  if (!input.tableName?.trim()) {
    throw new Error('Table name is required.');
  }

  const connection = await getDatabaseById(input.connectionId);

  if (!connection) {
    throw new Error('Database connection not found.');
  }

  await deleteConnectionTableRow(connection, input.tableName, input.row);

  revalidateTablePaths(connection.id, input.tableName);

  return {
    success: true,
    message: 'Row deleted.',
  };
}
