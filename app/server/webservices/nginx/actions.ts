'use server';

import { revalidatePath } from 'next/cache';
import { runCommandOnServer } from '@/services/ssh';
import { executeCommand, executeQuickCommand } from '@/app/server/commands/actions';
import { getServerForRunner } from '@/app/servers/actions';
import { getServerPublicIp as getServerPublicIpLogic } from '@/app/server/webservices/actions';
import {
    getNginxConfiguration as getNginxConfigurationRecord,
    saveNginxConfiguration as saveNginxConfigurationRecord,
} from '@/services/webservices/nginx/data';
import { generateNginxConfigFromContext as generateNginxConfigFromContextLogic } from '@/services/webservices/nginx/logic';

export interface SubPath {
    id: string;
    path: string;
    action: 'serve-local' | 'return-404';
}

export interface ProxySettings {
    setHost?: boolean;
    setRealIp?: boolean;
    setForwardedFor?: boolean;
    setForwardedProto?: boolean;
    upgradeWebSocket?: boolean;
    customHeaders?: { key: string; value: string; id: string }[];
}

export interface PathRule {
    id: string;
    path: string;
    action: 'proxy' | 'return-404' | 'redirect-301' | 'redirect-302' | 'redirect-307' | 'redirect-308';
    proxyTarget?: 'remote-server' | 'local-port';
    serverId?: string;
    serverName?: string;
    serverIp?: string;
    port?: string;
    localPort?: string;
    proxySettings?: ProxySettings;
    subPaths?: SubPath[];
    redirectTarget?: string;
    passParameters?: boolean;
}

export interface DomainRedirect {
    id: string;
    subdomain?: string;
    domainId: string;
    domainName: string;
    redirectTarget: string;
}

export interface DomainBlock {
    id: string;
    domainId: string;
    domainName: string;
    subdomain?: string;
    domainPath?: string;
    httpsRedirection: boolean;
    sslEnabled: boolean;
    sslCertificateFile?: string; // e.g. "example.com.pem", "my-cert.pem"
    pathRules: PathRule[];
}

export interface NginxConfiguration {
    serverIp: string;
    configName: string;
    blocks: DomainBlock[];
    domainRedirects?: DomainRedirect[];
    updatedAt?: any;
}

type GenerateNginxConfigResult =
    | { success: true; config: string; error?: undefined }
    | { success: false; error: string; config?: undefined };

/**
 * Save Nginx configuration for a specific server
 */
export async function saveNginxConfiguration(
    serverId: string,
    config: NginxConfiguration
) {
    try {
        await saveNginxConfigurationRecord({
            serverId,
            serverIp: config.serverIp,
            configName: config.configName,
            blocks: config.blocks ?? [],
            domainRedirects: config.domainRedirects ?? null,
        });

        revalidatePath('/server/webservices/nginx');

        return { success: true };
    } catch (error: any) {
        console.error('Error saving nginx configuration:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Get Nginx configuration for a specific server
 */
export async function getNginxConfiguration(serverId: string) {
    try {
        const row = await getNginxConfigurationRecord(serverId);
        if (!row) {
            return null;
        }

        return {
          serverIp: row.serverIp,
          configName: row.configName,
          blocks: (row.blocks as unknown as DomainBlock[]) ?? [],
          domainRedirects: (row.domainRedirects as unknown as DomainRedirect[] | null) ?? [],
          updatedAt: row.updatedAt.toISOString(),
        } as NginxConfiguration;
    } catch (error: any) {
        console.error('Error fetching nginx configuration:', error);
        return null;
    }
}

/**
 * Fetch the public IP of a server by running a command on it
 */
export async function getServerPublicIp(serverId: string) {
    return getServerPublicIpLogic(serverId);
}

/**
 * Generate Nginx configuration file content from current context/form state
 * This allows generating config without requiring saved configuration
 */
export async function generateNginxConfigFromContext(config: NginxConfiguration): Promise<GenerateNginxConfigResult> {
    try {
        return generateNginxConfigFromContextLogic(config);
    } catch (error: any) {
        console.error('Error generating nginx config from context:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate Nginx configuration file content from path rules
 */
export async function generateNginxConfigFile(serverId: string): Promise<GenerateNginxConfigResult> {
    try {
        const config = await getNginxConfiguration(serverId);

        if (!config || !config.blocks || config.blocks.length === 0) {
            return {
                success: false,
                error: 'No configuration found for this server'
            };
        }

        // Use the new context-based generator
        return await generateNginxConfigFromContext(config);
    } catch (error: any) {
        console.error('Error generating nginx config:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Delete Nginx configuration from the server
 * Removes from both sites-available and sites-enabled, then reloads nginx
 */
export async function deleteNginxConfig(serverId: string, configName: string) {
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

        // Prevent deletion of default config
        if (configName === 'default') {
            return {
                success: false,
                error: 'Cannot delete default configuration'
            };
        }

        // Delete config from both sites-enabled and sites-available, then reload nginx
        const deleteCommand = `
            sudo rm -f /etc/nginx/sites-enabled/${configName} && \
            sudo rm -f /etc/nginx/sites-available/${configName} && \
            sudo nginx -t && \
            sudo systemctl reload nginx
        `;

        const result = await runCommandOnServer(
            host,
            server.username,
            server.privateKey,
            deleteCommand,
            undefined,
            undefined,
            false
        );

        if (result.code !== 0) {
            return {
                success: false,
                error: `Deletion failed: ${result.stderr}`
            };
        }

        return {
            success: true,
            message: `Nginx configuration '${configName}' deleted and nginx reloaded successfully`,
            output: result.stdout
        };
    } catch (error: any) {
        console.error('Error deleting nginx config:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Deploy the generated Nginx configuration to the server
 */
export async function deployNginxConfig(serverId: string, configContent?: string, configName?: string) {
    try {
        let finalConfig = configContent;

        // If no config content provided, try to generate it from the saved state (backward compatibility)
        if (!finalConfig) {
            const configResult = await generateNginxConfigFile(serverId);
            if (!configResult.success || !configResult.config) {
                return {
                    success: false,
                    error: configResult.error || 'Failed to generate config'
                };
            }
            finalConfig = configResult.config;
        }

        if (!finalConfig) {
            return {
                success: false,
                error: 'Failed to build nginx configuration'
            };
        }

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

        // Determine file name (default to 'default' if not provided)
        const siteName = configName || 'default';
        const configFileName = `/tmp/nginx-${serverId}-${siteName}.conf`;

        // Escape the config content for shell
        const escapedConfig = finalConfig.replace(/'/g, "'\\''");

        // Deploy the config
        // 1. Remove previous config files if they exist (from both sites-enabled and sites-available)
        // 2. Also remove .conf variant if we are deploying a name without extension (to avoid dangling symlinks/conflicts)
        // 3. Write new config to temp file
        // 4. Move to sites-available with the specific name
        // 5. Create symlink to sites-enabled
        // 6. Test config with nginx -t
        // 7. Restart nginx to apply changes

        let cleanupExtra = '';
        if (!siteName.endsWith('.conf')) {
            cleanupExtra = `sudo rm -f /etc/nginx/sites-enabled/${siteName}.conf && sudo rm -f /etc/nginx/sites-available/${siteName}.conf && `;
        }

        const deployCommand = `
            ${cleanupExtra}
            sudo rm -f /etc/nginx/sites-enabled/${siteName} && \
            sudo rm -f /etc/nginx/sites-available/${siteName} && \
            echo '${escapedConfig}' > ${configFileName} && \
            sudo cp ${configFileName} /etc/nginx/sites-available/${siteName} && \
            sudo ln -sf /etc/nginx/sites-available/${siteName} /etc/nginx/sites-enabled/${siteName} && \
            sudo nginx -t && \
            sudo systemctl restart nginx
        `;

        const result = await runCommandOnServer(
            host,
            server.username,
            server.privateKey,
            deployCommand,
            undefined,
            undefined,
            false // Use enhanced runner (with swap) for deployment
        );

        if (result.code !== 0) {
            return {
                success: false,
                error: `Deployment failed: ${result.stderr}`
            };
        }

        return {
            success: true,
            message: `Nginx configuration '${siteName}' deployed and reloaded successfully`,
            output: result.stdout
        };
    } catch (error: any) {
        console.error('Error deploying nginx config:', error);
        return { success: false, error: error.message };
    }
}

/**
 * Generate SSL certificate using Certbot
 */
/**
 * Generate SSL certificate using Certbot
 * Supports HTTP (default) and DNS (for wildcards) validation
 */
export async function generateSslCertificate(
    serverId: string,
    domains: string[],
    configName: string,
    step: 'init' | 'finalize-dns' = 'init'
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

        const sslDir = '/etc/nginx/ssl';
        const certName = configName;
        const keyPath = `${sslDir}/${certName}.key`;
        const certPath = `${sslDir}/${certName}.pem`;

        // Prepare domain flags
        const domainList = Array.isArray(domains) ? domains : [domains];
        const safeDomains = domainList.map(d => d.trim()).filter(d => d);

        if (safeDomains.length === 0) {
            return { success: false, error: 'No domains provided for certificate generation' };
        }

        const primaryDomain = safeDomains[0];
        const domainFlags = safeDomains.map(d => `-d ${d}`).join(' ');
        const isWildcard = safeDomains.some(d => d.includes('*'));

        // ==========================================
        //  HTTP VALIDATION (Standard)
        // ==========================================
        if (!isWildcard) {
            // Use --standalone to avoid dependency on existing (potentially broken) Nginx config
            // 1. Ensure SSL directory exists
            // 2. Ensure firewall allows HTTP/HTTPS
            // 3. Install certbot
            // 4. Stop Nginx to free port 80
            // 5. Generate certificate via --standalone
            // 6. Copy files
            // 7. Restart Nginx
            // 8. Cleanup locks
            const command = `
                # Cleanup potential locks
                sudo rm -f /var/lib/letsencrypt/.certbot.lock
                sudo rm -f /var/log/letsencrypt/.certbot.lock
                
                sudo mkdir -p ${sslDir} && \
                sudo ufw allow 80/tcp && sudo ufw allow 443/tcp && \
                sudo apt-get update && sudo apt-get install -y certbot && \
                
                # Stop Nginx to allow standalone certbot to bind to port 80
                sudo systemctl stop nginx
                
                # Run Certbot (capture exit code to ensure we restart nginx regardless)
                sudo certbot certonly --standalone ${domainFlags} --cert-name ${configName} --non-interactive --agree-tos -m encryption.public@neupgroup.com --force-renewal
                CERTBOT_EXIT=$?
                
                if [ $CERTBOT_EXIT -eq 0 ]; then
                    sudo cp -L /etc/letsencrypt/live/${configName}/privkey.pem ${keyPath} && \
                    sudo cp -L /etc/letsencrypt/live/${configName}/fullchain.pem ${certPath} && \
                    sudo chmod 600 ${keyPath} && \
                    sudo chmod 644 ${certPath}
                fi
                
                # Restart Nginx
                sudo systemctl start nginx || true
                
                exit $CERTBOT_EXIT
            `;

            const result = await executeCommand(
                serverId,
                command,
                `SSL Generation (Standalone): ${configName}`,
                command
            );

            if (result.error) {
                return {
                    success: false,
                    error: `Certificate generation failed: ${result.error}`
                };
            }

            return {
                success: true,
                message: `Certificate for ${safeDomains.join(', ')} generated and saved as ${certName}.key/pem`,
                output: result.output || ''
            };
        }

        // ==========================================
        //  DNS VALIDATION (Wildcard)
        // ==========================================
        const hookScriptPath = '/tmp/neup-cert-hook.sh';
        const challengeFilePath = `/tmp/cert_challenge_${configName}`;
        const signalFilePath = `/tmp/cert_signal_${configName}`;
        const logFilePath = `/tmp/certbot_${configName}.log`;
        const pidFilePath = `/tmp/certbot_${configName}.pid`;

        if (step === 'init') {
            // Cleanup previous runs and locks
            const cleanupCmd = `
                sudo rm -f ${challengeFilePath} ${signalFilePath} ${logFilePath} ${pidFilePath};
                # Cleanup potential Certbot locks
                sudo rm -f /var/lib/letsencrypt/.certbot.lock
                sudo rm -f /var/log/letsencrypt/.certbot.lock
                # Kill any existing certbot process for this config if plausible (risky generic kill, better to rely on pid file if exists)
                if [ -f ${pidFilePath} ]; then
                   sudo kill -9 $(cat ${pidFilePath}) || true
                fi
                # Also try to kill any certbot process to be safe if generic lock cleanup isn't enough
                sudo killall certbot || true
            `;

            // Create Hook Script
            // This script writes the validation token and waits for a signal file
            const createHookCmd = `
cat <<'EOF' > ${hookScriptPath}
#!/bin/bash
# Write validation to file
echo "$CERTBOT_VALIDATION" > ${challengeFilePath}
chmod 644 ${challengeFilePath}

# Wait for signal file (max 10 minutes)
COUNTER=0
while [ ! -f ${signalFilePath} ]; do
  if [ $COUNTER -gt 600 ]; then
    exit 1
  fi
  sleep 1
  let COUNTER=COUNTER+1
done

# Cleanup signal and proceed
rm -f ${signalFilePath}
EOF
chmod +x ${hookScriptPath}
`;

            // Start Certbot in Background
            // We use --manual --auth-hook
            const startCertbotCmd = `
                ${cleanupCmd}
                ${createHookCmd}
                sudo mkdir -p ${sslDir} && \
                sudo apt-get update && sudo apt-get install -y certbot && \
                nohup sudo certbot certonly --manual --preferred-challenges dns ${domainFlags} --cert-name ${configName} --manual-auth-hook ${hookScriptPath} --non-interactive --agree-tos -m encryption.public@neupgroup.com --force-renewal > ${logFilePath} 2>&1 & echo $! > ${pidFilePath}
            `;

            // Init step is background task, we don't need to log everything to history yet as it returns immediately.
            // But we can logging "Init SSL" for transparency.
            await executeCommand(
                serverId,
                startCertbotCmd,
                `Init SSL Wildcard: ${configName}`,
                startCertbotCmd
            );

            // Poll for Challenge File (up to 30 seconds)
            let attempts = 0;
            let challengeToken = '';

            while (attempts < 15) {
                // Wait 2 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));

                const checkCmd = `if [ -f ${challengeFilePath} ]; then cat ${challengeFilePath}; fi`;
                const checkResult = await executeQuickCommand(serverId, checkCmd);

                if (checkResult.output && checkResult.output.trim()) {
                    challengeToken = checkResult.output.trim();
                    break;
                }
                attempts++;
            }

            if (!challengeToken) {
                // Read log to see why it failed
                const logResult = await executeQuickCommand(serverId, `cat ${logFilePath}`);
                return {
                    success: false,
                    error: `Timed out waiting for DNS challenge generation. Certbot log: ${(logResult.output || '').slice(-500)}`
                };
            }

            // Return action required
            return {
                success: true,
                actionRequired: 'dns-verification',
                challenge: challengeToken,
                dnsRecord: `_acme-challenge.${primaryDomain.replace('*.', '')}`,
                message: 'Please add the TXT record to your DNS provider.'
            };

        } else if (step === 'finalize-dns') {
            // Signal Certbot to continue
            const signalCmd = `touch ${signalFilePath}`;
            await executeQuickCommand(serverId, signalCmd);

            // Wait for process to finish (poll PID file)
            // It might take time for Let's Encrypt to verify
            let attempts = 0;
            let finished = false;

            while (attempts < 45) { // Wait up to 90 seconds
                await new Promise(resolve => setTimeout(resolve, 2000));

                // Check if PID is still running
                const checkPidCmd = `if [ -f ${pidFilePath} ] && ps -p $(cat ${pidFilePath}) > /dev/null; then echo "running"; else echo "stopped"; fi`;
                const checkResult = await executeQuickCommand(serverId, checkPidCmd);

                if (checkResult.output && checkResult.output.includes('stopped')) {
                    finished = true;
                    break;
                }
                attempts++;
            }

            // Check Result
            const copyAndCheckCmd = `
                if [ -f /etc/letsencrypt/live/${configName}/fullchain.pem ]; then
                   sudo cp -L /etc/letsencrypt/live/${configName}/privkey.pem ${keyPath} && \
                   sudo cp -L /etc/letsencrypt/live/${configName}/fullchain.pem ${certPath} && \
                   sudo chmod 600 ${keyPath} && \
                   sudo chmod 644 ${certPath} && \
                   echo "SUCCESS"
                else
                   echo "FAILURE"
                fi
            `;

            // This is the important step to see in history!
            const finalResult = await executeCommand(
                serverId,
                copyAndCheckCmd,
                `Finalize SSL Wildcard: ${configName}`,
                copyAndCheckCmd
            );

            // Archive the Certbot log to history for debugging/audit
            await executeCommand(serverId, `cat ${logFilePath}`, `SSL Log: ${configName}`);

            if (finalResult.output && finalResult.output.includes('SUCCESS')) {
                return {
                    success: true,
                    message: `Wildcard certificate generated successfully.`
                };
            } else {
                // Fetch log for immediate error display
                const logResult = await executeQuickCommand(serverId, `cat ${logFilePath}`);
                // Since executeQuickCommand also returns a result object with output/error
                const logContent = logResult.output || logResult.error || 'No log content available';

                return {
                    success: false,
                    error: `Verification failed. Certbot log: ${logContent.slice(-1000)}`
                };
            }
        }

        return { success: false, error: 'Invalid step' };

    } catch (error: any) {
        console.error('Error generating SSL certificate:', error);
        return { success: false, error: error.message };
    }
}
