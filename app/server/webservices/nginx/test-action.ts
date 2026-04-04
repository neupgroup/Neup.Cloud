'use server';

import { executeCommand } from '@/app/server/commands/actions';
import { cookies } from 'next/headers';

export async function testNginxConfiguration() {
    try {
        const cookieStore = await cookies();
        const serverId = cookieStore.get('selected_server')?.value;

        if (!serverId) {
            return {
                success: false,
                error: 'No server selected'
            };
        }

        // Test nginx configuration - will be logged to database for debugging
        // Note: skipSwap is now globally true, so no swap will be created
        const result = await executeCommand(serverId, 'sudo nginx -t 2>&1', 'Test Nginx Configuration');

        // nginx -t outputs to stderr, but we're redirecting it to stdout with 2>&1
        const output = result.output || '';
        const hasError = result.error;

        // Check if the test was successful
        if (output.includes('syntax is ok') && output.includes('test is successful')) {
            return {
                success: true,
                message: 'Configuration test passed successfully',
                output: output
            };
        } else if (output.includes('syntax is ok')) {
            return {
                success: true,
                message: 'Configuration syntax is valid',
                output: output
            };
        } else if (output.includes('emerg') || output.includes('[error]') || hasError) {
            // nginx configuration has errors
            return {
                success: false,
                error: 'Configuration has errors',
                output: output
            };
        } else {
            return {
                success: false,
                error: 'Configuration test failed. Output: ' + output.substring(0, 200),
                output: output
            };
        }
    } catch (error) {
        console.error('Error testing nginx configuration:', error);
        return {
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error occurred'
        };
    }
}
