'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import type { QueryResult } from '../_types';

/**
 * Execute a query on a MariaDB database
 */
export async function executeMariaDBQuery(
    serverId: string,
    dbName: string,
    query: string
): Promise<QueryResult> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
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
