#!/bin/bash

# Run this script as the yhgs user to build the project
# Usage: sudo -u yhgs bash build-as-yhgs.sh

echo "Building YHGS Bridge project as yhgs user..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "Error: package.json not found. Make sure you're in /var/www/yhgs-bridge"
    echo "Current directory: $(pwd)"
    exit 1
fi

# Check if Node.js is available
if ! command -v node &> /dev/null; then
    echo "Error: Node.js not found. Please install Node.js first."
    exit 1
fi

echo "Node.js version: $(node --version)"
echo "npm version: $(npm --version)"

# Install dependencies
echo "Installing dependencies..."
npm install

# Build the project
echo "Building the project..."
npm run build

# Check if build was successful
if [ -d "dist" ]; then
    echo "✅ Build completed successfully!"
    echo "Contents of dist directory:"
    ls -la dist/
else
    echo "❌ Build failed - dist directory not found"
    exit 1
fi

echo "Project is ready to start!"