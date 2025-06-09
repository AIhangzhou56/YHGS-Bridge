#!/bin/bash

echo "Deploying YHGS Bridge API Backend..."

# Create user if doesn't exist
sudo useradd -r -m -s /bin/bash yhgs 2>/dev/null || true

# Create API directory
sudo mkdir -p /var/www/yhgs-api
sudo cp -r api-backend/* /var/www/yhgs-api/
sudo chown -R yhgs:yhgs /var/www/yhgs-api

# Install Node.js dependencies
cd /var/www/yhgs-api
sudo -u yhgs npm install --production

# Create systemd service
sudo tee /etc/systemd/system/yhgs-api.service > /dev/null << 'SERVICE'
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
sudo cp nginx-api.conf /etc/nginx/conf.d/yhgs-api.conf

# Start services
sudo systemctl daemon-reload
sudo systemctl enable yhgs-api
sudo systemctl start yhgs-api
sudo nginx -t && sudo systemctl reload nginx

echo "API backend deployed successfully!"
echo "Access at: http://api.yourdomain.com"
