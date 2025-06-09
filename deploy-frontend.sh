#!/bin/bash

echo "Deploying YHGS Bridge Frontend..."

# Create web directory
mkdir -p /var/www/yhgs-frontend
cp -r static-frontend/* /var/www/yhgs-frontend/
chown -R nginx:nginx /var/www/yhgs-frontend
chmod -R 755 /var/www/yhgs-frontend

# Install Nginx configuration
cp nginx-frontend.conf /etc/nginx/conf.d/yhgs-frontend.conf

# Test and reload Nginx
nginx -t && systemctl reload nginx

echo "Frontend deployed successfully!"
echo "Access at: http://app.yourdomain.com"
