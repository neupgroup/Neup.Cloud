'use server';

import { executeCommand } from '@/app/server/commands/actions';
import { cookies } from 'next/headers';

/**
 * Restart Nginx service on the selected server
 */
export async function restartNginxService() {
    try {
        const cookieStore = await cookies();
        const serverId = cookieStore.get('selected_server')?.value;

        if (!serverId) {
            return { success: false, error: 'No server selected' };
        }

        // Execute restart command - will be logged to serverLogs
        const result = await executeCommand(
            serverId,
            'sudo systemctl restart nginx',
            'Restart Nginx Server'
        );

        // Check if command was successful
        if (result.error) {
            return {
                success: false,
                error: result.error
            };
        }

        return {
            success: true,
            message: 'Nginx restarted successfully',
            output: result.output
        };
    } catch (error: any) {
        console.error('Error restarting nginx:', error);
        return { success: false, error: error.message };
    }
}
