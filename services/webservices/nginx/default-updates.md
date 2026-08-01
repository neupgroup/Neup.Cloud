# Nginx Default Updates

Update history and migration notes for the default Nginx catch-all configuration.

::neup.documentation::nginx-default-updates
::title Nginx Default Updates

The default Nginx configuration flow was updated to use selected-server context and a simplified SSL directory layout.

::public

Current behavior:

- The page uses the active selected server instead of requiring manual server ID entry.
- The selected server name and ID are shown before certificate generation or deployment.
- SSL certificate paths are fixed and read-only.
- New deployments use `/etc/nginx/ssl/default.crt` and `/etc/nginx/ssl/default.key`.
- The redirect URL remains configurable.

Migration from old SSL paths:

```bash
sudo mkdir -p /etc/nginx/ssl
sudo cp /etc/nginx/ssl.certificate/default.crt /etc/nginx/ssl/default.crt
sudo cp /etc/nginx/ssl.certificates/default.key /etc/nginx/ssl/default.key
sudo chmod 644 /etc/nginx/ssl/default.crt
sudo chmod 600 /etc/nginx/ssl/default.key
sudo nginx -t
sudo systemctl reload nginx
```

After verifying the new paths, old directories may be removed manually if they are no longer referenced by any Nginx configuration.

::public end

::private

Files involved in the current selected-server and fixed-path behavior:

- `app/(main)/server/webservices/nginx/default/page.tsx`
- `app/(main)/server/webservices/nginx/default/client.tsx`
- `services/webservices/nginx-default-service.ts`
- `services/webservices/nginx/generate-default-nginx.sh`

Selected-server resolution:

- The default page first checks the `selectedServer` query value.
- If no query value is present, it falls back to the `selected_server` cookie.
- Navigation links are built with `withSelectedServerQuery()` to preserve selected-server context.

SSL layout changed from separate legacy directories:

```text
/etc/nginx/
├── ssl.certificate/
│   └── default.crt
└── ssl.certificates/
    └── default.key
```

to one directory:

```text
/etc/nginx/
└── ssl/
    ├── default.crt
    └── default.key
```

The code still accepts explicit certificate and key paths in service function arguments, but the UI and script defaults use the simplified `/etc/nginx/ssl` layout.

::private end

::end
