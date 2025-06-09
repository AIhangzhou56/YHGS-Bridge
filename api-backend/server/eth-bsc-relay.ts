import { ethers } from "ethers";
import { relayPersistence } from "./persistence";

// Configuration for reorg safety with adaptive confirmation depth
const DEFAULT_CONFIRMATION_DEPTH = 12; // Default block confirmations
const MAX_REORG_DEPTH = 64; // Maximum expected reorg depth

// Environment-based confirmation depths
const CONFIRMATIONS_ETH = parseInt(process.env.CONFIRMATIONS_ETH || '12');
const CONFIRMATIONS_BSC = parseInt(process.env.CONFIRMATIONS_BSC || '15');

// Header Store contract configuration
const HEADER_STORE_CONTRACT = process.env.HEADER_STORE_CONTRACT || '0x0000000000000000000000000000000000000000';
const RECEIPT_VERIFIER_CONTRACT = process.env.RECEIPT_VERIFIER_CONTRACT || '0x0000000000000000000000000000000000000000';

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

interface ReceiptProof {
  blockHash: string;
  receiptsRoot: string;
  receipt: string;
  proof: string[];
  logIndex: number;
  receiptIndex: number;
  blockHeader: {
    parentHash: string;
    receiptsRoot: string;
    blockNumber: number;
    timestamp: number;
  };
}

export class EthereumBSCRelay {
  private ethProvider: ethers.JsonRpcProvider;
  private bscProvider: ethers.JsonRpcProvider;
  private ethSigner: ethers.Wallet;
  private bscSigner: ethers.Wallet;
  private ethBridge: ethers.Contract;
  private bscBridge: ethers.Contract;
  private headerStore: ethers.Contract | null = null;
  private receiptVerifier: ethers.Contract | null = null;
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

      // Calculate confirmation requirement using adaptive depth
      const currentBlock = await this.ethProvider.getBlockNumber();
      const confirmationBlock = lockData.blockNumber + CONFIRMATIONS_ETH;

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
        console.log(`Event stored, waiting for ${CONFIRMATIONS_ETH} confirmations (current: ${currentBlock}, required: ${confirmationBlock})`);
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

  // Start confirmation processor for reorg safety
  private startConfirmationProcessor(): void {
    const processInterval = setInterval(async () => {
      try {
        await this.processConfirmedEvents();
      } catch (error) {
        console.error('Error in confirmation processor:', error);
      }
    }, 30000); // Check every 30 seconds

    (this as any).confirmationProcessor = processInterval;
  }

  // Process events that have received sufficient confirmations
  private async processConfirmedEvents(): Promise<void> {
    try {
      const currentBlock = await this.ethProvider.getBlockNumber();
      
      // Check events awaiting confirmation
      const pendingEvents = relayPersistence.getEventsAwaitingConfirmation(currentBlock, CONFIRMATIONS_ETH);
      
      for (const event of pendingEvents) {
        const isValid = await this.verifyEventIntegrity(event);
        
        if (isValid) {
          relayPersistence.markEventConfirmed(event.transactionHash, event.logIndex);
          console.log(`Event confirmed: ${event.transactionHash}-${event.logIndex}`);
        } else {
          relayPersistence.markEventFailed(event.transactionHash, event.logIndex, 'Event removed due to reorg');
          console.log(`Event reorged: ${event.transactionHash}-${event.logIndex}`);
        }
      }

      // Process confirmed events
      const confirmedEvents = relayPersistence.getConfirmedEvents(5);
      
      for (const event of confirmedEvents) {
        await this.processConfirmedEvent(event);
      }

    } catch (error) {
      console.error('Error processing confirmed events:', error);
    }
  }

  // Verify event hasn't been removed due to reorg
  private async verifyEventIntegrity(event: any): Promise<boolean> {
    try {
      const currentBlock = await this.ethProvider.getBlock(event.blockNumber);
      
      if (!currentBlock || currentBlock.hash !== event.blockHash) {
        return false;
      }

      const receipt = await this.ethProvider.getTransactionReceipt(event.transactionHash);
      if (!receipt || receipt.blockHash !== event.blockHash) {
        return false;
      }

      return true;
    } catch (error) {
      console.error('Error verifying event integrity:', error);
      return false;
    }
  }

  // Process a confirmed event by generating proof and submitting mint
  private async processConfirmedEvent(event: any): Promise<void> {
    try {
      console.log(`Processing confirmed event: ${event.transactionHash}-${event.logIndex}`);

      const nonceUsed = await this.bscBridge.isNonceUsed(event.nonce);
      if (nonceUsed) {
        relayPersistence.markEventFailed(event.transactionHash, event.logIndex, 'Nonce already used on BSC');
        return;
      }

      const receipt = await this.ethProvider.getTransactionReceipt(event.transactionHash);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      const lockLog = receipt.logs[event.logIndex];
      if (!lockLog) {
        throw new Error('Lock event log not found');
      }

      const parsedLog = this.ethBridge.interface.parseLog({
        topics: lockLog.topics,
        data: lockLog.data
      });

      if (parsedLog) {
        const lockData: LockEventData = {
          token: parsedLog.args.token,
          sender: parsedLog.args.sender,
          amount: parsedLog.args.amount,
          targetChain: 'bsc',
          targetAddr: parsedLog.args.targetAddr,
          nonce: event.nonce,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          blockHash: event.blockHash,
          logIndex: event.logIndex
        };

        const proof = await this.generateProof(lockData);
        const mintTxHash = await this.submitMintToBSCWithReturn(lockData, proof);

        relayPersistence.markEventProcessed(event.transactionHash, event.logIndex, mintTxHash);
        console.log(`✅ Event processed successfully: ${event.transactionHash}`);
      }

    } catch (error) {
      console.error(`Failed to process confirmed event: ${event.transactionHash}`, error);
      relayPersistence.markEventFailed(event.transactionHash, event.logIndex, error instanceof Error ? error.message : 'Processing failed');
    }
  }

  // Enhanced mint submission with header, proof, and logIndex
  private async submitMintToBSCWithReturn(lockData: LockEventData, proof: string): Promise<string> {
    console.log(`Submitting mint transaction to BSC with receipt proof...`);

    // Generate receipt proof for the transaction
    const receiptProof = await this.generateReceiptProof(lockData.transactionHash);

    // Enhanced mint payload with header, proof, and logIndex
    const mintPayload = {
      token: lockData.token,
      recipient: lockData.targetAddr,
      amount: lockData.amount,
      nonce: lockData.nonce,
      blockHeader: receiptProof.blockHeader,
      receiptProof: receiptProof.proof,
      receipt: receiptProof.receipt,
      logIndex: lockData.logIndex
    };

    // Call enhanced mint function with receipt verification
    const gasEstimate = await this.bscBridge.mintWithProof.estimateGas(
      mintPayload.token,
      mintPayload.recipient,
      mintPayload.amount,
      mintPayload.nonce,
      mintPayload.blockHeader,
      mintPayload.receiptProof,
      mintPayload.receipt,
      mintPayload.logIndex
    );

    const gasLimit = (gasEstimate * BigInt(125)) / BigInt(100);
    const feeData = await this.bscProvider.getFeeData();

    const mintTx = await this.bscBridge.mintWithProof(
      mintPayload.token,
      mintPayload.recipient,
      mintPayload.amount,
      mintPayload.nonce,
      mintPayload.blockHeader,
      mintPayload.receiptProof,
      mintPayload.receipt,
      mintPayload.logIndex,
      { 
        gasLimit,
        gasPrice: feeData.gasPrice 
      }
    );

    console.log(`Mint transaction with proof submitted: ${mintTx.hash}`);

    const receipt = await Promise.race([
      mintTx.wait(),
      new Promise((_, reject) => 
        setTimeout(() => reject(new Error("Transaction timeout")), 300000)
      )
    ]) as any;

    if (receipt?.status === 1) {
      console.log(`Mint with proof confirmed on BSC: ${mintTx.hash}`);
      return mintTx.hash;
    } else {
      throw new Error("Mint transaction failed or reverted");
    }
  }

  stop(): void {
    if (!this.isRunning) {
      console.log("Relay is not running");
      return;
    }

    console.log("Stopping Ethereum-BSC relay service...");
    this.ethBridge.removeAllListeners();
    
    if ((this as any).confirmationProcessor) {
      clearInterval((this as any).confirmationProcessor);
    }
    
    this.isRunning = false;
    console.log("Relay service stopped");
  }

  // Generate receipt proof using eth_getProof + RLP
  async generateReceiptProof(txHash: string): Promise<ReceiptProof> {
    try {
      console.log(`Generating receipt proof for transaction: ${txHash}`);

      // Get transaction receipt
      const receipt = await this.ethProvider.getTransactionReceipt(txHash);
      if (!receipt) {
        throw new Error(`Transaction receipt not found for ${txHash}`);
      }

      // Get block header
      const block = await this.ethProvider.getBlock(receipt.blockNumber);
      if (!block) {
        throw new Error(`Block not found for number ${receipt.blockNumber}`);
      }

      // Get receipt proof using eth_getProof RPC call
      const proofResponse = await this.ethProvider.send('eth_getProof', [
        receipt.to, // Contract address
        [], // Storage keys (empty for receipt proof)
        `0x${receipt.blockNumber.toString(16)}`
      ]);

      // Generate Merkle proof for the receipt
      const receiptProof = await this.generateReceiptMerkleProof(txHash, receipt.blockNumber);

      const blockHeader = {
        parentHash: block.parentHash,
        receiptsRoot: block.receiptsRoot || '',
        blockNumber: block.number,
        timestamp: block.timestamp
      };

      return {
        blockHash: receipt.blockHash,
        receiptsRoot: block.receiptsRoot || '',
        receipt: this.encodeReceipt(receipt),
        proof: receiptProof.proof,
        logIndex: 0, // Will be set by caller based on specific log
        receiptIndex: receipt.index,
        blockHeader
      };

    } catch (error) {
      console.error(`Error generating receipt proof for ${txHash}:`, error);
      throw error;
    }
  }

  // Generate Merkle proof for transaction receipt
  private async generateReceiptMerkleProof(txHash: string, blockNumber: number): Promise<{proof: string[], index: number}> {
    try {
      // Get all receipts in the block to build Merkle tree
      const block = await this.ethProvider.getBlock(blockNumber, true);
      if (!block || !block.transactions) {
        throw new Error(`Block ${blockNumber} or transactions not found`);
      }

      const receipts = [];
      for (const tx of block.transactions) {
        if (typeof tx === 'string') {
          const receipt = await this.ethProvider.getTransactionReceipt(tx);
          if (receipt) {
            receipts.push(receipt);
          }
        } else {
          const receipt = await this.ethProvider.getTransactionReceipt(tx.hash);
          if (receipt) {
            receipts.push(receipt);
          }
        }
      }

      // Find target receipt index
      const targetIndex = receipts.findIndex(r => r.hash === txHash);
      if (targetIndex === -1) {
        throw new Error(`Receipt not found in block for ${txHash}`);
      }

      // Generate Merkle proof (simplified implementation)
      const proof = this.buildMerkleProof(receipts, targetIndex);
      
      return { proof, index: targetIndex };
    } catch (error) {
      console.error(`Error generating Merkle proof:`, error);
      throw error;
    }
  }

  // Encode transaction receipt to RLP format
  private encodeReceipt(receipt: any): string {
    // Simplified RLP encoding for receipt
    // In production, use a proper RLP library
    const logs = receipt.logs.map((log: any) => ({
      address: log.address,
      topics: log.topics,
      data: log.data
    }));

    return JSON.stringify({
      status: receipt.status,
      cumulativeGasUsed: receipt.cumulativeGasUsed,
      logsBloom: receipt.logsBloom,
      logs: logs
    });
  }

  // Build Merkle proof for receipt at given index
  private buildMerkleProof(receipts: any[], targetIndex: number): string[] {
    const proof: string[] = [];
    
    // Create leaf hashes
    const leaves = receipts.map(receipt => 
      ethers.keccak256(ethers.toUtf8Bytes(this.encodeReceipt(receipt)))
    );

    let currentLevel = leaves;
    let index = targetIndex;

    while (currentLevel.length > 1) {
      const nextLevel: string[] = [];
      
      for (let i = 0; i < currentLevel.length; i += 2) {
        if (i + 1 < currentLevel.length) {
          // Pair exists
          const left = currentLevel[i];
          const right = currentLevel[i + 1];
          const combined = ethers.keccak256(ethers.concat([left, right]));
          nextLevel.push(combined);
          
          // Add sibling to proof if current index is involved
          if (Math.floor(index / 2) === Math.floor(i / 2)) {
            if (index % 2 === 0 && i + 1 < currentLevel.length) {
              proof.push(right); // Add right sibling
            } else if (index % 2 === 1) {
              proof.push(left); // Add left sibling
            }
          }
        } else {
          // Odd number, carry forward
          nextLevel.push(currentLevel[i]);
        }
      }
      
      currentLevel = nextLevel;
      index = Math.floor(index / 2);
    }

    return proof;
  }

  // Enhanced reorg rollback mechanism
  async checkAndHandleReorg(): Promise<void> {
    try {
      const currentBlock = await this.ethProvider.getBlockNumber();
      const checkDepth = Math.min(MAX_REORG_DEPTH, currentBlock);
      
      // Get events that might be affected by reorg
      const recentEvents = relayPersistence.getEventsInRange(
        currentBlock - checkDepth,
        currentBlock
      );

      for (const event of recentEvents) {
        // Verify if stored blockHash matches current canonical chain
        const currentBlockData = await this.ethProvider.getBlock(event.blockNumber);
        
        if (!currentBlockData || currentBlockData.hash !== event.blockHash) {
          console.log(`Reorg detected for event ${event.transactionHash} at block ${event.blockNumber}`);
          
          // Reset event to PENDING status for reprocessing
          relayPersistence.markEventFailed(
            event.transactionHash, 
            event.logIndex, 
            `Reorg detected: stored hash ${event.blockHash} != current hash ${currentBlockData?.hash}`
          );
          
          // Update to pending for reprocessing if transaction still exists
          const receipt = await this.ethProvider.getTransactionReceipt(event.transactionHash);
          if (receipt) {
            relayPersistence.storeEvent({
              transactionHash: event.transactionHash,
              logIndex: event.logIndex,
              nonce: event.nonce,
              blockNumber: receipt.blockNumber,
              blockHash: receipt.blockHash,
              confirmationBlock: receipt.blockNumber + CONFIRMATIONS_ETH,
              status: 'pending'
            });
            console.log(`Event ${event.transactionHash} reset to pending after reorg`);
          }
        }
      }
    } catch (error) {
      console.error('Error checking for reorgs:', error);
    }
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