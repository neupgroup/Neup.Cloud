'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import type { DatabaseUser, OperationResult } from '../_types';

/**
 * List all users for a MariaDB database
 */
export async function listMariaDBUsers(serverId: string, dbName: string): Promise<DatabaseUser[]> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    const users: DatabaseUser[] = [];
    try {
        // First, get all users that have access to this database
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo mysql -N -s -e "SELECT DISTINCT User, Host FROM mysql.db WHERE Db = '${dbName}' UNION SELECT DISTINCT User, Host FROM mysql.user WHERE Super_priv = 'Y';"`,
            undefined,
            undefined,
            true
        );

        if (result.code === 0) {
            const lines = result.stdout.trim().split('\n').filter(Boolean);

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 2) {
                    const username = parts[0];
                    const host = parts[1];

                    // Get actual grants for this user
                    const grantsResult = await runCommandOnServer(
                        server.publicIp,
                        server.username,
                        server.privateKey,
                        `sudo mysql -N -s -e "SHOW GRANTS FOR '${username}'@'${host}';" 2>/dev/null || echo ""`,
                        undefined,
                        undefined,
                        true
                    );

                    let perms: 'full' | 'read' | 'custom' = 'read';

                    if (grantsResult.code === 0 && grantsResult.stdout) {
                        const grants = grantsResult.stdout.toLowerCase();

                        // Check if user has ALL PRIVILEGES on this database
                        if (grants.includes('all privileges') && (grants.includes(`\`${dbName}\``) || grants.includes('*.*'))) {
                            perms = 'full';
                        }
                        // Check for write permissions (INSERT, UPDATE, DELETE)
                        else if ((grants.includes('insert') || grants.includes('update') || grants.includes('delete')) &&
                            (grants.includes(`\`${dbName}\``) || grants.includes('*.*'))) {
                            perms = 'full';
                        }
                        // Only SELECT means read-only
                        else if (grants.includes('select') && (grants.includes(`\`${dbName}\``) || grants.includes('*.*'))) {
                            perms = 'read';
                        }
                    }

                    users.push({
                        username,
                        host,
                        permissions: perms
                    });
                }
            }
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
    if (!server || !server.username) {
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
    if (!server || !server.username) {
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
    if (!server || !server.username) {
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
    if (!server || !server.username) {
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
