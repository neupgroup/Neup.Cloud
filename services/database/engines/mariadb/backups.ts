'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import type { BackupResult } from '../_types';

/**
 * Generate a backup of a MariaDB database
 */
export async function generateMariaDBBackup(
    serverId: string,
    dbName: string,
    mode: 'full' | 'schema'
): Promise<BackupResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
        const filename = `${dbName}_${mode}_${timestamp}.sql`;
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
