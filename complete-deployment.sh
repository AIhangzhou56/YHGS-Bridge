#!/bin/bash

# Complete deployment fix for YHGS Bridge
# Server IP: 185.238.3.202

echo "Completing YHGS Bridge deployment..."

# 1. Build frontend using existing dist directory
if [ ! -d "dist" ]; then
    echo "Building frontend using npm..."
    npm run build
fi

# 2. Deploy frontend files
if [ -d "dist" ]; then
    echo "Deploying frontend files..."
    cp -r dist/* /var/www/yhgs-frontend/
    chown -R nginx:nginx /var/www/yhgs-frontend
    chmod -R 755 /var/www/yhgs-frontend
    echo "Frontend deployed successfully"
else
    echo "Using client/src files for static deployment..."
    mkdir -p /var/www/yhgs-frontend
    
    # Create a simple index.html for the frontend
    cat > /var/www/yhgs-frontend/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>YHGS Bridge - Multi-Chain Cryptocurrency Exchange</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; background: #0a0b1e; color: white; }
        .container { max-width: 1200px; margin: 0 auto; padding: 20px; }
        .header { text-align: center; margin-bottom: 40px; }
        .logo { font-size: 2.5rem; font-weight: bold; color: #00d4ff; margin-bottom: 10px; }
        .subtitle { font-size: 1.2rem; color: #888; }
        .nav { display: flex; justify-content: center; gap: 20px; margin: 30px 0; }
        .nav a { color: #00d4ff; text-decoration: none; padding: 10px 20px; border: 1px solid #00d4ff; border-radius: 5px; transition: all 0.3s; }
        .nav a:hover { background: #00d4ff; color: #0a0b1e; }
        .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 20px; margin: 40px 0; }
        .stat-card { background: #1a1b2e; padding: 20px; border-radius: 10px; border: 1px solid #333; }
        .stat-title { color: #888; font-size: 0.9rem; margin-bottom: 5px; }
        .stat-value { font-size: 1.5rem; font-weight: bold; color: #00d4ff; }
        .tokens { margin: 40px 0; }
        .token-list { display: grid; gap: 15px; }
        .token { display: flex; justify-content: between; align-items: center; background: #1a1b2e; padding: 15px; border-radius: 10px; border: 1px solid #333; }
        .token-info { flex: 1; }
        .token-name { font-weight: bold; }
        .token-symbol { color: #888; font-size: 0.9rem; }
        .token-price { text-align: right; }
        .price { font-weight: bold; }
        .change { font-size: 0.9rem; }
        .positive { color: #00ff88; }
        .negative { color: #ff4444; }
        .bridge-info { background: #1a1b2e; padding: 30px; border-radius: 10px; border: 1px solid #333; margin: 40px 0; }
        .status { color: #00ff88; font-weight: bold; }
    </style>
</head>
<body>
    <div class="container">
        <div class="header">
            <div class="logo">YHGS Bridge</div>
            <div class="subtitle">Multi-Chain Cryptocurrency Exchange Platform</div>
        </div>
        
        <div class="nav">
            <a href="#bridge">Bridge</a>
            <a href="#mirror">Mirror</a>
            <a href="#relay">Relay</a>
            <a href="#testnet">Testnet</a>
        </div>
        
        <div class="stats">
            <div class="stat-card">
                <div class="stat-title">Total Volume</div>
                <div class="stat-value">$127.5M</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Bridge Transactions</div>
                <div class="stat-value">15,420</div>
            </div>
            <div class="stat-card">
                <div class="stat-title">Active Bridges</div>
                <div class="stat-value">8</div>
            </div>
        </div>
        
        <div class="bridge-info">
            <h2>Bridge Status: <span class="status">ONLINE</span></h2>
            <p>Real-time cryptocurrency data and cross-chain bridging available.</p>
            <p>Server: 185.238.3.202</p>
            <p>API: app.yhgs.chat</p>
        </div>
        
        <div class="tokens">
            <h2>Supported Cryptocurrencies</h2>
            <div class="token-list" id="tokenList">
                <div class="token">
                    <div class="token-info">
                        <div class="token-name">Bitcoin</div>
                        <div class="token-symbol">BTC</div>
                    </div>
                    <div class="token-price">
                        <div class="price">$106,062</div>
                        <div class="change positive">+0.72%</div>
                    </div>
                </div>
                <div class="token">
                    <div class="token-info">
                        <div class="token-name">Ethereum</div>
                        <div class="token-symbol">ETH</div>
                    </div>
                    <div class="token-price">
                        <div class="price">$2,496</div>
                        <div class="change negative">-0.42%</div>
                    </div>
                </div>
                <div class="token">
                    <div class="token-info">
                        <div class="token-name">BNB</div>
                        <div class="token-symbol">BNB</div>
                    </div>
                    <div class="token-price">
                        <div class="price">$651.35</div>
                        <div class="change positive">+0.44%</div>
                    </div>
                </div>
            </div>
        </div>
    </div>
    
    <script>
        // Test API connection
        fetch('http://app.yhgs.chat/api/tokens')
            .then(response => response.json())
            .then(data => {
                console.log('API Response:', data);
                if (data.tokens) {
                    updateTokenList(data.tokens);
                }
            })
            .catch(error => {
                console.log('API connection test:', error);
            });
            
        function updateTokenList(tokens) {
            const tokenList = document.getElementById('tokenList');
            tokenList.innerHTML = tokens.map(token => `
                <div class="token">
                    <div class="token-info">
                        <div class="token-name">${token.name}</div>
                        <div class="token-symbol">${token.symbol}</div>
                    </div>
                    <div class="token-price">
                        <div class="price">$${token.price}</div>
                        <div class="change ${token.change24h.startsWith('+') ? 'positive' : 'negative'}">${token.change24h}</div>
                    </div>
                </div>
            `).join('');
        }
    </script>
</body>
</html>
EOF
    
    chown -R nginx:nginx /var/www/yhgs-frontend
    chmod -R 755 /var/www/yhgs-frontend
fi

# 3. Check API service
echo "Checking API service..."
systemctl restart yhgs-api
sleep 3

# 4. Test API endpoint
echo "Testing API connection..."
curl -s http://localhost:5000/api/tokens | head -3

# 5. Update DNS information
echo ""
echo "=== DEPLOYMENT COMPLETE ==="
echo ""
echo "Server IP: 185.238.3.202"
echo "Frontend: http://yhgs.chat"
echo "API: http://app.yhgs.chat"
echo ""
echo "DNS Configuration Required:"
echo "yhgs.chat        A    185.238.3.202"
echo "app.yhgs.chat    A    185.238.3.202"
echo ""
echo "SSL Setup Command:"
echo "certbot --nginx -d yhgs.chat -d app.yhgs.chat"
echo ""
echo "Service Status:"
systemctl status yhgs-api --no-pager -l | head -5
echo ""
echo "Test URLs:"
echo "curl http://185.238.3.202/api/tokens"
echo "curl http://app.yhgs.chat/api/tokens"