'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import type { DatabaseDetails, OperationResult } from '../_types';

/**
 * Get detailed information about a MariaDB database
 */
export async function getMariaDBDetails(serverId: string, dbName: string): Promise<DatabaseDetails> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
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
    if (!server || !server.username) {
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
