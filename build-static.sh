#!/bin/bash

# Build YHGS Bridge for Static Deployment

echo "Building YHGS Bridge for static deployment..."

# Build frontend
echo "Building frontend..."
npm run build

# Create deployment directories
mkdir -p static-frontend
mkdir -p api-backend

# Copy frontend build to static-frontend
echo "Preparing static frontend..."
cp -r dist/* static-frontend/

# Copy backend files to api-backend
echo "Preparing API backend..."
cp -r server/* api-backend/
cp package*.json api-backend/
cp drizzle.config.ts api-backend/
cp shared/schema.ts api-backend/shared/

# Create backend directory structure
mkdir -p api-backend/shared

# Copy environment file
cp .env.example api-backend/.env.production

# Update API backend for production
cd api-backend
echo "Installing production dependencies..."
# Remove SQLite dependencies that cause build issues on CentOS
npm install --production --omit=dev --ignore-scripts

echo "Build completed!"
echo ""
echo "Static frontend: ./static-frontend/"
echo "API backend: ./api-backend/"
echo ""
echo "Next step: Run ./yhgs-deployment.sh as root on your CentOS server"