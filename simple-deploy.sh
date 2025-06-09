#!/bin/bash

# Simple CentOS deployment with proper user creation
# Fixes the PostgreSQL root user issue

echo "Setting up YHGS Bridge with proper user configuration..."

# Create application user
useradd -r -m -s /bin/bash yhgs 2>/dev/null || echo "User yhgs already exists"

# Create application directory
mkdir -p /var/www/yhgs-bridge
chown yhgs:yhgs /var/www/yhgs-bridge

# Install required packages
dnf install -y postgresql postgresql-server redis nginx

# Initialize PostgreSQL as postgres user (this is the key fix)
if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
    echo "Initializing PostgreSQL..."
    sudo -u postgres /usr/bin/postgresql-setup --initdb
fi

# Start services
systemctl start postgresql redis nginx
systemctl enable postgresql redis nginx

# Create database
echo "Creating database..."
sudo -u postgres createdb yhgs_bridge 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER yhgs_user WITH PASSWORD 'yhgs2024';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE yhgs_bridge TO yhgs_user;"

# Configure Nginx
cat > /etc/nginx/conf.d/yhgs.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
    location /api/ {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }
    
    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
EOF

rm -f /etc/nginx/conf.d/default.conf

# Create systemd service
cat > /etc/systemd/system/yhgs-bridge.service << 'EOF'
[Unit]
Description=YHGS Bridge
After=network.target postgresql.service

[Service]
Type=simple
User=yhgs
WorkingDirectory=/var/www/yhgs-bridge
ExecStart=/usr/bin/node dist/index.js
Restart=always
Environment=NODE_ENV=production
Environment=PORT=5000
Environment=DATABASE_URL=postgresql://yhgs_user:yhgs2024@localhost:5432/yhgs_bridge

[Install]
WantedBy=multi-user.target
EOF

systemctl daemon-reload
nginx -t

echo "Setup completed. Now:"
echo "1. Copy your project files to /var/www/yhgs-bridge"
echo "2. chown -R yhgs:yhgs /var/www/yhgs-bridge"
echo "3. su - yhgs"
echo "4. cd /var/www/yhgs-bridge && npm install && npm run build"
echo "5. exit (back to root)"
echo "6. systemctl start yhgs-bridge"