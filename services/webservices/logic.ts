import { runCommandOnServer } from '@/services/ssh';
import { getDomains } from '@/services/domains/data';
import {
  getAllWebServices,
  getLatestWebService,
  getWebServiceById,
  getWebServicesByType,
} from '@/services/webservices/data';
import { getServerForRunner } from '@/services/servers/logic';
import type { WebServiceConfig } from '@/app/server/webservices/actions';

export async function getServerPublicIp(serverId: string) {
  try {
    const server = await getServerForRunner(serverId);
    if (!server) {
      return { success: false, error: 'Server not found' };
    }

    if (server.publicIp) {
      return { success: true, publicIp: server.publicIp };
    }

    if (!server.username || !server.privateKey) {
      return {
        success: false,
        error: 'Server credentials not configured for SSH access',
      };
    }

    const commands = [
      'curl -s ifconfig.me',
      'curl -s icanhazip.com',
      'curl -s ipecho.net/plain',
      'dig +short myip.opendns.com @resolver1.opendns.com',
    ];

    const host = server.publicIp || server.privateIp;
    if (!host) {
      return {
        success: false,
        error: 'Server is missing a reachable IP address',
      };
    }

    for (const command of commands) {
      try {
        const result = await runCommandOnServer(
          host,
          server.username,
          server.privateKey,
          command,
          undefined,
          undefined,
          true
        );

        if (result.code === 0 && result.stdout.trim()) {
          return { success: true, publicIp: result.stdout.trim() };
        }
      } catch {
        // Try the next provider.
      }
    }

    return {
      success: false,
      error: 'Failed to fetch public IP from server',
    };
  } catch (error: any) {
    console.error('Error fetching server public IP:', error);
    return { success: false, error: error.message };
  }
}

export async function getNginxConfigurationsForServer(serverId?: string): Promise<WebServiceConfig[]> {
  try {
    const dbConfigs = await getWebServicesByType('nginx');
    const draftConfigs = dbConfigs.map((config) => ({
      ...config,
      id: `@${config.id}`,
      isDraft: true,
    }));

    if (!serverId) {
      return draftConfigs;
    }

    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
      return draftConfigs;
    }

    const command = `
      find /etc/nginx/sites-available /etc/nginx/sites-enabled -maxdepth 1 -type f -o -type l 2>/dev/null \
        | xargs -n 1 basename 2>/dev/null \
        | sort \
        | uniq \
        | while read filename; do
            if [ -z "$filename" ]; then continue; fi

            is_synced="false"
            source_file=""

            if [ -e "/etc/nginx/sites-enabled/$filename" ]; then
              is_synced="true"
              source_file="/etc/nginx/sites-enabled/$filename"
            fi

            if [ -e "/etc/nginx/sites-available/$filename" ]; then
              source_file="/etc/nginx/sites-available/$filename"
            fi

            if [ ! -z "$source_file" ]; then
              echo "---NGINX-CONFIG-START: $filename|$is_synced---"
              cat "$source_file"
              echo "---NGINX-CONFIG-END---"
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
      true
    );

    if (code !== 0) {
      console.error('Failed to fetch nginx configs from server');
      return draftConfigs;
    }

    const serverConfigs: WebServiceConfig[] = [];
    const fileBlocks = stdout.split('---NGINX-CONFIG-START: ');

    for (const block of fileBlocks) {
      if (!block.trim()) {
        continue;
      }

      const [headerLine, ...contentParts] = block.split('\n');
      const [filename, isSyncedStr] = headerLine.replace(/---$/, '').trim().split('|');

      if (filename === 'default') {
        continue;
      }

      const content = contentParts.join('\n').split('---NGINX-CONFIG-END---')[0];
      const serverNameMatch = content.match(/server_name\s+([^;]+);/);
      const domainName = serverNameMatch ? serverNameMatch[1].trim().split(/\s+/)[0] : '';

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
          domainName,
          serverIp: server.publicIp,
          rawContent: content,
        },
      });
    }

    return [...draftConfigs, ...serverConfigs];
  } catch (error) {
    console.error('Error getting combined nginx configs:', error);
    return [];
  }
}

export async function getWebOrServerNginxConfigById(id: string, serverId?: string): Promise<WebServiceConfig | null> {
  if (id.startsWith('@')) {
    const config = await getWebServiceById(id.substring(1));
    return config ? { ...config, isDraft: true } : null;
  }

  if (!serverId) {
    return null;
  }

  try {
    const server = await getServerForRunner(serverId);
    if (!server || !server.username || !server.privateKey) {
      return null;
    }

    if (id === 'default') {
      return null;
    }

    const readCommand = `
      if [ -e "/etc/nginx/sites-available/${id}" ]; then
        cat "/etc/nginx/sites-available/${id}"
      elif [ -e "/etc/nginx/sites-enabled/${id}" ]; then
        cat "/etc/nginx/sites-enabled/${id}"
      else
        exit 1
      fi
    `;

    const { stdout, code } = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      readCommand
    );

    if (code !== 0) {
      return null;
    }

    const syncedResult = await runCommandOnServer(
      server.publicIp,
      server.username,
      server.privateKey,
      `[ -e "/etc/nginx/sites-enabled/${id}" ] && echo "true" || echo "false"`
    );
    const isSynced = syncedResult.stdout.trim() === 'true';

    const parsedValue = await parseNginxConfig(stdout, server.publicIp);

    if (parsedValue.domainName && parsedValue.domainName !== '_' && parsedValue.domainName !== 'localhost') {
      try {
        const domains = await getDomains();
        const matched = domains.find((domain) => domain.name === parsedValue.domainName);
        if (matched) {
          parsedValue.domainId = matched.id;
        }
      } catch (error) {
        console.error('Error resolving domain for config:', error);
      }
    }

    return {
      id,
      name: id,
      type: 'nginx',
      created_on: new Date().toISOString(),
      created_by: 'System',
      serverId: server.id,
      serverName: server.name,
      isDraft: false,
      isSynced,
      value: parsedValue,
    };
  } catch (error) {
    console.error('Error fetching/parsing server nginx config:', error);
    return null;
  }
}

function extractNamedBlocks(content: string, blockName: string): string[] {
  const blocks: string[] = [];
  let cursor = 0;

  while (cursor < content.length) {
    const keywordIdx = content.indexOf(blockName, cursor);
    if (keywordIdx === -1) {
      break;
    }

    const openBraceIdx = content.indexOf('{', keywordIdx + blockName.length);
    if (openBraceIdx === -1) {
      break;
    }

    let depth = 1;
    let idx = openBraceIdx + 1;
    while (idx < content.length && depth > 0) {
      const ch = content[idx];
      if (ch === '{') depth += 1;
      if (ch === '}') depth -= 1;
      idx += 1;
    }

    if (depth !== 0) {
      break;
    }

    blocks.push(content.slice(openBraceIdx + 1, idx - 1));
    cursor = idx;
  }

  return blocks;
}

function parsePathRulesFromServerBlock(serverBlockContent: string) {
  const locationBlocks = extractNamedBlocks(serverBlockContent, 'location');
  const locationHeaderRegex = /location\s+([^\{]+)\{/g;
  const headers: string[] = [];
  let headerMatch: RegExpExecArray | null;

  while ((headerMatch = locationHeaderRegex.exec(serverBlockContent)) !== null) {
    headers.push(headerMatch[1].trim());
  }

  const rules: any[] = [];

  for (let i = 0; i < Math.min(headers.length, locationBlocks.length); i += 1) {
    const path = headers[i];
    const blockContent = locationBlocks[i];

    const rule: any = {
      id: `rule-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
      path,
      action: 'proxy',
      proxySettings: {
        customHeaders: [],
      },
    };

    if (blockContent.includes('return 404;')) {
      rule.action = 'return-404';
    } else {
      const redirectMatch = blockContent.match(/return\s+(301|302|307|308)\s+([^;]+);/);
      if (redirectMatch) {
        const code = redirectMatch[1];
        let target = redirectMatch[2].trim();
        rule.action = `redirect-${code}`;

        if (target.includes('$request_uri')) {
          rule.passParameters = true;
          target = target.replace('$request_uri', '');
        }

        rule.redirectTarget = target;
      } else {
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
    }

    if (blockContent.includes('proxy_set_header Host')) rule.proxySettings.setHost = true;
    if (blockContent.includes('proxy_set_header X-Real-IP')) rule.proxySettings.setRealIp = true;
    if (blockContent.includes('proxy_set_header X-Forwarded-For')) rule.proxySettings.setForwardedFor = true;
    if (blockContent.includes('proxy_set_header X-Forwarded-Proto')) rule.proxySettings.setForwardedProto = true;
    if (blockContent.includes('proxy_set_header Upgrade $http_upgrade')) rule.proxySettings.upgradeWebSocket = true;

    rules.push(rule);
  }

  return rules;
}

function splitDomainAndSubdomain(serverName: string) {
  if (!serverName || serverName === '_' || serverName === 'localhost') {
    return {
      domainName: serverName,
      subdomain: '',
      domainId: 'manual-domain',
    };
  }

  if (serverName.startsWith('*.')) {
    return {
      domainName: serverName.slice(2),
      subdomain: '#',
      domainId: 'manual-domain',
    };
  }

  const parts = serverName.split('.');
  if (parts.length > 2) {
    return {
      domainName: parts.slice(-2).join('.'),
      subdomain: parts.slice(0, -2).join('.') || '@',
      domainId: 'manual-domain',
    };
  }

  if (parts.length === 2) {
    return {
      domainName: serverName,
      subdomain: '@',
      domainId: 'manual-domain',
    };
  }

  return {
    domainName: serverName,
    subdomain: '@',
    domainId: 'manual-domain',
  };
}

async function parseNginxConfig(configContent: string, currentServerIp: string) {
  const value: any = {
    serverIp: currentServerIp,
    blocks: [],
    domainRedirects: [],
  };

  const serverBlocks = extractNamedBlocks(configContent, 'server');
  const blockMap = new Map<string, any>();

  for (const serverBlock of serverBlocks) {
    const serverNameMatch = serverBlock.match(/server_name\s+([^;]+);/);
    if (!serverNameMatch) {
      continue;
    }

    const serverName = serverNameMatch[1].trim().split(/\s+/)[0];
    if (!serverName || serverName === '_' || serverName === 'localhost') {
      continue;
    }

    const hasIpv4_80 = /listen\s+80\b/.test(serverBlock);
    const hasIpv6_80 = /listen\s+\[::\]:80\b/.test(serverBlock);
    const hasIpv4_443 = /listen\s+443\b/.test(serverBlock);
    const hasIpv6_443 = /listen\s+\[::\]:443\b/.test(serverBlock);
    const has443 = hasIpv4_443 || hasIpv6_443;
    const has80 = hasIpv4_80 || hasIpv6_80;

    const httpsRedirect = /return\s+301\s+https:\/\/\$host\$request_uri;/.test(serverBlock);
    const sslCertMatch = serverBlock.match(/ssl_certificate\s+([^;]+);/);
    const sslCertPath = sslCertMatch ? sslCertMatch[1].trim() : '';
    const sslFileName = sslCertPath ? (sslCertPath.split('/').pop() || sslCertPath) : undefined;
    const pathRules = parsePathRulesFromServerBlock(serverBlock);

    const existing = blockMap.get(serverName);
    const base = existing || (() => {
      const split = splitDomainAndSubdomain(serverName);
      return {
        id: `block-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`,
        domainId: split.domainId,
        domainName: split.domainName,
        subdomain: split.subdomain,
        httpsRedirection: false,
        sslEnabled: false,
        sslCertificateFile: undefined,
        pathRules: [],
      };
    })();

    if (has80 && httpsRedirect) {
      base.httpsRedirection = true;
    }

    if (has443) {
      base.sslEnabled = true;
      if (sslFileName) {
        base.sslCertificateFile = sslFileName;
      }
    }

    if (pathRules.length > 0) {
      // Prefer HTTPS rules if present, otherwise keep HTTP rules.
      if (has443 || base.pathRules.length === 0) {
        base.pathRules = pathRules;
      }
    }

    blockMap.set(serverName, base);
  }

  const blocks = Array.from(blockMap.values()).map((block) => ({
    ...block,
    pathRules: block.pathRules.length > 0
      ? block.pathRules
      : [
          {
            id: 'rule-default',
            path: '/',
            action: 'proxy',
            proxyTarget: 'local-port',
            localPort: '3000',
          },
        ],
  }));

  value.blocks = blocks;

  if (blocks.length > 0) {
    value.domainName = blocks[0].domainName;
    value.domainId = blocks[0].domainId;
    value.subdomain = blocks[0].subdomain;
    value.pathRules = blocks[0].pathRules;
    value.sslEnabled = blocks[0].sslEnabled;
    value.httpsRedirection = blocks[0].httpsRedirection;
    value.sslCertificateFile = blocks[0].sslCertificateFile;
  }

  return value;
}
