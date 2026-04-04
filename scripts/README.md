# Default Nginx Configuration Generator

This directory contains scripts and tools for generating default Nginx configurations with self-signed SSL certificates.

## Overview

The default Nginx configuration is a catch-all server block that:
- Listens on both HTTP (port 80) and HTTPS (port 443)
- Catches all IP-based access and unknown domain requests
- Redirects all traffic to a specified URL (default: `https://neupgroup.com/cloud`)
- Uses a self-signed SSL certificate for HTTPS

## Usage

### Option 1: Using the Web Interface

1. Navigate to `/server/webservices/nginx/default` in your application
2. Enter the Server ID
3. Configure SSL certificate paths (or use defaults)
4. Click "Generate SSL Certificate"
5. Set the redirect URL
6. Click "Generate Configuration" to preview
7. Click "Deploy to Server" to apply

### Option 2: Using the Standalone Script

Run the script directly on your server:

```bash
# Using default values
sudo ./scripts/generate-default-nginx.sh

# With custom paths and redirect URL
sudo ./scripts/generate-default-nginx.sh \
    /path/to/cert.crt \
    /path/to/key.key \
    https://your-redirect-url.com
```

**Parameters:**
- `$1` - Certificate path (default: `/etc/nginx/ssl.certificate/default.crt`)
- `$2` - Private key path (default: `/etc/nginx/ssl.certificates/default.key`)
- `$3` - Redirect URL (default: `https://neupgroup.com/cloud`)

### Option 3: Manual Setup

If you prefer to run commands manually:

#### 1. Create directories
```bash
sudo mkdir -p /etc/nginx/ssl.certificate
sudo mkdir -p /etc/nginx/ssl.certificates
```

#### 2. Generate self-signed certificate
```bash
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout /etc/nginx/ssl.certificates/default.key \
    -out /etc/nginx/ssl.certificate/default.crt \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=default"
```

#### 3. Set permissions
```bash
sudo chmod 644 /etc/nginx/ssl.certificate/default.crt
sudo chmod 600 /etc/nginx/ssl.certificates/default.key
```

#### 4. Create Nginx configuration
Create `/etc/nginx/sites-available/default` with the following content:

```nginx
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
    ssl_certificate     /etc/nginx/ssl.certificate/default.crt;
    ssl_certificate_key /etc/nginx/ssl.certificates/default.key;

    # TLS hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache off;

    # Absolute redirect
    return 301 https://neupgroup.com/cloud;
}
```

#### 5. Enable and test
```bash
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default
sudo nginx -t
sudo systemctl restart nginx
```

## Security Notes

⚠️ **Important:** This configuration uses a **self-signed SSL certificate**. While this is sufficient for a catch-all/redirect configuration, browsers will show security warnings.

For production domains, you should use a proper SSL certificate from:
- Let's Encrypt (free, via Certbot)
- A commercial Certificate Authority (CA)

## Troubleshooting

### Certificate already exists
If you see errors about existing certificates, either:
1. Remove the old certificates first
2. Use different paths for the new certificates

### Nginx test fails
Run `sudo nginx -t` to see detailed error messages. Common issues:
- Certificate paths are incorrect
- Permissions are wrong
- Syntax errors in configuration

### Port already in use
If ports 80 or 443 are already in use:
1. Check what's using them: `sudo netstat -tlnp | grep ':80\|:443'`
2. Stop conflicting services
3. Or modify the configuration to use different ports

## Files

- `generate-default-nginx.sh` - Standalone script for automated setup
- `/src/app/webservices/nginx/default/` - Web interface for configuration
  - `page.tsx` - UI component
  - `actions.ts` - Server-side actions

## Related Documentation

- [Nginx Path Configuration](../../docs/nginx-path-configuration.md)
- [Nginx Official Documentation](https://nginx.org/en/docs/)
