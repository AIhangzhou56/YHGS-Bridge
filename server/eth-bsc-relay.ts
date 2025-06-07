import { ethers } from "ethers";
import { relayPersistence } from "./persistence";

// Configuration for reorg safety
const CONFIRMATION_DEPTH = 12; // Wait for 12 block confirmations
const MAX_REORG_DEPTH = 64; // Maximum expected reorg depth

interface LockEventData {
  token: string;
  sender: string;
  amount: bigint;
  targetChain: string;
  targetAddr: string;
  nonce: string;
  blockNumber: number;
  transactionHash: string;
  blockHash: string;
  logIndex: number;
}

interface ProofData {
  blockHash: string;
  blockNumber: number;
  transactionHash: string;
  transactionIndex: number;
  logIndex: number;
  receiptsRoot: string;
  stateRoot: string;
  eventData: string;
}

export class EthereumBSCRelay {
  private ethProvider: ethers.JsonRpcProvider;
  private bscProvider: ethers.JsonRpcProvider;
  private ethSigner: ethers.Wallet;
  private bscSigner: ethers.Wallet;
  private ethBridge: ethers.Contract;
  private bscBridge: ethers.Contract;
  private processedNonces: Set<string> = new Set();
  private isRunning: boolean = false;

  constructor() {
    // Initialize providers with testnet endpoints
    this.ethProvider = new ethers.JsonRpcProvider(
      process.env.ETHEREUM_RPC || `https://sepolia.infura.io/v3/${process.env.INFURA_API_KEY}`
    );
    
    this.bscProvider = new ethers.JsonRpcProvider(
      process.env.BSC_TESTNET_RPC || "https://data-seed-prebsc-1-s1.binance.org:8545/"
    );

    // Initialize signers from environment variables
    const ethPrivateKey = process.env.ETHEREUM_PRIVATE_KEY;
    const bscPrivateKey = process.env.BSC_PRIVATE_KEY;

    if (!ethPrivateKey || !bscPrivateKey) {
      throw new Error("Private keys not found in environment variables");
    }

    this.ethSigner = new ethers.Wallet(ethPrivateKey, this.ethProvider);
    this.bscSigner = new ethers.Wallet(bscPrivateKey, this.bscProvider);

    // Bridge contract ABI - minimal interface for lock/mint operations
    const bridgeAbi = [
      "event Locked(address indexed token, address indexed sender, uint256 amount, string targetChain, string targetAddr, bytes32 indexed nonce)",
      "function mint(address token, address to, uint256 amount, bytes32 nonce, bytes calldata proof) external",
      "function isNonceUsed(bytes32 nonce) external view returns (bool)",
      "function verifyProof(bytes calldata proof) external pure returns (bool)"
    ];

    // Initialize bridge contracts
    const ethBridgeAddress = process.env.ETHEREUM_BRIDGE_CONTRACT || "0x1234567890123456789012345678901234567890";
    const bscBridgeAddress = process.env.BSC_BRIDGE_CONTRACT || "0x2345678901234567890123456789012345678901";

    this.ethBridge = new ethers.Contract(ethBridgeAddress, bridgeAbi, this.ethSigner);
    this.bscBridge = new ethers.Contract(bscBridgeAddress, bridgeAbi, this.bscSigner);
  }

  async start(): Promise<void> {
    if (this.isRunning) {
      console.log("Relay is already running");
      return;
    }

    this.isRunning = true;
    console.log("Starting Ethereum to BSC relay service...");
    console.log(`Ethereum Bridge: ${await this.ethBridge.getAddress()}`);
    console.log(`BSC Bridge: ${await this.bscBridge.getAddress()}`);
    console.log(`Ethereum Signer: ${this.ethSigner.address}`);
    console.log(`BSC Signer: ${this.bscSigner.address}`);

    // Verify network connections
    try {
      const [ethNetwork, bscNetwork] = await Promise.all([
        this.ethProvider.getNetwork(),
        this.bscProvider.getNetwork()
      ]);
      
      console.log(`Connected to Ethereum network: ${ethNetwork.name} (${ethNetwork.chainId})`);
      console.log(`Connected to BSC network: ${bscNetwork.name} (${bscNetwork.chainId})`);
    } catch (error) {
      console.error("Network connection error:", error);
      throw error;
    }

    // Process historical events from last 1000 blocks
    await this.processHistoricalEvents();

    // Set up event listener for new lock events
    this.ethBridge.on("Locked", this.handleLockEvent.bind(this));

    // Start confirmation processing loop
    this.startConfirmationProcessor();

    console.log("Relay service is now actively listening for lock events...");
  }

  private async handleLockEvent(
    token: string,
    sender: string,
    amount: bigint,
    targetChain: string,
    targetAddr: string,
    nonce: string,
    event: any
  ): Promise<void> {
    const lockData: LockEventData = {
      token,
      sender,
      amount,
      targetChain,
      targetAddr,
      nonce,
      blockNumber: event.blockNumber,
      transactionHash: event.transactionHash,
      blockHash: event.blockHash,
      logIndex: event.index
    };

    console.log(`🔒 New lock event detected: ${event.transactionHash}`);
    await this.processLockEvent(lockData);
  }

  private async processHistoricalEvents(): Promise<void> {
    try {
      console.log("Scanning for historical lock events...");
      
      const currentBlock = await this.ethProvider.getBlockNumber();
      const fromBlock = Math.max(0, currentBlock - 1000);
      
      console.log(`Scanning blocks ${fromBlock} to ${currentBlock}`);

      const filter = this.ethBridge.filters.Locked();
      const events = await this.ethBridge.queryFilter(filter, fromBlock, currentBlock);

      console.log(`Found ${events.length} historical lock events`);

      for (const event of events) {
        const eventLog = event as ethers.EventLog;
        if (eventLog.args) {
          const lockData: LockEventData = {
            token: eventLog.args.token,
            sender: eventLog.args.sender,
            amount: eventLog.args.amount,
            targetChain: eventLog.args.targetChain,
            targetAddr: eventLog.args.targetAddr,
            nonce: eventLog.args.nonce,
            blockNumber: eventLog.blockNumber,
            transactionHash: eventLog.transactionHash,
            blockHash: eventLog.blockHash,
            logIndex: eventLog.index
          };

          await this.processLockEvent(lockData);
        }
      }

      console.log("Historical event processing completed");
    } catch (error) {
      console.error("Error processing historical events:", error);
    }
  }

  private async processLockEvent(lockData: LockEventData): Promise<void> {
    try {
      // Filter for BSC target chain only
      if (lockData.targetChain.toLowerCase() !== "bsc") {
        console.log(`Event targets ${lockData.targetChain}, ignoring (not BSC)`);
        return;
      }

      // Check if already stored in persistence layer
      if (relayPersistence.isEventProcessed(lockData.transactionHash, lockData.logIndex)) {
        console.log(`Event already stored: ${lockData.transactionHash}-${lockData.logIndex}`);
        return;
      }

      // Check if nonce already used
      if (relayPersistence.isNonceUsed(lockData.nonce)) {
        console.log(`Nonce ${lockData.nonce} already used`);
        return;
      }

      console.log(`New lock event detected: ${lockData.transactionHash}`);
      console.log(`  Token: ${lockData.token}`);
      console.log(`  Sender: ${lockData.sender}`);
      console.log(`  Amount: ${ethers.formatEther(lockData.amount)} ETH`);
      console.log(`  Target: ${lockData.targetAddr}`);
      console.log(`  Nonce: ${lockData.nonce}`);

      // Calculate confirmation requirement
      const currentBlock = await this.ethProvider.getBlockNumber();
      const confirmationBlock = lockData.blockNumber + CONFIRMATION_DEPTH;

      // Store event with pending status for reorg safety
      const stored = relayPersistence.storeEvent({
        transactionHash: lockData.transactionHash,
        logIndex: lockData.logIndex,
        nonce: lockData.nonce,
        blockNumber: lockData.blockNumber,
        blockHash: lockData.blockHash,
        confirmationBlock,
        status: 'pending'
      });

      if (stored) {
        console.log(`Event stored, waiting for ${CONFIRMATION_DEPTH} confirmations (current: ${currentBlock}, required: ${confirmationBlock})`);
      }

    } catch (error) {
      console.error(`Error processing lock event ${lockData.transactionHash}:`, error);
      
      // Mark as failed in persistence
      try {
        relayPersistence.markEventFailed(lockData.transactionHash, lockData.logIndex, error instanceof Error ? error.message : 'Unknown error');
      } catch (persistError) {
        console.error('Failed to mark event as failed:', persistError);
      }
    }
  }

  private async generateProof(lockData: LockEventData): Promise<string> {
    try {
      console.log(`Generating proof for transaction ${lockData.transactionHash}...`);

      // Get transaction receipt with full log data
      const receipt = await this.ethProvider.getTransactionReceipt(lockData.transactionHash);
      if (!receipt) {
        throw new Error("Transaction receipt not found");
      }

      // Get block for state/receipts root
      const block = await this.ethProvider.getBlock(lockData.blockNumber);
      if (!block) {
        throw new Error("Block not found");
      }

      // Encode the event data that was locked
      const eventData = ethers.AbiCoder.defaultAbiCoder().encode(
        ["address", "address", "uint256", "string", "string", "bytes32"],
        [
          lockData.token,
          lockData.sender,
          lockData.amount,
          lockData.targetChain,
          lockData.targetAddr,
          lockData.nonce
        ]
      );

      // Create comprehensive proof structure
      const proofData: ProofData = {
        blockHash: block.hash!,
        blockNumber: block.number,
        transactionHash: lockData.transactionHash,
        transactionIndex: receipt.index,
        logIndex: lockData.logIndex,
        receiptsRoot: block.receiptsRoot!,
        stateRoot: block.stateRoot!,
        eventData
      };

      // Encode proof for BSC verification
      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        [
          "tuple(bytes32 blockHash, uint256 blockNumber, bytes32 transactionHash, uint256 transactionIndex, uint256 logIndex, bytes32 receiptsRoot, bytes32 stateRoot, bytes eventData)"
        ],
        [proofData]
      );

      console.log(`Proof generated (${encodedProof.length} bytes)`);
      return encodedProof;

    } catch (error) {
      console.error("Error generating proof:", error);
      throw error;
    }
  }

  private async submitMintToBSC(lockData: LockEventData, proof: string): Promise<void> {
    try {
      console.log(`Submitting mint transaction to BSC...`);

      // Estimate gas for the mint operation
      const gasEstimate = await this.bscBridge.mint.estimateGas(
        lockData.token,
        lockData.targetAddr,
        lockData.amount,
        lockData.nonce,
        proof
      );

      // Add 25% buffer to gas estimate
      const gasLimit = (gasEstimate * BigInt(125)) / BigInt(100);
      console.log(`Gas estimate: ${gasEstimate}, using limit: ${gasLimit}`);

      // Get current gas price
      const feeData = await this.bscProvider.getFeeData();
      const gasPrice = feeData.gasPrice;

      // Submit the mint transaction
      const mintTx = await this.bscBridge.mint(
        lockData.token,
        lockData.targetAddr,
        lockData.amount,
        lockData.nonce,
        proof,
        { 
          gasLimit,
          gasPrice 
        }
      );

      console.log(`🚀 Mint transaction submitted: ${mintTx.hash}`);

      // Wait for confirmation with timeout
      const receipt = await Promise.race([
        mintTx.wait(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Transaction timeout")), 300000) // 5 minute timeout
        )
      ]) as any;

      if (receipt?.status === 1) {
        console.log(`✅ Mint confirmed on BSC: ${mintTx.hash}`);
        console.log(`   Gas used: ${receipt.gasUsed.toString()}`);
        console.log(`   Block: ${receipt.blockNumber}`);
      } else {
        throw new Error("Mint transaction failed or reverted");
      }

    } catch (error) {
      console.error("Error submitting mint to BSC:", error);
      throw error;
    }
  }

  async getRelayStatus(): Promise<{
    isRunning: boolean;
    processedEvents: number;
    ethereumBlock: number;
    bscBlock: number;
    ethBridge: string;
    bscBridge: string;
    ethSigner: string;
    bscSigner: string;
  }> {
    try {
      const [ethBlock, bscBlock] = await Promise.all([
        this.ethProvider.getBlockNumber(),
        this.bscProvider.getBlockNumber()
      ]);

      return {
        isRunning: this.isRunning,
        processedEvents: this.processedNonces.size,
        ethereumBlock: ethBlock,
        bscBlock: bscBlock,
        ethBridge: await this.ethBridge.getAddress(),
        bscBridge: await this.bscBridge.getAddress(),
        ethSigner: this.ethSigner.address,
        bscSigner: this.bscSigner.address
      };
    } catch (error) {
      console.error("Error getting relay status:", error);
      return {
        isRunning: this.isRunning,
        processedEvents: this.processedNonces.size,
        ethereumBlock: 0,
        bscBlock: 0,
        ethBridge: "unknown",
        bscBridge: "unknown",
        ethSigner: "unknown",
        bscSigner: "unknown"
      };
    }
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("Relay is not running");
      return;
    }

    console.log("Stopping Ethereum-BSC relay service...");
    this.ethBridge.removeAllListeners();
    this.isRunning = false;
    console.log("Relay service stopped");
  }

  // Test connection to both networks
  async testConnections(): Promise<boolean> {
    try {
      const [ethBlock, bscBlock] = await Promise.all([
        this.ethProvider.getBlockNumber(),
        this.bscProvider.getBlockNumber()
      ]);

      console.log(`Ethereum latest block: ${ethBlock}`);
      console.log(`BSC latest block: ${bscBlock}`);
      return true;
    } catch (error) {
      console.error("Connection test failed:", error);
      return false;
    }
  }
}

// Initialize and export relay instance
export const ethereumBSCRelay = new EthereumBSCRelay();