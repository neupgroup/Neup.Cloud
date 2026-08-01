# Nginx Default Implementation

Implementation documentation for the default Nginx catch-all configuration.

::neup.documentation::nginx-default-implementation
::title Nginx Default Implementation

The default Nginx implementation provides a web interface and standalone shell script for generating a self-signed certificate and deploying a catch-all default server block.

::public

The default Nginx feature is available at `/server/webservices/nginx/default`.

It supports:

- Selected-server deployment from the active server context.
- Self-signed SSL certificate generation.
- Fixed default SSL paths under `/etc/nginx/ssl`.
- Redirect URL configuration.
- Configuration preview before deployment.
- Deployment through SSH with `nginx -t` validation.

The standalone script is available at `services/webservices/nginx/generate-default-nginx.sh`.

Default script usage:

```bash
sudo ./services/webservices/nginx/generate-default-nginx.sh
```

Custom script usage:

```bash
sudo ./services/webservices/nginx/generate-default-nginx.sh \
  /path/to/cert.crt \
  /path/to/key.key \
  https://redirect-url.com
```

Generated default configuration shape:

```nginx
server {
    listen 80 default_server;
    listen [::]:80 default_server;

    listen 443 ssl default_server;
    listen [::]:443 ssl default_server;

    server_name _;

    ssl_certificate     /etc/nginx/ssl/default.crt;
    ssl_certificate_key /etc/nginx/ssl/default.key;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache off;

    return 301 https://neupgroup.com/cloud;
}
```

Production recommendations:

- Use a trusted certificate for production domains that should not show browser warnings.
- Monitor certificate expiration.
- Keep Nginx and TLS settings current.
- Keep backups of known-good server configurations.

::public end

::private

Current implementation files:

- `app/(main)/server/webservices/nginx/default/page.tsx`
- `app/(main)/server/webservices/nginx/default/client.tsx`
- `app/(main)/server/webservices/nginx/page.tsx`
- `services/webservices/nginx-default-service.ts`
- `services/webservices/nginx/generate-default-nginx.sh`

The web interface flow:

1. Resolve the selected server from `selectedServer` query state or the `selected_server` cookie.
2. Show selected server identity in the UI.
3. Generate a self-signed certificate at `/etc/nginx/ssl/default.crt` with key `/etc/nginx/ssl/default.key`.
4. Generate the default catch-all Nginx config from the selected redirect URL.
5. Deploy the config to `/etc/nginx/sites-available/default`.
6. Link it from `/etc/nginx/sites-enabled/default`.
7. Run `nginx -t`.
8. Restart Nginx when validation succeeds.

`generateDefaultSSLCertificate(serverId, certPath, keyPath)` generates the certificate and key on the selected server.

`deployDefaultNginxConfig(serverId, configContent)` deploys the generated default server block and restarts Nginx after validation.

`generateDefaultConfigContent(certPath, keyPath, redirectUrl)` returns generated Nginx config content without deploying it.

The implementation intentionally keeps the default catch-all separate from regular path-routing configuration so unknown domains and direct IP access can be handled predictably.

::private end

::end
