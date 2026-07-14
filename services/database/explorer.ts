import mysql from 'mysql2/promise';
import type { RowDataPacket } from 'mysql2';
import type {
  DatabaseRelation,
  DatabaseShellQueryResult,
  DatabaseTableDataPage,
  DatabaseTableIndex,
  DatabaseTableProperties,
  ExternalDatabase,
  FirestoreAuthConfig,
  MysqlAuthConfig,
  PostgresAuthConfig,
} from '@/services/database/types';
import { createPostgresPool } from '@/services/database/postgres/connection';
import {
  listFirestoreCollections,
  listFirestoreCollectionDocuments,
} from '@/services/database/firestore/firestore-auth';

function assertIdentifierPart(value: string, label = 'identifier') {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(value)) {
    throw new Error(`Invalid ${label}.`);
  }
}

function parseTableName(rawName: string) {
  const parts = rawName.split('.');
  if (parts.length === 1) {
    assertIdentifierPart(parts[0], 'table name');
    return { schema: null, table: parts[0] };
  }

  if (parts.length === 2) {
    assertIdentifierPart(parts[0], 'schema name');
    assertIdentifierPart(parts[1], 'table name');
    return { schema: parts[0], table: parts[1] };
  }

  throw new Error('Invalid table name.');
}

function assertColumnNames(columnNames: string[]) {
  if (!Array.isArray(columnNames) || columnNames.length === 0) {
    throw new Error('Select at least one column.');
  }

  const seen = new Set<string>();

  for (const columnName of columnNames) {
    assertIdentifierPart(columnName, 'column name');

    if (seen.has(columnName)) {
      throw new Error('Duplicate columns are not allowed.');
    }

    seen.add(columnName);
  }
}

function normalizeOptionalIdentifier(value: string | undefined, label: string) {
  const normalized = value?.trim();
  if (!normalized) {
    return null;
  }

  assertIdentifierPart(normalized, label);
  return normalized;
}

function quotePostgresIdentifierPart(value: string) {
  assertIdentifierPart(value);
  return `"${value}"`;
}

function quoteMysqlIdentifierPart(value: string) {
  assertIdentifierPart(value);
  return `\`${value}\``;
}

function quotePostgresIdentifier(rawName: string) {
  const parsed = parseTableName(rawName);
  const schema = parsed.schema || 'public';
  return `${quotePostgresIdentifierPart(schema)}.${quotePostgresIdentifierPart(parsed.table)}`;
}

function quoteMysqlIdentifier(rawName: string) {
  const parsed = parseTableName(rawName);
  return parsed.schema
    ? `${quoteMysqlIdentifierPart(parsed.schema)}.${quoteMysqlIdentifierPart(parsed.table)}`
    : quoteMysqlIdentifierPart(parsed.table);
}

function quotePostgresColumnList(columnNames: string[]) {
  assertColumnNames(columnNames);
  return columnNames.map((columnName) => quotePostgresIdentifierPart(columnName)).join(', ');
}

function quoteMysqlColumnList(columnNames: string[]) {
  assertColumnNames(columnNames);
  return columnNames.map((columnName) => quoteMysqlIdentifierPart(columnName)).join(', ');
}

function assertSqlConnectionType(connection: ExternalDatabase) {
  if (connection.connectionType === 'postgres') {
    return;
  }

  if (connection.connectionType === 'mysql' || connection.connectionType === 'mariadb') {
    return;
  }

  throw new Error(`${connection.connectionType} schema management is not supported yet.`);
}

async function listPostgresRelations(connection: ExternalDatabase): Promise<DatabaseRelation[]> {
  const auth = connection.authConfig as PostgresAuthConfig;
  const pool = createPostgresPool(auth);

  try {
    const result = await pool.query<{
      table_schema: string;
      table_name: string;
      table_type: string;
    }>(
      `SELECT table_schema, table_name, table_type
       FROM information_schema.tables
       WHERE table_schema NOT IN ('pg_catalog', 'information_schema')
       ORDER BY table_schema, table_name`
    );

    return result.rows.map((row) => ({
      name: row.table_schema === 'public' ? row.table_name : `${row.table_schema}.${row.table_name}`,
      type: row.table_type === 'VIEW' ? 'view' : 'table',
    }));
  } finally {
    await pool.end();
  }
}

async function listMysqlRelations(connection: ExternalDatabase): Promise<DatabaseRelation[]> {
  const auth = connection.authConfig as MysqlAuthConfig;

  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });

  try {
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = ?
       ORDER BY table_name ASC`,
      [auth.database]
    );

    return rows.map((row) => ({
      name: String((row as any).table_name),
      type: String((row as any).table_type) === 'VIEW' ? 'view' : 'table',
    }));
  } finally {
    await db.end();
  }
}

export async function listConnectionRelations(connection: ExternalDatabase): Promise<DatabaseRelation[]> {
  if (connection.connectionType === 'postgres') {
    return listPostgresRelations(connection);
  }

  if (connection.connectionType === 'mysql' || connection.connectionType === 'mariadb') {
    return listMysqlRelations(connection);
  }

  if (connection.connectionType === 'firestore') {
    return listFirestoreCollections(connection.authConfig as FirestoreAuthConfig);
  }

  throw new Error(`${connection.connectionType} table browsing is not supported yet.`);
}

export async function getConnectionRelations(connection: ExternalDatabase): Promise<DatabaseRelation[]> {
  return listConnectionRelations(connection);
}

async function getPostgresTableDataPage(
  connection: ExternalDatabase,
  tableName: string,
  page: number,
  perPage: 10 | 25 | 50
): Promise<DatabaseTableDataPage> {
  const auth = connection.authConfig as PostgresAuthConfig;
  const pool = createPostgresPool(auth);
  const offset = (page - 1) * perPage;
  const qualifiedTable = quotePostgresIdentifier(tableName);

  try {
    const countResult = await pool.query<{ count: string }>(`SELECT COUNT(*)::text AS count FROM ${qualifiedTable}`);

    const rowsResult = await pool.query<Record<string, unknown>>(
      `SELECT * FROM ${qualifiedTable} LIMIT $1 OFFSET $2`,
      [perPage, offset]
    );

    const columns = rowsResult.rows.length > 0
      ? Object.keys(rowsResult.rows[0])
      : [];

    if (columns.length === 0) {
      const parsed = parseTableName(tableName);
      const schema = parsed.schema || 'public';
      const cols = await pool.query<{ column_name: string }>(
        `SELECT column_name
         FROM information_schema.columns
         WHERE table_schema = $1 AND table_name = $2
         ORDER BY ordinal_position`,
        [schema, parsed.table]
      );

      return {
        columns: cols.rows.map((c) => c.column_name),
        rows: rowsResult.rows,
        totalRows: Number(countResult.rows[0]?.count || 0),
        page,
        perPage,
        hasNextPage: offset + rowsResult.rows.length < Number(countResult.rows[0]?.count || 0),
      };
    }

    return {
      columns,
      rows: rowsResult.rows,
      totalRows: Number(countResult.rows[0]?.count || 0),
      page,
      perPage,
      hasNextPage: offset + rowsResult.rows.length < Number(countResult.rows[0]?.count || 0),
    };
  } finally {
    await pool.end();
  }
}

async function getMysqlTableDataPage(
  connection: ExternalDatabase,
  tableName: string,
  page: number,
  perPage: 10 | 25 | 50
): Promise<DatabaseTableDataPage> {
  const auth = connection.authConfig as MysqlAuthConfig;
  const offset = (page - 1) * perPage;
  const qualifiedTable = quoteMysqlIdentifier(tableName);

  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });

  try {
    const [countRows] = await db.query<RowDataPacket[]>(`SELECT COUNT(*) AS count FROM ${qualifiedTable}`);
    const [rows] = await db.query<RowDataPacket[]>(
      `SELECT * FROM ${qualifiedTable} LIMIT ? OFFSET ?`,
      [perPage, offset]
    );

    const parsedRows = rows.map((row) => row as unknown as Record<string, unknown>);
    const columns = parsedRows.length > 0 ? Object.keys(parsedRows[0]) : [];
    const totalRows = Number((countRows[0] as any)?.count || 0);

    if (columns.length === 0) {
      const parsed = parseTableName(tableName);
      const [colRows] = await db.query<RowDataPacket[]>(
        `SELECT COLUMN_NAME
         FROM information_schema.columns
         WHERE table_schema = ? AND table_name = ?
         ORDER BY ORDINAL_POSITION ASC`,
        [auth.database, parsed.table]
      );

      return {
        columns: colRows.map((c) => String((c as any).COLUMN_NAME)),
        rows: parsedRows,
        totalRows,
        page,
        perPage,
        hasNextPage: offset + parsedRows.length < totalRows,
      };
    }

    return {
      columns,
      rows: parsedRows,
      totalRows,
      page,
      perPage,
      hasNextPage: offset + parsedRows.length < totalRows,
    };
  } finally {
    await db.end();
  }
}

export async function getConnectionTableDataPage(
  connection: ExternalDatabase,
  tableName: string,
  page: number,
  perPage: 10 | 25 | 50
): Promise<DatabaseTableDataPage> {
  if (connection.connectionType === 'postgres') {
    return getPostgresTableDataPage(connection, tableName, page, perPage);
  }

  if (connection.connectionType === 'mysql' || connection.connectionType === 'mariadb') {
    return getMysqlTableDataPage(connection, tableName, page, perPage);
  }

  if (connection.connectionType === 'firestore') {
    return listFirestoreCollectionDocuments(connection.authConfig as FirestoreAuthConfig, tableName, page, perPage);
  }

  throw new Error(`${connection.connectionType} table browsing is not supported yet.`);
}

function toSortedIndexList(indexMap: Map<string, DatabaseTableIndex>) {
  return Array.from(indexMap.values()).sort((left, right) => {
    if (left.isPrimary !== right.isPrimary) {
      return left.isPrimary ? -1 : 1;
    }

    if (left.isUnique !== right.isUnique) {
      return left.isUnique ? -1 : 1;
    }

    return left.name.localeCompare(right.name);
  });
}

function normalizeIndexColumns(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) => String(item).trim())
      .filter(Boolean);
  }

  if (typeof value === 'string') {
    const trimmed = value.trim();

    if (!trimmed) {
      return [];
    }

    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      return trimmed
        .slice(1, -1)
        .split(',')
        .map((item) => item.trim().replace(/^"(.*)"$/, '$1'))
        .filter(Boolean);
    }

    return trimmed
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

async function getPostgresTableProperties(
  connection: ExternalDatabase,
  tableName: string
): Promise<DatabaseTableProperties> {
  const auth = connection.authConfig as PostgresAuthConfig;
  const pool = createPostgresPool(auth);
  const parsed = parseTableName(tableName);
  const schema = parsed.schema || 'public';

  try {
    const relationResult = await pool.query<{ table_type: string }>(
      `SELECT table_type
       FROM information_schema.tables
       WHERE table_schema = $1 AND table_name = $2`,
      [schema, parsed.table]
    );

    if (relationResult.rows.length === 0) {
      throw new Error('Table or view not found.');
    }

    const relationType: DatabaseRelation['type'] =
      relationResult.rows[0].table_type === 'VIEW' ? 'view' : 'table';

    const columnsResult = await pool.query<{
      column_name: string;
      data_type: string;
      is_nullable: 'YES' | 'NO';
      column_default: string | null;
      is_primary_key: boolean;
    }>(
      `SELECT
         c.column_name,
         c.data_type,
         c.is_nullable,
         c.column_default,
         EXISTS (
           SELECT 1
           FROM information_schema.table_constraints tc
           JOIN information_schema.key_column_usage kcu
             ON tc.constraint_name = kcu.constraint_name
            AND tc.table_schema = kcu.table_schema
            AND tc.table_name = kcu.table_name
           WHERE tc.table_schema = c.table_schema
             AND tc.table_name = c.table_name
             AND tc.constraint_type = 'PRIMARY KEY'
             AND kcu.column_name = c.column_name
         ) AS is_primary_key
       FROM information_schema.columns c
       WHERE c.table_schema = $1 AND c.table_name = $2
       ORDER BY c.ordinal_position`,
      [schema, parsed.table]
    );

    const indexResult = await pool.query<{
      index_name: string;
      is_unique: boolean;
      is_primary: boolean;
      columns: string[];
    }>(
      `SELECT
         idx.relname AS index_name,
         i.indisunique AS is_unique,
         i.indisprimary AS is_primary,
         ARRAY_AGG(att.attname ORDER BY ord.ordinality) AS columns
       FROM pg_class tbl
       JOIN pg_namespace ns ON ns.oid = tbl.relnamespace
       JOIN pg_index i ON tbl.oid = i.indrelid
       JOIN pg_class idx ON idx.oid = i.indexrelid
       JOIN LATERAL unnest(i.indkey) WITH ORDINALITY AS ord(attnum, ordinality) ON TRUE
       JOIN pg_attribute att ON att.attrelid = tbl.oid AND att.attnum = ord.attnum
       WHERE ns.nspname = $1 AND tbl.relname = $2
       GROUP BY idx.relname, i.indisunique, i.indisprimary
       ORDER BY i.indisprimary DESC, idx.relname`,
      [schema, parsed.table]
    );

    const indexMap = new Map<string, DatabaseTableIndex>();

    for (const row of indexResult.rows) {
      indexMap.set(row.index_name, {
        name: row.index_name,
        columns: normalizeIndexColumns(row.columns),
        isUnique: row.is_unique,
        isPrimary: row.is_primary,
      });
    }

    const indexes = toSortedIndexList(indexMap);

    let rowCount: number | null = null;
    if (relationType === 'table') {
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quotePostgresIdentifier(tableName)}`
      );
      rowCount = Number(countResult.rows[0]?.count || 0);
    }

    const columnIndexes = new Map<string, string[]>();
    for (const index of indexes) {
      for (const columnName of index.columns) {
        const current = columnIndexes.get(columnName) || [];
        if (!current.includes(index.name)) {
          current.push(index.name);
        }
        columnIndexes.set(columnName, current);
      }
    }

    const columns = columnsResult.rows.map((column) => ({
      name: column.column_name,
      dataType: column.data_type,
      isNullable: column.is_nullable === 'YES',
      defaultValue: column.column_default,
      isPrimaryKey: column.is_primary_key,
      indexNames: columnIndexes.get(column.column_name) || [],
    }));

    return {
      relationName: tableName,
      schema,
      table: parsed.table,
      relationType,
      columns,
      indexes,
      primaryKeyColumns: columns.filter((column) => column.isPrimaryKey).map((column) => column.name),
      rowCount,
      supportsSchemaChanges: relationType === 'table',
      supportsIndexes: relationType === 'table',
    };
  } finally {
    await pool.end();
  }
}

async function getMysqlTableProperties(
  connection: ExternalDatabase,
  tableName: string
): Promise<DatabaseTableProperties> {
  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });
  const parsed = parseTableName(tableName);

  try {
    const [relationRows] = await db.query<RowDataPacket[]>(
      `SELECT table_type
       FROM information_schema.tables
       WHERE table_schema = ? AND table_name = ?`,
      [auth.database, parsed.table]
    );

    if (relationRows.length === 0) {
      throw new Error('Table or view not found.');
    }

    const relationType: DatabaseRelation['type'] =
      String((relationRows[0] as any).table_type) === 'VIEW' ? 'view' : 'table';

    const [columnRows] = await db.query<RowDataPacket[]>(
      `SELECT COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_KEY
       FROM information_schema.columns
       WHERE table_schema = ? AND table_name = ?
       ORDER BY ORDINAL_POSITION ASC`,
      [auth.database, parsed.table]
    );

    const [indexRows] = await db.query<RowDataPacket[]>(
      `SELECT INDEX_NAME, NON_UNIQUE, SEQ_IN_INDEX, COLUMN_NAME
       FROM information_schema.statistics
       WHERE table_schema = ? AND table_name = ?
       ORDER BY INDEX_NAME ASC, SEQ_IN_INDEX ASC`,
      [auth.database, parsed.table]
    );

    const indexMap = new Map<string, DatabaseTableIndex>();

    for (const row of indexRows) {
      const indexName = String((row as any).INDEX_NAME);
      const columnName = String((row as any).COLUMN_NAME);
      const current = indexMap.get(indexName) || {
        name: indexName,
        columns: [] as string[],
        isUnique: Number((row as any).NON_UNIQUE) === 0,
        isPrimary: indexName === 'PRIMARY',
      };

      current.columns.push(columnName);
      indexMap.set(indexName, current);
    }

    const indexes = toSortedIndexList(indexMap);

    let rowCount: number | null = null;
    if (relationType === 'table') {
      const [countRows] = await db.query<RowDataPacket[]>(
        `SELECT COUNT(*) AS count FROM ${quoteMysqlIdentifier(tableName)}`
      );
      rowCount = Number((countRows[0] as any)?.count || 0);
    }

    const columnIndexes = new Map<string, string[]>();
    for (const index of indexes) {
      for (const columnName of index.columns) {
        const current = columnIndexes.get(columnName) || [];
        if (!current.includes(index.name)) {
          current.push(index.name);
        }
        columnIndexes.set(columnName, current);
      }
    }

    const columns = columnRows.map((column) => {
      const columnName = String((column as any).COLUMN_NAME);
      const columnKey = String((column as any).COLUMN_KEY || '');

      return {
        name: columnName,
        dataType: String((column as any).COLUMN_TYPE),
        isNullable: String((column as any).IS_NULLABLE) === 'YES',
        defaultValue: (column as any).COLUMN_DEFAULT === null ? null : String((column as any).COLUMN_DEFAULT),
        isPrimaryKey: columnKey === 'PRI',
        indexNames: columnIndexes.get(columnName) || [],
      };
    });

    return {
      relationName: tableName,
      schema: null,
      table: parsed.table,
      relationType,
      columns,
      indexes,
      primaryKeyColumns: columns.filter((column) => column.isPrimaryKey).map((column) => column.name),
      rowCount,
      supportsSchemaChanges: relationType === 'table',
      supportsIndexes: relationType === 'table',
    };
  } finally {
    await db.end();
  }
}

export async function getConnectionTableProperties(
  connection: ExternalDatabase,
  tableName: string
): Promise<DatabaseTableProperties> {
  if (connection.connectionType === 'postgres') {
    return getPostgresTableProperties(connection, tableName);
  }

  if (connection.connectionType === 'mysql' || connection.connectionType === 'mariadb') {
    return getMysqlTableProperties(connection, tableName);
  }

  if (connection.connectionType === 'firestore') {
    return {
      relationName: tableName,
      schema: null,
      table: tableName,
      relationType: 'collection',
      columns: [],
      indexes: [],
      primaryKeyColumns: [],
      rowCount: null,
      supportsSchemaChanges: false,
      supportsIndexes: false,
    };
  }

  throw new Error(`${connection.connectionType} schema browsing is not supported yet.`);
}

async function ensureMutableSqlTable(connection: ExternalDatabase, tableName: string) {
  assertSqlConnectionType(connection);

  const properties = await getConnectionTableProperties(connection, tableName);

  if (properties.relationType !== 'table') {
    throw new Error('Schema changes are only supported for tables.');
  }

  return properties;
}

export async function createConnectionTableIndex(
  connection: ExternalDatabase,
  tableName: string,
  options: {
    indexName: string;
    columnNames: string[];
    unique?: boolean;
  }
) {
  const properties = await ensureMutableSqlTable(connection, tableName);
  const indexName = normalizeOptionalIdentifier(options.indexName, 'index name');

  if (!indexName) {
    throw new Error('Index name is required.');
  }

  assertColumnNames(options.columnNames);

  for (const columnName of options.columnNames) {
    if (!properties.columns.some((column) => column.name === columnName)) {
      throw new Error(`Column "${columnName}" does not exist.`);
    }
  }

  if (properties.indexes.some((index) => index.name === indexName)) {
    throw new Error(`Index "${indexName}" already exists.`);
  }

  if (connection.connectionType === 'postgres') {
    const auth = connection.authConfig as PostgresAuthConfig;
    const pool = createPostgresPool(auth);

    try {
      await pool.query(
        `CREATE ${options.unique ? 'UNIQUE ' : ''}INDEX ${quotePostgresIdentifierPart(indexName)} ON ${quotePostgresIdentifier(tableName)} (${quotePostgresColumnList(options.columnNames)})`
      );
    } finally {
      await pool.end();
    }

    return;
  }

  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });

  try {
    await db.query(
      `CREATE ${options.unique ? 'UNIQUE ' : ''}INDEX ${quoteMysqlIdentifierPart(indexName)} ON ${quoteMysqlIdentifier(tableName)} (${quoteMysqlColumnList(options.columnNames)})`
    );
  } finally {
    await db.end();
  }
}

export async function addConnectionTablePrimaryKey(
  connection: ExternalDatabase,
  tableName: string,
  options: {
    columnNames: string[];
    constraintName?: string;
  }
) {
  const properties = await ensureMutableSqlTable(connection, tableName);
  assertColumnNames(options.columnNames);

  if (properties.primaryKeyColumns.length > 0) {
    throw new Error('This table already has a primary key.');
  }

  for (const columnName of options.columnNames) {
    if (!properties.columns.some((column) => column.name === columnName)) {
      throw new Error(`Column "${columnName}" does not exist.`);
    }
  }

  const constraintName = normalizeOptionalIdentifier(options.constraintName, 'constraint name');

  if (connection.connectionType === 'postgres') {
    const auth = connection.authConfig as PostgresAuthConfig;
    const pool = createPostgresPool(auth);
    const defaultConstraintName = `${properties.table}_pkey`;

    try {
      await pool.query(
        `ALTER TABLE ${quotePostgresIdentifier(tableName)} ADD CONSTRAINT ${quotePostgresIdentifierPart(
          constraintName || defaultConstraintName
        )} PRIMARY KEY (${quotePostgresColumnList(options.columnNames)})`
      );
    } finally {
      await pool.end();
    }

    return;
  }

  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });

  try {
    if (constraintName) {
      await db.query(
        `ALTER TABLE ${quoteMysqlIdentifier(tableName)} ADD CONSTRAINT ${quoteMysqlIdentifierPart(
          constraintName
        )} PRIMARY KEY (${quoteMysqlColumnList(options.columnNames)})`
      );
    } else {
      await db.query(
        `ALTER TABLE ${quoteMysqlIdentifier(tableName)} ADD PRIMARY KEY (${quoteMysqlColumnList(options.columnNames)})`
      );
    }
  } finally {
    await db.end();
  }
}

export async function dropConnectionTableColumn(
  connection: ExternalDatabase,
  tableName: string,
  columnName: string
) {
  const properties = await ensureMutableSqlTable(connection, tableName);
  const normalizedColumnName = normalizeOptionalIdentifier(columnName, 'column name');

  if (!normalizedColumnName) {
    throw new Error('Column name is required.');
  }

  if (!properties.columns.some((column) => column.name === normalizedColumnName)) {
    throw new Error(`Column "${normalizedColumnName}" does not exist.`);
  }

  if (connection.connectionType === 'postgres') {
    const auth = connection.authConfig as PostgresAuthConfig;
    const pool = createPostgresPool(auth);

    try {
      await pool.query(
        `ALTER TABLE ${quotePostgresIdentifier(tableName)} DROP COLUMN ${quotePostgresIdentifierPart(normalizedColumnName)}`
      );
    } finally {
      await pool.end();
    }

    return;
  }

  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });

  try {
    await db.query(
      `ALTER TABLE ${quoteMysqlIdentifier(tableName)} DROP COLUMN ${quoteMysqlIdentifierPart(normalizedColumnName)}`
    );
  } finally {
    await db.end();
  }
}

export async function dropConnectionTableIndex(
  connection: ExternalDatabase,
  tableName: string,
  indexName: string
) {
  const properties = await ensureMutableSqlTable(connection, tableName);
  const normalizedIndexName = normalizeOptionalIdentifier(indexName, 'index name');

  if (!normalizedIndexName) {
    throw new Error('Index name is required.');
  }

  const existingIndex = properties.indexes.find((index) => index.name === normalizedIndexName);

  if (!existingIndex) {
    throw new Error(`Index "${normalizedIndexName}" does not exist.`);
  }

  if (existingIndex.isPrimary) {
    throw new Error('Primary key indexes cannot be dropped from this form.');
  }

  if (connection.connectionType === 'postgres') {
    const auth = connection.authConfig as PostgresAuthConfig;
    const pool = createPostgresPool(auth);
    const schema = properties.schema || 'public';

    try {
      await pool.query(
        `DROP INDEX ${quotePostgresIdentifierPart(schema)}.${quotePostgresIdentifierPart(normalizedIndexName)}`
      );
    } finally {
      await pool.end();
    }

    return;
  }

  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });

  try {
    await db.query(
      `DROP INDEX ${quoteMysqlIdentifierPart(normalizedIndexName)} ON ${quoteMysqlIdentifier(tableName)}`
    );
  } finally {
    await db.end();
  }
}

export async function dropConnectionTable(
  connection: ExternalDatabase,
  tableName: string
) {
  await ensureMutableSqlTable(connection, tableName);

  if (connection.connectionType === 'postgres') {
    const auth = connection.authConfig as PostgresAuthConfig;
    const pool = createPostgresPool(auth);

    try {
      await pool.query(`DROP TABLE ${quotePostgresIdentifier(tableName)}`);
    } finally {
      await pool.end();
    }

    return;
  }

  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });

  try {
    await db.query(`DROP TABLE ${quoteMysqlIdentifier(tableName)}`);
  } finally {
    await db.end();
  }
}

function buildPostgresRowPredicate(columns: string[], startIndex = 1) {
  assertColumnNames(columns);

  return columns
    .map((columnName, index) => `${quotePostgresIdentifierPart(columnName)} IS NOT DISTINCT FROM $${startIndex + index}`)
    .join(' AND ');
}

function buildMysqlRowPredicate(columns: string[]) {
  assertColumnNames(columns);

  return columns
    .map((columnName) => `${quoteMysqlIdentifierPart(columnName)} <=> ?`)
    .join(' AND ');
}

function getRowIdentityColumns(properties: DatabaseTableProperties, row: Record<string, unknown>) {
  const rowColumns = Object.keys(row).filter((columnName) =>
    properties.columns.some((column) => column.name === columnName)
  );

  if (properties.primaryKeyColumns.length > 0) {
    return properties.primaryKeyColumns.filter((columnName) => rowColumns.includes(columnName));
  }

  return rowColumns;
}

function rowsHaveSameValues(
  columns: string[],
  originalRow: Record<string, unknown>,
  updatedRow: Record<string, unknown>
) {
  return columns.every((columnName) => {
    const originalValue = originalRow[columnName];
    const updatedValue = updatedRow[columnName];

    if (originalValue === updatedValue) {
      return true;
    }

    return JSON.stringify(originalValue) === JSON.stringify(updatedValue);
  });
}

export async function updateConnectionTableRow(
  connection: ExternalDatabase,
  tableName: string,
  originalRow: Record<string, unknown>,
  updatedRow: Record<string, unknown>
) {
  const properties = await ensureMutableSqlTable(connection, tableName);
  const editableColumns = Object.keys(updatedRow).filter((columnName) =>
    properties.columns.some((column) => column.name === columnName)
  );
  const identityColumns = getRowIdentityColumns(properties, originalRow);

  if (editableColumns.length === 0) {
    throw new Error('No editable columns were provided.');
  }

  if (identityColumns.length === 0) {
    throw new Error('This row cannot be identified for update.');
  }

  if (rowsHaveSameValues(editableColumns, originalRow, updatedRow)) {
    return;
  }

  if (connection.connectionType === 'postgres') {
    const auth = connection.authConfig as PostgresAuthConfig;
    const pool = createPostgresPool(auth);
    const setClause = editableColumns
      .map((columnName, index) => `${quotePostgresIdentifierPart(columnName)} = $${index + 1}`)
      .join(', ');
    const whereClause = buildPostgresRowPredicate(identityColumns, editableColumns.length + 1);
    const values = [
      ...editableColumns.map((columnName) => updatedRow[columnName]),
      ...identityColumns.map((columnName) => originalRow[columnName]),
    ];

    try {
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quotePostgresIdentifier(tableName)} WHERE ${whereClause}`,
        identityColumns.map((columnName) => originalRow[columnName])
      );
      const matchingRows = Number(countResult.rows[0]?.count || 0);

      if (matchingRows !== 1) {
        throw new Error(`Expected to match 1 row, but matched ${matchingRows}.`);
      }

      const result = await pool.query(
        `UPDATE ${quotePostgresIdentifier(tableName)} SET ${setClause} WHERE ${whereClause}`,
        values
      );

      if (result.rowCount !== 1) {
        throw new Error(`Expected to update 1 row, but updated ${result.rowCount || 0}.`);
      }
    } finally {
      await pool.end();
    }

    return;
  }

  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });
  const setClause = editableColumns
    .map((columnName) => `${quoteMysqlIdentifierPart(columnName)} = ?`)
    .join(', ');
  const whereClause = buildMysqlRowPredicate(identityColumns);
  const values = [
    ...editableColumns.map((columnName) => updatedRow[columnName]),
    ...identityColumns.map((columnName) => originalRow[columnName]),
  ];

  try {
    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM ${quoteMysqlIdentifier(tableName)} WHERE ${whereClause}`,
      identityColumns.map((columnName) => originalRow[columnName])
    );
    const matchingRows = Number((countRows[0] as { count?: unknown })?.count || 0);

    if (matchingRows !== 1) {
      throw new Error(`Expected to match 1 row, but matched ${matchingRows}.`);
    }

    const [result] = await db.query(
      `UPDATE ${quoteMysqlIdentifier(tableName)} SET ${setClause} WHERE ${whereClause}`,
      values
    );
    const affectedRows = Number((result as { affectedRows?: number }).affectedRows || 0);

    if (affectedRows > 1) {
      throw new Error(`Expected to update 1 row, but updated ${affectedRows}.`);
    }
  } finally {
    await db.end();
  }
}

export async function deleteConnectionTableRow(
  connection: ExternalDatabase,
  tableName: string,
  row: Record<string, unknown>
) {
  const properties = await ensureMutableSqlTable(connection, tableName);
  const identityColumns = getRowIdentityColumns(properties, row);

  if (identityColumns.length === 0) {
    throw new Error('This row cannot be identified for delete.');
  }

  if (connection.connectionType === 'postgres') {
    const auth = connection.authConfig as PostgresAuthConfig;
    const pool = createPostgresPool(auth);
    const whereClause = buildPostgresRowPredicate(identityColumns);
    const values = identityColumns.map((columnName) => row[columnName]);

    try {
      const countResult = await pool.query<{ count: string }>(
        `SELECT COUNT(*)::text AS count FROM ${quotePostgresIdentifier(tableName)} WHERE ${whereClause}`,
        values
      );
      const matchingRows = Number(countResult.rows[0]?.count || 0);

      if (matchingRows !== 1) {
        throw new Error(`Expected to match 1 row, but matched ${matchingRows}.`);
      }

      const result = await pool.query(
        `DELETE FROM ${quotePostgresIdentifier(tableName)} WHERE ${whereClause}`,
        values
      );

      if (result.rowCount !== 1) {
        throw new Error(`Expected to delete 1 row, but deleted ${result.rowCount || 0}.`);
      }
    } finally {
      await pool.end();
    }

    return;
  }

  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });
  const whereClause = buildMysqlRowPredicate(identityColumns);
  const values = identityColumns.map((columnName) => row[columnName]);

  try {
    const [countRows] = await db.query<RowDataPacket[]>(
      `SELECT COUNT(*) AS count FROM ${quoteMysqlIdentifier(tableName)} WHERE ${whereClause}`,
      values
    );
    const matchingRows = Number((countRows[0] as { count?: unknown })?.count || 0);

    if (matchingRows !== 1) {
      throw new Error(`Expected to match 1 row, but matched ${matchingRows}.`);
    }

    const [result] = await db.query(
      `DELETE FROM ${quoteMysqlIdentifier(tableName)} WHERE ${whereClause}`,
      values
    );
    const affectedRows = Number((result as { affectedRows?: number }).affectedRows || 0);

    if (affectedRows !== 1) {
      throw new Error(`Expected to delete 1 row, but deleted ${affectedRows}.`);
    }
  } finally {
    await db.end();
  }
}

function parseMysqlExecutionResult(result: unknown) {
  if (Array.isArray(result)) {
    const rows = (result as RowDataPacket[]).map((row) => row as unknown as Record<string, unknown>);
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      rows,
      columns,
      rowCount: rows.length,
      message: `Returned ${rows.length} rows`,
    };
  }

  const header = result as { affectedRows?: number };
  const affectedRows = Number(header?.affectedRows || 0);

  return {
    rows: [] as Record<string, unknown>[],
    columns: [] as string[],
    rowCount: affectedRows,
    message: `Query OK, ${affectedRows} rows affected`,
  };
}

async function executePostgresShellQuery(connection: ExternalDatabase, query: string): Promise<DatabaseShellQueryResult> {
  const auth = connection.authConfig as PostgresAuthConfig;
  const pool = createPostgresPool(auth);
  const startedAt = Date.now();

  try {
    const result = await pool.query<Record<string, unknown>>(query);
    const rows = result.rows;
    const columns = rows.length > 0 ? Object.keys(rows[0]) : [];

    return {
      success: true,
      rows,
      columns,
      rowCount: typeof result.rowCount === 'number' ? result.rowCount : rows.length,
      executionTimeMs: Date.now() - startedAt,
      message: rows.length > 0 ? `Returned ${rows.length} rows` : `Query OK, ${result.rowCount ?? 0} rows affected`,
    };
  } finally {
    await pool.end();
  }
}

async function executeMysqlShellQuery(connection: ExternalDatabase, query: string): Promise<DatabaseShellQueryResult> {
  const auth = connection.authConfig as MysqlAuthConfig;
  const db = await mysql.createConnection({
    host: auth.host,
    port: Number(auth.port),
    database: auth.database,
    user: auth.username,
    password: auth.password,
  });
  const startedAt = Date.now();

  try {
    const [result] = await db.query(query);
    const parsed = parseMysqlExecutionResult(result);

    return {
      success: true,
      rows: parsed.rows,
      columns: parsed.columns,
      rowCount: parsed.rowCount,
      executionTimeMs: Date.now() - startedAt,
      message: parsed.message,
    };
  } finally {
    await db.end();
  }
}

export async function executeConnectionShellQuery(
  connection: ExternalDatabase,
  query: string
): Promise<DatabaseShellQueryResult> {
  const normalizedQuery = query.trim();

  if (!normalizedQuery) {
    throw new Error('Query cannot be empty.');
  }

  if (connection.connectionType === 'postgres') {
    return executePostgresShellQuery(connection, normalizedQuery);
  }

  if (connection.connectionType === 'mysql' || connection.connectionType === 'mariadb') {
    return executeMysqlShellQuery(connection, normalizedQuery);
  }

  throw new Error(`${connection.connectionType} shell execution is not supported yet.`);
}
