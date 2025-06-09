#!/bin/bash

echo "Complete YHGS Bridge Deployment..."

# Update domain names (replace with your actual domains)
read -p "Enter your frontend domain (e.g., app.yourdomain.com): " FRONTEND_DOMAIN
read -p "Enter your API domain (e.g., api.yourdomain.com): " API_DOMAIN

# Update Nginx configurations
sed -i "s/app.yourdomain.com/$FRONTEND_DOMAIN/g" nginx-frontend.conf
sed -i "s/api.yourdomain.com/$API_DOMAIN/g" nginx-api.conf nginx-frontend.conf

# Update CORS settings
sed -i "s/app.yourdomain.com/$FRONTEND_DOMAIN/g" api-backend/.env.production

# Deploy both frontend and backend
chmod +x deploy-frontend.sh deploy-backend.sh
./deploy-frontend.sh
./deploy-backend.sh

echo "Complete deployment finished!"
echo "Frontend: http://$FRONTEND_DOMAIN"
echo "API: http://$API_DOMAIN"
echo "Don't forget to set up SSL certificates!"
