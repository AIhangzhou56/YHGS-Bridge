import type { Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertWalletSchema, insertTransactionSchema } from "@shared/schema";
import { z } from "zod";

export async function registerRoutes(app: Express): Promise<Server> {
  // Wallet routes
  app.post("/api/wallet/connect", async (req, res) => {
    try {
      const { address, chain } = req.body;
      
      // Check if wallet already exists
      let wallet = await storage.getWalletByAddress(address);
      
      if (!wallet) {
        // Create new wallet
        wallet = await storage.createWallet({
          userId: null,
          address,
          chain,
          isConnected: true
        });
      } else {
        // Update connection status
        await storage.updateWalletConnection(wallet.id, true);
        wallet.isConnected = true;
      }

      res.json({ wallet });
    } catch (error) {
      res.status(500).json({ error: "Failed to connect wallet" });
    }
  });

  app.post("/api/wallet/disconnect", async (req, res) => {
    try {
      const { address } = req.body;
      const wallet = await storage.getWalletByAddress(address);
      
      if (wallet) {
        await storage.updateWalletConnection(wallet.id, false);
      }

      res.json({ success: true });
    } catch (error) {
      res.status(500).json({ error: "Failed to disconnect wallet" });
    }
  });

  app.get("/api/wallet/:address/balances", async (req, res) => {
    try {
      const { address } = req.params;
      const wallet = await storage.getWalletByAddress(address);
      
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      const balances = await storage.getWalletBalances(wallet.id);
      res.json({ balances });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch balances" });
    }
  });

  // Token routes
  app.get("/api/tokens", async (req, res) => {
    try {
      const tokens = await storage.getAllTokens();
      res.json({ tokens });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tokens" });
    }
  });

  app.post("/api/tokens/prices/update", async (req, res) => {
    try {
      // Simulate price updates with small variations
      const tokens = await storage.getAllTokens();
      
      for (const token of tokens) {
        const currentPrice = parseFloat(token.price);
        const variation = (Math.random() - 0.5) * 0.02; // ±1% variation
        const newPrice = currentPrice * (1 + variation);
        const newChange = parseFloat(token.change24h) + variation * 100;
        
        await storage.updateTokenPrice(
          token.id, 
          newPrice.toFixed(token.symbol === 'USDC' ? 4 : 2),
          newChange.toFixed(2)
        );
      }

      const updatedTokens = await storage.getAllTokens();
      res.json({ tokens: updatedTokens });
    } catch (error) {
      res.status(500).json({ error: "Failed to update prices" });
    }
  });

  // Bridge routes
  app.get("/api/bridge/rates", async (req, res) => {
    try {
      const rates = await storage.getAllBridgeRates();
      res.json({ rates });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bridge rates" });
    }
  });

  app.get("/api/bridge/rate/:fromChain/:toChain", async (req, res) => {
    try {
      const { fromChain, toChain } = req.params;
      const rate = await storage.getBridgeRate(fromChain, toChain);
      
      if (!rate) {
        return res.status(404).json({ error: "Bridge rate not found" });
      }

      res.json({ rate });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch bridge rate" });
    }
  });

  app.post("/api/bridge/transaction", async (req, res) => {
    try {
      const transactionData = insertTransactionSchema.parse(req.body);
      
      // Create pending transaction
      const transaction = await storage.createTransaction({
        ...transactionData,
        status: "pending"
      });

      // Simulate transaction processing
      setTimeout(async () => {
        const txHash = `0x${Math.random().toString(16).substr(2, 40)}`;
        const amount = parseFloat(transactionData.amount);
        const bridgeRate = await storage.getBridgeRate(transactionData.fromChain, transactionData.toChain);
        const fee = bridgeRate ? parseFloat(bridgeRate.fee) / 100 : 0.001;
        const receivedAmount = (amount * (1 - fee)).toFixed(8);
        
        await storage.updateTransactionStatus(
          transaction.id, 
          "completed", 
          txHash, 
          receivedAmount
        );
      }, 5000); // 5 second delay to simulate processing

      res.json({ transaction });
    } catch (error) {
      if (error instanceof z.ZodError) {
        return res.status(400).json({ error: "Invalid transaction data", details: error.errors });
      }
      res.status(500).json({ error: "Failed to create bridge transaction" });
    }
  });

  // Transaction routes
  app.get("/api/transactions/:walletAddress", async (req, res) => {
    try {
      const { walletAddress } = req.params;
      const wallet = await storage.getWalletByAddress(walletAddress);
      
      if (!wallet) {
        return res.status(404).json({ error: "Wallet not found" });
      }

      const transactions = await storage.getWalletTransactions(wallet.id);
      res.json({ transactions });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transactions" });
    }
  });

  app.get("/api/transaction/:id", async (req, res) => {
    try {
      const { id } = req.params;
      const transactions = await storage.getWalletTransactions(parseInt(id));
      const transaction = transactions.find(tx => tx.id === parseInt(id));
      
      if (!transaction) {
        return res.status(404).json({ error: "Transaction not found" });
      }

      res.json({ transaction });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transaction" });
    }
  });

  // Market stats
  app.get("/api/stats", async (req, res) => {
    try {
      // Mock market statistics
      const stats = {
        totalVolume: "127500000", // $127.5M
        bridgeTransactions: 8432,
        activeChains: 12,
        tvl: "2400000000" // $2.4B
      };

      res.json({ stats });
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch stats" });
    }
  });

  // Testnet bridge endpoints
  app.get("/api/testnet/:action", async (req, res) => {
    const { handleTestnetBridge } = await import('./testnet-bridge');
    await handleTestnetBridge(req, res);
  });

  app.post("/api/testnet/:action", async (req, res) => {
    const { handleTestnetBridge } = await import('./testnet-bridge');
    await handleTestnetBridge(req, res);
  });

  // BSC Mirror Bridge endpoints
  app.post("/api/bridge/lock-erc20", async (req, res) => {
    try {
      const { tokenAddress, amount, userAddress } = req.body;
      
      if (!tokenAddress || !amount || !userAddress) {
        return res.status(400).json({ error: "Missing required parameters" });
      }

      const { bscMirrorBridge } = await import('./bsc-mirror-bridge');
      
      // Get mirror token info
      const mirrorInfo = await bscMirrorBridge.getMirrorTokenInfo(tokenAddress);
      
      // Estimate fees
      const fees = await bscMirrorBridge.estimateBridgeFee(tokenAddress, amount);
      
      res.json({
        success: true,
        mirrorToken: mirrorInfo,
        fees,
        message: "Ready to lock ERC-20 and mint mirror token on BSC"
      });
    } catch (error) {
      console.error('Lock ERC-20 error:', error);
      res.status(500).json({ error: "Failed to process lock request" });
    }
  });

  app.get("/api/bridge/mirror-token/:originalToken", async (req, res) => {
    try {
      const { originalToken } = req.params;
      const { bscMirrorBridge } = await import('./bsc-mirror-bridge');
      
      const mirrorInfo = await bscMirrorBridge.getMirrorTokenInfo(originalToken);
      
      if (!mirrorInfo) {
        return res.status(404).json({ error: "Mirror token not found" });
      }
      
      res.json({ mirrorToken: mirrorInfo });
    } catch (error) {
      console.error('Get mirror token error:', error);
      res.status(500).json({ error: "Failed to get mirror token info" });
    }
  });

  app.post("/api/bridge/estimate-mirror-fee", async (req, res) => {
    try {
      const { tokenAddress, amount } = req.body;
      const { bscMirrorBridge } = await import('./bsc-mirror-bridge');
      
      const fees = await bscMirrorBridge.estimateBridgeFee(tokenAddress, amount);
      res.json({ fees });
    } catch (error) {
      console.error('Estimate fee error:', error);
      res.status(500).json({ error: "Failed to estimate fees" });
    }
  });

  // Ethereum-BSC Relay endpoints
  app.get("/api/relay/status", async (req, res) => {
    try {
      const { ethereumBSCRelay } = await import('./eth-bsc-relay');
      const status = await ethereumBSCRelay.getRelayStatus();
      res.json({ success: true, status });
    } catch (error) {
      console.error('Relay status error:', error);
      res.status(500).json({ error: "Failed to get relay status" });
    }
  });

  app.post("/api/relay/start", async (req, res) => {
    try {
      const { ethereumBSCRelay } = await import('./eth-bsc-relay');
      await ethereumBSCRelay.start();
      res.json({ success: true, message: "Relay service started" });
    } catch (error) {
      console.error('Relay start error:', error);
      res.status(500).json({ error: "Failed to start relay service" });
    }
  });

  app.post("/api/relay/stop", async (req, res) => {
    try {
      const { ethereumBSCRelay } = await import('./eth-bsc-relay');
      ethereumBSCRelay.stop();
      res.json({ success: true, message: "Relay service stopped" });
    } catch (error) {
      console.error('Relay stop error:', error);
      res.status(500).json({ error: "Failed to stop relay service" });
    }
  });

  app.get("/api/relay/test-connections", async (req, res) => {
    try {
      const { ethereumBSCRelay } = await import('./eth-bsc-relay');
      const connected = await ethereumBSCRelay.testConnections();
      res.json({ success: true, connected });
    } catch (error) {
      console.error('Connection test error:', error);
      res.status(500).json({ error: "Failed to test connections" });
    }
  });

  app.get("/api/relay/events", async (req, res) => {
    try {
      const { relayPersistence } = await import('./persistence');
      const limit = parseInt(req.query.limit as string) || 50;
      const events = relayPersistence.getRecentEvents(Math.min(limit, 100));
      res.json({ success: true, events });
    } catch (error) {
      console.error('Get events error:', error);
      res.status(500).json({ error: "Failed to retrieve events" });
    }
  });

  app.get("/api/relay/stats", async (req, res) => {
    try {
      const { relayPersistence } = await import('./persistence');
      const stats = relayPersistence.getStats();
      res.json({ success: true, stats });
    } catch (error) {
      console.error('Get stats error:', error);
      res.status(500).json({ error: "Failed to retrieve statistics" });
    }
  });

  app.post("/api/relay/cleanup", async (req, res) => {
    try {
      const { relayPersistence } = await import('./persistence');
      const { days = 30 } = req.body;
      const cleaned = relayPersistence.cleanupOldEvents(days);
      res.json({ success: true, cleanedEvents: cleaned });
    } catch (error) {
      console.error('Cleanup error:', error);
      res.status(500).json({ error: "Failed to cleanup old events" });
    }
  });

  // Prometheus metrics endpoint
  app.get("/metrics", async (req, res) => {
    try {
      const { relayPersistence } = await import('./persistence');
      const stats = relayPersistence.getStats();
      
      // Get relay status if available
      let relayStatus;
      try {
        const { ethereumBSCRelay } = await import('./eth-bsc-relay');
        relayStatus = await ethereumBSCRelay.getRelayStatus();
      } catch {
        relayStatus = { isRunning: false, processedEvents: 0, ethereumBlock: 0, bscBlock: 0 };
      }

      const metrics = `# HELP bridge_events_total Total number of bridge events by status
# TYPE bridge_events_total counter
bridge_events_total{status="pending"} ${stats.pending}
bridge_events_total{status="confirmed"} ${stats.confirmed}
bridge_events_total{status="processed"} ${stats.processed}
bridge_events_total{status="failed"} ${stats.failed}

# HELP bridge_relay_running Whether the relay service is running
# TYPE bridge_relay_running gauge
bridge_relay_running ${relayStatus.isRunning ? 1 : 0}

# HELP bridge_ethereum_block_height Latest Ethereum block height
# TYPE bridge_ethereum_block_height gauge
bridge_ethereum_block_height ${relayStatus.ethereumBlock}

# HELP bridge_bsc_block_height Latest BSC block height
# TYPE bridge_bsc_block_height gauge
bridge_bsc_block_height ${relayStatus.bscBlock}

# HELP bridge_last_processed_block Last fully processed Ethereum block
# TYPE bridge_last_processed_block gauge
bridge_last_processed_block ${stats.lastProcessedBlock}

# HELP bridge_total_events Total events in database
# TYPE bridge_total_events gauge
bridge_total_events ${stats.total}
`;

      res.set('Content-Type', 'text/plain');
      res.send(metrics);
    } catch (error) {
      console.error('Metrics error:', error);
      res.status(500).send('# Error generating metrics\n');
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}
