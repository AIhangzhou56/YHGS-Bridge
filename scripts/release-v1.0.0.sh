#!/bin/bash

# Ethereum-BSC Bridge Relay v1.0.0 Release Script
# Run this script to create the v1.0.0 Git tag and prepare GitHub release

set -e

echo "🚀 Preparing Ethereum-BSC Bridge Relay v1.0.0 Release"
echo "=================================================="

# Check if we're in a git repository
if [ ! -d ".git" ]; then
    echo "❌ Error: Not a git repository. Please run 'git init' first."
    exit 1
fi

# Check if there are uncommitted changes
if ! git diff-index --quiet HEAD --; then
    echo "⚠️  Warning: You have uncommitted changes. Please commit or stash them first."
    git status --porcelain
    exit 1
fi

# Add all files for the release
echo "📦 Adding files to Git..."
git add .
git add .env.example
git add docker-compose.yml
git add monitoring/
git add scripts/
git add README.md
git add CHANGELOG.md

# Commit the release
echo "💾 Committing v1.0.0 release..."
git commit -m "feat: Release v1.0.0 - Production-ready Ethereum-BSC bridge with monitoring

- Add Docker containerization with docker-compose stack
- Implement SQLite persistence with WAL mode for reorg safety
- Add Prometheus metrics and Grafana monitoring dashboards
- Create comprehensive API documentation with OpenAPI spec
- Add 12-block confirmation depth for security
- Implement unit tests and comprehensive error handling
- Add automatic database cleanup and maintenance features
- Include health checks and monitoring endpoints"

# Create the v1.0.0 tag
echo "🏷️  Creating v1.0.0 Git tag..."
git tag -a v1.0.0 -m "v1.0.0: Production-ready Ethereum-BSC Bridge Relay

This release includes:
✅ Production-ready relay system with reorg safety
✅ SQLite persistence with WAL mode  
✅ Comprehensive monitoring with Prometheus/Grafana
✅ Docker containerization with docker-compose
✅ OpenAPI documentation for all endpoints
✅ Unit test suite for core functionality
✅ 12-block confirmation depth for security
✅ Automatic event cleanup and database maintenance

Key Features:
- Lock & Mint mechanism for cross-chain transfers
- Real-time monitoring and alerting
- Cryptographic proof generation
- Nonce-based replay protection
- Health checks and service monitoring
- Complete Docker deployment stack"

echo "✅ Git tag v1.0.0 created successfully!"
echo ""
echo "Next steps:"
echo "1. Push to GitHub: git push origin main --tags"
echo "2. Create GitHub release using the prepared content below"
echo "3. Deploy using: docker compose up -d"
echo ""
echo "GitHub Release Content:"
echo "======================="
cat << 'EOF'

# 🚀 Ethereum-BSC Bridge Relay v1.0.0

Production-ready blockchain bridge enabling secure cross-chain asset transfers between Ethereum and Binance Smart Chain using the Lock & Mint model.

## 🎯 What's New

### Core Features
- ✅ **Production-ready relay system** with 12-block confirmation depth
- ✅ **SQLite persistence** with WAL mode for crash safety
- ✅ **Comprehensive monitoring** with Prometheus & Grafana
- ✅ **Docker containerization** with complete stack deployment
- ✅ **OpenAPI 3.0 documentation** for all REST endpoints
- ✅ **Unit test suite** covering bridge functionality
- ✅ **Automatic cleanup** for old processed events

### Security & Reliability
- 🔒 **Reorg protection** with block hash verification
- 🔒 **Nonce validation** prevents replay attacks  
- 🔒 **Health monitoring** with automatic service recovery
- 🔒 **Database integrity** checks and backup support

### Infrastructure
- 🐳 **Docker Compose** deployment with 4 services
- 📊 **Grafana dashboard** with real-time metrics
- 🔍 **Prometheus monitoring** with custom bridge metrics
- 🗄️ **SQLite WAL mode** for concurrent access

## 🚀 Quick Start

```bash
# Clone and configure
git clone <your-repo-url>
cd ethereum-bsc-bridge
cp .env.example .env

# Edit .env with your private keys and contract addresses
# Then start the complete stack:
docker compose up -d
```

**Access Points:**
- Frontend: http://localhost:3000
- API: http://localhost:5000/api  
- Prometheus: http://localhost:9090
- Grafana: http://localhost:3001 (admin/admin123)

## 📋 System Requirements

- Docker & Docker Compose
- 4GB RAM minimum
- Ethereum & BSC testnet private keys
- Bridge contract addresses

## 📊 Monitoring

Real-time dashboard shows:
- Event processing status (pending/confirmed/processed/failed)
- Block height synchronization across networks
- Relay service health and performance metrics
- Database statistics and processing rates

## 🔧 API Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/relay/status` | GET | Service status and statistics |
| `/api/relay/start` | POST | Start relay service |
| `/api/relay/stop` | POST | Stop relay service |
| `/api/relay/events` | GET | Recent processed events |
| `/metrics` | GET | Prometheus metrics |

## 🛡️ Security Features

- **12-block confirmation** requirement prevents reorg issues
- **Cryptographic nonces** prevent replay attacks
- **Private key isolation** through environment variables
- **Database persistence** survives restarts and crashes
- **Health checks** ensure service reliability

## 📈 Performance

- **WAL mode SQLite** for optimal database performance
- **Connection pooling** for blockchain RPC calls
- **Batch processing** of confirmed events
- **Automatic cleanup** of old data
- **Memory optimization** with configurable cache sizes

## 🔄 Upgrade Path

This v1.0.0 release provides a stable foundation for:
- Multi-token bridge support
- Advanced gas optimization
- WebSocket real-time updates
- Enhanced monitoring capabilities

EOF

echo ""
echo "🎉 Release v1.0.0 is ready!"
echo "Copy the content above to create your GitHub release."