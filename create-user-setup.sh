#!/bin/bash

# Create proper user and setup PostgreSQL for CentOS
# This fixes the root user restriction issue

echo "Creating proper user setup for PostgreSQL..."

# Create a dedicated user for the application
useradd -r -s /bin/bash -d /var/www/yhgs-bridge yhgs 2>/dev/null || echo "User yhgs already exists"

# Add yhgs user to nginx group for file permissions
usermod -a -G nginx yhgs

# Create application directory with proper ownership
mkdir -p /var/www/yhgs-bridge
chown yhgs:nginx /var/www/yhgs-bridge
chmod 755 /var/www/yhgs-bridge

# Install PostgreSQL if not already installed
dnf install -y postgresql postgresql-server

# Initialize PostgreSQL properly (as postgres user, not root)
echo "Initializing PostgreSQL database..."
if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
    # Use the postgres user that was created during package installation
    sudo -u postgres /usr/bin/postgresql-setup --initdb
fi

# Start and enable PostgreSQL
systemctl start postgresql
systemctl enable postgresql

# Wait for PostgreSQL to be ready
sleep 3

# Create database and user
echo "Setting up database..."
sudo -u postgres psql << 'EOF'
-- Create database
CREATE DATABASE yhgs_bridge;

-- Create user with password
CREATE USER yhgs_user WITH ENCRYPTED PASSWORD 'yhgs_secure_password_2024';

-- Grant all privileges
GRANT ALL PRIVILEGES ON DATABASE yhgs_bridge TO yhgs_user;

-- Grant schema permissions
\c yhgs_bridge;
GRANT ALL ON SCHEMA public TO yhgs_user;

-- Exit
\q
EOF

# Create environment file
cat > /var/www/yhgs-bridge/.env.production << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://yhgs_user:yhgs_secure_password_2024@localhost:5432/yhgs_bridge
REDIS_URL=redis://localhost:6379
EOF

# Set proper ownership for environment file
chown yhgs:nginx /var/www/yhgs-bridge/.env.production
chmod 600 /var/www/yhgs-bridge/.env.production

# Update systemd service to use the yhgs user
cat > /etc/systemd/system/yhgs-bridge.service << 'EOF'
[Unit]
Description=YHGS Bridge Application
After=network.target postgresql.service redis.service

[Service]
Type=simple
User=yhgs
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

[Install]
WantedBy=multi-user.target
EOF

# Create logs directory
mkdir -p /var/www/yhgs-bridge/logs
chown yhgs:nginx /var/www/yhgs-bridge/logs

# Test database connection
echo "Testing database connection..."
sudo -u postgres psql -d yhgs_bridge -c "SELECT 'Database connection successful!' as status;"

echo "✅ User and PostgreSQL setup completed!"
echo ""
echo "Created user: yhgs"
echo "Database: yhgs_bridge"
echo "Database user: yhgs_user"
echo "App directory: /var/www/yhgs-bridge"
echo ""
echo "Next steps:"
echo "1. Copy your project files to /var/www/yhgs-bridge"
echo "2. chown -R yhgs:nginx /var/www/yhgs-bridge"
echo "3. Switch to yhgs user: su - yhgs"
echo "4. cd /var/www/yhgs-bridge && npm install && npm run build"
echo "5. systemctl daemon-reload && systemctl start yhgs-bridge"