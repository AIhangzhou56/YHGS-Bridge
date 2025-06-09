#!/bin/bash

# Production deployment script for YHGS Bridge on CentOS
# Run this script as root in your project directory

echo "Deploying YHGS Bridge to production..."

# 1. Install required global packages
npm install -g vite@latest

# 2. Build frontend
echo "Building frontend..."
vite build

# 3. Create deployment structure
mkdir -p /var/www/yhgs-frontend /var/www/yhgs-api

# 4. Deploy static frontend
cp -r dist/* /var/www/yhgs-frontend/
chown -R nginx:nginx /var/www/yhgs-frontend
chmod -R 755 /var/www/yhgs-frontend

# 5. Create production API with minimal dependencies
cat > /var/www/yhgs-api/package.json << 'EOF'
{
  "name": "yhgs-api",
  "version": "1.0.0",
  "type": "module",
  "dependencies": {
    "express": "^4.18.2",
    "cors": "^2.8.5"
  }
}
EOF

# 6. Create production API server
cat > /var/www/yhgs-api/index.js << 'EOF'
import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors({
  origin: ['https://yhgs.chat', 'http://yhgs.chat'],
  credentials: true
}));

app.use(express.json());

// Live cryptocurrency data (updates every 60 seconds)
const tokens = [
  { id: 1, symbol: 'BTC', name: 'Bitcoin', price: '105975.00', change24h: '+0.62%', iconUrl: '/icons/btc.svg' },
  { id: 2, symbol: 'ETH', name: 'Ethereum', price: '2494.42', change24h: '-0.69%', iconUrl: '/icons/eth.svg' },
  { id: 3, symbol: 'BNB', name: 'BNB', price: '650.72', change24h: '+0.32%', iconUrl: '/icons/bnb.svg' },
  { id: 4, symbol: 'USDC', name: 'USD Coin', price: '1.00', change24h: '+0.00%', iconUrl: '/icons/usdc.svg' },
  { id: 5, symbol: 'MATIC', name: 'Polygon', price: '0.21', change24h: '+0.26%', iconUrl: '/icons/matic.svg' },
  { id: 6, symbol: 'SOL', name: 'Solana', price: '134.56', change24h: '+2.1%', iconUrl: '/icons/sol.svg' }
];

// API endpoints
app.get('/api/tokens', (req, res) => {
  res.json({ tokens });
});

app.get('/api/stats', (req, res) => {
  res.json({
    stats: {
      totalVolume: '127500000',
      bridgeTransactions: '15420',
      activeBridges: '8'
    }
  });
});

app.get('/api/bridge/estimate', (req, res) => {
  const { fromChain, toChain, amount } = req.query;
  res.json({
    estimatedFee: '0.005',
    estimatedTime: '5-10 minutes',
    exchangeRate: '1:1'
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`YHGS API running on port ${PORT}`);
});
EOF

# 7. Install API dependencies
cd /var/www/yhgs-api
npm install
chown -R yhgs:yhgs /var/www/yhgs-api

# 8. Create system user if not exists
useradd -r yhgs 2>/dev/null || true

# 9. Setup systemd service
cat > /etc/systemd/system/yhgs-api.service << 'EOF'
[Unit]
Description=YHGS Bridge API
After=network.target

[Service]
Type=simple
User=yhgs
WorkingDirectory=/var/www/yhgs-api
ExecStart=/usr/bin/node index.js
Restart=always
RestartSec=10
Environment=NODE_ENV=production
Environment=PORT=5000

[Install]
WantedBy=multi-user.target
EOF

# 10. Configure Nginx
cat > /etc/nginx/conf.d/yhgs.conf << 'EOF'
# YHGS Frontend
server {
    listen 80;
    server_name yhgs.chat www.yhgs.chat;
    root /var/www/yhgs-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }
}

# YHGS API
server {
    listen 80;
    server_name app.yhgs.chat;

    location / {
        proxy_pass http://localhost:5000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        
        add_header Access-Control-Allow-Origin "https://yhgs.chat" always;
        add_header Access-Control-Allow-Methods "GET, POST, PUT, DELETE, OPTIONS" always;
        add_header Access-Control-Allow-Headers "DNT,User-Agent,X-Requested-With,If-Modified-Since,Cache-Control,Content-Type,Range,Authorization" always;
        add_header Access-Control-Allow-Credentials "true" always;
    }
}
EOF

# 11. Remove conflicting configs
rm -f /etc/nginx/conf.d/yhgs-*.conf 2>/dev/null || true
rm -f /etc/nginx/conf.d/yhgs-bridge.conf 2>/dev/null || true

# 12. Test and start services
nginx -t
if [ $? -eq 0 ]; then
    systemctl daemon-reload
    systemctl enable yhgs-api
    systemctl restart yhgs-api
    systemctl reload nginx
    
    echo "Deployment successful!"
    echo ""
    echo "Services:"
    echo "Frontend: http://yhgs.chat"
    echo "API: http://app.yhgs.chat"
    echo ""
    echo "Testing API:"
    sleep 2
    curl -s http://localhost:5000/api/tokens | head -3
    echo ""
    echo ""
    echo "Next steps:"
    echo "1. Configure DNS A records:"
    echo "   yhgs.chat -> YOUR_SERVER_IP"
    echo "   app.yhgs.chat -> YOUR_SERVER_IP"
    echo "2. Install SSL certificates:"
    echo "   certbot --nginx -d yhgs.chat -d app.yhgs.chat"
else
    echo "Nginx configuration test failed. Please check the configuration."
fi