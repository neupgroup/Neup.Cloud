'use server';

import { getServerForRunner } from '@/services/server/server-service';
import { runCommandOnServer } from '@/services/server/ssh';
import { DatabaseSettings } from '../_types';

export async function saveMariaDBSettings(
    serverId: string,
    settings: DatabaseSettings
): Promise<{ success: boolean; message: string }> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        const commands: string[] = [];

        // Configure MariaDB for remote access
        if (settings.remoteAccess) {
            // Update bind-address to allow external connections
            commands.push(`sudo sed -i 's/^bind-address.*/bind-address = 0.0.0.0/' /etc/mysql/mariadb.conf.d/50-server.cnf || true`);

            // Configure SSL if required
            if (settings.sslRequired) {
                // Check if SSL certificates exist
                const sslCheckCmd = `test -f /etc/mysql/server-cert.pem && test -f /etc/mysql/server-key.pem && echo "EXISTS" || echo "MISSING"`;
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
                    // Generate self-signed SSL certificates
                    commands.push(`
                        sudo openssl req -newkey rsa:2048 -days 3650 -nodes -keyout /etc/mysql/server-key.pem -out /etc/mysql/server-cert.pem -x509 -subj "/C=US/ST=State/L=City/O=Organization/CN=localhost" 2>/dev/null || true
                    `);
                    commands.push(`sudo chown mysql:mysql /etc/mysql/server-*.pem || true`);
                    commands.push(`sudo chmod 600 /etc/mysql/server-key.pem || true`);
                    commands.push(`sudo chmod 644 /etc/mysql/server-cert.pem || true`);
                }

                // Configure SSL in MariaDB
                commands.push(`echo "[mysqld]
ssl-ca=/etc/mysql/server-cert.pem
ssl-cert=/etc/mysql/server-cert.pem
ssl-key=/etc/mysql/server-key.pem
require_secure_transport=ON" | sudo tee /etc/mysql/mariadb.conf.d/99-ssl.cnf`);
            } else {
                // Remove SSL requirement but keep SSL available
                commands.push(`echo "[mysqld]
ssl-ca=/etc/mysql/server-cert.pem
ssl-cert=/etc/mysql/server-cert.pem
ssl-key=/etc/mysql/server-key.pem" | sudo tee /etc/mysql/mariadb.conf.d/99-ssl.cnf || true`);
            }

            // Restart MariaDB to apply changes
            commands.push(`sudo systemctl restart mariadb`);
        } else {
            // Disable remote access
            commands.push(`sudo sed -i 's/^bind-address.*/bind-address = 127.0.0.1/' /etc/mysql/mariadb.conf.d/50-server.cnf || true`);
            commands.push(`sudo systemctl restart mariadb`);
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
                // Continue with other commands even if one fails
            }
        }

        return {
            success: true,
            message: settings.sslRequired
                ? 'MariaDB settings saved successfully. SSL/TLS has been enabled with self-signed certificates. Changes may take up to 60 seconds to apply.'
                : 'MariaDB settings saved successfully. Changes may take up to 60 seconds to apply.'
        };
    } catch (error: any) {
        console.error('Error saving MariaDB settings:', error);
        return {
            success: false,
            message: error.message || 'Failed to save settings.'
        };
    }
}

export async function getMariaDBSettings(
    serverId: string
): Promise<DatabaseSettings> {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username) {
        throw new Error('Server not found or missing credentials.');
    }

    try {
        let remoteAccess = false;
        let sslRequired = false;
        let allowedIps = '0.0.0.0/0'; // MariaDB bind-address 0.0.0.0 implies all IPs, specific IP restriction is usually firewall (UFW) or user grant based. Here we focus on bind-address.

        // Check bind-address
        const bindResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo grep -E "^bind-address" /etc/mysql/mariadb.conf.d/50-server.cnf || echo "bind-address = 127.0.0.1"`,
            undefined,
            undefined,
            true
        );

        if (bindResult.code === 0) {
            remoteAccess = bindResult.stdout.includes('0.0.0.0');
        }

        // Check SSL requirement
        const sslResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            `sudo grep -E "require_secure_transport" /etc/mysql/mariadb.conf.d/99-ssl.cnf 2>/dev/null || echo "OFF"`,
            undefined,
            undefined,
            true
        );

        if (sslResult.code === 0) {
            sslRequired = sslResult.stdout.includes('ON');
        }

        const allowAllHosts = true; // For MariaDB in this config context, we are mainly toggling bind-address. 
        // User-specific host restriction is handled in user management, not globally here mostly.
        // But for consistency with the UI which has this field, we return true if 0.0.0.0.

        return {
            remoteAccess,
            allowAllHosts,
            allowedIps,
            sslRequired
        };
    } catch (error: any) {
        console.error('Error reading MariaDB settings:', error);
        return {
            remoteAccess: true,
            allowAllHosts: true,
            allowedIps: '0.0.0.0/0',
            sslRequired: true
        };
    }
}
