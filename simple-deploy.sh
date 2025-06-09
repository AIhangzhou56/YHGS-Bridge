#!/bin/bash

# Simple deployment script - no sudo required
# Run as root on CentOS

echo "Deploying YHGS Bridge..."

# Create directories
mkdir -p /var/www/yhgs-frontend
mkdir -p /var/www/yhgs-api

# Deploy frontend
cp -r static-frontend/* /var/www/yhgs-frontend/
chown -R nginx:nginx /var/www/yhgs-frontend
chmod -R 755 /var/www/yhgs-frontend

# Deploy backend
useradd -r yhgs 2>/dev/null || true
cp -r api-backend/* /var/www/yhgs-api/
chown -R yhgs:yhgs /var/www/yhgs-api

# Install dependencies as yhgs user
cd /var/www/yhgs-api
su -c "npm install --production" yhgs

# Configure Nginx
cp nginx-frontend.conf /etc/nginx/conf.d/
cp nginx-api.conf /etc/nginx/conf.d/

# Create systemd service
cat > /etc/systemd/system/yhgs-api.service << 'EOF'
[Unit]
Description=YHGS Bridge API
After=network.target

[Service]
Type=simple
User=yhgs
WorkingDirectory=/var/www/yhgs-api
ExecStart=/usr/bin/node index.js
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
EOF

# Start services
systemctl daemon-reload
systemctl enable yhgs-api
systemctl start yhgs-api
systemctl reload nginx

echo "Deployment complete!"
echo "Frontend: /var/www/yhgs-frontend"
echo "API: /var/www/yhgs-api"