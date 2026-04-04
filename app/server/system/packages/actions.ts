'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';

export type PackageSearchResult = {
    name: string;
    description: string;
    isInstalled: boolean;
    installedVersion?: string;
    candidateVersion?: string;
};

export type PackageVersionInfo = {
    version: string;
    source: string;
    isInstalled: boolean;
};

// Search all available packages
export async function searchAvailablePackages(serverId: string, query: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { error: 'Server not found.' };
    }

    try {
        // apt-cache search returns: package - description
        // We limit to 50 results
        // Also check if installed. This is a bit heavy combined.
        // Better: search first, then check status for the results.

        // Step 1: Search
        // Skip swap for read-only ops
        const searchRes = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `apt-cache search "${query}" | head -n 50`,
            undefined, undefined, true
        );

        if (searchRes.code !== 0) return { error: `Search failed: ${searchRes.stderr}` };

        const lines = searchRes.stdout.trim().split('\n');
        const results: PackageSearchResult[] = [];

        // For performance, we might just get the names and do a bulk dpkg check or apt-cache policy check?
        // Bulk check: dpkg-query -W -f='${Package} ${Version}\n' package1 package2 ...
        // But apt-cache search output is "name - description"

        const packageNames: string[] = [];

        for (const line of lines) {
            if (!line) continue;
            // Split by " - " is risky if name has hyphen, but apt output is usually "name - desc" 
            // Actually it's just spaces first separation maybe? 
            // "vim - Vi IMproved - enhanced vi editor"
            const firstSpace = line.indexOf(' ');
            if (firstSpace === -1) continue;

            const name = line.substring(0, firstSpace);
            const description = line.substring(firstSpace).replace(/^[ \-]+/, '');

            // Filter duplicates/garbage
            if (name) {
                results.push({ name, description, isInstalled: false });
                packageNames.push(name);
            }
        }

        if (packageNames.length === 0) return { packages: [] };

        // Step 2: Check installed status for these packages
        // We can run `dpkg-query -W -f='${Package}|${Version}\n' [names]`
        // This fails if a package is NOT installed.
        // Instead, run `dpkg -l [names]` or `apt list [names]`? `apt list` is slow.
        // Better: `dpkg-query --show --showformat='${Package}|${Version}\n' name1 name2 ...` 
        // will error for uninstalled ones.
        // Best approach: Parse `apt list --installed` ? No, too big.

        // Let's use loop for safety or a safe command.
        // Actually, for a list of packages:
        // `dpkg-query -W -f='${Package}|${Version}\n' name || true` might work per item but slow.

        // Robust way: Get ALL installed packages again (fast with dpkg) and cross-reference in memory.
        const installedRes = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            "dpkg-query -W -f='${binary:Package}|${Version}\n'",
            undefined, undefined, true
        );

        const installedMap = new Map<string, string>();
        if (installedRes.code === 0) {
            installedRes.stdout.split('\n').forEach(line => {
                const [pkg, ver] = line.split('|');
                if (pkg) installedMap.set(pkg, ver || '');
            });
        }

        // Map back 
        const finalResults = results.map(p => ({
            ...p,
            isInstalled: installedMap.has(p.name),
            installedVersion: installedMap.get(p.name)
        }));

        return { packages: finalResults };

    } catch (e: any) {
        return { error: e.message };
    }
}

export async function getPackageVersions(serverId: string, packageName: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) return { error: 'Server not found.' };

    try {
        // Use apt-cache policy to see installed and candidate
        // And `apt-cache madison` strictly shows versions available in repo
        const res = await runCommandOnServer(
            server.publicIp, server.username, server.privateKey,
            `apt-cache policy "${packageName}"`,
            undefined, undefined, true
        );

        if (res.code !== 0) return { error: `Failed to fetch versions: ${res.stderr}` };

        const output = res.stdout;

        // Parse "Installed: ..." and "Candidate: ..."
        const installedMatch = output.match(/Installed: (.+)/);
        const candidateMatch = output.match(/Candidate: (.+)/);

        const currentInstalled = installedMatch && installedMatch[1] !== '(none)' ? installedMatch[1].trim() : null;
        const candidate = candidateMatch && candidateMatch[1] !== '(none)' ? candidateMatch[1].trim() : null;

        // "Version table:"
        // Start parsing lines after "Version table:"
        const lines = output.split('\n');
        const versionTableIndex = lines.findIndex(l => l.trim().startsWith('Version table:'));

        const versions: PackageVersionInfo[] = [];

        if (versionTableIndex !== -1) {
            for (let i = versionTableIndex + 1; i < lines.length; i++) {
                const line = lines[i];
                if (!line || !line.trim()) continue;

                // Format usually: 
                // *** 1.2.3 500
                //        500 http://...
                //      1.0.0 500
                //        500 http://...

                // We look for lines starting with version number (and optional ***)
                // " *** 1.18.0-0ubuntu1.4 500"
                // "     1.18.0-0ubuntu1 500"

                const trimmed = line.trim();
                // Check if it's a source line (http...) -> skip
                if (trimmed.startsWith('500') || trimmed.startsWith('100') || trimmed.startsWith('http') || trimmed.startsWith('var/lib/dpkg')) continue;

                // It's a version line
                // Remove *** if present
                const cleanLine = trimmed.replace(/^\*\*\*\s*/, '');
                const [ver] = cleanLine.split(' ');

                if (ver) {
                    versions.push({
                        version: ver,
                        source: 'repo', // simplified
                        isInstalled: ver === currentInstalled
                    });
                }
            }
        }

        return {
            versions,
            currentInstalled,
            candidate
        };

    } catch (e: any) {
        return { error: e.message };
    }
}

export async function installPackage(serverId: string, packageName: string, version?: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

    try {
        let cmd = '';
        if (version) {
            // Install specific version
            cmd = `sudo DEBIAN_FRONTEND=noninteractive apt-get install -y --allow-downgrades "${packageName}=${version}"`;
        } else {
            // Latest
            cmd = `sudo DEBIAN_FRONTEND=noninteractive apt-get install -y "${packageName}"`;
        }

        const result = await runCommandOnServer(
            server.publicIp, server.username, server.privateKey,
            cmd, undefined, undefined, true
        );

        if (result.code !== 0) return { error: `Install failed: ${result.stderr}` };
        return { success: true, output: result.stdout };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function uninstallPackage(serverId: string, packageName: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

    try {
        const cmd = `sudo DEBIAN_FRONTEND=noninteractive apt-get remove -y "${packageName}"`;
        const result = await runCommandOnServer(
            server.publicIp, server.username, server.privateKey,
            cmd, undefined, undefined, true
        );

        if (result.code !== 0) return { error: `Uninstall failed: ${result.stderr}` };
        return { success: true, output: result.stdout };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function reinstallPackage(serverId: string, packageName: string) {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) return { error: 'Server configuration missing.' };

    try {
        const cmd = `sudo DEBIAN_FRONTEND=noninteractive apt-get install --reinstall -y "${packageName}"`;
        const result = await runCommandOnServer(
            server.publicIp, server.username, server.privateKey,
            cmd, undefined, undefined, true
        );

        if (result.code !== 0) return { error: `Reinstall failed: ${result.stderr}` };
        return { success: true, output: result.stdout };
    } catch (e: any) {
        return { error: e.message };
    }
}
