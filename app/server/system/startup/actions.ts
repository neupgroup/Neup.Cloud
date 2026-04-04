'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';

export type StartupService = {
    unitFile: string;
    state: string;
    vendorPreset: string;
};

function parseSystemctlOutput(output: string): StartupService[] {
    if (!output) return [];
    const lines = output.trim().split('\n');
    const services: StartupService[] = [];

    for (const line of lines) {
        const trimmedLine = line.trim();
        if (!trimmedLine) continue;

        // split by whitespace
        const parts = trimmedLine.split(/\s+/);
        
        // Expected format: service_name state [vendor_preset]
        if (parts.length >= 2) {
             if (parts[0].endsWith('.service')) {
                 services.push({
                    unitFile: parts[0],
                    state: parts[1],
                    vendorPreset: parts[2] || '-'
                });
             }
        }
    }

    return services;
}

export async function getStartupServices(serverId: string): Promise<{ services?: StartupService[], error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) {
        return { error: 'Server not found.' };
    }
    if (!server.username || !server.privateKey) {
        return { error: 'No username or private key configured for this server.' };
    }

    try {
        // --no-pager: prevent paging
        // --no-legend: suppress column headers and footer
        const command = "systemctl list-unit-files --type=service --state=enabled --no-pager --no-legend";
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            command
        );

        if (result.code !== 0) {
            return { error: result.stderr || `Failed to get startup services. Exit code: ${result.code}` };
        }

        const services = parseSystemctlOutput(result.stdout);
        // Sort alphabetically
        services.sort((a, b) => a.unitFile.localeCompare(b.unitFile));

        return { services };

    } catch (e: any) {
        return { error: `Failed to get startup services: ${e.message}` };
    }
}

export async function toggleService(serverId: string, serviceName: string, enable: boolean): Promise<{ success?: boolean, error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };
    if (!server.username || !server.privateKey) return { error: 'No credentials.' };

    // --now enables/disables AND starts/stops immediately
    const action = enable ? 'enable' : 'disable';
    const command = `sudo systemctl ${action} --now ${serviceName}`;

    try {
        const result = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            command
        );

        if (result.code !== 0) {
            return { error: result.stderr || `Failed to ${action} service. Exit code: ${result.code}` };
        }
        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}

export async function createService(
    serverId: string, 
    data: { name: string, command: string, description?: string, user?: string, directory?: string }
): Promise<{ success?: boolean, error?: string }> {
    const server = await getServerForRunner(serverId);
    if (!server) return { error: 'Server not found.' };
    if (!server.username || !server.privateKey) return { error: 'No credentials.' };

    const serviceName = data.name.endsWith('.service') ? data.name : `${data.name}.service`;
    const description = data.description || `Service for ${data.name}`;
    const user = data.user || 'root';
    const directory = data.directory || '/root';
    
    const unitFileContent = `[Unit]
Description=${description}
After=network.target

[Service]
Type=simple
User=${user}
WorkingDirectory=${directory}
ExecStart=${data.command}
Restart=always

[Install]
WantedBy=multi-user.target
`;

    // Using heredoc with EOF to write file
    const writeCommand = `cat <<EOF | sudo tee /etc/systemd/system/${serviceName}
${unitFileContent}
EOF`;

    try {
        // 1. Write file
        const writeResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            writeCommand
        );
        if (writeResult.code !== 0) return { error: `Failed to create service file: ${writeResult.stderr}` };

        // 2. Reload daemon
        const reloadResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            'sudo systemctl daemon-reload'
        );
        if (reloadResult.code !== 0) return { error: `Failed to reload daemon: ${reloadResult.stderr}` };

        // 3. Enable and start
        const enableResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo systemctl enable --now ${serviceName}`
        );
        if (enableResult.code !== 0) return { error: `Failed to enable service: ${enableResult.stderr}` };

        return { success: true };
    } catch (e: any) {
        return { error: e.message };
    }
}
