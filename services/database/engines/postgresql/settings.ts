'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import { DatabaseSettings } from '../_types';

export async function savePostgresSettings(
    serverId: string,
    settings: DatabaseSettings
): Promise<{ success: boolean; message: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        const commands: string[] = [];

        // Configure PostgreSQL for remote access
        if (settings.remoteAccess) {
            // Check and generate SSL certificates if needed
            if (settings.sslRequired) {
                const sslCheckCmd = `test -f /var/lib/postgresql/server.crt && test -f /var/lib/postgresql/server.key && echo "EXISTS" || echo "MISSING"`;
                const sslCheck = await runCommandOnServer(
                    server.publicIp,
                    server.username,
                    server.privateKey,
                    sslCheckCmd,
                    undefined,
                    undefined,
                    true
                );

                if (sslCheck.stdout.includes('MISSING')) {
                    // Generate self-signed SSL certificates for PostgreSQL
                    commands.push(`
                        sudo openssl req -newkey rsa:2048 -days 3650 -nodes -keyout /var/lib/postgresql/server.key -out /var/lib/postgresql/server.crt -x509 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" 2>/dev/null || true
                    `);
                    commands.push(`sudo chown postgres:postgres /var/lib/postgresql/server.* || true`);
                    commands.push(`sudo chmod 600 /var/lib/postgresql/server.key || true`);
                    commands.push(`sudo chmod 644 /var/lib/postgresql/server.crt || true`);
                }

                // Enable SSL in postgresql.conf
                commands.push(`for f in /etc/postgresql/*/main/postgresql.conf; do [ -f "$f" ] && sudo sed -i "s/^#\\?ssl = .*/ssl = on/" "$f"; done`);
                commands.push(`for f in /etc/postgresql/*/main/postgresql.conf; do [ -f "$f" ] && sudo sed -i "s|^#\\?ssl_cert_file = .*|ssl_cert_file = '/var/lib/postgresql/server.crt'|" "$f"; done`);
                commands.push(`for f in /etc/postgresql/*/main/postgresql.conf; do [ -f "$f" ] && sudo sed -i "s|^#\\?ssl_key_file = .*|ssl_key_file = '/var/lib/postgresql/server.key'|" "$f"; done`);
            }

            // Update postgresql.conf to listen on all addresses
            commands.push(`for f in /etc/postgresql/*/main/postgresql.conf; do [ -f "$f" ] && sudo sed -i "s/^#\\?listen_addresses = .*/listen_addresses = '*'/" "$f"; done`);

            // Configure pg_hba.conf for allowed IPs
            const sslMode = settings.sslRequired ? 'hostssl' : 'host';
            const ipRange = settings.allowAllHosts ? '0.0.0.0/0' : settings.allowedIps;
            const hbaLine = `${sslMode}    all    all    ${ipRange}    md5    # neup-cloud-remote`;

            // Add or update the remote access rule safely
            commands.push(`
                for f in /etc/postgresql/*/main/pg_hba.conf; do 
                    if [ -f "$f" ]; then
                        grep -q "# neup-cloud-remote" "$f" || echo "# neup-cloud-remote" | sudo tee -a "$f";
                        sudo sed -i "s|.*# neup-cloud-remote.*|${hbaLine}|" "$f";
                    fi
                done
            `);

            // Restart PostgreSQL to apply changes
            commands.push(`sudo systemctl restart postgresql`);
        } else {
            // Disable remote access
            commands.push(`for f in /etc/postgresql/*/main/postgresql.conf; do [ -f "$f" ] && sudo sed -i "s/^#\\?listen_addresses = .*/listen_addresses = 'localhost'/" "$f"; done`);
            commands.push(`for f in /etc/postgresql/*/main/pg_hba.conf; do [ -f "$f" ] && sudo sed -i "/# neup-cloud-remote/d" "$f"; done`);
            commands.push(`sudo systemctl restart postgresql`);
        }

        // Execute all commands
        for (const cmd of commands) {
            const result = await runCommandOnServer(
                server.publicIp,
                server.username,
                server.privateKey,
                cmd,
                undefined,
                undefined,
                true // skipSwap
            );

            if (result.code !== 0 && !result.stderr.includes('No such file')) {
                console.error(`Command failed: ${cmd}`, result.stderr);
            }
        }

        return {
            success: true,
            message: settings.sslRequired
                ? 'PostgreSQL settings saved successfully. SSL/TLS has been enabled with self-signed certificates. Changes may take up to 60 seconds to apply.'
                : 'PostgreSQL settings saved successfully. Changes may take up to 60 seconds to apply.'
        };
    } catch (error: any) {
        console.error('Error saving PostgreSQL settings:', error);
        return {
            success: false,
            message: error.message || 'Failed to save settings.'
        };
    }
}

export async function getPostgresSettings(
    serverId: string
): Promise<DatabaseSettings> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        let remoteAccess = false;
        let sslRequired = false;
        let allowedIps = '0.0.0.0/0';

        // Check listen_addresses for PostgreSQL
        const listenResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo grep -E "^listen_addresses" /etc/postgresql/*/main/postgresql.conf || echo "listen_addresses = 'localhost'"`,
            undefined,
            undefined,
            true
        );

        if (listenResult.code === 0) {
            remoteAccess = listenResult.stdout.includes("'*'") || listenResult.stdout.includes('"*"');
        }

        // Check pg_hba.conf for SSL and allowed IPs
        const hbaResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo grep "# neup-cloud-remote" /etc/postgresql/*/main/pg_hba.conf || echo ""`,
            undefined,
            undefined,
            true
        );

        if (hbaResult.code === 0 && hbaResult.stdout.trim()) {
            sslRequired = hbaResult.stdout.includes('hostssl');

            // Extract IP range from the line
            const ipMatch = hbaResult.stdout.match(/(?:host(?:ssl)?)\s+all\s+all\s+([^\s]+)/);
            if (ipMatch && ipMatch[1]) {
                allowedIps = ipMatch[1];
            }
        }

        const allowAllHosts = allowedIps === '0.0.0.0/0';

        return {
            remoteAccess,
            allowAllHosts,
            allowedIps,
            sslRequired
        };
    } catch (error: any) {
        console.error('Error reading PostgreSQL settings:', error);
        return {
            remoteAccess: true,
            allowAllHosts: true,
            allowedIps: '0.0.0.0/0',
            sslRequired: true
        };
    }
}
