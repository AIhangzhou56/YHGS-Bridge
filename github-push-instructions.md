# Push YHGS Bridge to GitHub Repository

## Complete Commands to Run

Execute these commands in your project directory on your local machine or server:

```bash
# 1. Initialize git repository (if not already done)
git init

# 2. Add remote repository
git remote add origin https://github.com/AIhangzhou56/YHGS-Bridge.git

# 3. Configure git user (replace with your details)
git config user.name "Your Name"
git config user.email "your.email@example.com"

# 4. Add all project files
git add .

# 5. Create initial commit
git commit -m "Initial YHGS Bridge deployment with live cryptocurrency data

- Multi-chain bridge interface with Bridge, Mirror, Relay, Testnet
- Live cryptocurrency price integration from CoinGecko API
- Real-time Bitcoin ($107,661 +1.79%) and Ethereum data
- Production-ready deployment scripts for CentOS
- Static frontend + API backend architecture
- Professional UI with gradient design and responsive layout
- SSL-ready Nginx configurations for yhgs.chat domain
- Cross-chain transaction capabilities
- Bridge status monitoring and relay system"

# 6. Push to GitHub
git push -u origin main
```

## Alternative: Force Push (if repository exists)

If the repository already exists and you want to overwrite:

```bash
git branch -M main
git push -f origin main
```

## What Will Be Uploaded

Your complete YHGS Bridge project including:
- ✅ Live cryptocurrency API with CoinGecko integration
- ✅ Real-time price updates (Bitcoin, Ethereum, BNB, USDC, MATIC)
- ✅ Multi-chain bridge interface
- ✅ Production deployment scripts
- ✅ Nginx configurations for yhgs.chat
- ✅ Professional frontend with live data
- ✅ Working API backend on port 5000
- ✅ SSL certificate setup scripts

## Repository Structure

```
YHGS-Bridge/
├── client/src/           # React frontend components
├── server/              # Node.js API backend
├── shared/              # Database schema
├── simple-deploy.sh     # Production deployment script
├── nginx-frontend.conf  # Frontend web server config
├── nginx-api.conf      # API server config
├── DEPLOYMENT-COMPLETE.md # Documentation
└── package.json        # Dependencies
```

Your live cryptocurrency data API is currently serving Bitcoin at $107,661 (+1.79%) with 60-second updates from CoinGecko.