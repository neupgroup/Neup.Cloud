'use server';

// Moved from /app/(main)/processes/actions.ts
import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';

import type { Process } from './types';

function parsePsOutput(output: string): Process[] {
    if (!output) return [];
    const lines = output.trim().split('\n');
    const processes: Process[] = [];

    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        if (parts.length < 5) continue;

        const [pid, user, cpu, memory] = parts;
        const name = parts.slice(4).join(' ');

        processes.push({
            pid,
            user,
            cpu: `${cpu}%`,
            memory,
            name
        });
    }

    return processes;
}

export async function getProcesses(serverId: string): Promise<{ processes?: Process[], error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) {
        return { error: 'Server not found.' };
    }
    if (!server.username) {
        return { error: 'No username or SSH authentication configured for this server.' };
    }

    try {
        const osCheck = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'uname -s',
            undefined,
            undefined,
            true
        );

        if (osCheck.code !== 0) {
            return { error: `Failed to detect operating system. Exit code: ${osCheck.code}` };
        }

        const os = osCheck.stdout.trim();
        if (os !== 'Linux') {
            return { error: `Operating system '${os}' is not supported. Only Linux is supported.` };
        }

        const command = "ps -eo pid,user,%cpu,%mem,cmd --no-headers";
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            command,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { error: result.stderr || `Failed to get process list. Exit code: ${result.code}` };
        }

        const processes = parsePsOutput(result.stdout);
        processes.sort((a, b) => parseFloat(b.cpu) - parseFloat(a.cpu));
        return { processes };
    } catch (e: any) {
        return { error: `Failed to get process list: ${e.message}` };
    }
}

export async function killProcess(serverId: string, pid: string): Promise<{ success?: boolean, error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) {
        return { error: 'Server not found.' };
    }
    if (!server.username) {
        return { error: 'No username or SSH authentication configured for this server.' };
    }

    try {
        const command = `sudo kill -9 ${pid}`;
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            command
        );

        if (result.code !== 0) {
            return { error: result.stderr || `Failed to kill process ${pid}. Exit code: ${result.code}` };
        }

        return { success: true };
    } catch (e: any) {
        return { error: `Failed to kill process: ${e.message}` };
    }
}
