# YHGS Bridge Deployment Guide

## Quick Start (3 Commands)

```bash
# 1. Build static frontend
npm run build:static

# 2. Make deployment script executable
chmod +x yhgs-deployment.sh

# 3. Deploy (run as root on CentOS)
./yhgs-deployment.sh
```

## What This Deploys

- **Frontend**: https://yhgs.chat (static React app)
- **API**: https://app.yhgs.chat (Node.js backend with live crypto data)

## Prerequisites

- CentOS server with root access
- Node.js 18+ installed
- Nginx installed
- PostgreSQL installed
- DNS configured:
  - `yhgs.chat A YOUR_SERVER_IP`
  - `app.yhgs.chat A YOUR_SERVER_IP`

## Architecture

```
yhgs.chat (Static Frontend)
    ↓ API calls
app.yhgs.chat (Dynamic Backend)
    ↓ Real-time data
CoinGecko API (Live crypto prices)
```

## Build Process

The `npm run build:static` command:
1. Builds React frontend for production
2. Copies files to `static-frontend/`
3. Configures API endpoints for app.yhgs.chat
4. Optimizes for static hosting

## Deployment Process

The `yhgs-deployment.sh` script:
1. Creates system user `yhgs`
2. Deploys static files to `/var/www/yhgs-frontend`
3. Deploys API backend to `/var/www/yhgs-api`
4. Configures Nginx for both domains
5. Creates systemd service for API
6. Starts all services

## Post-Deployment

```bash
# Install SSL certificates
certbot --nginx -d yhgs.chat -d app.yhgs.chat

# Test API
curl https://app.yhgs.chat/api/tokens

# Check service status
systemctl status yhgs-api
```

## Monitoring

- Live crypto prices update every 60 seconds
- API logs: `journalctl -u yhgs-api -f`
- Nginx logs: `/var/log/nginx/access.log`

## Features

- Real-time cryptocurrency prices (Bitcoin, Ethereum, BNB, etc.)
- Cross-chain bridge interface
- Transaction history
- Wallet connection
- Mirror token management
- Testnet environment