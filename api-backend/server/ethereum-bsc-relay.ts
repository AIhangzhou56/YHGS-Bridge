import { ethers } from 'ethers';

interface LockEvent {
  token: string;
  sender: string;
  amount: string;
  targetChain: string;
  targetAddr: string;
  nonce: string;
  blockNumber: number;
  transactionHash: string;
  blockHash: string;
  logIndex: number;
}

interface RelayConfig {
  ethereumRpc: string;
  bscRpc: string;
  ethereumPrivateKey: string;
  bscPrivateKey: string;
  bridgeContractEth: string;
  bridgeContractBsc: string;
  startBlock?: number;
}

export class EthereumBSCRelay {
  private ethProvider: ethers.JsonRpcProvider;
  private bscProvider: ethers.JsonRpcProvider;
  private ethSigner: ethers.Wallet;
  private bscSigner: ethers.Wallet;
  private ethBridgeContract: ethers.Contract;
  private bscBridgeContract: ethers.Contract;
  private processedEvents: Set<string> = new Set();

  // Bridge contract ABI - focusing on the Locked event and mint function
  private readonly BRIDGE_ABI = [
    // Events
    "event Locked(address indexed token, address indexed sender, uint256 amount, string targetChain, string targetAddr, bytes32 indexed nonce)",
    
    // Functions for BSC contract
    "function mint(address token, address to, uint256 amount, bytes32 nonce, bytes memory proof) external",
    "function isNonceUsed(bytes32 nonce) external view returns (bool)",
    
    // Functions for verification
    "function verifyLockProof(bytes32 blockHash, bytes memory proof, bytes memory eventData) external pure returns (bool)"
  ];

  constructor(config: RelayConfig) {
    // Initialize providers
    this.ethProvider = new ethers.JsonRpcProvider(config.ethereumRpc);
    this.bscProvider = new ethers.JsonRpcProvider(config.bscRpc);

    // Initialize signers
    this.ethSigner = new ethers.Wallet(config.ethereumPrivateKey, this.ethProvider);
    this.bscSigner = new ethers.Wallet(config.bscPrivateKey, this.bscProvider);

    // Initialize contracts
    this.ethBridgeContract = new ethers.Contract(
      config.bridgeContractEth,
      this.BRIDGE_ABI,
      this.ethSigner
    );

    this.bscBridgeContract = new ethers.Contract(
      config.bridgeContractBsc,
      this.BRIDGE_ABI,
      this.bscSigner
    );

    console.log('Ethereum-BSC Relay initialized');
    console.log(`Ethereum Bridge: ${config.bridgeContractEth}`);
    console.log(`BSC Bridge: ${config.bridgeContractBsc}`);
  }

  // Start listening for lock events on Ethereum
  async startRelay(): Promise<void> {
    console.log('Starting Ethereum-BSC relay service...');

    // Listen for new lock events
    this.ethBridgeContract.on('Locked', async (
      token: string,
      sender: string,
      amount: ethers.BigNumberish,
      targetChain: string,
      targetAddr: string,
      nonce: string,
      event: ethers.Log
    ) => {
      try {
        const lockEvent: LockEvent = {
          token,
          sender,
          amount: amount.toString(),
          targetChain,
          targetAddr,
          nonce,
          blockNumber: event.blockNumber,
          transactionHash: event.transactionHash,
          blockHash: event.blockHash,
          logIndex: event.index
        };

        console.log(`New lock event detected: ${event.transactionHash}`);
        await this.processLockEvent(lockEvent);
      } catch (error) {
        console.error('Error processing lock event:', error);
      }
    });

    // Also process historical events (optional)
    await this.processHistoricalEvents();

    console.log('Relay service is now listening for lock events...');
  }

  // Process historical events from a specific block
  private async processHistoricalEvents(fromBlock: number = -1000): Promise<void> {
    try {
      console.log(`Fetching historical events from block ${fromBlock}...`);
      
      const filter = this.ethBridgeContract.filters.Locked();
      const events = await this.ethBridgeContract.queryFilter(filter, fromBlock);

      console.log(`Found ${events.length} historical lock events`);

      for (const event of events) {
        const parsedEvent = this.ethBridgeContract.interface.parseLog({
          topics: event.topics,
          data: event.data
        });

        if (parsedEvent) {
          const lockEvent: LockEvent = {
            token: parsedEvent.args.token,
            sender: parsedEvent.args.sender,
            amount: parsedEvent.args.amount.toString(),
            targetChain: parsedEvent.args.targetChain,
            targetAddr: parsedEvent.args.targetAddr,
            nonce: parsedEvent.args.nonce,
            blockNumber: event.blockNumber,
            transactionHash: event.transactionHash,
            blockHash: event.blockHash,
            logIndex: event.index
          };

          await this.processLockEvent(lockEvent);
        }
      }
    } catch (error) {
      console.error('Error processing historical events:', error);
    }
  }

  // Process a lock event and relay to BSC
  private async processLockEvent(lockEvent: LockEvent): Promise<void> {
    const eventId = `${lockEvent.transactionHash}-${lockEvent.logIndex}`;
    
    // Skip if already processed
    if (this.processedEvents.has(eventId)) {
      console.log(`Event ${eventId} already processed, skipping`);
      return;
    }

    try {
      console.log(`Processing lock event: ${JSON.stringify(lockEvent, null, 2)}`);

      // Check if this is targeting BSC
      if (lockEvent.targetChain.toLowerCase() !== 'bsc') {
        console.log(`Event targets ${lockEvent.targetChain}, not BSC. Skipping.`);
        return;
      }

      // Check if nonce is already used on BSC
      const nonceUsed = await this.bscBridgeContract.isNonceUsed(lockEvent.nonce);
      if (nonceUsed) {
        console.log(`Nonce ${lockEvent.nonce} already used on BSC, skipping`);
        this.processedEvents.add(eventId);
        return;
      }

      // Generate proof of the lock event
      const proof = await this.generateLockProof(lockEvent);

      // Submit mint transaction to BSC
      await this.submitMintToBSC(lockEvent, proof);

      // Mark as processed
      this.processedEvents.add(eventId);
      console.log(`Successfully processed and relayed event ${eventId}`);

    } catch (error) {
      console.error(`Error processing lock event ${eventId}:`, error);
    }
  }

  // Generate cryptographic proof of the lock event
  private async generateLockProof(lockEvent: LockEvent): Promise<string> {
    try {
      // Get the transaction receipt for the lock event
      const receipt = await this.ethProvider.getTransactionReceipt(lockEvent.transactionHash);
      if (!receipt) {
        throw new Error('Transaction receipt not found');
      }

      // Get the block for additional verification
      const block = await this.ethProvider.getBlock(lockEvent.blockNumber);
      if (!block) {
        throw new Error('Block not found');
      }

      // Find the specific log for our event
      const eventLog = receipt.logs.find(log => 
        log.address.toLowerCase() === this.ethBridgeContract.target.toString().toLowerCase() &&
        log.index === lockEvent.logIndex
      );

      if (!eventLog) {
        throw new Error('Event log not found in transaction receipt');
      }

      // Create proof structure
      const proofData = {
        blockHash: block.hash,
        blockNumber: block.number,
        transactionHash: lockEvent.transactionHash,
        transactionIndex: receipt.index,
        logIndex: lockEvent.logIndex,
        eventData: {
          token: lockEvent.token,
          sender: lockEvent.sender,
          amount: lockEvent.amount,
          targetChain: lockEvent.targetChain,
          targetAddr: lockEvent.targetAddr,
          nonce: lockEvent.nonce
        },
        signatures: {
          blockHash: block.hash,
          stateRoot: block.stateRoot,
          receiptsRoot: block.receiptsRoot
        }
      };

      // Encode the proof data
      const encodedProof = ethers.AbiCoder.defaultAbiCoder().encode(
        ['tuple(bytes32 blockHash, uint256 blockNumber, bytes32 transactionHash, uint256 transactionIndex, uint256 logIndex, tuple(address token, address sender, uint256 amount, string targetChain, string targetAddr, bytes32 nonce) eventData, tuple(bytes32 blockHash, bytes32 stateRoot, bytes32 receiptsRoot) signatures)'],
        [proofData]
      );

      console.log(`Generated proof for event ${lockEvent.transactionHash}`);
      return encodedProof;

    } catch (error) {
      console.error('Error generating proof:', error);
      throw error;
    }
  }

  // Submit mint transaction to BSC
  private async submitMintToBSC(lockEvent: LockEvent, proof: string): Promise<void> {
    try {
      console.log(`Submitting mint to BSC for ${lockEvent.amount} tokens...`);

      // Estimate gas for the mint transaction
      const gasEstimate = await this.bscBridgeContract.mint.estimateGas(
        lockEvent.token,
        lockEvent.targetAddr,
        lockEvent.amount,
        lockEvent.nonce,
        proof
      );

      // Add 20% buffer to gas estimate
      const gasLimit = (gasEstimate * BigInt(120)) / BigInt(100);

      // Submit the mint transaction
      const mintTx = await this.bscBridgeContract.mint(
        lockEvent.token,
        lockEvent.targetAddr,
        lockEvent.amount,
        lockEvent.nonce,
        proof,
        { gasLimit }
      );

      console.log(`Mint transaction submitted: ${mintTx.hash}`);

      // Wait for confirmation
      const receipt = await mintTx.wait();
      
      if (receipt.status === 1) {
        console.log(`Mint transaction confirmed on BSC: ${mintTx.hash}`);
        console.log(`Gas used: ${receipt.gasUsed.toString()}`);
      } else {
        throw new Error('Mint transaction failed');
      }

    } catch (error) {
      console.error('Error submitting mint to BSC:', error);
      throw error;
    }
  }

  // Get relay status and statistics
  async getRelayStatus(): Promise<{
    isListening: boolean;
    processedEvents: number;
    lastBlock: number;
    ethereumNetwork: string;
    bscNetwork: string;
  }> {
    try {
      const [ethNetwork, bscNetwork, ethBlock, bscBlock] = await Promise.all([
        this.ethProvider.getNetwork(),
        this.bscProvider.getNetwork(),
        this.ethProvider.getBlockNumber(),
        this.bscProvider.getBlockNumber()
      ]);

      return {
        isListening: true,
        processedEvents: this.processedEvents.size,
        lastBlock: ethBlock,
        ethereumNetwork: ethNetwork.name,
        bscNetwork: bscNetwork.name
      };
    } catch (error) {
      console.error('Error getting relay status:', error);
      return {
        isListening: false,
        processedEvents: this.processedEvents.size,
        lastBlock: 0,
        ethereumNetwork: 'unknown',
        bscNetwork: 'unknown'
      };
    }
  }

  // Stop the relay service
  async stop(): Promise<void> {
    try {
      this.ethBridgeContract.removeAllListeners();
      console.log('Relay service stopped');
    } catch (error) {
      console.error('Error stopping relay service:', error);
    }
  }
}

// Initialize and start the relay service
export async function startEthereumBSCRelay(): Promise<EthereumBSCRelay> {
  const config: RelayConfig = {
    ethereumRpc: process.env.ETHEREUM_RPC || 'https://sepolia.infura.io/v3/' + process.env.INFURA_API_KEY,
    bscRpc: process.env.BSC_TESTNET_RPC || 'https://data-seed-prebsc-1-s1.binance.org:8545/',
    ethereumPrivateKey: process.env.ETHEREUM_PRIVATE_KEY || '',
    bscPrivateKey: process.env.BSC_PRIVATE_KEY || '',
    bridgeContractEth: process.env.ETHEREUM_BRIDGE_CONTRACT || '0x1234567890123456789012345678901234567890',
    bridgeContractBsc: process.env.BSC_BRIDGE_CONTRACT || '0x2345678901234567890123456789012345678901'
  };

  const relay = new EthereumBSCRelay(config);
  await relay.startRelay();
  
  return relay;
}