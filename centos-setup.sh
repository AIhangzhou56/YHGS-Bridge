#!/bin/bash

# Complete CentOS Setup for YHGS Bridge
# Handles PostgreSQL properly and fixes all common issues

set -e

echo "🚀 Setting up YHGS Bridge on CentOS..."

# Check if running as root
if [[ $EUID -ne 0 ]]; then
   echo "This script must be run as root"
   exit 1
fi

# Fix Node.js conflicts first
echo "Fixing Node.js package conflicts..."
dnf remove -y nodejs npm nodejs-full-i18n 2>/dev/null || true
dnf clean all
rm -f /etc/yum.repos.d/nodesource-*.repo

# Install Node.js 20 using dnf modules
echo "Installing Node.js 20..."
dnf module reset nodejs -y 2>/dev/null || true
dnf module enable nodejs:20 -y 2>/dev/null || true
dnf install -y nodejs npm

# Install other required packages
echo "Installing system packages..."
dnf install -y nginx postgresql postgresql-server redis firewalld

# Initialize PostgreSQL database properly
echo "Setting up PostgreSQL..."
if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
    # Initialize as postgres user, not root
    sudo -u postgres /usr/bin/postgresql-setup --initdb
fi

# Start services
echo "Starting services..."
systemctl start postgresql
systemctl enable postgresql
systemctl start redis  
systemctl enable redis
systemctl start nginx
systemctl enable nginx

# Configure firewall
echo "Configuring firewall..."
systemctl start firewalld
systemctl enable firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-port=5000/tcp
firewall-cmd --reload

# Create database and user
echo "Creating database..."
sudo -u postgres createdb yhgs_bridge 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER yhgs_user WITH PASSWORD 'yhgs_secure_2024';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE yhgs_bridge TO yhgs_user;" 2>/dev/null || true

# Create application directory
APP_DIR="/var/www/yhgs-bridge"
mkdir -p $APP_DIR
cd $APP_DIR

# Create environment file
cat > .env.production << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://yhgs_user:yhgs_secure_2024@localhost:5432/yhgs_bridge
REDIS_URL=redis://localhost:6379
EOF

# Create systemd service
cat > /etc/systemd/system/yhgs-bridge.service << 'EOF'
[Unit]
Description=YHGS Bridge Application
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
StandardOutput=append:/var/www/yhgs-bridge/logs/app.log
StandardError=append:/var/www/yhgs-bridge/logs/error.log

[Install]
WantedBy=multi-user.target
EOF

# Create Nginx configuration
cat > /etc/nginx/conf.d/yhgs-bridge.conf << 'EOF'
server {
    listen 80;
    server_name yhgs.chat www.yhgs.chat;

    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

# Remove default Nginx config
rm -f /etc/nginx/conf.d/default.conf

# Create directories and set permissions
mkdir -p $APP_DIR/logs
chown -R nginx:nginx $APP_DIR

# Install PM2
npm install -g pm2

# Configure SELinux if enabled
if command -v getenforce &> /dev/null && [ "$(getenforce)" = "Enforcing" ]; then
    setsebool -P httpd_can_network_connect 1
    setsebool -P httpd_can_network_relay 1
fi

systemctl daemon-reload
nginx -t

echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Upload your project files to: $APP_DIR"
echo "2. cd $APP_DIR && npm install && npm run build"
echo "3. systemctl start yhgs-bridge"
echo "4. systemctl reload nginx"
echo ""
echo "Check status: systemctl status yhgs-bridge"