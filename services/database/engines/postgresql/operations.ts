'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import type { DatabaseDetails, DatabaseUser, OperationResult, BackupResult, QueryResult } from '../../engine-types';

/**
 * Get detailed information about a PostgreSQL database
 */
export async function getPostgresDetails(serverId: string, dbName: string): Promise<DatabaseDetails> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        let size = "0 MB";
        let tablesCount = 0;

        // Postgres existence check and metrics - Connect to the specific database
        const pgResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo -u postgres psql -d ${dbName} -t -c "
                SELECT 'RESULT_START_SIZE' || pg_size_pretty(pg_database_size('${dbName}'));
                SELECT 'RESULT_START_TABLES' || count(*) FROM pg_stat_user_tables;
            "`,
            undefined,
            undefined,
            true // skipSwap
        );

        if (pgResult.code === 0) {
            const lines = pgResult.stdout.trim().split('\n');
            // If we connected successfully, the database exists

            size = lines.find(l => l.includes('RESULT_START_SIZE'))?.replace('RESULT_START_SIZE', '').trim() || "0 MB";
            tablesCount = parseInt(lines.find(l => l.includes('RESULT_START_TABLES'))?.replace('RESULT_START_TABLES', '').trim() || "0");
        } else {
            // If connection failed, check if it's because DB doesn't exist
            if (pgResult.stderr.includes('does not exist')) {
                throw new Error('Database not found');
            }
            // Other errors
            console.error('Postgres check error:', pgResult.stderr);
        }

        return {
            name: dbName,
            engine: 'postgres',
            size,
            tablesCount,
            userCount: 1,
            status: 'healthy'
        };
    } catch (error: any) {
        if (error.message === 'Database not found') throw error;
        console.error('Error fetching PostgreSQL database details:', error);
        throw new Error('Failed to fetch database details.');
    }
}

/**
 * Create a new PostgreSQL database with a user
 */
export async function createPostgresDatabase(
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
        // Postgres logic
        const safeDbName = dbName.replace(/[^a-zA-Z0-9_]/g, '');
        const safeDbUser = dbUser.replace(/[^a-zA-Z0-9_]/g, '');

        const commands = [
            `sudo -u postgres psql -c "CREATE USER ${safeDbUser} WITH PASSWORD '${dbPass}';"`,
            `sudo -u postgres psql -c "CREATE DATABASE ${safeDbName} OWNER ${safeDbUser};"`,
            `sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE ${safeDbName} TO ${safeDbUser};"`
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
        console.error('Error creating PostgreSQL database:', error);
        return {
            success: false,
            message: error.message || 'Database creation failed.'
        };
    }
}

/**
 * Drop a PostgreSQL database
 */
export async function dropPostgresDatabase(
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
            `sudo -u postgres psql -t -c "SELECT datname FROM pg_database WHERE datname = '${safeDbName}';"`,
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

        const disconnectResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo -u postgres psql -d postgres -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = '${safeDbName}' AND pid <> pg_backend_pid();"`,
            undefined,
            undefined,
            true
        );

        if (disconnectResult.code !== 0) {
            throw new Error(disconnectResult.stderr || 'Failed to terminate active database sessions.');
        }

        const dropResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo -u postgres psql -d postgres -c "DROP DATABASE \\"${safeDbName}\\";"`,
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
        console.error('Error dropping PostgreSQL database:', error);
        return {
            success: false,
            message: error.message || 'Failed to drop database.'
        };
    }
}

/**
 * List all users for a PostgreSQL database
 */
export async function listPostgresUsers(serverId: string, dbName: string): Promise<DatabaseUser[]> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    const users: DatabaseUser[] = [];
    try {
        // Get all roles that can login and have some privilege on this database
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo -u postgres psql -t -c "SELECT DISTINCT r.rolname FROM pg_roles r WHERE r.rolcanlogin = true AND (has_database_privilege(r.rolname, '${dbName}', 'CONNECT') OR r.rolsuper = true);"`,
            undefined,
            undefined,
            true
        );

        if (result.code === 0) {
            const lines = result.stdout.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                const username = line.trim();
                if (!username) continue;

                // Check actual privileges for this user on this database
                const privResult = await runCommandOnServer(
                    server.publicIp,
                    server.username,
                    server.privateKey,
                    `sudo -u postgres psql -t -c "SELECT has_database_privilege('${username}', '${dbName}', 'CREATE') as create_priv, has_database_privilege('${username}', '${dbName}', 'TEMP') as temp_priv, has_database_privilege('${username}', '${dbName}', 'CONNECT') as connect_priv;"`,
                    undefined,
                    undefined,
                    true
                );

                let perms: 'full' | 'read' | 'custom' = 'read';

                if (privResult.code === 0 && privResult.stdout) {
                    const privLine = privResult.stdout.trim();
                    // Format: "t | t | t" or "f | f | t"
                    const [createPriv] = privLine.split('|').map(s => s.trim());

                    // If user has CREATE privilege, they likely have full access
                    // Also check if they're a superuser or database owner
                    const ownerResult = await runCommandOnServer(
                        server.publicIp,
                        server.username,
                        server.privateKey,
                        `sudo -u postgres psql -t -c "SELECT pg_catalog.pg_get_userbyid(d.datdba) = '${username}' as is_owner, r.rolsuper FROM pg_database d, pg_roles r WHERE d.datname = '${dbName}' AND r.rolname = '${username}';"`,
                        undefined,
                        undefined,
                        true
                    );

                    if (ownerResult.code === 0 && ownerResult.stdout) {
                        const ownerLine = ownerResult.stdout.trim();
                        const [isOwner, isSuperuser] = ownerLine.split('|').map(s => s.trim());

                        if (isSuperuser === 't' || isOwner === 't' || createPriv === 't') {
                            perms = 'full';
                        } else {
                            perms = 'read';
                        }
                    }
                }

                users.push({
                    username,
                    host: 'localhost',
                    permissions: perms
                });
            }
        }
    } catch (e) {
        console.error('Failed to list PostgreSQL database users', e);
    }
    return users;
}

/**
 * Create a new user for a PostgreSQL database
 */
export async function createPostgresUser(
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

        const privs = permissions === 'full' ? 'ALL PRIVILEGES' : 'SELECT';
        const commands = [
            `sudo -u postgres psql -c "CREATE USER ${safeUser} WITH PASSWORD '${password}';"`,
            `sudo -u postgres psql -c "GRANT ${privs} ON DATABASE ${safeDb} TO ${safeUser};"`
        ];

        if (permissions === 'read') {
            // For Postgres read-only, we also need to grant on schema tables
            commands.push(`sudo -u postgres psql -d ${safeDb} -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${safeUser};"`);
        }

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
 * Delete a PostgreSQL user
 */
export async function deletePostgresUser(
    serverId: string,
    username: string
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server missing.');
    }

    try {
        const cmd = `sudo -u postgres psql -c "DROP ROLE ${username};"`;
        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);

        if (result.code !== 0) {
            // Check if role doesn't exist
            if (result.stderr.includes('does not exist')) {
                return { success: false, message: `User '${username}' does not exist.` };
            }
            // Check if role owns objects
            if (result.stderr.includes('cannot be dropped because some objects depend on it')) {
                return { success: false, message: `Cannot delete user '${username}' because it owns database objects. Please reassign or drop those objects first.` };
            }
            throw new Error(result.stderr || 'Failed to delete user');
        }

        return { success: true, message: `User ${username} deleted successfully.` };
    } catch (error: any) {
        console.error('Error deleting PostgreSQL user:', error);
        return { success: false, message: error.message || 'Delete failed.' };
    }
}

/**
 * Update PostgreSQL user permissions
 */
export async function updatePostgresUserPermissions(
    serverId: string,
    dbName: string,
    username: string,
    permissions: 'full' | 'read'
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server missing.');
    }

    try {
        const safeDb = dbName.replace(/[^a-zA-Z0-9_]/g, '');
        const privs = permissions === 'full' ? 'ALL PRIVILEGES' : 'SELECT';

        const commands = [
            `sudo -u postgres psql -c "REVOKE ALL PRIVILEGES ON DATABASE ${safeDb} FROM ${username};"`,
            `sudo -u postgres psql -c "GRANT ${privs} ON DATABASE ${safeDb} TO ${username};"`
        ];

        if (permissions === 'read') {
            commands.push(`sudo -u postgres psql -d ${safeDb} -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO ${username};"`);
        }

        for (const cmd of commands) {
            await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);
        }

        return { success: true, message: `Permissions updated to ${permissions}.` };
    } catch (error: any) {
        return { success: false, message: error.message || 'Update failed.' };
    }
}

/**
 * Update PostgreSQL user password
 */
export async function updatePostgresUserPassword(
    serverId: string,
    username: string,
    newPassword: string
): Promise<OperationResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server missing.');
    }

    try {
        const cmd = `sudo -u postgres psql -c "ALTER USER ${username} WITH PASSWORD '${newPassword}';"`;
        const res = await runCommandOnServer(server.publicIp, server.username, server.privateKey, cmd, undefined, undefined, true);

        if (res.code !== 0) {
            throw new Error(res.stderr);
        }

        return { success: true, message: `Password updated for user ${username}.` };
    } catch (error: any) {
        return { success: false, message: error.message || 'Password update failed.' };
    }
}

/**
 * Generate a backup of a PostgreSQL database
 */
export async function generatePostgresBackup(
    serverId: string,
    dbName: string,
    mode: 'full' | 'schema'
): Promise<BackupResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${dbName}_${mode}_${timestamp}.sql`;
        const options = mode === 'schema' ? '--schema-only' : '';

        const backupCmd = `sudo -u postgres pg_dump ${options} ${dbName}`;

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
        console.error('PostgreSQL backup error:', error);
        return {
            success: false,
            message: error.message || 'Failed to generate backup.'
        };
    }
}

/**
 * Execute a query on a PostgreSQL database
 */
export async function executePostgresQuery(
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

        const cmd = `sudo -u postgres psql -d ${dbName} -A -F "\t" -P footer=off -f ${tempFile}`;

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
