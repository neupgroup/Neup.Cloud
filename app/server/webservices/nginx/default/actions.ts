'use server';

import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';

/**
 * Generate a self-signed SSL certificate for the default Nginx configuration
 */
export async function generateDefaultSSLCertificate(
    serverId: string,
    certPath: string = '/etc/nginx/ssl/default.crt',
    keyPath: string = '/etc/nginx/ssl/default.key'
) {
    try {
        const server = await getServerForRunner(serverId);
        if (!server) {
            return { success: false, error: 'Server not found' };
        }

        if (!server.username || !server.privateKey) {
            return {
                success: false,
                error: 'Server credentials not configured'
            };
        }

        const host = server.publicIp || server.privateIp;
        if (!host) {
            return { success: false, error: 'Server is missing a reachable IP address' };
        }

        // Extract directory path (both files should be in the same directory)
        const sslDir = certPath.substring(0, certPath.lastIndexOf('/'));

        // Command to generate self-signed certificate
        // 1. Create directory if it doesn't exist
        // 2. Generate a 2048-bit RSA private key
        // 3. Generate a self-signed certificate valid for 365 days
        // 4. Set appropriate permissions
        const generateCommand = `
            sudo mkdir -p ${sslDir} && \\
            sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \\
                -keyout ${keyPath} \\
                -out ${certPath} \\
                -subj "/C=US/ST=State/L=City/O=Organization/CN=default" && \\
            sudo chmod 644 ${certPath} && \\
            sudo chmod 600 ${keyPath} && \\
            echo "Certificate generated successfully"
        `;

        const result = await runCommandOnServer(
            host,
            server.username,
            server.privateKey,
            generateCommand,
            undefined,
            undefined,
            false // Use enhanced runner
        );

        if (result.code !== 0) {
            return {
                success: false,
                error: `Certificate generation failed: ${result.stderr}`
            };
        }

        return {
            success: true,
            message: 'SSL certificate generated successfully',
            output: result.stdout,
            certPath,
            keyPath
        };
    } catch (error: any) {
        console.error('Error generating SSL certificate:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deploy the default Nginx configuration to the server
 */
export async function deployDefaultNginxConfig(
    serverId: string,
    configContent: string
) {
    try {
        const server = await getServerForRunner(serverId);
        if (!server) {
            return { success: false, error: 'Server not found' };
        }

        if (!server.username || !server.privateKey) {
            return {
                success: false,
                error: 'Server credentials not configured'
            };
        }

        const host = server.publicIp || server.privateIp;
        if (!host) {
            return { success: false, error: 'Server is missing a reachable IP address' };
        }

        const configFileName = `/tmp/nginx-default-${serverId}.conf`;

        // Escape the config content for shell
        const escapedConfig = configContent.replace(/'/g, "'\\''");

        // Deploy the config
        // 1. Remove existing default config if it exists
        // 2. Write new config to temp file
        // 3. Move to sites-available
        // 4. Create symlink to sites-enabled
        // 5. Test config with nginx -t
        // 6. Restart nginx to apply changes
        const deployCommand = `
            sudo rm -f /etc/nginx/sites-enabled/default && \\
            sudo rm -f /etc/nginx/sites-available/default && \\
            echo '${escapedConfig}' > ${configFileName} && \\
            sudo cp ${configFileName} /etc/nginx/sites-available/default && \\
            sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default && \\
            sudo nginx -t && \\
            sudo systemctl restart nginx && \\
            echo "Default configuration deployed successfully"
        `;

        const result = await runCommandOnServer(
            host,
            server.username,
            server.privateKey,
            deployCommand,
            undefined,
            undefined,
            false // Use enhanced runner
        );

        if (result.code !== 0) {
            return {
                success: false,
                error: `Deployment failed: ${result.stderr}`
            };
        }

        return {
            success: true,
            message: 'Default Nginx configuration deployed and reloaded successfully',
            output: result.stdout
        };
    } catch (error: any) {
        console.error('Error deploying default nginx config:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate the default Nginx configuration content
 */
export async function generateDefaultConfigContent(
    certPath: string = '/etc/nginx/ssl/default.crt',
    keyPath: string = '/etc/nginx/ssl/default.key',
    redirectUrl: string = 'https://neupgroup.com/cloud'
) {
    const config = `# DEFAULT CATCH-ALL HANDLER
# File: default.conf
#
# Purpose:
# - Catch IP access & unknown domains
# - Redirect HTTP + HTTPS to ${redirectUrl}
# - No content served, ever

server {
    # HTTP
    listen 80 default_server;
    listen [::]:80 default_server;

    # HTTPS
    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    # Catch-all
    server_name _;

    # SSL certificate paths
    ssl_certificate     ${certPath};
    ssl_certificate_key ${keyPath};

    # TLS hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache off;

    # Absolute redirect
    return 301 ${redirectUrl};
}
`;

    return { success: true, config };
}
