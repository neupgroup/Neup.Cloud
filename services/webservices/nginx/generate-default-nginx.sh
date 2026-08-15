#!/bin/bash

# Script to generate self-signed SSL certificate and default Nginx configuration
# Usage: ./generate-default-nginx.sh [cert_path] [key_path] [redirect_url]

set -e

# Default values
CERT_PATH="${1:-/.neup/certificates/ssl/default.pem}"
KEY_PATH="${2:-/.neup/certificates/ssl/default.key}"
REDIRECT_URL="${3:-https://neupgroup.com/cloud}"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${YELLOW}=== Default Nginx Configuration Generator ===${NC}"
echo ""
echo "Certificate Path: $CERT_PATH"
echo "Private Key Path: $KEY_PATH"
echo "Redirect URL: $REDIRECT_URL"
echo ""

# Extract directory path (both files in same directory)
SSL_DIR=$(dirname "$CERT_PATH")

# Step 1: Create directory
echo -e "${YELLOW}Step 1: Creating SSL directory...${NC}"
sudo mkdir -p "$SSL_DIR"
echo -e "${GREEN}✓ Directory created${NC}"
echo ""

# Step 2: Generate SSL certificate
echo -e "${YELLOW}Step 2: Generating self-signed SSL certificate...${NC}"
sudo openssl req -x509 -nodes -days 365 -newkey rsa:2048 \
    -keyout "$KEY_PATH" \
    -out "$CERT_PATH" \
    -subj "/C=US/ST=State/L=City/O=Organization/CN=default"

# Set appropriate permissions
sudo chmod 644 "$CERT_PATH"
sudo chmod 600 "$KEY_PATH"
echo -e "${GREEN}✓ SSL certificate generated successfully${NC}"
echo ""

# Step 3: Generate Nginx configuration
echo -e "${YELLOW}Step 3: Generating Nginx configuration...${NC}"

CONFIG_CONTENT="# DEFAULT CATCH-ALL HANDLER
# File: default.conf
#
# Purpose:
# - Catch IP access & unknown domains
# - Redirect HTTP + HTTPS to $REDIRECT_URL
# - No content served, ever

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
    ssl_certificate     $CERT_PATH;
    ssl_certificate_key $KEY_PATH;

    # Body Size Limit
    client_max_body_size 100M;

    # TLS hardening
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_session_cache off;

    # Absolute redirect
    return 301 $REDIRECT_URL;
}
"

# Write configuration to temporary file
TEMP_CONFIG="/tmp/nginx-default-$(date +%s).conf"
echo "$CONFIG_CONTENT" > "$TEMP_CONFIG"
echo -e "${GREEN}✓ Configuration generated${NC}"
echo ""

# Step 4: Deploy configuration
echo -e "${YELLOW}Step 4: Deploying configuration...${NC}"

# Backup existing default config if it exists
if [ -f /etc/nginx/sites-available/default ]; then
    echo "Backing up existing default configuration..."
    sudo cp /etc/nginx/sites-available/default /etc/nginx/sites-available/default.backup.$(date +%s)
fi

# Remove old symlinks and configs
sudo rm -f /etc/nginx/sites-enabled/default
sudo rm -f /etc/nginx/sites-available/default

# Copy new config
sudo cp "$TEMP_CONFIG" /etc/nginx/sites-available/default

# Create symlink
sudo ln -sf /etc/nginx/sites-available/default /etc/nginx/sites-enabled/default

echo -e "${GREEN}✓ Configuration deployed${NC}"
echo ""

# Step 5: Test Nginx configuration
echo -e "${YELLOW}Step 5: Testing Nginx configuration...${NC}"
if sudo nginx -t; then
    echo -e "${GREEN}✓ Nginx configuration test passed${NC}"
    echo ""
    
    # Step 6: Restart Nginx
    echo -e "${YELLOW}Step 6: Restarting Nginx...${NC}"
    sudo systemctl restart nginx
    echo -e "${GREEN}✓ Nginx restarted successfully${NC}"
    echo ""
    
    echo -e "${GREEN}=== Setup Complete ===${NC}"
    echo ""
    echo "Your default Nginx configuration is now active."
    echo "All requests to this server will be redirected to: $REDIRECT_URL"
else
    echo -e "${RED}✗ Nginx configuration test failed${NC}"
    echo -e "${RED}Please check the configuration and try again${NC}"
    exit 1
fi

# Clean up temp file
rm -f "$TEMP_CONFIG"
