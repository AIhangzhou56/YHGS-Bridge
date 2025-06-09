#!/bin/bash

# CentOS Deployment Script for YHGS Bridge - No sudo required
# Run as root user

echo "Deploying YHGS Bridge on CentOS..."

# Update domain names
read -p "Enter your frontend domain (e.g., app.yourdomain.com): " FRONTEND_DOMAIN
read -p "Enter your API domain (e.g., api.yourdomain.com): " API_DOMAIN

echo "Updating configurations for $FRONTEND_DOMAIN and $API_DOMAIN..."

# Update Nginx configurations
sed -i "s/app.yourdomain.com/$FRONTEND_DOMAIN/g" nginx-frontend.conf
sed -i "s/api.yourdomain.com/$API_DOMAIN/g" nginx-api.conf nginx-frontend.conf

# Update CORS and API settings
sed -i "s/app.yourdomain.com/$FRONTEND_DOMAIN/g" api-backend/.env.production
sed -i "s/api.yourdomain.com/$API_DOMAIN/g" client/src/lib/queryClient.ts

# Deploy Frontend
echo "Deploying frontend..."
mkdir -p /var/www/yhgs-frontend
cp -r static-frontend/* /var/www/yhgs-frontend/
chown -R nginx:nginx /var/www/yhgs-frontend
chmod -R 755 /var/www/yhgs-frontend

# Deploy Backend
echo "Deploying backend..."
useradd -r -m -s /bin/bash yhgs 2>/dev/null || true
mkdir -p /var/www/yhgs-api
cp -r api-backend/* /var/www/yhgs-api/
chown -R yhgs:yhgs /var/www/yhgs-api

# Install backend dependencies
cd /var/www/yhgs-api
su -c "npm install --production" yhgs

# Install Nginx configurations
cp nginx-frontend.conf /etc/nginx/conf.d/yhgs-frontend.conf
cp nginx-api.conf /etc/nginx/conf.d/yhgs-api.conf

# Create systemd service
tee /etc/systemd/system/yhgs-api.service > /dev/null << 'EOF'
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
EOF

# Start services
systemctl daemon-reload
systemctl enable yhgs-api
systemctl start yhgs-api

# Configure firewall
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# Test and reload Nginx
nginx -t && systemctl reload nginx

echo "Deployment completed successfully!"
echo ""
echo "Frontend: http://$FRONTEND_DOMAIN"
echo "API: http://$API_DOMAIN"
echo ""
echo "Service status:"
systemctl status yhgs-api --no-pager -l
echo ""
echo "Next steps:"
echo "1. Configure DNS for your domains"
echo "2. Set up SSL certificates with certbot"
echo "3. Test cryptocurrency data at: http://$API_DOMAIN/api/tokens"