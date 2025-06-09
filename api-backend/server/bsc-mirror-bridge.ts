import { ethers } from 'ethers';
import { storage } from './storage';

// BSC Mirror Token Bridge for ERC-20 to BEP-20 mirroring
export class BSCMirrorBridge {
  private ethereumProvider: ethers.JsonRpcProvider;
  private bscProvider: ethers.JsonRpcProvider;
  private ethereumSigner: ethers.Wallet;
  private bscSigner: ethers.Wallet;
  private mirrorTokenFactory: ethers.Contract;
  private lockContract: ethers.Contract;
  
  // Contract ABIs
  private readonly LOCK_CONTRACT_ABI = [
    "event TokenLocked(address indexed token, address indexed user, uint256 amount, bytes32 indexed lockId)",
    "function lockToken(address token, uint256 amount) external returns (bytes32 lockId)",
    "function releaseLock(bytes32 lockId, address to) external"
  ];

  private readonly MIRROR_FACTORY_ABI = [
    "function createMirrorToken(address originalToken, string name, string symbol, uint8 decimals) external returns (address mirrorToken)",
    "function getMirrorToken(address originalToken) external view returns (address)",
    "function mintMirrorToken(address mirrorToken, address to, uint256 amount) external",
    "function burnMirrorToken(address mirrorToken, uint256 amount) external"
  ];

  private readonly ERC20_ABI = [
    "function name() external view returns (string)",
    "function symbol() external view returns (string)",
    "function decimals() external view returns (uint8)",
    "function totalSupply() external view returns (uint256)",
    "function balanceOf(address account) external view returns (uint256)"
  ];

  constructor() {
    // Initialize providers
    this.ethereumProvider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC || 'https://mainnet.infura.io/v3/' + process.env.INFURA_API_KEY
    );
    
    this.bscProvider = new ethers.JsonRpcProvider(
      process.env.BSC_RPC || 'https://bsc-dataseed.binance.org/'
    );

    // Initialize signers (use environment variables for private keys)
    this.ethereumSigner = new ethers.Wallet(
      process.env.ETHEREUM_PRIVATE_KEY || '0x' + '0'.repeat(64),
      this.ethereumProvider
    );
    
    this.bscSigner = new ethers.Wallet(
      process.env.BSC_PRIVATE_KEY || '0x' + '0'.repeat(64),
      this.bscProvider
    );

    // Initialize contracts
    this.lockContract = new ethers.Contract(
      process.env.ETHEREUM_LOCK_CONTRACT || '0x1234567890123456789012345678901234567890',
      this.LOCK_CONTRACT_ABI,
      this.ethereumSigner
    );

    this.mirrorTokenFactory = new ethers.Contract(
      process.env.BSC_MIRROR_FACTORY || '0x2345678901234567890123456789012345678901',
      this.MIRROR_FACTORY_ABI,
      this.bscSigner
    );
  }

  // Listen for ERC-20 lock events on Ethereum
  async startListening() {
    console.log('Starting BSC Mirror Bridge listener...');
    
    this.lockContract.on('TokenLocked', async (token, user, amount, lockId, event) => {
      try {
        await this.handleTokenLock({
          token,
          user,
          amount: amount.toString(),
          lockId,
          txHash: event.transactionHash,
          blockNumber: event.blockNumber
        });
      } catch (error) {
        console.error('Error handling token lock:', error);
      }
    });
  }

  // Handle ERC-20 token lock and mint mirror on BSC
  private async handleTokenLock(lockEvent: {
    token: string;
    user: string;
    amount: string;
    lockId: string;
    txHash: string;
    blockNumber: number;
  }) {
    console.log(`Processing lock event: ${lockEvent.lockId}`);

    try {
      // Get original token details
      const originalToken = new ethers.Contract(
        lockEvent.token,
        this.ERC20_ABI,
        this.ethereumProvider
      );

      const [name, symbol, decimals] = await Promise.all([
        originalToken.name(),
        originalToken.symbol(),
        originalToken.decimals()
      ]);

      // Check if mirror token exists on BSC
      let mirrorTokenAddress = await this.mirrorTokenFactory.getMirrorToken(lockEvent.token);
      
      // Create mirror token if it doesn't exist
      if (mirrorTokenAddress === ethers.ZeroAddress) {
        console.log(`Creating mirror token for ${symbol}...`);
        
        const createTx = await this.mirrorTokenFactory.createMirrorToken(
          lockEvent.token,
          `Mirrored ${name}`,
          `m${symbol}`,
          decimals
        );
        
        await createTx.wait();
        mirrorTokenAddress = await this.mirrorTokenFactory.getMirrorToken(lockEvent.token);
        
        console.log(`Mirror token created at: ${mirrorTokenAddress}`);
      }

      // Mint mirrored tokens on BSC
      console.log(`Minting ${lockEvent.amount} m${symbol} to ${lockEvent.user}...`);
      
      const mintTx = await this.mirrorTokenFactory.mintMirrorToken(
        mirrorTokenAddress,
        lockEvent.user,
        lockEvent.amount
      );

      const mintReceipt = await mintTx.wait();
      
      // Store bridge transaction in database
      await this.storeBridgeTransaction({
        lockId: lockEvent.lockId,
        originalToken: lockEvent.token,
        mirrorToken: mirrorTokenAddress,
        user: lockEvent.user,
        amount: lockEvent.amount,
        ethereumTxHash: lockEvent.txHash,
        bscTxHash: mintReceipt.hash,
        status: 'completed',
        createdAt: new Date()
      });

      console.log(`Mirror minting completed: ${mintReceipt.hash}`);

    } catch (error) {
      console.error('Error in handleTokenLock:', error);
      
      // Store failed transaction
      await this.storeBridgeTransaction({
        lockId: lockEvent.lockId,
        originalToken: lockEvent.token,
        mirrorToken: ethers.ZeroAddress,
        user: lockEvent.user,
        amount: lockEvent.amount,
        ethereumTxHash: lockEvent.txHash,
        bscTxHash: null,
        status: 'failed',
        createdAt: new Date()
      });
    }
  }

  // Handle BSC mirror token burn and unlock on Ethereum
  async handleMirrorBurn(burnEvent: {
    mirrorToken: string;
    user: string;
    amount: string;
    burnId: string;
  }) {
    try {
      // Get original token address from mirror token
      const originalToken = await this.getOriginalTokenFromMirror(burnEvent.mirrorToken);
      
      if (!originalToken) {
        throw new Error('Original token not found for mirror token');
      }

      // Release locked tokens on Ethereum
      const releaseTx = await this.lockContract.releaseLock(
        burnEvent.burnId,
        burnEvent.user
      );

      await releaseTx.wait();
      console.log(`Tokens released on Ethereum: ${releaseTx.hash}`);

    } catch (error) {
      console.error('Error handling mirror burn:', error);
    }
  }

  // Get original token address from mirror token
  private async getOriginalTokenFromMirror(mirrorToken: string): Promise<string | null> {
    // This would require additional contract functionality to map mirror tokens back to originals
    // For now, we'll use a database lookup
    try {
      const bridgeRecord = await this.getBridgeTransactionByMirrorToken(mirrorToken);
      return bridgeRecord?.originalToken || null;
    } catch (error) {
      console.error('Error getting original token:', error);
      return null;
    }
  }

  // Store bridge transaction in database
  private async storeBridgeTransaction(transaction: {
    lockId: string;
    originalToken: string;
    mirrorToken: string;
    user: string;
    amount: string;
    ethereumTxHash: string;
    bscTxHash: string | null;
    status: 'pending' | 'completed' | 'failed';
    createdAt: Date;
  }) {
    try {
      await storage.createTransaction({
        walletId: 1, // Default wallet for bridge transactions
        type: 'bridge',
        fromToken: transaction.originalToken,
        toToken: transaction.mirrorToken,
        fromChain: 'ethereum',
        toChain: 'bsc',
        amount: transaction.amount,
        status: transaction.status,
        txHash: transaction.bscTxHash
      });
    } catch (error) {
      console.error('Error storing bridge transaction:', error);
    }
  }

  // Get bridge transaction by mirror token
  private async getBridgeTransactionByMirrorToken(mirrorToken: string) {
    try {
      // This would require extending the storage interface to support bridge-specific queries
      const transactions = await storage.getWalletTransactions(1);
      return transactions.find(tx => tx.toToken === mirrorToken);
    } catch (error) {
      console.error('Error getting bridge transaction:', error);
      return null;
    }
  }

  // Get mirror token info
  async getMirrorTokenInfo(originalToken: string) {
    try {
      const mirrorTokenAddress = await this.mirrorTokenFactory.getMirrorToken(originalToken);
      
      if (mirrorTokenAddress === ethers.ZeroAddress) {
        return null;
      }

      const mirrorToken = new ethers.Contract(
        mirrorTokenAddress,
        this.ERC20_ABI,
        this.bscProvider
      );

      const [name, symbol, decimals, totalSupply] = await Promise.all([
        mirrorToken.name(),
        mirrorToken.symbol(),
        mirrorToken.decimals(),
        mirrorToken.totalSupply()
      ]);

      return {
        address: mirrorTokenAddress,
        name,
        symbol,
        decimals,
        totalSupply: totalSupply.toString()
      };
    } catch (error) {
      console.error('Error getting mirror token info:', error);
      return null;
    }
  }

  // Estimate bridge fees
  async estimateBridgeFee(tokenAddress: string, amount: string): Promise<{
    ethereumGasFee: string;
    bscGasFee: string;
    bridgeFee: string;
    totalFee: string;
  }> {
    try {
      // Estimate Ethereum gas for lock transaction
      const lockGasEstimate = await this.lockContract.lockToken.estimateGas(
        tokenAddress,
        ethers.parseEther(amount)
      );
      
      const ethereumGasPrice = await this.ethereumProvider.getFeeData();
      const ethereumGasFee = (lockGasEstimate * (ethereumGasPrice.gasPrice || 0n)).toString();

      // Estimate BSC gas for mint transaction
      const mintGasEstimate = await this.mirrorTokenFactory.mintMirrorToken.estimateGas(
        ethers.ZeroAddress, // Placeholder address
        ethers.ZeroAddress,
        ethers.parseEther(amount)
      );
      
      const bscGasPrice = await this.bscProvider.getFeeData();
      const bscGasFee = (mintGasEstimate * (bscGasPrice.gasPrice || 0n)).toString();

      // Bridge fee (0.1% of amount)
      const amountBigInt = ethers.parseEther(amount);
      const bridgeFee = (amountBigInt * BigInt(1) / BigInt(1000)).toString();
      
      const totalFee = (BigInt(ethereumGasFee) + BigInt(bscGasFee) + BigInt(bridgeFee)).toString();

      return {
        ethereumGasFee: ethers.formatEther(ethereumGasFee),
        bscGasFee: ethers.formatEther(bscGasFee),
        bridgeFee: ethers.formatEther(bridgeFee),
        totalFee: ethers.formatEther(totalFee)
      };
    } catch (error) {
      console.error('Error estimating bridge fee:', error);
      return {
        ethereumGasFee: '0',
        bscGasFee: '0',
        bridgeFee: '0',
        totalFee: '0'
      };
    }
  }
}

// Create and export bridge instance
export const bscMirrorBridge = new BSCMirrorBridge();