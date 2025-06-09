#!/bin/bash

echo "Deploying YHGS Bridge Frontend..."

# Create web directory
sudo mkdir -p /var/www/yhgs-frontend
sudo cp -r static-frontend/* /var/www/yhgs-frontend/
sudo chown -R nginx:nginx /var/www/yhgs-frontend
sudo chmod -R 755 /var/www/yhgs-frontend

# Install Nginx configuration
sudo cp nginx-frontend.conf /etc/nginx/conf.d/yhgs-frontend.conf

# Test and reload Nginx
sudo nginx -t && sudo systemctl reload nginx

echo "Frontend deployed successfully!"
echo "Access at: http://app.yourdomain.com"
