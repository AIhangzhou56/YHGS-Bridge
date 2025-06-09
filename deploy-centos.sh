#!/bin/bash

# YHGS Multi-Chain Bridge Production Deployment Script
# CentOS/RHEL Version

set -e

echo "🚀 Starting YHGS Bridge Production Deployment on CentOS..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root (use sudo)"
   exit 1
fi

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

# Configuration
APP_NAME="yhgs-bridge"
APP_DIR="/var/www/yhgs-bridge"
SERVICE_USER="nginx"
NODE_VERSION="20"

print_status() {
    echo -e "${GREEN}✓${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

# Detect package manager
if command -v dnf &> /dev/null; then
    PKG_MANAGER="dnf"
elif command -v yum &> /dev/null; then
    PKG_MANAGER="yum"
else
    print_error "Neither dnf nor yum found. This script requires CentOS/RHEL."
    exit 1
fi

print_status "Using package manager: $PKG_MANAGER"

# Update system packages
print_status "Updating system packages..."
$PKG_MANAGER update -y

# Install EPEL repository
print_status "Installing EPEL repository..."
$PKG_MANAGER install -y epel-release

# Install required packages
print_status "Installing required packages..."
$PKG_MANAGER install -y curl git nginx postgresql postgresql-server postgresql-contrib redis htop firewalld

# Initialize PostgreSQL (CentOS specific)
if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
    print_status "Initializing PostgreSQL database..."
    postgresql-setup initdb
fi

# Install Node.js 20 from NodeSource
print_status "Installing Node.js 20..."
curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
$PKG_MANAGER install -y nodejs

# Install PM2 globally
print_status "Installing PM2..."
npm install -g pm2

# Start and enable services
print_status "Starting and enabling services..."
systemctl start postgresql
systemctl enable postgresql
systemctl start redis
systemctl enable redis
systemctl start nginx
systemctl enable nginx

# Configure firewall
print_status "Configuring firewall..."
systemctl start firewalld
systemctl enable firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=5000/tcp
firewall-cmd --reload

# Create application directory
print_status "Creating application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# Clone or update repository
if [ -d ".git" ]; then
    print_status "Updating existing repository..."
    git pull origin main
else
    print_status "Cloning repository..."
    git clone https://github.com/yourusername/yhgs-bridge.git .
fi

# Install dependencies
print_status "Installing Node.js dependencies..."
npm install

# Build the application
print_status "Building application..."
npm run build

# Create logs directory
mkdir -p logs

# Set up environment file
if [ ! -f .env.production ]; then
    print_status "Creating production environment file..."
    cat > .env.production << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://yhgs_user:your_password@localhost:5432/yhgs_bridge
REDIS_URL=redis://localhost:6379
EOF
    print_warning "Please update .env.production with your actual database credentials"
fi

# Create PostgreSQL database and user
print_status "Setting up PostgreSQL database..."
sudo -u postgres psql << 'EOF'
CREATE DATABASE yhgs_bridge;
CREATE USER yhgs_user WITH ENCRYPTED PASSWORD 'your_secure_password';
GRANT ALL PRIVILEGES ON DATABASE yhgs_bridge TO yhgs_user;
\q
EOF

# Create systemd service file
print_status "Creating systemd service..."
cat > /etc/systemd/system/yhgs-bridge.service << 'EOF'
[Unit]
Description=YHGS Bridge Application
Documentation=https://github.com/yourusername/yhgs-bridge
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=nginx
Group=nginx
WorkingDirectory=/var/www/yhgs-bridge
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/yhgs-bridge/.env.production

# Logging
StandardOutput=append:/var/www/yhgs-bridge/logs/app.log
StandardError=append:/var/www/yhgs-bridge/logs/error.log

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ReadWritePaths=/var/www/yhgs-bridge
ProtectHome=true

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration for CentOS
print_status "Creating Nginx configuration..."
cat > /etc/nginx/conf.d/yhgs-bridge.conf << 'EOF'
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

    # API endpoints
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Static assets
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }

    # React app routes - all non-API requests
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
        
        # Handle React routing
        proxy_intercept_errors on;
        error_page 404 = @fallback;
    }

    # Fallback for React router
    location @fallback {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

# Set proper ownership
print_status "Setting file permissions..."
chown -R nginx:nginx $APP_DIR
chmod -R 755 $APP_DIR

# SELinux configuration for CentOS
if command -v getenforce &> /dev/null && [ "$(getenforce)" = "Enforcing" ]; then
    print_status "Configuring SELinux..."
    setsebool -P httpd_can_network_connect 1
    setsebool -P httpd_can_network_relay 1
    semanage port -a -t http_port_t -p tcp 5000 2>/dev/null || true
fi

# Test Nginx configuration
print_status "Testing Nginx configuration..."
nginx -t

# Reload systemd and start services
systemctl daemon-reload
systemctl enable yhgs-bridge
systemctl start yhgs-bridge
systemctl reload nginx

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
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
      error_file: './logs/pm2-err.log',
      out_file: './logs/pm2-out.log',
      log_file: './logs/pm2-combined.log',
      time: true
    }
  ]
}
EOF

# Setup PM2 startup script
pm2 startup systemd -u nginx --hp /var/www/yhgs-bridge

print_status "Deployment completed successfully!"
echo ""
echo "Next steps:"
echo "1. Update your domain in /etc/nginx/conf.d/yhgs-bridge.conf"
echo "2. Update database credentials in $APP_DIR/.env.production"
echo "3. Run database migrations: cd $APP_DIR && npm run db:push"
echo "4. Start the application: systemctl start yhgs-bridge"
echo "5. Check status: systemctl status yhgs-bridge"
echo ""
echo "Useful commands:"
echo "- View logs: journalctl -u yhgs-bridge -f"
echo "- Restart service: systemctl restart yhgs-bridge"
echo "- Check Nginx: nginx -t && systemctl reload nginx"