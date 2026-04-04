'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';

export type FirewallRule = {
    id: number;
    to: string;
    action: string;
    from: string;
    ipv6: boolean;
};

export type FirewallStatus = {
    active: boolean;
    rules: FirewallRule[];
    defaultIncoming: string;
    defaultOutgoing: string;
    error?: string;
};

export async function getFirewallStatus(serverId: string): Promise<FirewallStatus> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        return { active: false, rules: [], defaultIncoming: 'unknown', defaultOutgoing: 'unknown', error: 'Server not found or missing credentials.' };
    }

    try {
        let isActive = false;
        let defaultIncoming = 'unknown';
        let defaultOutgoing = 'unknown';
        const rules: FirewallRule[] = [];

        // Check if UFW is active and get rules with verbose to see defaults
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'sudo ufw status verbose',
            undefined,
            undefined,
            true
        );

        if (result.code === 0) {
            const lines = result.stdout.split('\n');
            isActive = lines[0]?.toLowerCase().includes('status: active');

            if (isActive) {
                // Parse defaults from verbose output
                // Output example: "Default: deny (incoming), allow (outgoing), disabled (routed)"
                const defaultLine = lines.find(line => line.toLowerCase().startsWith('default:'));
                if (defaultLine) {
                    if (defaultLine.includes('deny (incoming)')) defaultIncoming = 'deny';
                    else if (defaultLine.includes('reject (incoming)')) defaultIncoming = 'reject';
                    else if (defaultLine.includes('allow (incoming)')) defaultIncoming = 'allow';

                    if (defaultLine.includes('deny (outgoing)')) defaultOutgoing = 'deny';
                    else if (defaultLine.includes('reject (outgoing)')) defaultOutgoing = 'reject';
                    else if (defaultLine.includes('allow (outgoing)')) defaultOutgoing = 'allow';
                }
            } else if (result.stdout.includes('Status: inactive')) {
                isActive = false;
            } else {
                return { active: false, rules: [], defaultIncoming: 'unknown', defaultOutgoing: 'unknown', error: result.stderr || 'Failed to check firewall status.' };
            }
        } else {
            return { active: false, rules: [], defaultIncoming: 'unknown', defaultOutgoing: 'unknown', error: result.stderr || 'Failed to check firewall status.' };
        }

        // If inactive or defaults not found in status (e.g. non-verbose available), check config file
        if (defaultIncoming === 'unknown' || defaultOutgoing === 'unknown') {
            const configResult = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                'cat /etc/default/ufw',
                undefined,
                undefined,
                true
            );

            if (configResult.code === 0) {
                const configLines = configResult.stdout.split('\n');

                if (defaultIncoming === 'unknown') {
                    const inputLine = configLines.find(line => line.startsWith('DEFAULT_INPUT_POLICY='));
                    if (inputLine) {
                        const val = inputLine.split('=')[1].replace(/"/g, '').trim().toLowerCase();
                        defaultIncoming = val === 'drop' ? 'deny' : val === 'accept' ? 'allow' : val;
                    }
                }

                if (defaultOutgoing === 'unknown') {
                    const outputLine = configLines.find(line => line.startsWith('DEFAULT_OUTPUT_POLICY='));
                    if (outputLine) {
                        const val = outputLine.split('=')[1].replace(/"/g, '').trim().toLowerCase();
                        defaultOutgoing = val === 'drop' ? 'deny' : val === 'accept' ? 'allow' : val;
                    }
                }
            }
        }

        // Fetch numbered rules for deletion purposes
        const numberedResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'sudo ufw status numbered',
            undefined,
            undefined,
            true
        );

        if (numberedResult.code === 0) {
            const numberedLines = numberedResult.stdout.split('\n');
            const ruleRegex = /^\[\s*(\d+)\]\s+(.*?)\s+(ALLOW IN|DENY IN|REJECT IN|LIMIT IN)\s+(.*)$/;

            for (const line of numberedLines) {
                const match = line.match(ruleRegex);
                if (match) {
                    const id = parseInt(match[1]);
                    const to = match[2].trim();
                    const action = match[3].trim();
                    let from = match[4].trim();
                    const isV6 = from.includes('(v6)') || to.includes('(v6)');

                    rules.push({
                        id,
                        to,
                        action,
                        from,
                        ipv6: isV6
                    });
                }
            }
        } else if (!isActive && result.stdout.includes('Status: inactive')) {
            // If inactive, we can't get numbered rules, but we can see 'added' rules
            const addedResult = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                'sudo ufw show added',
                undefined,
                undefined,
                true
            );

            if (addedResult.code === 0) {
                // Parse 'ufw show added' output
                // Example: "ufw allow 5432" or "ufw allow 80/tcp"
                const lines = addedResult.stdout.split('\n');
                let fakeId = 1;
                for (const line of lines) {
                    const cleanLine = line.trim();
                    if (cleanLine.startsWith('ufw ')) {
                        const parts = cleanLine.split(' ');
                        // ufw [action] [to]
                        // very basic parsing
                        const action = parts[1]?.toUpperCase() + ' (PENDING)';
                        const to = parts[2] || 'unknown';

                        rules.push({
                            id: -fakeId, // Negative ID to indicate pending/unmanageable by ID
                            to: to,
                            action: action,
                            from: 'Anywhere', // Assumption for basic 'added' output
                            ipv6: false
                        });
                        fakeId++;
                    }
                }
            }
        }

        return { active: isActive, rules, defaultIncoming, defaultOutgoing };

    } catch (error: any) {
        return { active: false, rules: [], defaultIncoming: 'unknown', defaultOutgoing: 'unknown', error: error.message };
    }
}

export async function allowPort(serverId: string, port: string, protocol: 'tcp' | 'udp' = 'tcp'): Promise<{ success: boolean; message: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found.');
    }

    // Input validation
    if (!/^\d+$/.test(port)) {
        return { success: false, message: 'Invalid port allowed.' };
    }

    // Check if active first
    const statusResult = await runCommandOnServer(
        server.publicIp,
        server.username,
        server.privateKey,
        'sudo ufw status', // simple check
        undefined,
        undefined,
        true
    );

    if (statusResult.code === 0 && statusResult.stdout.includes('Status: inactive')) {
        return { success: false, message: 'Firewall must be enabled to add rules.' };
    }

    try {
        const cmd = `sudo ufw allow ${port}/${protocol}`;
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            cmd,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { success: false, message: result.stderr || 'Failed to allow port.' };
        }

        return { success: true, message: `Port ${port}/${protocol} allowed.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function deleteRule(serverId: string, ruleId: number): Promise<{ success: boolean; message: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found.');
    }

    if (ruleId < 0) {
        return { success: false, message: 'Cannot delete pending rules by ID. Please enable firewall first.' };
    }

    try {
        // ufw delete requires confirmation, so we force it with --force? No, `delete` by number doesn't usually look for confirmation if not interactive, but let's check. 
        // `echo "y" | sudo ufw delete <number>` is safer.
        const cmd = `echo "y" | sudo ufw delete ${ruleId}`;
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            cmd,
            undefined,
            undefined,
            true
        );

        if (result.code !== 0) {
            return { success: false, message: result.stderr || 'Failed to delete rule.' };
        }
        return { success: true, message: `Rule ${ruleId} deleted.` };
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function toggleFirewall(serverId: string, enable: boolean): Promise<{ success: boolean; message: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
        throw new Error('Server not found.');
    }

    try {
        if (enable) {
            // Safety check: ensure SSH (22) is allowed before enabling
            // We check 'ufw show added' to see if 22 is present
            const checkResult = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                'sudo ufw show added',
                undefined,
                undefined,
                true
            );

            const hasSSH = checkResult.stdout.includes(' 22') || checkResult.stdout.includes('ssh');

            if (!hasSSH) {
                // Auto-allow SSH to prevent lockout
                await runCommandOnServer(
                    server.publicIp,
                    server.username,
                    server.privateKey,
                    'sudo ufw allow 22/tcp',
                    undefined,
                    undefined,
                    true
                );
            }

            // Enable
            const cmd = `echo "y" | sudo ufw enable`;
            const result = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                cmd,
                undefined,
                undefined,
                true
            );

            if (result.code !== 0) return { success: false, message: result.stderr || 'Failed to enable firewall.' };
            return { success: true, message: 'Firewall enabled successfully.' };

        } else {
            // Disable
            const cmd = `sudo ufw disable`;
            const result = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                cmd,
                undefined,
                undefined,
                true
            );

            if (result.code !== 0) return { success: false, message: result.stderr || 'Failed to disable firewall.' };
            return { success: true, message: 'Firewall disabled successfully.' };
        }
    } catch (error: any) {
        return { success: false, message: error.message };
    }
}

export async function checkPortConnectivity(serverId: string, port: number): Promise<{ status: 'open' | 'closed' | 'blocked' | 'error', message: string, latency?: number }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.publicIp) {
        return { status: 'error', message: 'Server not found or missing IP.' };
    }

    const net = await import('net');

    const connectionTest = await new Promise<{ status: 'open' | 'closed' | 'blocked' | 'error', message: string, latency?: number }>((resolve) => {
        const start = Date.now();
        const socket = new net.Socket();
        socket.setTimeout(3000);

        socket.on('connect', () => {
            const latency = Date.now() - start;
            socket.destroy();
            resolve({ status: 'open', message: 'Connection successful', latency });
        });

        socket.on('timeout', () => {
            socket.destroy();
            resolve({ status: 'blocked', message: 'Connection timed out' });
        });

        socket.on('error', (err: any) => {
            socket.destroy();
            if (err.code === 'ECONNREFUSED') {
                resolve({ status: 'closed', message: 'Connection refused' });
            } else {
                resolve({ status: 'error', message: err.message });
            }
        });

        try {
            socket.connect(port, server.publicIp);
        } catch (err: any) {
            resolve({ status: 'error', message: err.message });
        }
    });

    // If it's open, return immediately
    if (connectionTest.status === 'open') {
        return { ...connectionTest, message: 'Receiving requests (Handled by application)' };
    }

    // If it failed/timed out, let's check the Firewall (UFW) to see if it's the culprit
    try {
        const fw = await getFirewallStatus(serverId);

        if (!fw.active) {
            // Firewall is off, so it must be something else
            return {
                ...connectionTest,
                message: connectionTest.status === 'closed'
                    ? 'Receiving requests (No application listening)'
                    : 'Not receiving requests'
            };
        }

        // Check rules
        const portStr = port.toString();
        const matchingRule = fw.rules.find(r =>
            r.to === portStr ||
            r.to.startsWith(portStr + '/') ||
            r.to === 'Anywhere'
        );

        if (matchingRule) {
            if (matchingRule.action.includes('ALLOW')) {
                // Rule allows it, but connection still failed
                return {
                    ...connectionTest,
                    message: connectionTest.status === 'closed'
                        ? 'Receiving requests (No application listening)'
                        : 'Not receiving requests'
                };
            } else {
                // Explicitly denied
                return { status: 'blocked', message: 'Not receiving requests' };
            }
        }

        // No specific rule, check default policy
        if (fw.defaultIncoming === 'deny' || fw.defaultIncoming === 'reject') {
            return { status: 'blocked', message: 'Not receiving requests' };
        }

        return {
            status: connectionTest.status,
            message: connectionTest.status === 'closed'
                ? 'Receiving requests (No application listening)'
                : 'Not receiving requests'
        };

    } catch (e) {
        // If we can't check firewall status, just return the original result
        return {
            ...connectionTest,
            message: connectionTest.status === 'closed'
                ? 'Receiving requests (No application listening)'
                : 'Not receiving requests'
        };
    }
}
