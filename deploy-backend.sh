#!/bin/bash

echo "Deploying YHGS Bridge API Backend..."

# Create user if doesn't exist
useradd -r -m -s /bin/bash yhgs 2>/dev/null || true

# Create API directory
mkdir -p /var/www/yhgs-api
cp -r api-backend/* /var/www/yhgs-api/
chown -R yhgs:yhgs /var/www/yhgs-api

# Install Node.js dependencies
cd /var/www/yhgs-api
su -c "npm install --production" yhgs

# Create systemd service
tee /etc/systemd/system/yhgs-api.service > /dev/null << 'SERVICE'
[Unit]
Description=YHGS Bridge API
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=yhgs
Group=yhgs
WorkingDirectory=/var/www/yhgs-api
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/yhgs-api/.env.production

[Install]
WantedBy=multi-user.target
SERVICE

# Install Nginx configuration
cp nginx-api.conf /etc/nginx/conf.d/yhgs-api.conf

# Start services
systemctl daemon-reload
systemctl enable yhgs-api
systemctl start yhgs-api
nginx -t && systemctl reload nginx

echo "API backend deployed successfully!"
echo "Access at: http://api.yourdomain.com"
