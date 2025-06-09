import { Request, Response } from 'express';
import { storage } from './storage';

// Testnet configuration for ETH to SOL bridge testing
const TESTNET_CONFIG = {
  ethereum: {
    chainId: 11155111, // Sepolia testnet
    rpcUrl: 'https://sepolia.infura.io/v3/demo',
    bridgeContract: '0x742d35Cc6634C0532925a3b8D35Cc6634C0532925',
    faucetUrl: 'https://sepoliafaucet.com/',
    explorer: 'https://sepolia.etherscan.io'
  },
  solana: {
    cluster: 'devnet',
    rpcUrl: 'https://api.devnet.solana.com',
    bridgeProgram: 'BR1dg3Prog1111111111111111111111111111111111',
    faucetUrl: 'https://faucet.solana.com/',
    explorer: 'https://explorer.solana.com/?cluster=devnet'
  }
};

// Test wallet addresses with pre-funded balances
const TEST_WALLETS = {
  ethereum: {
    address: '0x742d35Cc6634C0532925a3b8D35Cc6634C0532925',
    privateKey: 'test_key_eth_sepolia',
    balance: {
      ETH: '5.0',
      USDC: '1000.0'
    }
  },
  solana: {
    address: 'EthSoLBridgeTest1111111111111111111111111111',
    keypair: 'test_keypair_sol_devnet',
    balance: {
      SOL: '10.0',
      USDC: '500.0'
    }
  }
};

interface TestBridgeTransaction {
  id: string;
  fromChain: 'ethereum' | 'solana';
  toChain: 'ethereum' | 'solana';
  token: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  status: 'pending' | 'locked' | 'minting' | 'completed' | 'failed';
  txHash?: string;
  estimatedTime: number;
  fee: string;
  createdAt: Date;
  completedAt?: Date;
}

class TestnetBridge {
  private transactions: Map<string, TestBridgeTransaction> = new Map();
  private lockEventTimeout: Map<string, NodeJS.Timeout> = new Map();

  // Simulate ETH to SOL bridge transaction
  async initiateEthToSolBridge(params: {
    amount: string;
    fromAddress: string;
    toAddress: string;
    token: 'ETH' | 'USDC';
  }): Promise<TestBridgeTransaction> {
    const transactionId = `eth-sol-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const transaction: TestBridgeTransaction = {
      id: transactionId,
      fromChain: 'ethereum',
      toChain: 'solana',
      token: params.token,
      amount: params.amount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      status: 'pending',
      estimatedTime: 180, // 3 minutes for testnet
      fee: this.calculateBridgeFee(params.amount, params.token),
      createdAt: new Date()
    };

    this.transactions.set(transactionId, transaction);

    // Simulate Ethereum lock transaction
    setTimeout(() => this.simulateEthereumLock(transactionId), 2000);
    
    return transaction;
  }

  // Simulate SOL to ETH bridge transaction
  async initiateSolToEthBridge(params: {
    amount: string;
    fromAddress: string;
    toAddress: string;
    token: 'SOL' | 'USDC';
  }): Promise<TestBridgeTransaction> {
    const transactionId = `sol-eth-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    const transaction: TestBridgeTransaction = {
      id: transactionId,
      fromChain: 'solana',
      toChain: 'ethereum',
      token: params.token,
      amount: params.amount,
      fromAddress: params.fromAddress,
      toAddress: params.toAddress,
      status: 'pending',
      estimatedTime: 240, // 4 minutes for testnet
      fee: this.calculateBridgeFee(params.amount, params.token),
      createdAt: new Date()
    };

    this.transactions.set(transactionId, transaction);

    // Simulate Solana lock transaction
    setTimeout(() => this.simulateSolanaLock(transactionId), 1500);
    
    return transaction;
  }

  private simulateEthereumLock(transactionId: string) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    // Generate mock Ethereum transaction hash
    const ethTxHash = `0x${Math.random().toString(16).padStart(64, '0')}`;
    
    transaction.status = 'locked';
    transaction.txHash = ethTxHash;
    
    console.log(`[Testnet] ETH Lock confirmed: ${ethTxHash}`);
    
    // Simulate Solana mint after lock confirmation
    setTimeout(() => this.simulateSolanaMint(transactionId), 30000); // 30 seconds
  }

  private simulateSolanaLock(transactionId: string) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    // Generate mock Solana transaction signature
    const solTxSig = Math.random().toString(58).substr(2, 88);
    
    transaction.status = 'locked';
    transaction.txHash = solTxSig;
    
    console.log(`[Testnet] SOL Lock confirmed: ${solTxSig}`);
    
    // Simulate Ethereum mint after lock confirmation
    setTimeout(() => this.simulateEthereumMint(transactionId), 45000); // 45 seconds
  }

  private simulateSolanaMint(transactionId: string) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    transaction.status = 'minting';
    
    setTimeout(() => {
      const solMintSig = Math.random().toString(58).substr(2, 88);
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      
      console.log(`[Testnet] SOL Mint completed: ${solMintSig}`);
    }, 15000); // 15 seconds for mint
  }

  private simulateEthereumMint(transactionId: string) {
    const transaction = this.transactions.get(transactionId);
    if (!transaction) return;

    transaction.status = 'minting';
    
    setTimeout(() => {
      const ethMintHash = `0x${Math.random().toString(16).padStart(64, '0')}`;
      transaction.status = 'completed';
      transaction.completedAt = new Date();
      
      console.log(`[Testnet] ETH Mint completed: ${ethMintHash}`);
    }, 20000); // 20 seconds for mint
  }

  private calculateBridgeFee(amount: string, token: string): string {
    const baseAmount = parseFloat(amount);
    const feePercentage = token === 'ETH' || token === 'SOL' ? 0.003 : 0.001; // 0.3% for native, 0.1% for stablecoins
    return (baseAmount * feePercentage).toFixed(6);
  }

  getTransaction(id: string): TestBridgeTransaction | undefined {
    return this.transactions.get(id);
  }

  getAllTransactions(): TestBridgeTransaction[] {
    return Array.from(this.transactions.values()).sort((a, b) => 
      b.createdAt.getTime() - a.createdAt.getTime()
    );
  }

  getTestnetConfig() {
    return TESTNET_CONFIG;
  }

  getTestWallets() {
    return TEST_WALLETS;
  }
}

export const testnetBridge = new TestnetBridge();

// API endpoints for testnet bridge
export async function handleTestnetBridge(req: Request, res: Response) {
  try {
    const { action } = req.params;
    
    switch (action) {
      case 'config':
        res.json({
          success: true,
          config: testnetBridge.getTestnetConfig(),
          testWallets: testnetBridge.getTestWallets()
        });
        break;
        
      case 'initiate-eth-to-sol':
        const ethToSolResult = await testnetBridge.initiateEthToSolBridge(req.body);
        res.json({
          success: true,
          transaction: ethToSolResult,
          message: 'ETH to SOL bridge initiated on testnet'
        });
        break;
        
      case 'initiate-sol-to-eth':
        const solToEthResult = await testnetBridge.initiateSolToEthBridge(req.body);
        res.json({
          success: true,
          transaction: solToEthResult,
          message: 'SOL to ETH bridge initiated on testnet'
        });
        break;
        
      case 'status':
        const { transactionId } = req.query;
        if (typeof transactionId === 'string') {
          const transaction = testnetBridge.getTransaction(transactionId);
          if (transaction) {
            res.json({ success: true, transaction });
          } else {
            res.status(404).json({ success: false, error: 'Transaction not found' });
          }
        } else {
          res.json({
            success: true,
            transactions: testnetBridge.getAllTransactions()
          });
        }
        break;
        
      default:
        res.status(400).json({ success: false, error: 'Invalid action' });
    }
  } catch (error) {
    console.error('Testnet bridge error:', error);
    res.status(500).json({ success: false, error: 'Internal server error' });
  }
}