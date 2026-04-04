import type { DomainRedirect, NginxConfiguration, PathRule } from '@/app/server/webservices/nginx/actions';

type GenerateNginxConfigResult =
  | { success: true; config: string; error?: undefined }
  | { success: false; error: string; config?: undefined };

function normalizePathRule(rule: PathRule): PathRule {
  let normalizedPath = rule.path.trim();

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  if (normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
    normalizedPath = normalizedPath.slice(0, -1);
  }

  const subPaths = (rule.subPaths || []).map((subPath) => ({
    ...subPath,
    path: subPath.path.startsWith('/') ? subPath.path : `/${subPath.path}`,
  }));

  return {
    ...rule,
    path: normalizedPath,
    subPaths,
  };
}

function renderDomainRedirect(redirect: DomainRedirect) {
  const redirectName = redirect.subdomain ? `${redirect.subdomain}.${redirect.domainName}` : redirect.domainName;

  return `
server {
    listen 80;
    listen [::]:80;
    server_name ${redirectName};
    return 301 ${redirect.redirectTarget};
}
`;
}

export function generateNginxConfigFromContext(config: NginxConfiguration): GenerateNginxConfigResult {
  let nginxConfig = '';

  for (const redirect of config.domainRedirects || []) {
    nginxConfig += renderDomainRedirect(redirect);
  }

  for (const block of config.blocks) {
    const normalizedRules = (block.pathRules || []).map(normalizePathRule);
    const serverName = block.subdomain ? `${block.subdomain}.${block.domainName}` : block.domainName;

    nginxConfig += `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};
`;

    if (block.httpsRedirection) {
      nginxConfig += `
    if ($scheme != "https") {
        return 301 https://$host$request_uri;
    }
`;
    }

    for (const rule of normalizedRules) {
      nginxConfig += `
    location ${rule.path} {
`;

      if (rule.action === 'return-404') {
        nginxConfig += '        return 404;\n';
      } else if (rule.action.startsWith('redirect-')) {
        const statusCode = rule.action.split('-')[1];
        const suffix = rule.passParameters ? '$request_uri' : '';
        nginxConfig += `        return ${statusCode} ${rule.redirectTarget || '/'}${suffix};\n`;
      } else if (rule.proxyTarget === 'local-port' && rule.localPort) {
        nginxConfig += `        proxy_pass http://127.0.0.1:${rule.localPort};\n`;
      } else if (rule.proxyTarget === 'remote-server' && rule.serverIp) {
        nginxConfig += `        proxy_pass http://${rule.serverIp}${rule.port ? `:${rule.port}` : ''};\n`;
      }

      if (rule.proxySettings?.setHost) nginxConfig += '        proxy_set_header Host $host;\n';
      if (rule.proxySettings?.setRealIp) nginxConfig += '        proxy_set_header X-Real-IP $remote_addr;\n';
      if (rule.proxySettings?.setForwardedFor) nginxConfig += '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n';
      if (rule.proxySettings?.setForwardedProto) nginxConfig += '        proxy_set_header X-Forwarded-Proto $scheme;\n';
      if (rule.proxySettings?.upgradeWebSocket) {
        nginxConfig += '        proxy_set_header Upgrade $http_upgrade;\n';
        nginxConfig += '        proxy_set_header Connection "upgrade";\n';
      }

      for (const header of rule.proxySettings?.customHeaders || []) {
        nginxConfig += `        proxy_set_header ${header.key} ${header.value};\n`;
      }

      nginxConfig += '    }\n';
    }

    nginxConfig += '}\n';
  }

  return { success: true, config: nginxConfig.trim() };
}
