#!/bin/bash

# Build static frontend for deployment
# This creates a static website that can be hosted anywhere

echo "Building static YHGS Bridge frontend..."

# Install dependencies if needed
npm install

# Build the frontend for production
echo "Building React frontend..."
npm run build

# Create deployment directory
DEPLOY_DIR="./static-deploy"
mkdir -p $DEPLOY_DIR

# Copy built frontend files
echo "Copying static files..."
cp -r dist/public/* $DEPLOY_DIR/

# Create backend deployment package
BACKEND_DIR="./backend-deploy"
mkdir -p $BACKEND_DIR

# Copy backend files
echo "Preparing backend deployment..."
cp -r dist/index.js $BACKEND_DIR/
cp -r server $BACKEND_DIR/
cp -r shared $BACKEND_DIR/
cp package.json $BACKEND_DIR/
cp package-lock.json $BACKEND_DIR/

# Create production environment template
cat > $BACKEND_DIR/.env.production << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://yhgs_user:yhgs2024@localhost:5432/yhgs_bridge
REDIS_URL=redis://localhost:6379
FRONTEND_URL=https://app.yourdomain.com
EOF

# Create Nginx configuration for static frontend
cat > nginx-static.conf << 'EOF'
server {
    listen 80;
    server_name app.yourdomain.com;
    root /var/www/yhgs-static;
    index index.html;

    # Enable gzip compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml application/xml+rss text/javascript;

    # Cache static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Handle React Router - serve index.html for all routes
    location / {
        try_files $uri $uri/ /index.html;
    }

    # Proxy API calls to backend
    location /api/ {
        proxy_pass http://api.yourdomain.com:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Create API server Nginx configuration
cat > nginx-api.conf << 'EOF'
server {
    listen 80;
    server_name api.yourdomain.com;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        # CORS headers for API
        add_header Access-Control-Allow-Origin "https://app.yourdomain.com" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        
        if ($request_method = 'OPTIONS') {
            add_header Access-Control-Allow-Origin "https://app.yourdomain.com";
            add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS";
            add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization";
            add_header Content-Length 0;
            add_header Content-Type text/plain;
            return 204;
        }
    }
}
EOF

# Create deployment script for static frontend
cat > deploy-static.sh << 'EOF'
#!/bin/bash

# Deploy static frontend to web server
echo "Deploying static YHGS Bridge frontend..."

# Create web directory
sudo mkdir -p /var/www/yhgs-static
sudo cp -r static-deploy/* /var/www/yhgs-static/
sudo chown -R nginx:nginx /var/www/yhgs-static
sudo chmod -R 755 /var/www/yhgs-static

# Install Nginx configuration
sudo cp nginx-static.conf /etc/nginx/conf.d/yhgs-static.conf
sudo nginx -t && sudo systemctl reload nginx

echo "Static frontend deployed to /var/www/yhgs-static"
echo "Configure your domain: app.yourdomain.com"
EOF

# Create deployment script for API backend
cat > deploy-api.sh << 'EOF'
#!/bin/bash

# Deploy API backend
echo "Deploying YHGS Bridge API backend..."

# Create API directory
sudo mkdir -p /var/www/yhgs-api
sudo cp -r backend-deploy/* /var/www/yhgs-api/
sudo chown -R yhgs:yhgs /var/www/yhgs-api

# Install dependencies
cd /var/www/yhgs-api
sudo -u yhgs npm install --production

# Create systemd service
sudo tee /etc/systemd/system/yhgs-api.service > /dev/null << 'SERVICE'
[Unit]
Description=YHGS Bridge API
After=network.target postgresql.service

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

# Install API Nginx configuration
sudo cp nginx-api.conf /etc/nginx/conf.d/yhgs-api.conf
sudo nginx -t && sudo systemctl reload nginx

# Start API service
sudo systemctl daemon-reload
sudo systemctl enable yhgs-api
sudo systemctl start yhgs-api

echo "API backend deployed and running on port 5000"
echo "Configure your domain: api.yourdomain.com"
EOF

chmod +x deploy-static.sh
chmod +x deploy-api.sh

echo "✅ Static deployment files created!"
echo ""
echo "Deployment structure:"
echo "📁 static-deploy/     - Static frontend files"
echo "📁 backend-deploy/    - Backend API files"
echo "📄 nginx-static.conf  - Frontend Nginx config"
echo "📄 nginx-api.conf     - API Nginx config"
echo "📄 deploy-static.sh   - Deploy frontend script"
echo "📄 deploy-api.sh      - Deploy backend script"
echo ""
echo "To deploy:"
echo "1. Run: ./deploy-static.sh (for frontend)"
echo "2. Run: ./deploy-api.sh (for backend)"
echo "3. Update domains in Nginx configs"
echo "4. Set up SSL certificates"