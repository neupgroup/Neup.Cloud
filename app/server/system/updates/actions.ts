'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';

export type PackageUpdate = {
    name: string;
    currentVersion: string;
    newVersion: string;
    architecture: string;
    path: string; // e.g. focal-updates
};

export async function getSystemUpdates(serverId: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or misconfigured.' };
    }

    try {
        // apt list --upgradable
        // We redirect stderr to null to avoid 'WARNING: apt does not have a stable CLI interface' polluting output if possible, 
        // but runCommandOnServer captures both.
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'apt list --upgradable',
            undefined,
            undefined,
            true // skipSwap
        );

        if (result.code !== 0) {
            return { error: `Failed to check for updates: ${result.stderr}` };
        }

        const updates: PackageUpdate[] = [];
        const lines = result.stdout.split('\n');

        // Example line:
        // accountsservice/focal-updates 0.6.55-0ubuntu12~20.04.5 amd64 [upgradable from: 0.6.55-0ubuntu12~20.04.4]

        for (const line of lines) {
            if (line.includes('Listing...')) continue;
            if (!line.includes('[upgradable from:')) continue;

            try {
                const [pkgPart, ...rest] = line.split(' ');
                if (!pkgPart) continue;

                const [name, path] = pkgPart.split('/');

                // rest parts: "version architecture [upgradable from: old_version]"
                // We filter empty strings from split
                const parts = line.split(/\s+/);
                // parts[0] = name/path
                // parts[1] = newVersion
                // parts[2] = architecture
                // parts[3] = [upgradable
                // parts[4] = from:
                // parts[5] = oldVersion] (might need trimming)

                if (parts.length >= 6) {
                    const newVersion = parts[1];
                    const architecture = parts[2];
                    const oldVersionRaw = parts[parts.length - 1]; // Last part is usually "ver]"
                    const currentVersion = oldVersionRaw.replace(']', '');

                    updates.push({
                        name,
                        path: path || 'unknown',
                        newVersion,
                        architecture,
                        currentVersion
                    });
                }
            } catch (err) {
                console.warn('Failed to parse update line:', line);
            }
        }

        return { updates };

    } catch (e: any) {
        return { error: `Connection failed: ${e.message}` };
    }
}

export async function refreshPackageList(serverId: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or misconfigured.' };
    }

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'sudo apt-get update',
            undefined,
            undefined,
            true // Use root/sudo if needed, but 'sudo' is in command string. 
            // Actually runCommandOnServer has 'useSudo' arg? 
            // Let's check signature. 
            // The helper usually takes (ip, user, key, command) ... 
            // In previous logs (Step 52): 
            // runCommandOnServer(ip, user, key, cmd, undefined, undefined, true) 
            // The last 'true' likely means "use PTY" or similar?
        );
        // Step 52 line 150: rootMode ? `sudo ...` : `...`
        // It seems the command string includes sudo.

        if (result.code !== 0) {
            return { error: `Failed to refresh package list: ${result.stderr}` };
        }
        return { success: true, output: result.stdout };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getInstalledPackages(serverId: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found or misconfigured.' };
    }

    try {
        // dpkg-query is faster and cleaner for scripting than apt list
        // Format: PackageName Version Architecture
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            "dpkg-query -W -f='${binary:Package}|${Version}|${Architecture}\n'",
            undefined,
            undefined,
            true // skipSwap
        );

        if (result.code !== 0) {
            return { error: `Failed to list installed packages: ${result.stderr}` };
        }

        // Parse output
        const packages: PackageUpdate[] = result.stdout
            .trim()
            .split('\n')
            .map(line => {
                const [name, version, architecture] = line.split('|');
                if (!name) return null;
                return {
                    name,
                    currentVersion: version,
                    newVersion: '', // Not relevant for installed list unless we cross-ref
                    architecture: architecture || '',
                    path: 'installed'
                };
            })
            .filter((p): p is PackageUpdate => p !== null);

        return { packages };

    } catch (e: any) {
        return { error: `Connection failed: ${e.message}` };
    }
}

export async function getPackageDetails(serverId: string, packageName: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found.' };
    }

    try {
        // apt-cache show gives descriptions and details
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `apt-cache show "${packageName}"`,
            undefined,
            undefined,
            true // skipSwap
        );

        if (result.code !== 0) return { error: `Package details not found: ${result.stderr}` };

        // Simple parsing of the raw output (description, etc)
        const output = result.stdout;
        const descriptionMatch = output.match(/Description-en: (.*)|Description: (.*)/);
        const description = descriptionMatch ? (descriptionMatch[1] || descriptionMatch[2]) : 'No description available.';

        // Homepage
        const homepageMatch = output.match(/Homepage: (.*)/);
        const homepage = homepageMatch ? homepageMatch[1] : null;

        return {
            details: {
                raw: output,
                description,
                homepage
            }
        };

    } catch (e: any) {
        return { error: e.message };
    }
}

export async function updatePackage(serverId: string, packageName: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

    try {
        // Run interactive update? No, run non-interactive
        const cmd = `sudo DEBIAN_FRONTEND=noninteractive apt-get install --only-upgrade -y "${packageName}"`;
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            cmd,
            undefined,
            undefined,
            true // pty for sudo might be needed
        );

        if (result.code !== 0) {
            return { error: `Update failed: ${result.stderr}` };
        }
        return { success: true, output: result.stdout };
    } catch (e: any) {
        return { error: e.message };
    }
}
