# YHGS Multi-Chain Bridge

A production-ready blockchain bridge platform enabling cross-chain asset transfers between Ethereum and Binance Smart Chain (BSC) using the Lock & Mint model.

## 🏗️ Architecture

The system implements a trustless bridge mechanism:
- **Lock** ERC-20 tokens on Ethereum Sepolia testnet
- **Generate cryptographic proofs** of lock events
- **Mint** equivalent BEP-20 tokens on BSC testnet
- **12-block confirmation depth** for reorg safety
- **SQLite persistence** with WAL mode for reliability

## 🚀 Quick Start with Docker

### Prerequisites
- Docker and Docker Compose
- Ethereum and BSC testnet private keys
- Bridge contract addresses

### 1. Clone and Configure
```bash
git clone <repository-url>
cd yhgs-multi-chain-bridge
cp .env.example .env
```

### 2. Update Environment Variables
Edit `.env` with your configuration:
```bash
ETHEREUM_PRIVATE_KEY=your_ethereum_private_key
BSC_PRIVATE_KEY=your_bsc_private_key
ETHEREUM_BRIDGE_CONTRACT=0x1234...
BSC_BRIDGE_CONTRACT=0x5678...
```

### 3. Start the Complete Stack
```bash
docker compose up -d
```

This launches:
- **Bridge Relay Service** (port 5000)
- **Frontend Interface** (port 3000)
- **Prometheus Metrics** (port 9090)
- **Grafana Dashboard** (port 3001)

### 4. Access the Services

| Service | URL | Description |
|---------|-----|-------------|
| Frontend | http://localhost:3000 | Bridge user interface |
| Relay API | http://localhost:5000/api | REST API endpoints |
| Prometheus | http://localhost:9090 | Metrics collection |
| Grafana | http://localhost:3001 | Monitoring dashboard |

**Grafana Login:** admin / admin123

## 📊 Monitoring & Observability

### Prometheus Metrics
The relay exposes metrics at `/metrics`:
- `bridge_events_total{status}` - Events by processing status
- `bridge_relay_running` - Service health status
- `bridge_ethereum_block_height` - Latest Ethereum block
- `bridge_bsc_block_height` - Latest BSC block
- `bridge_total_events` - Total events in database

### Grafana Dashboard
Pre-configured dashboard shows:
- Real-time event processing status
- Block height synchronization
- Relay service health
- Processing statistics

## 🔧 API Documentation

### Relay Control
```bash
# Start relay service
curl -X POST http://localhost:5000/api/relay/start

# Stop relay service
curl -X POST http://localhost:5000/api/relay/stop

# Get relay status
curl http://localhost:5000/api/relay/status
```

### Monitoring
```bash
# Get processing statistics
curl http://localhost:5000/api/relay/stats

# Get recent events
curl http://localhost:5000/api/relay/events?limit=10

# Test network connections
curl http://localhost:5000/api/relay/test-connections
```

### Maintenance
```bash
# Cleanup old events (30+ days)
curl -X POST http://localhost:5000/api/relay/cleanup \
  -H "Content-Type: application/json" \
  -d '{"days": 30}'
```

## 🛡️ Security Features

### Reorg Protection
- **12-block confirmation** requirement before processing
- **Block hash verification** to detect chain reorganizations
- **Automatic failure handling** for reorged events

### Nonce Validation
- **Cryptographic nonces** prevent replay attacks
- **Database persistence** tracks used nonces
- **Cross-chain verification** ensures uniqueness

### Private Key Management
- Environment variable configuration
- Docker secrets support
- No hardcoded credentials

## 🗄️ Database Schema

SQLite database with WAL mode stores:
- **processed_events** - Event lifecycle tracking
- **relay_config** - Service configuration
- Optimized indexes for performance
- Automatic cleanup of old data

## 🏛️ Bridge Contracts

### Ethereum Lock Contract
```solidity
event Locked(
    address indexed token,
    address indexed sender,
    uint256 amount,
    string targetChain,
    address targetAddr,
    bytes32 nonce
);
```

### BSC Mint Contract
```solidity
function mint(
    address token,
    address to,
    uint256 amount,
    bytes32 nonce,
    bytes calldata proof
) external;
```

## 🔐 Light-Client PoC (v1.1)

### Enhanced Security Features
- **Receipt Verification**: Cryptographic proof verification using Merkle trees and RLP encoding
- **Header Store**: Light client functionality with block header validation and BLS signature placeholders
- **Adaptive Confirmations**: Environment-configurable confirmation depths (ETH: 12, BSC: 15 blocks)
- **Reorg Protection**: Automatic rollback detection and event status reset on chain reorganizations

### Smart Contract Enhancements
```solidity
// ReceiptVerifier.sol - Verifies transaction receipt proofs
function verifyReceiptProof(
    bytes32 blockHash,
    bytes memory receiptRLP,
    bytes32[] memory proof,
    uint256 logIndex
) external view returns (bool)

// HeaderStore.sol - Stores verified block headers
function submitHeader(
    bytes32 blockHash,
    bytes32 parentHash,
    bytes32 receiptsRoot,
    uint256 blockNumber,
    BLSSignature calldata signature
) external onlyValidator
```

### Relay System Improvements
- **generateReceiptProof()**: Uses eth_getProof and RLP encoding for cryptographic verification
- **Enhanced mint payload**: Includes block header, receipt proof, and log index
- **Automatic reorg handling**: Resets pending events when block hash mismatches detected

### Security Pipeline
```bash
# Run security audit
docker compose -f docker-compose.test.yml up --build security-audit

# Generate SARIF report
./scripts/security-audit.sh

# Continuous monitoring
docker compose up -d prometheus grafana
```

## 🔍 Development

### Local Development
```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Run tests
npm test

# Build TypeScript
npm run build
```

### Environment Setup
```bash
# Copy environment template
cp .env.example .env

# Install Docker dependencies
docker compose pull
```

## 📋 System Requirements

### Production Deployment
- **CPU:** 2+ cores
- **RAM:** 4GB minimum
- **Storage:** 50GB SSD (for blockchain data)
- **Network:** Stable internet connection

### Docker Resources
- **relay:** 512MB RAM, 1 CPU
- **frontend:** 256MB RAM, 0.5 CPU
- **prometheus:** 1GB RAM, 1 CPU
- **grafana:** 512MB RAM, 0.5 CPU

## 🚨 Troubleshooting

### Common Issues

**Relay Won't Start**
```bash
# Check environment variables
docker compose logs relay

# Verify network connectivity
curl http://localhost:5000/api/relay/test-connections
```

**Database Issues**
```bash
# Check WAL mode
sqlite3 data/relay.db "PRAGMA journal_mode;"

# Verify integrity
sqlite3 data/relay.db "PRAGMA integrity_check;"
```

**Monitoring Not Working**
```bash
# Restart monitoring stack
docker compose restart prometheus grafana

# Check metrics endpoint
curl http://localhost:5000/metrics
```

## 🔄 Backup & Recovery

### Database Backup
```bash
# Create backup
docker compose exec relay sqlite3 /app/data/relay.db ".backup /app/data/backup.db"

# Restore from backup
docker compose down
cp backup.db data/relay.db
docker compose up -d
```

### Configuration Backup
```bash
# Backup environment
cp .env .env.backup

# Backup monitoring configs
tar -czf monitoring-backup.tar.gz monitoring/
```

## 🔬 v1.1 Light-Client PoC

### Smart Contract Verification
The system includes cryptographic verification of Ethereum transaction receipts:

```solidity
// ReceiptVerifier.sol - Verifies tx receipts using Merkle proofs
function verifyReceipt(ReceiptProof memory _proof) public view returns (bool)

// Light client header store for block validation
function storeHeader(bytes32 _blockHash, bytes32 _receiptsRoot, uint256 _blockNumber)
```

### Enhanced Security Features
- **Adaptive Confirmation Depth**: Configure `CONFIRMATIONS_ETH=12` and `CONFIRMATIONS_BSC=6`
- **Reorg Detection**: Automatic rollback of events affected by chain reorganizations
- **Receipt Proof Generation**: `generateReceiptProof(txHash)` using eth_getProof + RLP
- **Merkle Verification**: Cryptographic proof validation on destination chain

### Security Audit Pipeline
```bash
# Run security audits with Slither + Mythril
docker compose -f docker-compose.test.yml up slither mythril

# Generate SARIF reports for GitHub Code Scanning
# Reports saved to audit-reports/ directory
```

### Grafana Alerting
Pre-configured alerts for production monitoring:
- **Critical**: `failed_events_total > 0` (immediate notification)
- **Warning**: `reorg_events_total > 0` (chain reorganization detected)
- **Warning**: `relay_latency_p95_ms > 10000` (performance degradation)

## 📝 Changelog

### v1.1.0 - Light-Client PoC
- ✅ Receipt Verifier smart contract with Merkle proof verification
- ✅ Light client header store for BSC block validation
- ✅ generateReceiptProof() function using eth_getProof + RLP
- ✅ Adaptive confirmation depth with per-chain configuration
- ✅ Enhanced reorg detection with automatic event rollback
- ✅ Security audit pipeline with Slither + Mythril integration
- ✅ Grafana alert rules for comprehensive monitoring
- ✅ SARIF output for GitHub Code Scanning

### v1.0.0 (2024-06-07)
- ✅ Production-ready relay system with reorg safety
- ✅ SQLite persistence with WAL mode
- ✅ Comprehensive monitoring with Prometheus/Grafana
- ✅ Docker containerization with docker-compose
- ✅ OpenAPI documentation for all endpoints
- ✅ Unit test suite for core functionality
- ✅ 12-block confirmation depth for security
- ✅ Automatic event cleanup and database maintenance

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🔗 Links

- [Ethereum Sepolia Testnet](https://sepolia.etherscan.io/)
- [BSC Testnet Explorer](https://testnet.bscscan.com/)
- [Prometheus Documentation](https://prometheus.io/docs/)
- [Grafana Documentation](https://grafana.com/docs/)