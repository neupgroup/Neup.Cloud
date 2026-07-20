'use server';

/**
 * Unified Database Actions
 * 
 * This file provides a unified API for database operations that automatically
 * routes to the appropriate engine-specific implementation (MariaDB or PostgreSQL).
 */

import type {
    DatabaseInstallation,
    DatabaseInstance,
    DatabaseDetails,
    DatabaseUser,
    OperationResult,
    BackupResult,
    StoredBackupResult,
    DatabaseBackupFile,
    DatabaseBackupSummary,
    QueryResult,
    DatabaseSettings
} from './engine-types';
import { buildDatabaseBackupFilename, safeBackupFilenamePart } from './engine-types';
import { getServerForRunner } from '@/services/server/server-service';
import { executeCommand, executeQuickCommand } from '@/services/server/commands/server-command-service';

// Import common operations
import {
    checkDatabaseInstallation as _checkDatabaseInstallation,
    installDatabaseEngine as _installDatabaseEngine,
    listAllDatabases as _listAllDatabases
} from './engine-common';

// MariaDB operations
import {
    getMariaDBDetails,
    createMariaDBDatabase,
    dropMariaDBDatabase,
    listMariaDBUsers,
    createMariaDBUser,
    deleteMariaDBUser,
    updateMariaDBUserPermissions,
    updateMariaDBUserPassword,
    generateMariaDBBackup,
    executeMariaDBQuery
} from './engines/mariadb/operations';

// PostgreSQL operations
import {
    getPostgresDetails,
    createPostgresDatabase,
    dropPostgresDatabase,
    listPostgresUsers,
    createPostgresUser,
    deletePostgresUser,
    updatePostgresUserPermissions,
    updatePostgresUserPassword,
    generatePostgresBackup,
    executePostgresQuery
} from './engines/postgresql/operations';

// Settings operations
import { saveMariaDBSettings, getMariaDBSettings } from './engines/mariadb/settings';
import { savePostgresSettings, getPostgresSettings } from './engines/postgresql/settings';

// Re-export types
export type {
    DatabaseInstallation,
    DatabaseInstance,
    DatabaseDetails,
    DatabaseUser,
    DatabaseTable,
    OperationResult,
    BackupResult,
    StoredBackupResult,
    DatabaseBackupFile,
    DatabaseBackupSummary,
    QueryResult,
    DatabaseSettings,
    EngineStatus
} from './engine-types';

/**
 * Common operations - wrapped to comply with 'use server' requirements
 */

export async function checkDatabaseInstallation(serverId: string): Promise<DatabaseInstallation> {
    return _checkDatabaseInstallation(serverId);
}

export async function installDatabaseEngine(serverId: string, engine: 'mariadb' | 'postgres'): Promise<OperationResult> {
    return _installDatabaseEngine(serverId, engine);
}

export async function listAllDatabases(serverId: string): Promise<DatabaseInstance[]> {
    return _listAllDatabases(serverId);
}

/**
 * Get detailed information about a database
 */
export async function getDatabaseDetails(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string
): Promise<DatabaseDetails> {
    if (engine === 'mariadb') {
        return getMariaDBDetails(serverId, dbName);
    } else {
        return getPostgresDetails(serverId, dbName);
    }
}

/**
 * Create a new database instance with a user
 */
export async function createDatabaseInstance(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    dbUser: string,
    dbPass: string
): Promise<OperationResult> {
    if (engine === 'mariadb') {
        return createMariaDBDatabase(serverId, dbName, dbUser, dbPass);
    } else {
        return createPostgresDatabase(serverId, dbName, dbUser, dbPass);
    }
}

/**
 * Drop a database instance
 */
export async function dropDatabaseInstance(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string
): Promise<OperationResult> {
    if (engine === 'mariadb') {
        return dropMariaDBDatabase(serverId, dbName);
    } else {
        return dropPostgresDatabase(serverId, dbName);
    }
}

/**
 * List all users for a database
 */
export async function listDatabaseUsers(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string
): Promise<DatabaseUser[]> {
    if (engine === 'mariadb') {
        return listMariaDBUsers(serverId, dbName);
    } else {
        return listPostgresUsers(serverId, dbName);
    }
}

/**
 * Create a new database user
 */
export async function createDatabaseUser(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    username: string,
    password: string,
    permissions: 'full' | 'read' = 'full'
): Promise<OperationResult> {
    if (engine === 'mariadb') {
        return createMariaDBUser(serverId, dbName, username, password, permissions);
    } else {
        return createPostgresUser(serverId, dbName, username, password, permissions);
    }
}

/**
 * Delete a database user
 */
export async function deleteDatabaseUser(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    username: string,
    host: string = '%'
): Promise<OperationResult> {
    if (engine === 'mariadb') {
        return deleteMariaDBUser(serverId, username, host);
    } else {
        return deletePostgresUser(serverId, username);
    }
}

/**
 * Update database user permissions
 */
export async function updateDatabaseUserPermissions(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    username: string,
    host: string = '%',
    permissions: 'full' | 'read'
): Promise<OperationResult> {
    if (engine === 'mariadb') {
        return updateMariaDBUserPermissions(serverId, dbName, username, host, permissions);
    } else {
        return updatePostgresUserPermissions(serverId, dbName, username, permissions);
    }
}

/**
 * Update database user password
 */
export async function updateDatabaseUserPassword(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    username: string,
    newPassword: string,
    host: string = '%'
): Promise<OperationResult> {
    if (engine === 'mariadb') {
        return updateMariaDBUserPassword(serverId, username, newPassword, host);
    } else {
        return updatePostgresUserPassword(serverId, username, newPassword);
    }
}

/**
 * Generate a database backup
 */
export async function generateDatabaseBackup(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    mode: 'full' | 'schema'
): Promise<BackupResult> {
    if (engine === 'mariadb') {
        return generateMariaDBBackup(serverId, dbName, mode);
    } else {
        return generatePostgresBackup(serverId, dbName, mode);
    }
}

function shellDoubleQuote(value: string) {
    return `"${value.replace(/["\\$`]/g, '\\$&')}"`;
}

function buildStoreDatabaseBackupCommand(
    username: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    mode: 'full' | 'schema'
) {
    const filename = buildDatabaseBackupFilename(dbName, mode);
    const backupDirectory = `/${username}/.neup/backups/database`;
    const backupPath = `${backupDirectory}/${filename}`;
    const dumpOptions = mode === 'schema'
        ? engine === 'postgres' ? '--schema-only' : '--no-data'
        : '';
    const dumpCommand = engine === 'postgres'
        ? `sudo -u postgres pg_dump ${dumpOptions} ${shellDoubleQuote(dbName)}`
        : `sudo mysqldump ${dumpOptions} ${shellDoubleQuote(dbName)}`;

    return {
        filename,
        path: backupPath,
        command: [
            `sudo mkdir -p ${shellDoubleQuote(backupDirectory)}`,
            `${dumpCommand} | sudo tee ${shellDoubleQuote(backupPath)} > /dev/null`,
            `sudo chmod 600 ${shellDoubleQuote(backupPath)}`,
            `printf 'BACKUP_SIZE_BYTES=%s\\n' "$(sudo stat -c%s ${shellDoubleQuote(backupPath)})"`,
            `echo ${shellDoubleQuote(`Backup stored at ${backupPath}`)}`,
        ].join(' && '),
    };
}

/**
 * Store a database backup on the selected Neup server
 */
export async function storeDatabaseBackup(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    mode: 'full' | 'schema'
): Promise<StoredBackupResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    const backupCommand = buildStoreDatabaseBackupCommand(server.username, engine, dbName, mode);
    const result = await executeCommand(
        serverId,
        backupCommand.command,
        `Store ${engine} Database Backup`,
        backupCommand.command,
        `database:${engine}:${dbName}:backup:${mode}`
    );

    if (result.error) {
        return {
            success: false,
            message: result.error,
        };
    }

    const sizeBytes = Number(result.output?.match(/BACKUP_SIZE_BYTES=(\d+)/)?.[1]);

    return {
        success: true,
        filename: backupCommand.filename,
        path: backupCommand.path,
        sizeBytes: Number.isFinite(sizeBytes) ? sizeBytes : undefined,
        message: `Backup stored at ${backupCommand.path}.`,
    };
}

function parseBackupFilename(filename: string, fallbackDbName?: string) {
    const mode: 'full' | 'schema' | null = filename.endsWith('.structure.sql') ? 'schema' : filename.endsWith('.full.sql') ? 'full' : null;
    if (!mode) return null;

    if (fallbackDbName) {
        return { mode, databaseName: fallbackDbName };
    }

    const suffixLength = mode === 'schema' ? '.structure.sql'.length : '.full.sql'.length;
    const nameWithoutSuffix = filename.slice(0, -suffixLength);
    const parts = nameWithoutSuffix.split('.');
    const databaseName = parts.length >= 4 ? parts.slice(3).join('.') : parts.slice(1).join('.');

    return databaseName ? { mode, databaseName } : null;
}

async function listDatabaseBackupFiles(serverId: string, dbName?: string): Promise<DatabaseBackupFile[]> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    const safeDbName = dbName ? safeBackupFilenamePart(dbName) : null;
    const backupDirectory = `/${server.username}/.neup/backups/database`;
    const findPattern = safeDbName
        ? `\\( -name "*.${safeDbName}.full.sql" -o -name "*.${safeDbName}.structure.sql" \\)`
        : `\\( -name "*.full.sql" -o -name "*.structure.sql" \\)`;
    const command = [
        `BACKUP_DIR=${shellDoubleQuote(backupDirectory)}`,
        'if [ -d "$BACKUP_DIR" ]; then',
        `sudo find "$BACKUP_DIR" -maxdepth 1 -type f ${findPattern} -printf '%T@|%f|%s\\n' 2>/dev/null`,
        'fi',
    ].join('\n');

    const result = await executeQuickCommand(serverId, command);
    if (result.error) {
        return [];
    }

    const rows = result.output?.split('\n').map((line) => line.trim()).filter(Boolean) ?? [];
    const files: DatabaseBackupFile[] = [];

    for (const row of rows) {
        const [timestampValue, filename, sizeValue] = row.split('|');
        if (!timestampValue || !filename || !sizeValue) continue;

        const timestamp = Number(timestampValue);
        const sizeBytes = Number(sizeValue);
        if (!Number.isFinite(timestamp) || !Number.isFinite(sizeBytes)) continue;

        const parsedFilename = parseBackupFilename(filename, dbName);
        if (!parsedFilename) continue;

        files.push({
            filename,
            path: `${backupDirectory}/${filename}`,
            databaseName: parsedFilename.databaseName,
            mode: parsedFilename.mode,
            sizeBytes,
            modifiedAt: new Date(timestamp * 1000).toISOString(),
        });
    }

    return files.sort((left, right) => new Date(right.modifiedAt).getTime() - new Date(left.modifiedAt).getTime());
}

/**
 * Read every stored backup file for a database from the selected Neup server
 */
export async function getDatabaseBackupFiles(
    serverId: string,
    dbName?: string
): Promise<DatabaseBackupFile[]> {
    return listDatabaseBackupFiles(serverId, dbName);
}

/**
 * Read the latest stored backup files from the selected Neup server
 */
export async function getDatabaseBackupSummary(
    serverId: string,
    dbName: string
): Promise<DatabaseBackupSummary> {
    const summary: DatabaseBackupSummary = {};
    const files = await listDatabaseBackupFiles(serverId, dbName);

    for (const file of files) {
        const current = summary[file.mode];

        if (!current || new Date(file.modifiedAt).getTime() > new Date(current.modifiedAt).getTime()) {
            summary[file.mode] = file;
        }
    }

    return summary;
}

/**
 * Execute a database query
 */
export async function executeDatabaseQuery(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    dbName: string,
    query: string
): Promise<QueryResult> {
    if (engine === 'mariadb') {
        return executeMariaDBQuery(serverId, dbName, query);
    } else {
        return executePostgresQuery(serverId, dbName, query);
    }
}

/**
 * Save database settings
 */
export async function saveDatabaseSettings(
    serverId: string,
    engine: 'mariadb' | 'postgres',
    settings: DatabaseSettings
): Promise<OperationResult> {
    if (engine === 'mariadb') {
        return saveMariaDBSettings(serverId, settings);
    } else {
        return savePostgresSettings(serverId, settings);
    }
}

/**
 * Get database settings
 */
export async function getDatabaseSettings(
    serverId: string,
    engine: 'mariadb' | 'postgres'
): Promise<DatabaseSettings> {
    if (engine === 'mariadb') {
        return getMariaDBSettings(serverId);
    } else {
        return getPostgresSettings(serverId);
    }
}
