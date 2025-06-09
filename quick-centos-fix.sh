#!/bin/bash

# Quick Node.js Conflict Fix for CentOS
# Resolves the nodejs package conflict you're experiencing

echo "Fixing Node.js package conflicts on CentOS..."

# Remove conflicting packages
echo "Removing conflicting Node.js packages..."
dnf remove -y nodejs npm nodejs-full-i18n 2>/dev/null || true

# Clean package cache
dnf clean all

# Remove NodeSource repository
rm -f /etc/yum.repos.d/nodesource-*.repo

# Install Node.js using dnf modules (recommended for CentOS 8+)
echo "Installing Node.js 20 using dnf modules..."
dnf module reset nodejs -y
dnf module enable nodejs:20 -y
dnf install -y nodejs npm

# Verify installation
if command -v node &> /dev/null; then
    echo "✓ Node.js installed successfully: $(node --version)"
    echo "✓ npm version: $(npm --version)"
else
    echo "✗ Node.js installation failed"
    exit 1
fi

# Install PM2 globally
npm install -g pm2

echo "✓ Node.js conflict resolved. You can now continue with deployment."