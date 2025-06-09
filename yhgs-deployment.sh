#!/bin/bash

# YHGS Bridge Deployment for yhgs.chat
# Run as root on CentOS

echo "Deploying YHGS Bridge to yhgs.chat..."

# Create directories
mkdir -p /var/www/yhgs-frontend
mkdir -p /var/www/yhgs-api

# Deploy static frontend
cp -r static-frontend/* /var/www/yhgs-frontend/
chown -R nginx:nginx /var/www/yhgs-frontend
chmod -R 755 /var/www/yhgs-frontend

# Deploy API backend
useradd -r yhgs 2>/dev/null || true
cp -r api-backend/* /var/www/yhgs-api/
chown -R yhgs:yhgs /var/www/yhgs-api

# Install Node.js dependencies
cd /var/www/yhgs-api
su -c "npm install --production" yhgs

# Configure Nginx for yhgs.chat
cp nginx-frontend.conf /etc/nginx/conf.d/yhgs-frontend.conf
cp nginx-api.conf /etc/nginx/conf.d/yhgs-api.conf

# Create systemd service
cat > /etc/systemd/system/yhgs-api.service << 'EOF'
[Unit]
Description=YHGS Bridge API
After=network.target postgresql.service

[Service]
Type=simple
User=yhgs
WorkingDirectory=/var/www/yhgs-api
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/yhgs-api/.env.production

[Install]
WantedBy=multi-user.target
EOF

# Configure firewall
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --reload

# Start services
systemctl daemon-reload
systemctl enable yhgs-api
systemctl start yhgs-api
nginx -t && systemctl reload nginx

echo "Deployment completed!"
echo ""
echo "Services:"
echo "Frontend: https://yhgs.chat"
echo "API: https://app.yhgs.chat"
echo ""
echo "Status check:"
systemctl status yhgs-api --no-pager -l
echo ""
echo "Next steps:"
echo "1. Configure DNS: yhgs.chat -> your server IP"
echo "2. Configure DNS: app.yhgs.chat -> your server IP"
echo "3. Install SSL: certbot --nginx -d yhgs.chat -d app.yhgs.chat"
echo "4. Test API: curl https://app.yhgs.chat/api/tokens"