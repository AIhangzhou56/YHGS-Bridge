#!/bin/bash

# Quick Fix for React Router Routes in Production - CentOS Version
# Run this on your CentOS server to fix the blank page issue

echo "Fixing React Router routes on CentOS..."

# Update Nginx configuration for CentOS (uses conf.d instead of sites-available)
sudo tee /etc/nginx/conf.d/yhgs-bridge.conf > /dev/null << 'EOF'
server {
    listen 80;
    server_name yhgs.chat www.yhgs.chat;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # API routes - proxy to backend
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # All other routes - proxy to backend (which serves React app)
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # Enable connection upgrade for WebSocket
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Remove default Nginx configuration if it exists
sudo rm -f /etc/nginx/conf.d/default.conf

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# Restart your Node.js application (using systemctl for CentOS)
sudo systemctl restart yhgs-bridge

# If using PM2, also restart that
sudo pm2 restart yhgs-bridge 2>/dev/null || true

echo "Fix applied for CentOS. Your /mirror route should now work."
echo "Check status with: sudo systemctl status yhgs-bridge"