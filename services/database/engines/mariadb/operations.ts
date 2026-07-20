'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import { buildDatabaseBackupFilename, type DatabaseDetails, type DatabaseUser, type OperationResult, type BackupResult, type QueryResult } from '../../engine-types';

/**
 * Get detailed information about a MariaDB database
 */
export async function getMariaDBDetails(serverId: string, dbName: string): Promise<DatabaseDetails> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        let size = "0 MB";
        let tablesCount = 0;

        // Check existence and metrics
        const mysqlResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo mysql -N -s -e "
                SELECT 'RESULT_START_EXISTS', COUNT(*) FROM information_schema.SCHEMATA WHERE schema_name = '${dbName}';
                SELECT 'RESULT_START_SIZE', COALESCE(ROUND(SUM(data_length + index_length) / 1024 / 1024, 2), 0) FROM information_schema.TABLES WHERE table_schema = '${dbName}';
                SELECT 'RESULT_START_TABLES', COUNT(*) FROM information_schema.TABLES WHERE table_schema = '${dbName}';
            "`,
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        if (mysqlResult.code === 0) {
            const lines = mysqlResult.stdout.trim().split('\n');

            const exists = lines.find(l => l.includes('RESULT_START_EXISTS'))?.replace('RESULT_START_EXISTS', '').trim();
            if (exists === '0') throw new Error('Database not found');

            const sizeValue = lines.find(l => l.includes('RESULT_START_SIZE'))?.replace('RESULT_START_SIZE', '').trim() || '0';
            size = `${sizeValue} MB`;
            tablesCount = parseInt(lines.find(l => l.includes('RESULT_START_TABLES'))?.replace('RESULT_START_TABLES', '').trim() || '0');
        }

        return {
            name: dbName,
            engine: 'mariadb',
            size,
            tablesCount,
            userCount: 1,
            status: 'healthy'
        };
    } catch (error: any) {
        if (error.message === 'Database not found') throw error;
        console.error('Error fetching MariaDB database details:', error);
        throw new Error('Failed to fetch database details.');
    }
}

/**
 * Create a new MariaDB database with a user
 */
export async function createMariaDBDatabase(
    serverId: string,
    dbName: string,
    dbUser: string,
    dbPass: string
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        // Sanitize names (simple)
        const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, '');
        const safeDbUser = dbUser.replace(/[^a-zA-Z0-9_]/g, '');

        const commands = [
            `sudo mysql -e "CREATE DATABASE IF NOT EXISTS \\\`${safeDbName}\\\`;"`,
            `sudo mysql -e "CREATE USER IF NOT EXISTS '${safeDbUser}'@'%' IDENTIFIED BY '${dbPass}';"`,
            `sudo mysql -e "GRANT ALL PRIVILEGES ON \\\`${safeDbName}\\\`.* TO '${safeDbUser}'@'%';"`,
            `sudo mysql -e "FLUSH PRIVILEGES;"`
        ];

        // Run commands sequentially
        for (const cmd of commands) {
            const result = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                cmd,
                undefined,
                undefined,
                true // skipSwap - Don't use swap space for database operations
            );

            if (result.code !== 0 && !result.stderr.toLowerCase().includes('already exists')) {
                throw new Error(`Failed to execute: ${cmd}. Error: ${result.stderr}`);
            }
        }

        return {
            success: true,
            message: `Database ${dbName} and user ${dbUser} created successfully.`
        };
    } catch (error: any) {
        console.error('Error creating MariaDB database:', error);
        return {
            success: false,
            message: error.message || 'Database creation failed.'
        };
    }
}

/**
 * Drop a MariaDB database
 */
export async function dropMariaDBDatabase(
    serverId: string,
    dbName: string
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, '');
        if (!safeDbName) {
            throw new Error('Invalid database name.');
        }

        const existsResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo mysql -N -s -e "SELECT SCHEMA_NAME FROM information_schema.SCHEMATA WHERE SCHEMA_NAME = '${safeDbName}';"`,
            undefined,
            undefined,
            true
        );

        if (existsResult.code !== 0) {
            throw new Error(existsResult.stderr || 'Failed to verify database.');
        }

        if (!existsResult.stdout.trim()) {
            return {
                success: false,
                message: `Database '${dbName}' does not exist.`
            };
        }

        const dropResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo mysql -e "DROP DATABASE \\\`${safeDbName}\\\`;"`,
            undefined,
            undefined,
            true
        );

        if (dropResult.code !== 0) {
            throw new Error(dropResult.stderr || 'Failed to drop database.');
        }

        return {
            success: true,
            message: `Database '${dbName}' dropped successfully.`
        };
    } catch (error: any) {
        console.error('Error dropping MariaDB database:', error);
        return {
            success: false,
            message: error.message || 'Failed to drop database.'
        };
    }
}

/**
 * List all users for a MariaDB database
 */
export async function listMariaDBUsers(serverId: string, dbName: string): Promise<DatabaseUser[]> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    const users: DatabaseUser[] = [];
    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo mysql -N -s -e "SELECT 'RESULT_START', User, Host, Select_priv, Insert_priv, Update_priv, Delete_priv, Create_priv FROM mysql.db WHERE Db = '${dbName}';"`,
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        if (result.code === 0) {
            const lines = result.stdout.trim().split('\n');
            lines.filter(l => l.includes('RESULT_START')).forEach(line => {
                const cleanLine = line.replace('RESULT_START', '').trim();
                const parts = cleanLine.split(/\s+/);
                if (parts.length >= 2) {
                    // Detect permissions
                    // parts[2] is Select_priv, parts[3] is Insert_priv, etc.
                    let perms: 'full' | 'read' | 'custom' = 'read';
                    // Check Insert_priv, Update_priv, Delete_priv, Create_priv
                    const hasWrite = parts.slice(3, 7).some(p => p === 'Y'); // parts[3] to parts[6] are Insert, Update, Delete, Create
                    if (hasWrite) perms = 'full';

                    users.push({
                        username: parts[0],
                        host: parts[1],
                        permissions: perms
                    });
                }
            });
        }
    } catch (e) {
        console.error('Failed to list MariaDB database users', e);
    }
    return users;
}

/**
 * Create a new user for a MariaDB database
 */
export async function createMariaDBUser(
    serverId: string,
    dbName: string,
    username: string,
    password: string,
    permissions: 'full' | 'read' = 'full'
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        const safeDb = dbName.replace(/[^a-zA-Z0-9_]/g, '');
        const safeUser = username.replace(/[^a-zA-Z0-9_]/g, '');

        const privs = permissions === 'full' ? 'ALL PRIVILEGES' : 'SELECT, SHOW VIEW';
        const commands = [
            `sudo mysql -e "CREATE USER IF NOT EXISTS '${safeUser}'@'%' IDENTIFIED BY '${password}';"`,
            `sudo mysql -e "GRANT ${privs} ON \\\`${safeDb}\\\`.* TO '${safeUser}'@'%';"`,
            `sudo mysql -e "FLUSH PRIVILEGES;"`
        ];

        for (const cmd of commands) {
            const res = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
            if (res.code !== 0 && !res.stderr.toLowerCase().includes('already exists')) {
                throw new Error(res.stderr);
            }
        }

        return { success: true, message: `User ${username} created with ${permissions} access.` };
    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to create user.' };
    }
}

/**
 * Delete a MariaDB user
 */
export async function deleteMariaDBUser(
    serverId: string,
    username: string,
    host: string = '%'
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server missing.');
    }

    try {
        const commands = [
            `sudo mysql -e "DROP USER '${username}'@'${host}';"`,
            `sudo mysql -e "FLUSH PRIVILEGES;"`
        ];

        for (const cmd of commands) {
            const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
            if (result.code !== 0) {
                // Check if user doesn't exist
                if (result.stderr.includes('does not exist') || result.stderr.includes('Operation DROP USER failed')) {
                    return { success: false, message: `User '${username}'@'${host}' does not exist.` };
                }
                throw new Error(result.stderr || 'Failed to delete user');
            }
        }

        return { success: true, message: `User ${username} deleted successfully.` };
    } catch (error: any) {
        console.error('Error deleting MariaDB user:', error);
        return { success: false, message: error.message || 'Delete failed.' };
    }
}

/**
 * Update MariaDB user permissions
 */
export async function updateMariaDBUserPermissions(
    serverId: string,
    dbName: string,
    username: string,
    host: string = '%',
    permissions: 'full' | 'read'
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server missing.');
    }

    try {
        const safeDb = dbName.replace(/[^a-zA-Z0-9_]/g, '');
        const privs = permissions === 'full' ? 'ALL PRIVILEGES' : 'SELECT, SHOW VIEW';

        const commands = [
            `sudo mysql -e "REVOKE ALL PRIVILEGES ON \\\`${safeDb}\\\`.* FROM '${username}'@'${host}';"`,
            `sudo mysql -e "GRANT ${privs} ON \\\`${safeDb}\\\`.* TO '${username}'@'${host}';"`,
            `sudo mysql -e "FLUSH PRIVILEGES;"`
        ];

        for (const cmd of commands) {
            await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
        }

        return { success: true, message: `Permissions updated to ${permissions}.` };
    } catch (error: any) {
        return { success: false, message: error.message || 'Update failed.' };
    }
}

/**
 * Update MariaDB user password
 */
export async function updateMariaDBUserPassword(
    serverId: string,
    username: string,
    newPassword: string,
    host: string = '%'
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server missing.');
    }

    try {
        const commands = [
            `sudo mysql -e "ALTER USER '${username}'@'${host}' IDENTIFIED BY '${newPassword}';"`,
            `sudo mysql -e "FLUSH PRIVILEGES;"`
        ];

        for (const cmd of commands) {
            const res = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
            if (res.code !== 0) {
                throw new Error(res.stderr);
            }
        }

        return { success: true, message: `Password updated for user ${username}.` };
    } catch (error: any) {
        return { success: false, message: error.message || 'Password update failed.' };
    }
}

/**
 * Generate a backup of a MariaDB database
 */
export async function generateMariaDBBackup(
    serverId: string,
    dbName: string,
    mode: 'full' | 'schema'
): Promise<BackupResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        const filename = buildDatabaseBackupFilename(dbName, mode);
        const options = mode === 'schema' ? '--no-data' : '';

        const backupCmd = `sudo mysqldump ${options} ${dbName}`;

        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            backupCmd,
            undefined,
            undefined,
            true // skipSwap - Don't use swap space for database operations
        );

        if (result.code !== 0) {
            throw new Error(`Backup failed: ${result.stderr}`);
        }

        return {
            success: true,
            content: result.stdout,
            filename,
            message: 'Backup generated successfully.'
        };
    } catch (error: any) {
        console.error('MariaDB backup error:', error);
        return {
            success: false,
            message: error.message || 'Failed to generate backup.'
        };
    }
}

/**
 * Execute a query on a MariaDB database
 */
export async function executeMariaDBQuery(
    serverId: string,
    dbName: string,
    query: string
): Promise<QueryResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    const startTime = performance.now();
    const timestamp = Date.now();
    const tempFile = `/tmp/query_${timestamp}.sql`;

    try {
        // Safe query transfer using base64
        const queryBase64 = Buffer.from(query + (query.trim().endsWith(';') ? '' : ';')).toString('base64');
        await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `echo "${queryBase64}" | base64 -d > ${tempFile}`,
            undefined,
            undefined,
            true
        );

        const cmd = `sudo mysql -D ${dbName} -B < ${tempFile}`;

        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            cmd,
            undefined,
            undefined,
            true
        );

        // Cleanup
        await runCommandOnServer(server.publicIp, server.username, server.privateKey, `rm ${tempFile}`, undefined, undefined, true);

        if (result.code !== 0) {
            const error = result.stderr.replace(/ERROR \d+ \(\w+\): /, '').trim() || result.stdout.trim() || 'Unknown error';
            return { success: false, message: error };
        }

        // Parse TSV output
        const lines = result.stdout.trim().split('\n');
        if (lines.length === 0) {
            return {
                success: true,
                data: [],
                rowCount: 0,
                executionTime: (performance.now() - startTime) / 1000,
                message: 'Query executed successfully. No results returned.'
            };
        }

        let data: any[] = [];
        if (lines.length > 0) {
            const headers = lines[0].split('\t');
            if (headers.length === 1 && headers[0] === '') {
                data = [];
            } else {
                for (let i = 1; i < lines.length; i++) {
                    const values = lines[i].split('\t');
                    const row: any = {};
                    headers.forEach((header, index) => {
                        row[header] = values[index];
                    });
                    data.push(row);
                }
            }
        }

        return {
            success: true,
            data,
            rowCount: data.length,
            executionTime: (performance.now() - startTime) / 1000,
            message: 'Query executed successfully'
        };

    } catch (error: any) {
        return { success: false, message: error.message || 'Failed to execute query' };
    }
}
