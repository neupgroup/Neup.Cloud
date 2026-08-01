# Nginx Default Configuration

Default Nginx catch-all configuration tooling for web services.

## Shared Rules

Keep default catch-all behavior documented with the Nginx service implementation. Do not duplicate this guide in the root `docs` folder.

## Related Documentation

- [Default implementation](default-implementation.md)
- [Default updates](default-updates.md)
- [Path configuration](path-configuration.md)

::neup.documentation::nginx-default-configuration
::title Nginx Default Configuration

The default Nginx configuration creates a catch-all server block for unmatched HTTP and HTTPS requests.

::public

Use the default Nginx configuration when a server should redirect direct IP access and unknown domains instead of serving unintended content.

The configuration:

- Catches unmatched requests with `server_name _`.
- Listens on ports `80` and `443` as the default server.
- Redirects all unmatched traffic to the configured redirect URL.
- Uses a self-signed certificate so HTTPS requests can be handled by the catch-all block.

Default values:

- Certificate path: `/etc/nginx/ssl/default.crt`
- Private key path: `/etc/nginx/ssl/default.key`
- Redirect URL: `https://neupgroup.com/cloud`

The web interface is available at `/server/webservices/nginx/default`.

Command-line usage:

```bash
sudo ./generate-default-nginx.sh
```

Command-line usage with custom paths and redirect URL:

```bash
sudo ./generate-default-nginx.sh \
  /etc/nginx/ssl/default.crt \
  /etc/nginx/ssl/default.key \
  https://your-redirect-url.com
```

Example generated server block:

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

After deployment, verify the configuration:

```bash
sudo nginx -t
sudo systemctl status nginx
curl -I http://your-server-ip
curl -Ik https://your-server-ip
```

Expected redirect response:

```text
HTTP/1.1 301 Moved Permanently
Location: https://neupgroup.com/cloud
```

Self-signed certificate warnings are expected for direct HTTPS access. Use a real certificate, such as a Let's Encrypt certificate, for production domains that should be trusted by browsers.

::public end

::private

The service implementation lives in `services/webservices/nginx-default-service.ts`.

The standalone script lives in `services/webservices/nginx/generate-default-nginx.sh`.

The app route for the default configuration UI lives in `app/(main)/server/webservices/nginx/default/page.tsx`.

The default configuration deployment flow:

1. Generates or uses the configured certificate and private key paths.
2. Writes the default server block to a temporary config file.
3. Replaces `/etc/nginx/sites-available/default`.
4. Links it from `/etc/nginx/sites-enabled/default`.
5. Runs `nginx -t`.
6. Restarts Nginx after a successful configuration test.

When troubleshooting, check:

- Certificate and key path consistency between the UI, service, script, and generated Nginx config.
- File permissions: certificate `644`, private key `600`.
- Whether `/etc/nginx/sites-enabled/default` points to `/etc/nginx/sites-available/default`.
- Nginx errors in `/var/log/nginx/error.log`.

::private end

::end
