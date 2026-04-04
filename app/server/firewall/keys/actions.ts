'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';
import { generateKeyPair } from 'crypto';
import { promisify } from 'util';

const generateKeyPairAsync = promisify(generateKeyPair);

export type SshKey = {
    index: number;
    type: string;
    fingerprint: string;
    comment: string;
    preview: string;
    source: string;
    raw: string;
};

export async function generateSSHKeyPair(comment: string = 'generated-key') {
    try {
        const { publicKey, privateKey } = await generateKeyPairAsync('rsa', {
            modulusLength: 4096,
            publicKeyEncoding: {
                type: 'spki',
                format: 'pem'
            },
            privateKeyEncoding: {
                type: 'pkcs8',
                format: 'pem'
            }
        });

        // The node crypto module generates keys in PEM format (PKCS#8/SPKI).
        // Standard SSH public keys in authorized_keys are in a different format (OpenSSH).
        // Node's crypto module doesn't natively export to OpenSSH format easily without extra work or libraries like ssh-keygen-lite or just using ssh-keygen command if available.
        // However, we can use `ssh-keygen` command on the server if we are running in an environment that has it, OR just stick to node-forge or similar if we wanted pure JS.
        // BUT, since we are in a node environment, let's see if we can convert it. 
        // Actually, simplest is to use `ssh-keygen` for generation if available, or use a library logic. 

        // Let's try to do it properly with `ssh-keygen` assuming the host running this code (the Next.js server) has it.
        // If not, we might need a fallback. 

        // Better approach for pure Node.js without shelling out:
        // Use 'ssh-keygen' is standard on most containers.
        // But let's check if we can do it with a library later if this fails.
        // Actually, for now, let's use `ssh-keygen` via child_process because converting PEM to OpenSSH format manually is tedious (asn1 parsing).

        // Wait, 'crypto' in Node 18+ might support it?
        // Node 20+ might.
        // Let's use `ssh-keygen` command locally on the container.

        const { exec } = require('child_process');
        const execAsync = promisify(exec);

        // Generate a temporary file path
        const tempPath = `/tmp/key_${Date.now()}`;

        // Generate SSH key: -t rsa -b 4096 -C "comment" -f path -N "" (no passphrase)
        await execAsync(`ssh-keygen -t rsa -b 4096 -C "${comment}" -f ${tempPath} -N ""`);

        // Read the files
        const fs = require('fs/promises');
        const pub = await fs.readFile(`${tempPath}.pub`, 'utf8');
        const priv = await fs.readFile(tempPath, 'utf8');

        // Cleanup
        await fs.unlink(tempPath);
        await fs.unlink(`${tempPath}.pub`);

        return { publicKey: pub, privateKey: priv };

    } catch (error: any) {
        console.error("Key generation failed:", error);
        return { error: `Failed to generate key pair: ${error.message}` };
    }
}

export async function addAuthorizedKey(serverId: string, publicKey: string): Promise<{ success?: boolean, error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };

    try {
        // Append key to authorized_keys
        // We should ensure .ssh directory exists
        const cmd = `
            mkdir -p ~/.ssh && 
            chmod 700 ~/.ssh && 
            echo "${publicKey.trim()}" >> ~/.ssh/authorized_keys && 
            chmod 600 ~/.ssh/authorized_keys
        `;

        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey!,
            cmd,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { error: result.stderr || 'Failed to add key' };
        }

        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getAuthorizedKeys(serverId: string): Promise<{ keys?: SshKey[], error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) {
        return { error: 'Server not found.' };
    }
    if (!server.username || !server.privateKey) {
        return { error: 'No username or private key configured for this server.' };
    }

    try {
        // Get absolute path of authorized_keys
        const pathCmd = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'echo "$HOME/.ssh/authorized_keys"',
            undefined,
            undefined,
            true // skipSwap
        );

        const filePath = pathCmd.stdout.trim();

        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `cat "${filePath}"`,
            undefined,
            undefined,
            true // skipSwap
        );

        if (result.code !== 0) {
            // If file doesn't exist, it might just mean no keys (or directory missing). 
            // We can return empty list if file not found, but error if something else.
            // cat: ...: No such file or directory
            if (result.stderr.includes('No such file or directory')) {
                return { keys: [] };
            }
            return { error: result.stderr || `Failed to read authorized_keys. Exit code: ${result.code}` };
        }

        const keys: SshKey[] = [];
        const lines = result.stdout.split('\n');

        lines.forEach((line, index) => {
            const trimmed = line.trim();
            if (!trimmed || trimmed.startsWith('#')) return;

            // Simplified parsing. SSH keys can have options at the start.
            // E.g. "ssh-rsa AAA... comment" or "from="box" ssh-rsa ..."
            // Ideally we find the key type "ssh-rsa", "ssh-ed25519", "ecdsa-..."

            const parts = trimmed.split(' ');
            let typeIndex = -1;

            // Common key types
            const keyTypes = ['ssh-rsa', 'ssh-ed25519', 'ssh-dss', 'ecdsa-sha2-nistp256', 'ecdsa-sha2-nistp384', 'ecdsa-sha2-nistp521'];

            for (let i = 0; i < parts.length; i++) {
                if (keyTypes.includes(parts[i])) {
                    typeIndex = i;
                    break;
                }
            }

            if (typeIndex !== -1 && parts.length > typeIndex + 1) {
                const type = parts[typeIndex];
                const key = parts[typeIndex + 1];
                const comment = parts.slice(typeIndex + 2).join(' ');

                keys.push({
                    index,
                    type,
                    fingerprint: 'N/A', // Real fingerprint generation requires processing the key
                    preview: key.substring(0, 30) + '...' + key.substring(key.length - 10),
                    comment: comment || 'No comment',
                    source: filePath,
                    raw: trimmed
                });
            } else {
                // Fallback for lines we can't easily parse but are not comments
                keys.push({
                    index,
                    type: 'unknown',
                    fingerprint: 'N/A',
                    preview: trimmed.substring(0, 50) + (trimmed.length > 50 ? '...' : ''),
                    comment: 'Unknown format',
                    source: filePath,
                    raw: trimmed
                });
            }
        });

        return { keys };

    } catch (e: any) {
        return { error: `Failed to fetch SSH keys: ${e.message}` };
    }
}
