# Default Nginx Configuration - Quick Reference

## What This Does

This setup creates a **catch-all default Nginx server block** that:

1. **Catches all unmatched requests** - Any request that doesn't match other server blocks
2. **Handles both HTTP and HTTPS** - Listens on ports 80 and 443
3. **Redirects everything** - All traffic is redirected to a specified URL (e.g., `https://neupgroup.com/cloud`)
4. **Uses self-signed SSL** - Generates a self-signed certificate for HTTPS support

## Why You Need This

Without a default server block:
- Direct IP access may expose internal services
- Unknown domain names pointing to your server could serve unintended content
- HTTPS requests without proper certificates will fail

With this default configuration:
- All unmatched traffic is safely redirected
- No content is served directly
- Clean, professional handling of all edge cases

## Quick Start

### Method 1: Web Interface (Recommended)

1. Go to: `/server/webservices/nginx/default`
2. Enter your Server ID
3. Click "Generate SSL Certificate"
4. Click "Generate Configuration"
5. Click "Deploy to Server"

### Method 2: Command Line

SSH into your server and run:

```bash
# Download the script
curl -o generate-default-nginx.sh https://your-domain.com/scripts/generate-default-nginx.sh

# Make it executable
chmod +x generate-default-nginx.sh

# Run it
sudo ./generate-default-nginx.sh
```

Or with custom parameters:

```bash
sudo ./generate-default-nginx.sh \
    /etc/nginx/ssl.certificate/default.crt \
    /etc/nginx/ssl.certificates/default.key \
    https://your-redirect-url.com
```

## Configuration Details

### Default Paths

- **Certificate**: `/etc/nginx/ssl.certificate/default.crt`
- **Private Key**: `/etc/nginx/ssl.certificates/default.key`
- **Redirect URL**: `https://neupgroup.com/cloud`

### What Gets Created

1. **SSL Certificate** - A self-signed certificate valid for 365 days
2. **Private Key** - RSA 2048-bit key with restricted permissions
3. **Nginx Config** - Default server block in `/etc/nginx/sites-available/default`

### Security Settings

- **TLS Protocols**: TLSv1.2 and TLSv1.3 only
- **Session Cache**: Disabled for catch-all use
- **Certificate Permissions**: 644 (readable)
- **Key Permissions**: 600 (owner only)

## Example Configuration

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

## Testing

After deployment, test your configuration:

```bash
# Test Nginx configuration
sudo nginx -t

# Check if Nginx is running
sudo systemctl status nginx

# Test HTTP redirect
curl -I http://your-server-ip

# Test HTTPS redirect (will show certificate warning)
curl -Ik https://your-server-ip
```

Expected response:
```
HTTP/1.1 301 Moved Permanently
Location: https://neupgroup.com/cloud
```

## Troubleshooting

### Certificate Warnings

**Problem**: Browsers show "Not Secure" warnings

**Solution**: This is expected with self-signed certificates. For production domains, use Let's Encrypt:

```bash
sudo certbot certonly --nginx -d yourdomain.com
```

### Port Already in Use

**Problem**: Error binding to port 80 or 443

**Solution**: Check what's using the ports:

```bash
sudo netstat -tlnp | grep ':80\|:443'
```

### Configuration Test Fails

**Problem**: `nginx -t` shows errors

**Solution**: Check the error message and verify:
- Certificate paths are correct
- Files have proper permissions
- No syntax errors in the config

### Redirect Not Working

**Problem**: Server doesn't redirect as expected

**Solution**: 
1. Verify the config is in sites-enabled: `ls -la /etc/nginx/sites-enabled/`
2. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. Restart Nginx: `sudo systemctl restart nginx`

## Updating the Configuration

To change the redirect URL or certificate paths:

1. Edit the configuration file:
   ```bash
   sudo nano /etc/nginx/sites-available/default
   ```

2. Test the changes:
   ```bash
   sudo nginx -t
   ```

3. Apply the changes:
   ```bash
   sudo systemctl reload nginx
   ```

## Production Considerations

### Use Real Certificates

For production, replace the self-signed certificate with a real one:

```bash
# Using Let's Encrypt
sudo certbot certonly --nginx -d yourdomain.com

# Update the config to use the new certificate
sudo nano /etc/nginx/sites-available/default
```

Update the paths to:
```nginx
ssl_certificate     /etc/letsencrypt/live/yourdomain.com/fullchain.pem;
ssl_certificate_key /etc/letsencrypt/live/yourdomain.com/privkey.pem;
```

### Monitor Certificate Expiration

Self-signed certificates expire after 365 days. Set a reminder to regenerate:

```bash
# Check certificate expiration
openssl x509 -in /etc/nginx/ssl.certificate/default.crt -noout -enddate
```

### Log Monitoring

Monitor redirects to understand traffic patterns:

```bash
# Watch access logs
sudo tail -f /var/log/nginx/access.log | grep "301"
```

## Related Files

- Web Interface: `/src/app/webservices/nginx/default/page.tsx`
- Server Actions: `/src/app/webservices/nginx/default/actions.ts`
- Standalone Script: `/scripts/generate-default-nginx.sh`
- Documentation: `/scripts/README.md`

## Support

For issues or questions:
1. Check the Nginx error logs: `/var/log/nginx/error.log`
2. Verify the configuration: `sudo nginx -t`
3. Review the documentation in `/scripts/README.md`
