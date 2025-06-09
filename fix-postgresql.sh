#!/bin/bash

# Fix PostgreSQL setup for CentOS
# Resolves the "root user not allowed" error

echo "Fixing PostgreSQL setup..."

# Stop any running PostgreSQL processes
systemctl stop postgresql 2>/dev/null || true

# Initialize PostgreSQL as postgres user (not root)
if [ ! -f /var/lib/pgsql/data/postgresql.conf ]; then
    echo "Initializing PostgreSQL database..."
    sudo -u postgres /usr/bin/postgresql-setup --initdb
fi

# Start PostgreSQL service
systemctl start postgresql
systemctl enable postgresql

# Wait for PostgreSQL to start
sleep 3

# Create database and user
echo "Creating database and user..."
sudo -u postgres createdb yhgs_bridge 2>/dev/null || echo "Database already exists"
sudo -u postgres psql << 'EOF'
DO
$do$
BEGIN
   IF NOT EXISTS (
      SELECT FROM pg_catalog.pg_roles 
      WHERE  rolname = 'yhgs_user') THEN
      
      CREATE USER yhgs_user WITH PASSWORD 'yhgs_secure_2024';
   END IF;
END
$do$;
GRANT ALL PRIVILEGES ON DATABASE yhgs_bridge TO yhgs_user;
EOF

echo "✅ PostgreSQL setup completed"
echo "Database: yhgs_bridge"
echo "User: yhgs_user"
echo "Password: yhgs_secure_2024"

# Test connection
echo "Testing database connection..."
sudo -u postgres psql -d yhgs_bridge -c "SELECT version();" | head -1