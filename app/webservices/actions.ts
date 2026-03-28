'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { getServerForRunner } from '@/app/servers/actions';
import { runCommandOnServer } from '@/services/ssh';
import { createRecordId, queryAppDb, toIsoString } from '@/lib/app-db';

export type WebServiceType = 'nginx' | 'apache' | 'caddy';

export interface WebServiceConfig {
    id?: string;
    name?: string; // Optional configuration name
    type: WebServiceType;
    created_on: any;
    created_by: string;
    value: any; // JSON configuration
    serverId?: string; // Optional server reference
    serverName?: string; // Optional server name
    isDraft?: boolean;
    isSynced?: boolean;
}

/**
 * Save a web service configuration
 */
export async function saveWebServiceConfig(
    type: WebServiceType,
    value: any,
    createdBy: string,
    serverId?: string,
    serverName?: string,
    name?: string
): Promise<{ success: boolean; id?: string; message?: string }> {
    try {
        const id = createRecordId();
        await queryAppDb(`
          INSERT INTO webservices (
            id,
            name,
            type,
            "created_on",
            "created_by",
            value,
            "serverId",
            "serverName"
          )
          VALUES ($1, $2, $3, NOW(), $4, $5::jsonb, $6, $7)
        `, [
          id,
          name ?? null,
          type,
          createdBy,
          JSON.stringify(value),
          serverId ?? null,
          serverName ?? null,
        ]);

        revalidatePath('/webservices');
        revalidatePath('/webservices/nginx');

        return {
            success: true,
            id,
            message: 'Configuration saved successfully'
        };
    } catch (error: any) {
        console.error('Error saving web service config:', error);
        return {
            success: false,
            message: error.message || 'Failed to save configuration'
        };
    }
}

/**
 * Update an existing web service configuration
 */
export async function updateWebServiceConfig(
    id: string,
    value: any,
    name?: string
): Promise<{ success: boolean; message?: string }> {
    try {
        await queryAppDb(`
          UPDATE webservices
          SET
            value = $2::jsonb,
            "updated_on" = NOW(),
            name = COALESCE($3, name)
          WHERE id = $1
        `, [id, JSON.stringify(value), name ?? null]);

        revalidatePath('/webservices');
        revalidatePath('/webservices/nginx');

        return {
            success: true,
            message: 'Configuration updated successfully'
        };
    } catch (error: any) {
        console.error('Error updating web service config:', error);
        return {
            success: false,
            message: error.message || 'Failed to update configuration'
        };
    }
}

/**
 * Delete a web service configuration
 */
export async function deleteWebServiceConfig(id: string): Promise<{ success: boolean; message?: string }> {
    try {
        await queryAppDb(`
          DELETE FROM webservices
          WHERE id = $1
        `, [id]);

        revalidatePath('/webservices');
        revalidatePath('/webservices/nginx');

        return {
            success: true,
            message: 'Configuration deleted successfully'
        };
    } catch (error: any) {
        console.error('Error deleting web service config:', error);
        return {
            success: false,
            message: error.message || 'Failed to delete configuration'
        };
    }
}

/**
 * Get a specific web service configuration by ID
 */
export async function getWebServiceConfig(id: string): Promise<WebServiceConfig | null> {
    try {
        const result = await queryAppDb<any>(`
          SELECT *
          FROM webservices
          WHERE id = $1
          LIMIT 1
        `, [id]);

        const row = result.rows[0];
        return row ? serializeConfig(row) : null;
    } catch (error) {
        console.error('Error getting web service config:', error);
        return null;
    }
}

function serializeConfig(data: any): WebServiceConfig {
    return {
        id: data.id,
        ...data,
        created_on: toIsoString(data.created_on) ?? data.created_on,
        updated_on: toIsoString(data.updated_on) ?? data.updated_on,
    };
}

/**
 * Get all web service configurations
 */
export async function getAllWebServiceConfigs(): Promise<WebServiceConfig[]> {
    try {
        const result = await queryAppDb<any>(`
          SELECT *
          FROM webservices
          ORDER BY "created_on" DESC
        `);

        return result.rows.map(serializeConfig);
    } catch (error) {
        console.error('Error getting web service configs:', error);
        return [];
    }
}

/**
 * Get web service configurations by type
 */
export async function getWebServiceConfigsByType(type: WebServiceType): Promise<WebServiceConfig[]> {
    try {
        const result = await queryAppDb<any>(`
          SELECT *
          FROM webservices
          WHERE type = $1
          ORDER BY "created_on" DESC
        `, [type]);

        return result.rows.map(serializeConfig);
    } catch (error) {
        console.error('Error getting web service configs by type:', error);
        return [];
    }
}

/**
 * Get web service configurations by server
 */
export async function getWebServiceConfigsByServer(serverId: string): Promise<WebServiceConfig[]> {
    try {
        const result = await queryAppDb<any>(`
          SELECT *
          FROM webservices
          WHERE "serverId" = $1
          ORDER BY "created_on" DESC
        `, [serverId]);

        return result.rows.map(serializeConfig);
    } catch (error) {
        console.error('Error getting web service configs by server:', error);
        return [];
    }
}

/**
 * Get the latest web service configuration for a specific type and server
 */
export async function getLatestWebServiceConfig(
    type: WebServiceType,
    serverId?: string
): Promise<WebServiceConfig | null> {
    try {
        const result = serverId
          ? await queryAppDb<any>(`
              SELECT *
              FROM webservices
              WHERE type = $1 AND "serverId" = $2
              ORDER BY "created_on" DESC
              LIMIT 1
            `, [type, serverId])
          : await queryAppDb<any>(`
              SELECT *
              FROM webservices
              WHERE type = $1
              ORDER BY "created_on" DESC
              LIMIT 1
            `, [type]);

        const row = result.rows[0];
        return row ? serializeConfig(row) : null;
    } catch (error) {
        console.error('Error getting latest web service config:', error);
        return null;
    }
}

/**
 * Get all Nginx configurations (Database + Server)
 */
export async function getNginxConfigurations(): Promise<WebServiceConfig[]> {
    try {
        const dbConfigs = await getWebServiceConfigsByType('nginx');

        // Map DB configs to have @ prefix in ID
        const mappedDbConfigs = dbConfigs.map(config => ({
            ...config,
            id: `@${config.id}`,
            isDraft: true
        }));

        const cookieStore = await cookies();
        const serverId = cookieStore.get('selected_server')?.value;

        if (!serverId) {
            return mappedDbConfigs;
        }

        const server = await getServerForRunner(serverId);
        if (!server || !server.username || !server.privateKey) {
            return mappedDbConfigs;
        }

        // Fetch configs from server
        // We scan sites-available AND sites-enabled to find all configs
        const command = `
            # Collect unique filenames from both directories
            # We use a temp file or just processing in memory via piping
            find /etc/nginx/sites-available /etc/nginx/sites-enabled -maxdepth 1 -type f -o -type l 2>/dev/null | xargs -n 1 basename 2>/dev/null | sort | uniq | while read filename; do
                if [ -z "$filename" ]; then continue; fi
                
                is_synced="false"
                source_file=""
                
                # Check if it is in sites-enabled (symlink or file)
                if [ -e "/etc/nginx/sites-enabled/$filename" ]; then
                    is_synced="true"
                    # If it's a file in enabled (not just link), we can read it there
                    source_file="/etc/nginx/sites-enabled/$filename"
                fi
                
                # Prefer reading from sites-available if it exists there (canonical source)
                if [ -e "/etc/nginx/sites-available/$filename" ]; then
                    source_file="/etc/nginx/sites-available/$filename"
                fi
                
                if [ ! -z "$source_file" ]; then
                    echo "---NGINX-CONFIG-START: $filename|$is_synced---";
                    cat "$source_file";
                    echo "---NGINX-CONFIG-END---";
                fi
            done
        `;

        const { stdout, code } = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            command,
            undefined,
            undefined,
            true // Link skipSwap to true for faster read
        );

        if (code !== 0) {
            console.error('Failed to fetch nginx configs from server');
            return mappedDbConfigs;
        }

        const serverConfigs: WebServiceConfig[] = [];
        const fileBlocks = stdout.split('---NGINX-CONFIG-START: ');

        for (const block of fileBlocks) {
            if (!block.trim()) continue;

            const [headerLine, ...contentParts] = block.split('\n');
            const [filename, isSyncedStr] = headerLine.replace(/---$/, '').trim().split('|');

            // Skip default configuration
            if (filename === 'default') continue;

            // Filename is used directly (no stripping of .conf)
            const content = contentParts.join('\n').split('---NGINX-CONFIG-END---')[0];

            // simple regex to find server_name
            const serverNameMatch = content.match(/server_name\s+([^;]+);/);
            const domainName = serverNameMatch ? serverNameMatch[1].trim().split(/\s+/)[0] : '';

            // Should verify if created already in db list?
            // Actually conflicting names between DB and Server is tricky.
            // For now assuming clean separation or server overrides? 
            // Nginx page displays both.

            serverConfigs.push({
                id: filename,
                name: filename,
                type: 'nginx',
                created_on: new Date().toISOString(),
                created_by: 'System',
                serverName: server.name,
                serverId: server.id,
                isSynced: isSyncedStr === 'true',
                isDraft: false,
                value: {
                    domainName: domainName,
                    serverIp: server.publicIp,
                    rawContent: content
                }
            });
        }

        return [...mappedDbConfigs, ...serverConfigs];

    } catch (error) {
        console.error('Error getting combined nginx configs:', error);
        return [];
    }
}

/**
 * Get Nginx configuration by ID (handling both Drafts and Server-side)
 * @param id The configuration ID (prefixed with @ for drafts)
 */
export async function getWebOrServerNginxConfig(id: string): Promise<WebServiceConfig | null> {
    // Case 1: Draft from Database
    if (id.startsWith('@')) {
        const dbId = id.substring(1);
        const config = await getWebServiceConfig(dbId);
        if (config) {
            return { ...config, isDraft: true };
        }
        return null;
    }

    // Case 2: Active Config from Server
    try {
        const cookieStore = await cookies();
        const serverId = cookieStore.get('selected_server')?.value;

        if (!serverId) {
            console.error('No server selected for fetching nginx config');
            return null;
        }

        const server = await getServerForRunner(serverId);
        if (!server || !server.username || !server.privateKey) {
            console.error('Selected server details incomplete');
            return null;
        }

        const filename = id; // ID is the filename

        // Block access to default configuration
        if (filename === 'default') {
            return null;
        }

        // We read from sites-available to get the content even if it's disabled. NO appending of .conf
        // But if not found there, try sites-enabled
        const command = `
            if [ -e "/etc/nginx/sites-available/${filename}" ]; then
                cat "/etc/nginx/sites-available/${filename}"
            elif [ -e "/etc/nginx/sites-enabled/${filename}" ]; then
                cat "/etc/nginx/sites-enabled/${filename}"
            else
                exit 1
            fi
        `;

        const { stdout, code } = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            command
        );

        if (code !== 0) {
            console.error('Failed to read nginx config file');
            return null;
        }

        // Check if synced (enabled)
        const checkSyncedCommand = `[ -e "/etc/nginx/sites-enabled/${filename}" ] && echo "true" || echo "false"`;
        const syncedResult = await runCommandOnServer(
            server.publicIp,
            server.username,
            server.privateKey,
            checkSyncedCommand
        );
        const isSynced = syncedResult.stdout.trim() === 'true';

        // Parse configurations
        const parsedValue = await parseNginxConfig(stdout, server.publicIp);

        // Try to match domain name to a managed domain
        if (parsedValue.domainName && parsedValue.domainName !== '_' && parsedValue.domainName !== 'localhost') {
            try {
                const { getDomains } = await import('@/app/domains/actions');
                const domains = await getDomains();
                // Find exact match
                const matched = domains.find((d: any) => d.name === parsedValue.domainName);
                if (matched) {
                    parsedValue.domainId = matched.id;
                }
            } catch (err) {
                console.error('Error resolving domain for config:', err);
            }
        }

        return {
            id: filename,
            name: filename,
            type: 'nginx',
            created_on: new Date().toISOString(),
            created_by: 'System',
            serverId: server.id,
            serverName: server.name,
            isDraft: false,
            isSynced: isSynced,
            value: parsedValue
        };

    } catch (error) {
        console.error('Error fetching/parsing server nginx config:', error);
        return null;
    }
}

// Helper to parse Nginx Config Text into simpler JSON structure for the Editor
// This is a naive parser focusing on server_name and location blocks with proxy_pass
async function parseNginxConfig(configContent: string, currentServerIp: string) {
    const value: any = {
        serverIp: currentServerIp, // Default to current
        pathRules: []
    };

    // Extract server_name
    const serverNameMatch = configContent.match(/server_name\s+([^;]+);/);
    if (serverNameMatch) {
        const domains = serverNameMatch[1].trim().split(/\s+/);
        const fullServerName = domains[0]; // Take primary

        // If it's effectively an IP or localhost, we might treat it as "no domain" mode
        if (fullServerName === '_' || fullServerName === 'localhost' || fullServerName === currentServerIp) {
            value.domainName = fullServerName;
        } else {
            // Attempt to split subdomain
            // This is naive, ideally we'd match against known domains
            const parts = fullServerName.split('.');
            if (parts.length > 2) {
                value.domainName = parts.slice(-2).join('.');
                value.subdomain = parts.slice(0, -2).join('.');
            } else {
                value.domainName = fullServerName;
            }
            value.domainId = 'manual-domain';
        }
    }

    // Extract location blocks
    const locationRegex = /location\s+([^{]+)\s*{([^}]+)}/g;
    let match;
    const rules = [];

    while ((match = locationRegex.exec(configContent)) !== null) {
        const path = match[1].trim();
        const blockContent = match[2];

        const rule: any = {
            id: `rule-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            path: path,
            action: 'proxy', // default
            proxySettings: {
                customHeaders: []
            }
        };

        // Check for return 404
        if (blockContent.includes('return 404;')) {
            rule.action = 'return-404';
        }
        // Check for return 301/302/307/308
        else if (blockContent.match(/return\s+(301|302|307|308)\s+([^;]+);/)) {
            const redirectMatch = blockContent.match(/return\s+(301|302|307|308)\s+([^;]+);/);
            if (redirectMatch) {
                const code = redirectMatch[1];
                rule.action = `redirect-${code}`;
                let target = redirectMatch[2].trim();

                if (target.includes('$request_uri')) {
                    rule.passParameters = true;
                    target = target.replace('$request_uri', '');
                }

                rule.redirectTarget = target;
            }
        }
        // Check for proxy_pass
        else {
            const proxyPassMatch = blockContent.match(/proxy_pass\s+([^;]+);/);
            if (proxyPassMatch) {
                const proxyUrl = proxyPassMatch[1].trim();

                const localhostMatch = proxyUrl.match(/https?:\/\/(localhost|127\.0\.0\.1):(\d+)/);

                if (localhostMatch) {
                    rule.proxyTarget = 'local-port';
                    rule.localPort = localhostMatch[2];
                } else {
                    const remoteMatch = proxyUrl.match(/https?:\/\/([^:]+)(?::(\d+))?/);
                    if (remoteMatch) {
                        rule.proxyTarget = 'remote-server';
                        rule.serverIp = remoteMatch[1];
                        rule.port = remoteMatch[2] || '80';
                    }
                }
            }
        }

        if (blockContent.includes('proxy_set_header Host')) rule.proxySettings.setHost = true;
        if (blockContent.includes('proxy_set_header X-Real-IP')) rule.proxySettings.setRealIp = true;
        if (blockContent.includes('proxy_set_header X-Forwarded-For')) rule.proxySettings.setForwardedFor = true;
        if (blockContent.includes('proxy_set_header X-Forwarded-Proto')) rule.proxySettings.setForwardedProto = true;
        if (blockContent.includes('proxy_set_header Upgrade $http_upgrade')) rule.proxySettings.upgradeWebSocket = true;

        rules.push(rule);
    }

    if (rules.length > 0) {
        value.pathRules = rules;
    } else {
        value.pathRules = [{
            id: `rule-default`,
            path: '/',
            action: 'proxy',
            proxyTarget: 'local-port',
            localPort: '3000'
        }];
    }

    return value;
}
