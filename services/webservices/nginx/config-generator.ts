import type { DomainRedirect, NginxConfiguration, PathRule } from '@/services/webservices/nginx/service';

type GenerateNginxConfigResult =
  | { success: true; config: string; error?: undefined }
  | { success: false; error: string; config?: undefined };

function normalizePathRule(rule: PathRule): PathRule {
  let normalizedPath = rule.path.trim();

  if (!normalizedPath.startsWith('/')) {
    normalizedPath = `/${normalizedPath}`;
  }

  if (rule.action !== 'alias' && normalizedPath.length > 1 && normalizedPath.endsWith('/')) {
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

function buildServerName(subdomain: string | undefined, domainName: string): string {
  if (!subdomain || subdomain === '@') {
    return domainName;
  }

  if (subdomain === '#') {
    return `*.${domainName}`;
  }

  return `${subdomain}.${domainName}`;
}

function buildSslPaths(sslCertificateFile: string) {
  const certificateFileInput = sslCertificateFile.trim();
  const certFileNameOnly = certificateFileInput.includes('/')
    ? certificateFileInput.split('/').pop() || certificateFileInput
    : certificateFileInput;

  const certFileName = /\.[^.]+$/.test(certFileNameOnly)
    ? certFileNameOnly
    : `${certFileNameOnly}.pem`;

  const certBaseName = certFileName.replace(/\.[^.]+$/, '');
  const keyFileName = `${certBaseName}.key`;

  return {
    certPath: `/etc/nginx/ssl/${certFileName}`,
    keyPath: `/etc/nginx/ssl/${keyFileName}`,
  };
}

function renderLocationRules(normalizedRules: PathRule[]): string {
  let locations = '';

  for (const rule of normalizedRules) {
    const isProxyRule = rule.action === 'proxy';
    locations += `
    location ${rule.path} {
`;

    if (rule.action === 'return-404') {
      locations += '        return 404;\n';
    } else if (rule.action.startsWith('redirect-')) {
      const statusCode = rule.action.split('-')[1];
      const suffix = rule.passParameters ? '$request_uri' : '';
      locations += `        return ${statusCode} ${rule.redirectTarget || '/'}${suffix};\n`;
    } else if (rule.action === 'alias' && rule.aliasPath) {
      locations += `        alias ${rule.aliasPath.trim()};\n`;
    } else if (isProxyRule && rule.proxyTarget === 'local-port' && rule.localPort) {
      locations += `        proxy_pass http://127.0.0.1:${rule.localPort};\n`;
    } else if (isProxyRule && rule.proxyTarget === 'remote-server' && rule.serverIp) {
      locations += `        proxy_pass http://${rule.serverIp}${rule.port ? `:${rule.port}` : ''};\n`;
    }

    if (isProxyRule) {
      if (rule.proxySettings?.setHost) locations += '        proxy_set_header Host $host;\n';
      if (rule.proxySettings?.setRealIp) locations += '        proxy_set_header X-Real-IP $remote_addr;\n';
      if (rule.proxySettings?.setForwardedFor) locations += '        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;\n';
      if (rule.proxySettings?.setForwardedProto) locations += '        proxy_set_header X-Forwarded-Proto $scheme;\n';
      if (rule.proxySettings?.upgradeWebSocket) {
        locations += '        proxy_set_header Upgrade $http_upgrade;\n';
        locations += '        proxy_set_header Connection "upgrade";\n';
      }

      for (const header of rule.proxySettings?.customHeaders || []) {
        locations += `        proxy_set_header ${header.key} ${header.value};\n`;
      }
    }

    locations += '    }\n';
  }

  return locations;
}

export function generateNginxConfigFromContext(config: NginxConfiguration): GenerateNginxConfigResult {
  let nginxConfig = '';

  for (const redirect of config.domainRedirects || []) {
    nginxConfig += renderDomainRedirect(redirect);
  }

  for (const block of config.blocks) {
    const normalizedRules = (block.pathRules || []).map(normalizePathRule);
    const serverName = buildServerName(block.subdomain, block.domainName);
    const renderedLocations = renderLocationRules(normalizedRules);

    if (block.sslEnabled) {
      if (!block.sslCertificateFile) {
        return {
          success: false,
          error: `SSL is enabled for ${serverName} but no certificate file is selected.`,
        };
      }

      const { certPath, keyPath } = buildSslPaths(block.sslCertificateFile);

      if (block.httpsRedirection) {
        nginxConfig += `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};
    return 301 https://$host$request_uri;
}
`;
      } else {
        nginxConfig += `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};
${renderedLocations}}
`;
      }

      nginxConfig += `
server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name ${serverName};

    ssl_certificate ${certPath};
    ssl_certificate_key ${keyPath};
    ssl_protocols TLSv1.2 TLSv1.3;

${renderedLocations}}
`;

      continue;
    }

    nginxConfig += `
server {
    listen 80;
    listen [::]:80;
    server_name ${serverName};
`;

    nginxConfig += renderedLocations;
    nginxConfig += '}\n';
  }

  return { success: true, config: nginxConfig.trim() };
}
