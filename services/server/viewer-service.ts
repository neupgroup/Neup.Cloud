'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import { revalidatePath } from 'next/cache';
import { getServerSshPassphrase } from '@/services/server/server-metadata';

export async function getFileContent(serverId: string, path: string, isBinary: boolean = false, rootMode: boolean = false) {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };
    if (!server.username || !server.privateKey) return { error: 'SSH config missing.' };
    const sshPassphrase = getServerSshPassphrase(server.moreDetails);

    try {
        let command;
        if (isBinary) {
            // Read binary file as base64
            command = rootMode ? `sudo base64 -w 0 ${path}` : `base64 -w 0 ${path}`;
        } else {
            // Read text file
            command = rootMode ? `sudo cat ${path}` : `cat ${path}`;
        }

        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true, {}, sshPassphrase ?? undefined); // skipSwap - Don't use swap space for file viewer operations

        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to read file.' };
        }

        return { content: result.stdout };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function saveFileContent(serverId: string, path: string, content: string, rootMode: boolean = false) {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };
    if (!server.username || !server.privateKey) return { error: 'SSH config missing.' };
    const sshPassphrase = getServerSshPassphrase(server.moreDetails);

    try {
        // Escape content carefully. 
        // A robust way to write content is to cat from a heredoc or echo, but special characters are tricky.
        // Better approach: encode to base64 locally, then decode on server.
        // This avoids all shell escaping issues.
        const base64Content = Buffer.from(content).toString('base64');
        const command = rootMode
            ? `echo "${base64Content}" | base64 -d | sudo tee ${path} > /dev/null`
            : `echo "${base64Content}" | base64 -d > ${path}`;

        const result = await runCommandOnServer(server.publicIp, server.username, server.privateKey, command, undefined, undefined, true, {}, sshPassphrase ?? undefined); // skipSwap - Don't use swap space for file viewer operations

        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to save file.' };
        }

        revalidatePath('/server/viewer'); // In case anyone is looking
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
