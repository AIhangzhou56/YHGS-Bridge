# Remote Signer Integration with Gnosis Safe

## Overview

This document outlines the implementation of remote signing capabilities for the YHGS Multi-Chain Bridge using Gnosis Safe multi-signature wallets. The remote signer eliminates the need for storing private keys in environment variables while providing enterprise-grade security through distributed key management.

## Architecture

### Current State
```
Bridge Relay ──> Private Key (ENV) ──> Direct Signing
```

### Target State with Remote Signer
```
Bridge Relay ──> Remote Signer API ──> Gnosis Safe ──> Multi-Sig Approval ──> Transaction Execution
```

## Gnosis Safe Flow

### 1. Transaction Proposal
```typescript
interface TransactionProposal {
  safeAddress: string;
  to: string;
  value: string;
  data: string;
  operation: 0 | 1; // CALL or DELEGATECALL
  gasToken: string;
  gasPrice: string;
  gasLimit: string;
  refundReceiver: string;
  nonce: number;
}
```

### 2. Multi-Signature Collection
```typescript
interface SignatureCollection {
  safeTxHash: string;
  signatures: Array<{
    signer: string;
    signature: string;
    signatureType: 'eth_sign' | 'eth_signTypedData';
    timestamp: number;
  }>;
  threshold: number;
  confirmationsRequired: number;
  confirmationsReceived: number;
}
```

### 3. Transaction Execution
```typescript
interface ExecutionResult {
  txHash: string;
  status: 'pending' | 'confirmed' | 'failed';
  gasUsed: string;
  effectiveGasPrice: string;
  blockNumber: number;
  confirmations: number;
}
```

## Remote Signer API Implementation

### Core Service Class
```typescript
export class RemoteSignerService {
  private safeApiUrl: string;
  private apiKey: string;
  private signers: Map<string, Signer>;
  
  constructor(config: RemoteSignerConfig) {
    this.safeApiUrl = config.safeApiUrl;
    this.apiKey = config.apiKey;
    this.signers = new Map();
  }

  async proposeTransaction(proposal: TransactionProposal): Promise<string> {
    const safeTransaction = await this.buildSafeTransaction(proposal);
    const safeTxHash = await this.submitProposal(safeTransaction);
    
    // Store proposal for tracking
    await this.storePendingTransaction(safeTxHash, proposal);
    
    return safeTxHash;
  }

  async collectSignatures(safeTxHash: string): Promise<SignatureCollection> {
    const pendingTx = await this.getPendingTransaction(safeTxHash);
    const signers = await this.getRequiredSigners(pendingTx.safeAddress);
    
    const signatures: Array<Signature> = [];
    
    for (const signerAddress of signers) {
      const signature = await this.requestSignature(signerAddress, safeTxHash);
      if (signature) {
        signatures.push({
          signer: signerAddress,
          signature: signature.signature,
          signatureType: signature.type,
          timestamp: Date.now()
        });
      }
    }
    
    return {
      safeTxHash,
      signatures,
      threshold: pendingTx.threshold,
      confirmationsRequired: pendingTx.threshold,
      confirmationsReceived: signatures.length
    };
  }

  async executeTransaction(safeTxHash: string): Promise<ExecutionResult> {
    const signatures = await this.collectSignatures(safeTxHash);
    
    if (signatures.confirmationsReceived < signatures.threshold) {
      throw new Error(`Insufficient signatures: ${signatures.confirmationsReceived}/${signatures.threshold}`);
    }
    
    const executionTx = await this.submitExecution(safeTxHash, signatures);
    const receipt = await executionTx.wait();
    
    return {
      txHash: receipt.transactionHash,
      status: receipt.status === 1 ? 'confirmed' : 'failed',
      gasUsed: receipt.gasUsed.toString(),
      effectiveGasPrice: receipt.effectiveGasPrice.toString(),
      blockNumber: receipt.blockNumber,
      confirmations: 1
    };
  }
}
```

### Integration with Bridge Relay
```typescript
export class EnhancedEthereumBSCRelay extends EthereumBSCRelay {
  private remoteSigner: RemoteSignerService;
  
  constructor() {
    super();
    this.remoteSigner = new RemoteSignerService({
      safeApiUrl: process.env.GNOSIS_SAFE_API_URL!,
      apiKey: process.env.GNOSIS_SAFE_API_KEY!,
      ethSafeAddress: process.env.GNOSIS_SAFE_ETH!,
      bscSafeAddress: process.env.GNOSIS_SAFE_BSC!
    });
  }

  async submitMintWithRemoteSigner(lockData: LockEventData, proof: string): Promise<string> {
    const receiptProof = await this.generateReceiptProof(lockData.transactionHash);
    
    // Build mint transaction data
    const mintData = this.bscBridge.interface.encodeFunctionData('mintWithProof', [
      lockData.token,
      lockData.targetAddr,
      lockData.amount,
      lockData.nonce,
      receiptProof.blockHeader,
      receiptProof.proof,
      receiptProof.receipt,
      lockData.logIndex
    ]);

    // Propose transaction to Gnosis Safe
    const proposal: TransactionProposal = {
      safeAddress: process.env.GNOSIS_SAFE_BSC!,
      to: await this.bscBridge.getAddress(),
      value: '0',
      data: mintData,
      operation: 0, // CALL
      gasToken: '0x0000000000000000000000000000000000000000', // ETH
      gasPrice: '0',
      gasLimit: '500000',
      refundReceiver: '0x0000000000000000000000000000000000000000',
      nonce: await this.getNextNonce()
    };

    const safeTxHash = await this.remoteSigner.proposeTransaction(proposal);
    console.log(`Mint transaction proposed: ${safeTxHash}`);

    // Wait for signatures and execute
    const result = await this.waitForExecution(safeTxHash);
    return result.txHash;
  }

  private async waitForExecution(safeTxHash: string, timeout = 300000): Promise<ExecutionResult> {
    const startTime = Date.now();
    
    while (Date.now() - startTime < timeout) {
      try {
        const signatures = await this.remoteSigner.collectSignatures(safeTxHash);
        
        if (signatures.confirmationsReceived >= signatures.threshold) {
          return await this.remoteSigner.executeTransaction(safeTxHash);
        }
        
        console.log(`Waiting for signatures: ${signatures.confirmationsReceived}/${signatures.threshold}`);
        await new Promise(resolve => setTimeout(resolve, 10000)); // Check every 10 seconds
        
      } catch (error) {
        console.error(`Error checking signatures for ${safeTxHash}:`, error);
        await new Promise(resolve => setTimeout(resolve, 5000));
      }
    }
    
    throw new Error(`Transaction execution timeout: ${safeTxHash}`);
  }
}
```

## Signature Collection Strategies

### 1. Webhook-Based Collection
```typescript
interface WebhookPayload {
  safeTxHash: string;
  safeAddress: string;
  signerAddress: string;
  signature: string;
  confirmationsReceived: number;
  confirmationsRequired: number;
  status: 'signed' | 'executed' | 'failed';
}

app.post('/webhook/gnosis-safe', async (req: Request, res: Response) => {
  const payload: WebhookPayload = req.body;
  
  if (payload.status === 'signed') {
    console.log(`New signature received for ${payload.safeTxHash}`);
    await remoteSigner.updateSignatureStatus(payload);
  }
  
  if (payload.confirmationsReceived >= payload.confirmationsRequired) {
    console.log(`Threshold reached for ${payload.safeTxHash}, executing...`);
    await remoteSigner.executeTransaction(payload.safeTxHash);
  }
  
  res.status(200).send('OK');
});
```

### 2. Polling-Based Collection
```typescript
class PollingSignatureCollector {
  private pendingTransactions = new Map<string, PendingTransaction>();
  private pollingInterval = 30000; // 30 seconds
  
  async startPolling(): Promise<void> {
    setInterval(async () => {
      for (const [safeTxHash, pendingTx] of this.pendingTransactions) {
        try {
          const signatures = await this.remoteSigner.collectSignatures(safeTxHash);
          
          if (signatures.confirmationsReceived >= signatures.threshold) {
            await this.remoteSigner.executeTransaction(safeTxHash);
            this.pendingTransactions.delete(safeTxHash);
          }
        } catch (error) {
          console.error(`Polling error for ${safeTxHash}:`, error);
        }
      }
    }, this.pollingInterval);
  }
}
```

## Security Considerations

### Access Control
```typescript
interface SignerPermissions {
  address: string;
  role: 'admin' | 'operator' | 'observer';
  permissions: {
    canPropose: boolean;
    canSign: boolean;
    canExecute: boolean;
    maxTransactionValue: string;
    allowedTokens: string[];
  };
}

class AccessController {
  async validateSignerPermissions(
    signerAddress: string, 
    transaction: TransactionProposal
  ): Promise<boolean> {
    const permissions = await this.getSignerPermissions(signerAddress);
    
    if (!permissions.canPropose) {
      throw new Error('Insufficient permissions to propose transactions');
    }
    
    if (BigInt(transaction.value) > BigInt(permissions.maxTransactionValue)) {
      throw new Error('Transaction value exceeds signer limit');
    }
    
    return true;
  }
}
```

### Rate Limiting
```typescript
class RateLimiter {
  private proposalCounts = new Map<string, { count: number; resetTime: number }>();
  private readonly maxProposalsPerHour = 10;
  
  async checkRateLimit(signerAddress: string): Promise<boolean> {
    const now = Date.now();
    const hourAgo = now - 3600000;
    
    const current = this.proposalCounts.get(signerAddress) || { count: 0, resetTime: now };
    
    if (current.resetTime < hourAgo) {
      current.count = 0;
      current.resetTime = now;
    }
    
    if (current.count >= this.maxProposalsPerHour) {
      throw new Error('Rate limit exceeded');
    }
    
    current.count++;
    this.proposalCounts.set(signerAddress, current);
    
    return true;
  }
}
```

## Configuration

### Environment Variables
```bash
# Gnosis Safe Configuration
GNOSIS_SAFE_API_URL=https://safe-transaction-mainnet.safe.global
GNOSIS_SAFE_API_KEY=your_api_key_here
GNOSIS_SAFE_ETH=0x1234567890123456789012345678901234567890
GNOSIS_SAFE_BSC=0x2345678901234567890123456789012345678901

# Webhook Configuration
GNOSIS_SAFE_WEBHOOK_URL=https://your-bridge.example.com/webhook/gnosis-safe
GNOSIS_SAFE_WEBHOOK_SECRET=your_webhook_secret

# Signature Collection
SIGNATURE_COLLECTION_METHOD=webhook  # or 'polling'
SIGNATURE_TIMEOUT_MS=300000  # 5 minutes
POLLING_INTERVAL_MS=30000    # 30 seconds

# Remove these - no longer needed with remote signer
# ETHEREUM_PRIVATE_KEY=
# BSC_PRIVATE_KEY=
```

### Safe Deployment Script
```typescript
async function deploySafes() {
  const owners = [
    '0x1234567890123456789012345678901234567890',
    '0x2345678901234567890123456789012345678901',
    '0x3456789012345678901234567890123456789012'
  ];
  
  const threshold = 2; // 2 of 3 signatures required
  
  const ethSafe = await deploySafe(owners, threshold, 'ethereum');
  const bscSafe = await deploySafe(owners, threshold, 'bsc');
  
  console.log(`Ethereum Safe: ${ethSafe.address}`);
  console.log(`BSC Safe: ${bscSafe.address}`);
  
  return { ethSafe, bscSafe };
}
```

## Migration Process

### Phase 1: Parallel Operation
1. Deploy Gnosis Safes on both networks
2. Configure remote signer service
3. Run both old and new systems in parallel
4. Gradually migrate operations to Safe-based signing

### Phase 2: Full Migration
1. Stop using private key signers
2. Remove private keys from environment
3. Update all bridge operations to use remote signer
4. Implement monitoring for Safe operations

### Phase 3: Optimization
1. Optimize signature collection timing
2. Implement advanced access controls
3. Add comprehensive logging and alerting
4. Performance tuning for high-throughput scenarios

## Monitoring and Alerting

### Metrics
- `safe_proposals_total`: Total number of Safe transaction proposals
- `safe_signatures_collected`: Number of signatures collected per transaction
- `safe_execution_time`: Time from proposal to execution
- `safe_execution_failures`: Number of failed executions

### Alerts
- **Critical**: Safe transaction stuck for > 1 hour
- **Warning**: Signature collection taking > 30 minutes
- **Info**: New Safe transaction proposed

This remote signer implementation provides enterprise-grade security while maintaining the bridge's operational efficiency.