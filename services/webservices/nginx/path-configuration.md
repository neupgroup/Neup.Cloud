# Nginx Path Configuration

Documentation for generated Nginx path routing configuration.

::neup.documentation::nginx-path-configuration
::title Nginx Path Configuration

The Nginx path configuration feature builds server blocks for domains, subdomains, redirects, SSL settings, and route-specific behavior.

::public

The path configuration UI is available from `/server/webservices/nginx`.

It supports:

- Creating named Nginx configurations.
- Selecting domain and subdomain targets.
- Adding path rules.
- Proxying to a remote server.
- Proxying to a local port.
- Serving alias paths.
- Returning `404` for ignored paths.
- Returning redirect responses with `301`, `302`, `307`, or `308`.
- Enabling SSL with certificate files stored under `/etc/nginx/ssl`.
- Enabling HTTP-to-HTTPS redirection.
- Configuring `client_max_body_size`.
- Previewing generated config before deployment.
- Testing and restarting Nginx from the management page.

Example path-routing intent:

```text
example.com /api   -> 127.0.0.1:8000
example.com /admin -> 127.0.0.1:3000
example.com /old   -> 301 /new
```

Generated configurations are deployed to the selected server and validated with `nginx -t` before Nginx is restarted.

::public end

::private

Primary implementation files:

- `components/webservices/nginx/NginxConfigEditor.tsx`
- `services/webservices/nginx/service.ts`
- `services/webservices/nginx/config-generator.ts`
- `app/(main)/server/webservices/nginx/page.tsx`
- `app/(main)/server/webservices/nginx/new/page.tsx`
- `app/(main)/server/webservices/nginx/[id]/page.tsx`

The configuration model is defined by `NginxConfiguration`, `DomainBlock`, `DomainRedirect`, and `PathRule` in `services/webservices/nginx/service.ts`.

`generateNginxConfigFromContext()` in `services/webservices/nginx/config-generator.ts` is the shared generator used by service code. It normalizes path rules before rendering Nginx config.

Path normalization rules:

- Paths are trimmed.
- Missing leading slashes are added.
- Non-alias paths drop trailing slashes when the path is longer than `/`.
- Subpaths also receive a leading slash when missing.

Supported location actions:

- `proxy` renders `proxy_pass` to a local port or remote server.
- `alias` renders an Nginx `alias` directive.
- `return-404` renders `return 404`.
- `redirect-301`, `redirect-302`, `redirect-307`, and `redirect-308` render Nginx redirects.

SSL path generation:

- A selected certificate file is normalized to a file name.
- Missing extensions default to `.pem`.
- The private key path uses the certificate base name with `.key`.
- Both paths are rendered under `/etc/nginx/ssl`.

Deployment flow:

1. The editor builds a `NginxConfiguration` from UI state.
2. The service calls the shared config generator.
3. `deployNginxConfig()` writes a temporary config file on the selected server.
4. The config is copied into `/etc/nginx/sites-available/{siteName}`.
5. A symlink is created in `/etc/nginx/sites-enabled/{siteName}`.
6. `nginx -t` validates the result.
7. Nginx is restarted when validation succeeds.

Security notes:

- Deployment requires SSH access to the selected server.
- Remote commands require sudo privileges for Nginx paths and service restart.
- Generated config should be reviewed before deployment when custom headers, aliases, redirects, or SSL settings change.

::private end

::end
