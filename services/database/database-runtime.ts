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
    QueryResult,
    DatabaseSettings
} from './engine-types';

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
