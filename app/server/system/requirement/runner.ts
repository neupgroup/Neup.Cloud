'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';

import { executeCommand } from '@/app/server/commands/actions';

export async function checkRequirementStep(serverId: string, command: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) return { error: 'Server or credentials not found' };

    try {
        const res = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true);
        return {
            completed: res.code === 0,
            output: res.stdout.trim()
        };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function installRequirementStep(serverId: string, command: string) {
    try {
        const result = await executeCommand(serverId, command, 'System Requirement Install', command);
        if (result.error) {
            return { error: result.error };
        }
        return { success: true, output: result.output };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function uninstallRequirementStep(serverId: string, command: string) {
    try {
        const result = await executeCommand(serverId, command, 'System Requirement Uninstall', command);
        if (result.error) {
            return { error: result.error };
        }
        return { success: true, output: result.output };
    } catch (e: any) {
        return { error: e.message };
    }
}
