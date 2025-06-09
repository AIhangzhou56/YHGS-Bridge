#!/bin/bash

# Complete deployment script that handles user switching properly
# Run this as root

echo "Setting up YHGS Bridge with proper user management..."

# Create yhgs user if doesn't exist
if ! id "yhgs" &>/dev/null; then
    useradd -r -m -s /bin/bash yhgs
    echo "Created user: yhgs"
fi

# Create app directory
mkdir -p /var/www/yhgs-bridge
chown yhgs:yhgs /var/www/yhgs-bridge

# Setup PostgreSQL properly
if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
    sudo -u postgres /usr/bin/postgresql-setup --initdb
fi

systemctl start postgresql
systemctl enable postgresql

# Create database
sudo -u postgres createdb yhgs_bridge 2>/dev/null || true
sudo -u postgres psql -c "CREATE USER yhgs_user WITH PASSWORD 'yhgs2024';" 2>/dev/null || true
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE yhgs_bridge TO yhgs_user;"

# Install Node.js if not present
if ! command -v node &> /dev/null; then
    dnf install -y nodejs npm
fi

# Copy project files to app directory (you need to update this path)
echo "Copy your project files to /var/www/yhgs-bridge now..."
echo "Then run: chown -R yhgs:yhgs /var/www/yhgs-bridge"
echo ""
echo "To build the project, run these commands:"
echo "sudo -u yhgs bash -c 'cd /var/www/yhgs-bridge && npm install && npm run build'"
echo ""

# Create environment file
cat > /var/www/yhgs-bridge/.env.production << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://yhgs_user:yhgs2024@localhost:5432/yhgs_bridge
REDIS_URL=redis://localhost:6379
EOF

chown yhgs:yhgs /var/www/yhgs-bridge/.env.production

# Create systemd service
cat > /etc/systemd/system/yhgs-bridge.service << 'EOF'
[Unit]
Description=YHGS Bridge Application
After=network.target postgresql.service

[Service]
Type=simple
User=yhgs
Group=yhgs
WorkingDirectory=/var/www/yhgs-bridge
ExecStart=/usr/bin/node dist/index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
EnvironmentFile=/var/www/yhgs-bridge/.env.production

[Install]
WantedBy=multi-user.target
EOF

# Setup Nginx
cat > /etc/nginx/conf.d/yhgs.conf << 'EOF'
server {
    listen 80;
    server_name _;
    
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

rm -f /etc/nginx/conf.d/default.conf
systemctl start nginx
systemctl enable nginx

systemctl daemon-reload

echo "✅ Setup completed!"
echo ""
echo "Next steps:"
echo "1. Copy your project files: cp -r /path/to/your/project/* /var/www/yhgs-bridge/"
echo "2. Set ownership: chown -R yhgs:yhgs /var/www/yhgs-bridge"
echo "3. Build as yhgs user: sudo -u yhgs bash -c 'cd /var/www/yhgs-bridge && npm install && npm run build'"
echo "4. Start service: systemctl start yhgs-bridge"
echo "5. Test: curl http://localhost/api/tokens"