
'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';

export type NetworkConnection = {
    protocol: string;
    localAddress: string;
    peerAddress: string;
    state: string;
    process: string;
    pid: string;
    port: string;
};

function parseSsOutput(output: string): NetworkConnection[] {
    if (!output) return [];
    const lines = output.trim().split('\n');
    const connections: NetworkConnection[] = [];

    // ss -tuanp output format (roughly):
    // Netid State Recv-Q Send-Q Local_Address:Port Peer_Address:Port Process
    // tcp LISTEN 0 128 0.0.0.0:22 0.0.0.0:* users:(("sshd",pid=123,fd=3))

    for (const line of lines) {
        // Skip header if present (though -H should avoid it)
        if (line.startsWith('Netid')) continue;

        // Split by whitespace, but be careful with the last column which can contain spaces
        const parts = line.trim().split(/\s+/);
        if (parts.length < 6) continue;

        const protocol = parts[0];
        const state = parts[1];
        // parts[2] is Recv-Q, parts[3] is Send-Q
        const localAddressFull = parts[4];
        const peerAddressFull = parts[5];
        const processInfoRaw = parts.slice(6).join(' '); // Remainder is process info

        // Extract Port from Local Address
        // IPv4: 0.0.0.0:22 -> 22
        // IPv6: [::]:22 -> 22
        // If it looks like *:http, we might need mapped names, but ss -n prevents that (-n is numeric)
        let port = '';
        let localAddress = localAddressFull;

        const lastColonIndex = localAddressFull.lastIndexOf(':');
        if (lastColonIndex !== -1) {
            port = localAddressFull.substring(lastColonIndex + 1);
            localAddress = localAddressFull.substring(0, lastColonIndex);
        }

        // Parse Process Info
        // users:(("nginx",pid=123,fd=4),("nginx",pid=124,fd=4))
        // or just empty if no permission
        let processName = '-';
        let pid = '-';

        if (processInfoRaw && processInfoRaw.includes('users:((')) {
            try {
                // Regex to capture first process name and pid
                // users:(("process_name",pid=123
                const match = processInfoRaw.match(/"([^"]+)",pid=(\d+)/);
                if (match) {
                    processName = match[1];
                    pid = match[2];
                }
            } catch (e) {
                // ignore parsing error
            }
        }

        connections.push({
            protocol: protocol.toUpperCase(),
            localAddress: localAddress,
            peerAddress: peerAddressFull,
            state: state,
            process: processName,
            pid: pid,
            port: port
        });
    }

    return connections;
}

export async function getNetworkConnections(serverId: string): Promise<{ connections?: NetworkConnection[], error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) {
        return { error: 'Server not found.' };
    }
    if (!server.username) {
        return { error: 'No username or SSH authentication configured for this server.' };
    }

    try {
        // uname check? safe to assume linux for now or just try running ss
        // Use ss -tuanpH
        // -t: tcp
        // -u: udp
        // -a: all (listening + established)
        // -n: numeric ports (easier to parse)
        // -p: processes
        // -H: no header
        const command = "ss -tuanpH";

        // We might need sudo to see all processes, but we run as user first.
        // If we want detailed process info for root processes, user needs sudo NOPASSWD or we miss it.
        // We'll proceed with user privileges.

        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            command,
            undefined,
            undefined,
            true // skipSwap
        );

        if (result.code !== 0) {
            // If ss fails (e.g., net-tools installed but not iproute2), fallback to netstat?
            // "ss" is standard. If 127/command not found, try netstat.
            if (result.stderr.includes('not found')) {
                return { error: 'Command "ss" not found. Please ensure iproute2 is installed.' };
            }
            return { error: result.stderr || `Failed to get network connections. Exit code: ${result.code}` };
        }

        const connections = parseSsOutput(result.stdout);

        // Sort: Listening first, then established
        // Secondary sort by port
        connections.sort((a, b) => {
            if (a.state === 'LISTEN' && b.state !== 'LISTEN') return -1;
            if (a.state !== 'LISTEN' && b.state === 'LISTEN') return 1;
            return parseInt(a.port) - parseInt(b.port);
        });

        return { connections };

    } catch (e: any) {
        return { error: `Failed to get network stats: ${e.message}` };
    }
}
