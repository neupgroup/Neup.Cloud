'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';

import { executeCommand } from '@/services/server/commands/server-command-service';

export async function checkRequirementStep(serverId: string, command: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) return { error: 'Server or credentials not found' };

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

export async function installRequirementStep(serverId: string, command: string, requirementId?: string) {
    try {
        const result = await executeCommand(serverId, command, 'System Requirement Install', command, requirementId ? `requirement:${requirementId}:install` : null);
        if (result.error) {
            return { error: result.error };
        }
        return { success: true, output: result.output };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function uninstallRequirementStep(serverId: string, command: string, requirementId?: string) {
    try {
        const result = await executeCommand(serverId, command, 'System Requirement Uninstall', command, requirementId ? `requirement:${requirementId}:uninstall` : null);
        if (result.error) {
            return { error: result.error };
        }
        return { success: true, output: result.output };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function updateRequirementStep(serverId: string, command: string, requirementId?: string) {
    try {
        const result = await executeCommand(serverId, command, 'System Requirement Update', command, requirementId ? `requirement:${requirementId}:update` : null);
        if (result.error) {
            return { error: result.error };
        }
        return { success: true, output: result.output };
    } catch (e: any) {
        return { error: e.message };
    }
}
