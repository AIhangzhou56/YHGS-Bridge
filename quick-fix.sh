#!/bin/bash

# Quick Fix for React Router Routes in Production
# Run this on your server to fix the blank page issue

echo "Fixing React Router routes..."

# Update your current Nginx configuration
sudo tee /etc/nginx/sites-available/yhgs-bridge > /dev/null << 'EOF'
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

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

# Restart your Node.js application
sudo pm2 restart yhgs-bridge

echo "Fix applied. Your /mirror route should now work."