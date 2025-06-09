#!/bin/bash

# CentOS-compatible build script for YHGS Bridge

echo "Building YHGS Bridge for CentOS deployment..."

# Build frontend
echo "Building frontend..."
npm run build

# Create deployment directories
mkdir -p static-frontend
mkdir -p api-backend

# Copy frontend build to static-frontend
echo "Preparing static frontend..."
cp -r dist/* static-frontend/

# Copy backend files to api-backend (excluding problematic packages)
echo "Preparing API backend..."
cp -r server/* api-backend/
cp drizzle.config.ts api-backend/
mkdir -p api-backend/shared
cp shared/schema.ts api-backend/shared/

# Replace SQLite db.ts with PostgreSQL version
cp server/db-postgres.ts api-backend/db.ts

# Create a CentOS-compatible package.json (PostgreSQL only)
cat > api-backend/package.json << 'EOF'
{
  "name": "yhgs-api",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "start": "node index.js"
  },
  "dependencies": {
    "pg": "^8.11.3",
    "drizzle-orm": "^0.29.0",
    "drizzle-zod": "^0.5.1",
    "express": "^4.18.2",
    "express-session": "^1.17.3",
    "zod": "^3.22.4",
    "ethers": "^6.9.0",
    "ws": "^8.14.2"
  }
}
EOF

# Copy environment file
cp .env.example api-backend/.env.production

# Update environment for PostgreSQL
cat > api-backend/.env.production << 'EOF'
NODE_ENV=production
PORT=5000
DATABASE_URL=postgresql://yhgs_user:yhgs2024@localhost:5432/yhgs_bridge
CORS_ORIGIN=https://yhgs.chat
EOF

echo "Build completed successfully!"
echo ""
echo "Static frontend: ./static-frontend/"
echo "API backend: ./api-backend/"
echo ""
echo "Next step: Run ./yhgs-deployment.sh as root on your CentOS server"