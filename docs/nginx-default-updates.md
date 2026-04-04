# Default Nginx Configuration - Updates Summary

## Changes Made

### 1. Server Selection via Cookies

**Before:**
- Manual server ID input field
- User had to enter server ID manually

**After:**
- Automatic server selection from cookies
- Uses `selected_server` cookie value
- Shows current server name and ID
- Alert message if no server is selected

**Files Modified:**
- `/src/app/webservices/nginx/default/page.tsx` - Converted to server component
- `/src/app/webservices/nginx/default/client.tsx` - New client component with cookie-based logic

### 2. Simplified SSL Certificate Paths

**Before:**
- Certificate: `/etc/nginx/ssl.certificate/default.crt`
- Private Key: `/etc/nginx/ssl.certificates/default.key`
- Two separate directories
- Paths were editable by user

**After:**
- Certificate: `/etc/nginx/ssl/default.crt`
- Private Key: `/etc/nginx/ssl/default.key`
- Single directory: `/etc/nginx/ssl/`
- Paths are read-only (disabled inputs)

**Files Modified:**
- `/src/app/webservices/nginx/default/client.tsx` - Fixed paths, disabled inputs
- `/src/app/webservices/nginx/default/actions.ts` - Updated default paths
- `/scripts/generate-default-nginx.sh` - Updated default paths

## Technical Details

### Server Component Pattern

The page now follows Next.js 13+ app router pattern:

```typescript
// page.tsx (Server Component)
export default async function DefaultNginxConfigPage() {
    const cookieStore = await cookies();
    const serverId = cookieStore.get('selected_server')?.value;
    const server = await getServer(serverId);
    
    return <DefaultNginxConfigClient serverId={serverId} serverName={server.name} />;
}
```

```typescript
// client.tsx (Client Component)
'use client';
export default function DefaultNginxConfigClient({ serverId, serverName }) {
    // All interactive logic here
}
```

### SSL Directory Structure

**Old Structure:**
```
/etc/nginx/
├── ssl.certificate/
│   └── default.crt
└── ssl.certificates/
    └── default.key
```

**New Structure:**
```
/etc/nginx/
└── ssl/
    ├── default.crt
    └── default.key
```

### UI Changes

1. **Removed:** Server ID input field
2. **Added:** Server information card showing:
   - Server name
   - Server ID (in monospace font)
   - Alert if no server selected

3. **Modified:** SSL Certificate section
   - Shows SSL directory path (read-only)
   - Shows certificate path (read-only)
   - Shows private key path (read-only)
   - Removed ability to edit paths

## User Experience Flow

1. **Select Server** - User selects server from navigation (sets cookie)
2. **Navigate to Page** - `/server/webservices/nginx/default`
3. **View Server Info** - Page shows selected server automatically
4. **Generate Certificate** - Click button to generate SSL cert in `/etc/nginx/ssl/`
5. **Configure Redirect** - Enter redirect URL (default: `https://neupgroup.com/cloud`)
6. **Generate Config** - Preview Nginx configuration
7. **Deploy** - Deploy to selected server

## Benefits

### 1. Improved UX
- No need to remember or enter server ID
- Consistent with other pages in the application
- Clear visual feedback of selected server

### 2. Simplified Paths
- Single directory for all SSL files
- Easier to manage and backup
- Reduced confusion about where files are stored
- Prevents user errors from typos in paths

### 3. Better Security
- Paths are standardized and read-only
- Reduces risk of misconfiguration
- Consistent permissions across deployments

## Migration Notes

If you have existing certificates in the old locations, you can migrate them:

```bash
# Create new directory
sudo mkdir -p /etc/nginx/ssl

# Copy existing certificates
sudo cp /etc/nginx/ssl.certificate/default.crt /etc/nginx/ssl/default.crt
sudo cp /etc/nginx/ssl.certificates/default.key /etc/nginx/ssl/default.key

# Set permissions
sudo chmod 644 /etc/nginx/ssl/default.crt
sudo chmod 600 /etc/nginx/ssl/default.key

# Update Nginx config to use new paths
sudo nano /etc/nginx/sites-available/default

# Test and reload
sudo nginx -t
sudo systemctl reload nginx

# Optional: Remove old directories after verification
# sudo rm -rf /etc/nginx/ssl.certificate
# sudo rm -rf /etc/nginx/ssl.certificates
```

## Files Changed

```
/src/app/webservices/nginx/default/
├── page.tsx           # Server component (gets cookie)
├── client.tsx         # NEW - Client component (UI logic)
└── actions.ts         # Updated default paths

/scripts/
└── generate-default-nginx.sh  # Updated default paths
```

## Testing Checklist

- [x] TypeScript compilation passes
- [x] Server selection from cookies works
- [x] Server info displays correctly
- [x] No server selected shows alert
- [x] SSL paths are read-only
- [x] Certificate generation uses new paths
- [x] Configuration generation works
- [x] Deployment succeeds
- [x] Standalone script uses new paths

## Backward Compatibility

The changes are **backward compatible** at the code level:
- Old function signatures still accept custom paths
- Default values updated to new structure
- Existing deployments continue to work

However, **new deployments** will use the simplified structure.
