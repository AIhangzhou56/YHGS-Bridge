#!/bin/bash

# Complete Static Deployment Setup for YHGS Bridge
# Creates separate frontend and backend deployments

echo "Creating static deployment for YHGS Bridge..."

# Create deployment directories
mkdir -p static-frontend
mkdir -p api-backend

# Copy current built frontend files
if [ -d "dist/public" ]; then
    cp -r dist/public/* static-frontend/
    echo "Frontend files copied to static-frontend/"
else
    echo "Building frontend first..."
    npm run build
    cp -r dist/public/* static-frontend/
fi

# Create backend deployment package
cp -r server api-backend/
cp -r shared api-backend/
cp package.json api-backend/
cp package-lock.json api-backend/
cp drizzle.config.ts api-backend/

# Create production environment for backend
cat > api-backend/.env.production << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://yhgs_user:yhgs2024@localhost:5432/yhgs_bridge
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=https://app.yourdomain.com
EOF

# Create simplified backend entry point
cat > api-backend/index.js << 'EOF'
import express from 'express';
import cors from 'cors';
import { registerRoutes } from './server/routes.js';

const app = express();
const PORT = process.env.PORT || 5000;

// CORS configuration for static frontend
app.use(cors({
  origin: process.env.CORS_ORIGIN || 'https://app.yourdomain.com',
  credentials: true
}));

app.use(express.json());

// Register API routes
await registerRoutes(app);

app.listen(PORT, '0.0.0.0', () => {
  console.log(`YHGS Bridge API running on port ${PORT}`);
});
EOF

# Create Nginx configuration for static frontend
cat > nginx-frontend.conf << 'EOF'
server {
    listen 80;
    server_name app.yourdomain.com;
    root /var/www/yhgs-frontend;
    index index.html;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # Handle React Router - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }
}
EOF

# Create Nginx configuration for API backend
cat > nginx-api.conf << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=30r/s;
    
    location / {
        limit_req zone=api burst=50 nodelay;
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers
        add_header Access-Control-Allow-Origin "https://app.yourdomain.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;
        
        # Handle preflight requests
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://app.yourdomain.com";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
            add_header Access-Control-Allow-Credentials "true";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
}
EOF

# Create frontend deployment script
cat > deploy-frontend.sh << 'EOF'
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
EOF

# Create backend deployment script
cat > deploy-backend.sh << 'EOF'
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
EOF

# Create complete deployment script
cat > deploy-complete.sh << 'EOF'
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
EOF

chmod +x deploy-frontend.sh deploy-backend.sh deploy-complete.sh

echo "Static deployment setup completed!"
echo ""
echo "Generated files:"
echo "📁 static-frontend/ - Static website files"
echo "📁 api-backend/ - Backend API files"
echo "📄 nginx-frontend.conf - Frontend web server config"
echo "📄 nginx-api.conf - API server config"
echo "📄 deploy-frontend.sh - Frontend deployment script"
echo "📄 deploy-backend.sh - Backend deployment script"
echo "📄 deploy-complete.sh - Complete deployment script"
echo ""
echo "Deployment options:"
echo "1. Run: ./deploy-complete.sh (automated deployment)"
echo "2. Run separately: ./deploy-frontend.sh && ./deploy-backend.sh"
echo "3. Manual deployment using the generated configs"