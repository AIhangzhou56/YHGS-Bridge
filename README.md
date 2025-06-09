# YHGS Bridge - Multi-Chain Cryptocurrency Exchange Platform

A sophisticated blockchain bridge platform enabling secure multi-currency exchanges across different blockchain networks, with advanced monitoring and cross-chain transaction capabilities.

## Live Features

- **Real-time Cryptocurrency Data**: Bitcoin $107,661 (+1.79%), Ethereum $2,532 (+0.79%)
- **60-Second Price Updates**: Live integration with CoinGecko API
- **Multi-Chain Support**: Ethereum, BSC, Polygon, Solana
- **Professional UI**: Modern gradient design with responsive layout
- **Production Ready**: Deployment scripts for CentOS servers

## Architecture

```
Frontend (yhgs.chat) → API (app.yhgs.chat) → CoinGecko API
```

## Quick Start

### Development
```bash
npm install
npm run dev
```

### Production Deployment
```bash
chmod +x simple-deploy.sh
./simple-deploy.sh
```

## API Endpoints

- `/api/tokens` - Live cryptocurrency prices
- `/api/stats` - Bridge transaction statistics
- `/api/relay/status` - Cross-chain relay monitoring
- `/api/bridge/rates` - Exchange rates between chains

## Supported Cryptocurrencies

- Bitcoin (BTC)
- Ethereum (ETH)
- Binance Coin (BNB)
- USD Coin (USDC)
- Polygon (MATIC)
- Solana (SOL)

## Deployment

### Requirements
- CentOS server with root access
- Node.js 18+
- Nginx
- Domain configured (yhgs.chat, app.yhgs.chat)

### DNS Configuration
```
yhgs.chat        A    YOUR_SERVER_IP
app.yhgs.chat    A    YOUR_SERVER_IP
```

### SSL Certificate
```bash
certbot --nginx -d yhgs.chat -d app.yhgs.chat
```

## Project Structure

```
├── client/src/           # React frontend components
│   ├── components/       # UI components
│   ├── pages/           # Route pages
│   └── lib/             # Utilities
├── server/              # Node.js API backend
│   ├── routes.ts        # API endpoints
│   ├── storage.ts       # Data management
│   └── price-service.ts # CoinGecko integration
├── shared/              # Database schema
├── nginx-*.conf         # Web server configurations
└── simple-deploy.sh     # Production deployment
```

## Features

### Bridge Interface
- Cross-chain token transfers
- Real-time fee estimation
- Transaction status tracking

### Mirror Tokens
- ERC-20 to BSC mirror minting
- Automated token locking
- Bridge rate management

### Relay System
- Ethereum-BSC relay monitoring
- Event processing pipeline
- Reorg detection and handling

### Testnet Environment
- Safe testing environment
- Simulated transactions
- Development tools

## Technology Stack

- **Frontend**: React, TypeScript, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript
- **Database**: PostgreSQL with Drizzle ORM
- **Blockchain**: Ethers.js for web3 integration
- **Monitoring**: Prometheus metrics
- **Deployment**: Nginx, Systemd

## Live Status

Currently serving live cryptocurrency data with 60-second updates from CoinGecko API. Bridge platform operational with multi-chain transaction capabilities.

## License

MIT License