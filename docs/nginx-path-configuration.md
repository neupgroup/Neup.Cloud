# Nginx Path Configuration Feature

## Overview
A comprehensive web interface for configuring Nginx path routing rules. This feature allows users to define which paths should be handled by which servers, with support for complex routing scenarios and automatic configuration generation and deployment.

## Location
- **Page**: `/server/webservices/nginx`
- **Files Created**:
  - `/src/app/webservices/nginx/page.tsx` - Main UI component
  - `/src/app/webservices/nginx/actions.ts` - Server actions for configuration management

## Features

### 1. Server Selection
- Select the Nginx server from a dropdown of available servers
- Automatically fetch or manually enter the server's public IP
- Refresh button to fetch the latest public IP from the server

### 2. Domain Selection
- **Optional**: Select a domain from your managed domains
- Dropdown shows all domains added to your account
- Visual indicator for verified domains
- If selected, Nginx will use the domain name instead of IP address in `server_name` directive
- Link to add new domains if none exist
- Supports both domain-based and IP-based configurations

### 3. Path Routing Rules
Define routing rules with the following capabilities:

#### Path Configuration
- **Path**: The URL path to match (e.g., `/app`, `/app/about`, `/app/about/more`)
- **Target Server**: Select which server should handle this path
- **Port**: Specify the port on the target server (default: 3000)
- **Ignore Path**: Option to mark a path as ignored (returns 404)

#### Rule Management
- Add multiple path rules
- Remove individual rules
- Visual feedback showing the complete route (path → server:port)
- Automatic server IP population when selecting a target server

### 3. Configuration Preview
- Generate a preview of the Nginx configuration file
- View the complete configuration before deployment
- Syntax-highlighted textarea for easy reading

### 4. Deployment
- One-click deployment to the selected server
- Automatically:
  - Uploads the configuration to the server
  - Tests the Nginx configuration
  - Reloads Nginx if the configuration is valid
- Warning message before deployment to prevent accidental overwrites

### 5. Persistence
- Configurations are saved to Firestore
- Automatically loads saved configuration when selecting a server
- Maintains configuration history

## Use Cases

### Example 1: Microservices Architecture
```
Main Server: nginx-server (192.168.1.100)

Rules:
1. /app → server1:3000
2. /app/about → server2:3001
3. /app/about/more → server3:3002
4. /api → server4:8080
```

### Example 2: Static Content with API
```
Main Server: nginx-server (192.168.1.100)

Rules:
1. /api → backend-server:8000
2. /admin → admin-server:3000
3. /static → [ignored] (served locally)
```

### Example 3: Domain-Based Configuration
```
Main Server: nginx-server (192.168.1.100)
Domain: myapp.com

Rules:
1. /api → api-server:8080
2. /blog → blog-server:3000
3. /shop → shop-server:4000

Generated Nginx config will use:
server_name myapp.com;
```


## Technical Details

### Path Matching Order
- Paths are automatically sorted by length (longest first)
- This ensures more specific paths are matched before general ones
- Example: `/app/about/more` is checked before `/app/about` before `/app`

### Generated Nginx Configuration
The system generates a complete Nginx server block with:
- Listen directives for IPv4 and IPv6
- Server name (using domain name if selected, otherwise public IP)
- Access and error logs
- Location blocks for each path rule
- Proxy headers for proper request forwarding

**Domain vs IP Configuration:**
- If a domain is selected: `server_name example.com;`
- If no domain is selected: `server_name 192.168.1.100;`

### Deployment Process
1. Configuration is generated from saved rules
2. File is uploaded to `/tmp/nginx-{serverId}.conf` on the server
3. Configuration is copied to `/etc/nginx/sites-available/default`
4. Nginx configuration is tested with `nginx -t`
5. If valid, Nginx is reloaded with `systemctl reload nginx`

## Security Considerations
- Requires SSH access to the server
- Uses server credentials stored in Firestore
- Deployment requires sudo privileges on the target server
- Configuration is validated before being applied

## Future Enhancements
- SSL/TLS configuration support
- Custom headers and directives
- Load balancing configuration
- Rate limiting rules
- Caching configuration
- Multiple server blocks per configuration
- Configuration versioning and rollback
- Real-time Nginx status monitoring

## Integration
This feature integrates with:
- **Server Management**: Uses existing server data from `/servers`
- **Domain Management**: Fetches user's managed domains from `/domains`
- **SSH Service**: Leverages the SSH service for remote command execution
- **Firebase**: Stores configurations in Firestore
- **Web Services**: Accessible from the main `/server/webservices` page

## Navigation
- Access from: `/server/webservices` → "Configure Path Routing" button (when Nginx is selected as proxy handler)
- Back button returns to `/server/webservices`
