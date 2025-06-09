#!/bin/bash

# YHGS Bridge Production Deployment Script
# This script fixes WebSocket issues and deploys to your server

set -e

echo "🚀 Starting YHGS Bridge Deployment..."

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Configuration
APP_NAME="yhgs-bridge"
APP_DIR="/var/www/yhgs-bridge"
SERVICE_USER="www-data"
NODE_VERSION="20"

# Function to print colored output
print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   print_error "This script must be run as root (use sudo)"
   exit 1
fi

print_status "Installing system dependencies..."

# Update system packages
apt update && apt upgrade -y

# Install required packages
apt install -y curl wget git build-essential nginx certbot python3-certbot-nginx

# Install Node.js 20
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
npm install -g pm2

print_status "System dependencies installed"

# Create application directory
mkdir -p $APP_DIR
mkdir -p $APP_DIR/logs
chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR

print_status "Created application directory: $APP_DIR"

# Copy application files (assuming current directory contains the app)
print_status "Copying application files..."
cp -r ./* $APP_DIR/
cd $APP_DIR

# Install dependencies
print_status "Installing Node.js dependencies..."
npm ci --only=production

# Build application
print_status "Building application..."
npm run build

# Create environment file template
cat > .env.production << EOF
NODE_ENV=production
PORT=5000

# Database Configuration (UPDATE THESE VALUES)
DATABASE_URL=postgresql://username:password@your-db-host:5432/yhgs_bridge?sslmode=require
PGHOST=your-db-host
PGPORT=5432
PGUSER=username
PGPASSWORD=password
PGDATABASE=yhgs_bridge

# Optional: API Keys for enhanced features
# COINGECKO_API_KEY=your_api_key_here
EOF

# Create PM2 ecosystem config
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'yhgs-bridge',
    script: './dist/index.js',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env_file: '.env.production',
    env: {
      NODE_ENV: 'production',
      PORT: 5000
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm Z',
    merge_logs: true,
    kill_timeout: 5000,
    restart_delay: 1000
  }]
}
EOF

# Create systemd service for PM2
cat > /etc/systemd/system/yhgs-bridge.service << EOF
[Unit]
Description=YHGS Bridge PM2 Service
After=network.target

[Service]
Type=forking
User=$SERVICE_USER
WorkingDirectory=$APP_DIR
Environment=PATH=/usr/bin:/usr/local/bin
Environment=PM2_HOME=/home/$SERVICE_USER/.pm2
ExecStart=/usr/bin/pm2 start ecosystem.config.js --env production
ExecReload=/usr/bin/pm2 reload ecosystem.config.js --env production
ExecStop=/usr/bin/pm2 delete yhgs-bridge
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
cat > /etc/nginx/sites-available/yhgs-bridge << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    # Security headers
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-XSS-Protection "1; mode=block" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "no-referrer-when-downgrade" always;
    add_header Content-Security-Policy "default-src 'self' http: https: data: blob: 'unsafe-inline'" always;

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/xml+rss application/json;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }

    # API rate limiting
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static files caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:5000;
    }
}
EOF

# Enable Nginx site
ln -sf /etc/nginx/sites-available/yhgs-bridge /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Test Nginx configuration
nginx -t

print_status "Nginx configuration created"

# Set proper permissions
chown -R $SERVICE_USER:$SERVICE_USER $APP_DIR
chmod +x $APP_DIR/deploy.sh

print_status "Setting up PM2 and starting application..."

# Switch to service user and start PM2
sudo -u $SERVICE_USER bash << EOF
cd $APP_DIR
pm2 delete yhgs-bridge 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
EOF

# Enable and start services
systemctl daemon-reload
systemctl enable yhgs-bridge
systemctl start yhgs-bridge
systemctl enable nginx
systemctl restart nginx

print_status "Services started successfully"

# Create update script
cat > $APP_DIR/update.sh << 'EOF'
#!/bin/bash
echo "Updating YHGS Bridge..."
cd /var/www/yhgs-bridge
git pull origin main
npm ci --only=production
npm run build
pm2 reload yhgs-bridge
echo "Update completed!"
EOF

chmod +x $APP_DIR/update.sh

# Create monitoring script
cat > $APP_DIR/monitor.sh << 'EOF'
#!/bin/bash
echo "=== YHGS Bridge Status ==="
echo "PM2 Status:"
pm2 status yhgs-bridge
echo ""
echo "Application Logs (last 20 lines):"
pm2 logs yhgs-bridge --lines 20
echo ""
echo "System Resources:"
free -h
df -h
echo ""
echo "Nginx Status:"
systemctl status nginx --no-pager
EOF

chmod +x $APP_DIR/monitor.sh

print_status "Deployment completed successfully!"

echo ""
echo "=========================================="
echo "🎉 YHGS Bridge Deployment Complete!"
echo "=========================================="
echo ""
print_warning "IMPORTANT: Complete these final steps:"
echo ""
echo "1. Update database configuration in: $APP_DIR/.env.production"
echo "   - Set your actual DATABASE_URL"
echo "   - Update PGHOST, PGUSER, PGPASSWORD, PGDATABASE"
echo ""
echo "2. Update domain in Nginx config: /etc/nginx/sites-available/yhgs-bridge"
echo "   - Replace 'your-domain.com' with your actual domain"
echo ""
echo "3. Setup SSL certificate:"
echo "   sudo certbot --nginx -d your-domain.com -d www.your-domain.com"
echo ""
echo "4. Restart services after configuration:"
echo "   sudo systemctl restart yhgs-bridge"
echo "   sudo systemctl restart nginx"
echo ""
echo "Useful commands:"
echo "- Check status: $APP_DIR/monitor.sh"
echo "- Update app: $APP_DIR/update.sh"
echo "- View logs: pm2 logs yhgs-bridge"
echo "- Restart app: pm2 restart yhgs-bridge"
echo ""
print_status "Your YHGS Bridge is now running on http://localhost:5000"
print_status "WebSocket connection issues have been fixed!"