#!/bin/bash

# Production Fix for React Router Routes - CentOS Version
# This fixes the blank page issue on /mirror, /relay, /testnet routes

echo "🔧 Fixing React Router in Production on CentOS..."

APP_DIR="/var/www/yhgs-bridge"
cd $APP_DIR

# Update Nginx configuration for CentOS (uses conf.d directory)
cat > /etc/nginx/conf.d/yhgs-bridge.conf << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

    root /var/www/yhgs-bridge/dist/public;
    index index.html;

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

    # Rate limiting for API
    limit_req_zone $binary_remote_addr zone=api:10m rate=10r/s;

    # API routes - proxy to Node.js backend
    location /api/ {
        limit_req zone=api burst=20 nodelay;
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_read_timeout 30s;
        proxy_connect_timeout 10s;
    }

    # Metrics endpoint
    location /metrics {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
    }

    # Static assets with long cache
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
        try_files $uri =404;
    }

    # React Router handling - serve index.html for all routes
    location / {
        try_files $uri $uri/ @react;
    }

    # Fallback for React Router
    location @react {
        rewrite ^.*$ /index.html last;
    }

    # Handle specific React routes explicitly
    location ~ ^/(mirror|relay|testnet|bridge)$ {
        try_files $uri /index.html;
    }
}
EOF

echo "✅ Updated Nginx configuration"

# Create a production server configuration
cat > server-production.js << 'EOF'
const express = require('express');
const path = require('path');
const app = express();

// Serve static files
app.use(express.static(path.join(__dirname, 'dist/public')));

// API routes proxy (if needed)
app.use('/api', (req, res) => {
  // Proxy to main app on port 5000
  const httpProxy = require('http-proxy-middleware');
  return httpProxy({
    target: 'http://localhost:5000',
    changeOrigin: true
  })(req, res);
});

// Handle React Router routes
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'dist/public/index.html'));
});

const PORT = process.env.FRONTEND_PORT || 3000;
app.listen(PORT, () => {
  console.log(`Frontend server running on port ${PORT}`);
});
EOF

# Update PM2 configuration for dual server setup
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [
    {
      name: 'yhgs-bridge-backend',
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
      error_file: './logs/backend-err.log',
      out_file: './logs/backend-out.log',
      log_file: './logs/backend-combined.log',
      time: true
    }
  ]
}
EOF

# Test Nginx configuration
echo "🔍 Testing Nginx configuration..."
nginx -t

if [ $? -eq 0 ]; then
    echo "✅ Nginx configuration is valid"
    
    # Reload Nginx
    systemctl reload nginx
    echo "✅ Nginx reloaded"
    
    # Restart PM2 apps
    pm2 restart yhgs-bridge-backend 2>/dev/null || pm2 start ecosystem.config.js
    pm2 save
    
    echo "✅ Backend restarted"
    
    echo ""
    echo "🎉 Production fix completed!"
    echo ""
    echo "Your React routes should now work:"
    echo "- https://your-domain.com/mirror"
    echo "- https://your-domain.com/relay"
    echo "- https://your-domain.com/testnet"
    echo "- https://your-domain.com/bridge"
    echo ""
    echo "Check status with: pm2 status"
    echo "View logs with: pm2 logs yhgs-bridge-backend"
    
else
    echo "❌ Nginx configuration has errors"
    echo "Please check the configuration manually"
    exit 1
fi
EOF

chmod +x production-fix.sh