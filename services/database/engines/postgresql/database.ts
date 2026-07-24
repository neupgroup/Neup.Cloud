'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import type { DatabaseDetails, OperationResult } from '../_types';

/**
 * Get detailed information about a PostgreSQL database
 */
export async function getPostgresDetails(serverId: string, dbName: string): Promise<DatabaseDetails> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
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
    if (!server || !server.username) {
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
