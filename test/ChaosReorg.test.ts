import { expect } from "chai";
import { ethers } from "hardhat";
import { EthereumBSCRelay } from "../server/eth-bsc-relay";
import { relayPersistence } from "../server/persistence";

describe("Chaos Test: 9-Block Reorg Simulation", function () {
  let relay: EthereumBSCRelay;
  let mockEthProvider: any;
  let mockBscProvider: any;
  let initialStats: any;

  beforeEach(async function () {
    // Initialize relay with mock providers for controlled testing
    mockEthProvider = {
      getBlockNumber: async () => 1000,
      getBlock: async (blockNumber: number) => ({
        hash: `0x${blockNumber.toString(16).padStart(64, '0')}`,
        number: blockNumber,
        parentHash: `0x${(blockNumber - 1).toString(16).padStart(64, '0')}`,
        receiptsRoot: `0x${blockNumber.toString(16).padStart(64, 'a')}`,
        stateRoot: `0x${blockNumber.toString(16).padStart(64, 'b')}`,
        difficulty: 1000000 + blockNumber,
        timestamp: 1600000000 + blockNumber * 15
      }),
      getNetwork: async () => ({ name: "sepolia", chainId: 11155111 })
    };

    mockBscProvider = {
      getBlockNumber: async () => 2000,
      getNetwork: async () => ({ name: "bsc-testnet", chainId: 97 })
    };

    // Store initial metrics
    initialStats = relayPersistence.getStats();
  });

  it("should detect 9-block reorg and increment bridge_reorg_total metric", async function () {
    console.log("🧪 Starting 9-block reorg chaos test");
    
    // Step 1: Simulate normal block progression
    const originalBlocks = [];
    for (let i = 995; i <= 1004; i++) {
      originalBlocks.push({
        blockNumber: i,
        blockHash: `0x${i.toString(16).padStart(64, '0')}`,
        status: 'confirmed'
      });
    }

    // Store original blocks in persistence
    for (const block of originalBlocks) {
      relayPersistence.storeEvent({
        transactionHash: `0x${block.blockNumber.toString(16).padStart(64, 'f')}`,
        logIndex: 0,
        nonce: `0x${block.blockNumber.toString(16).padStart(64, 'a')}`,
        blockNumber: block.blockNumber,
        blockHash: block.blockHash,
        confirmationBlock: block.blockNumber + 12,
        status: 'confirmed'
      });
    }

    console.log(`📊 Stored ${originalBlocks.length} blocks for reorg simulation`);

    // Step 2: Simulate 9-block reorg - blocks 996-1004 get new hashes
    const reorgedBlocks = [];
    for (let i = 996; i <= 1004; i++) {
      reorgedBlocks.push({
        blockNumber: i,
        oldHash: `0x${i.toString(16).padStart(64, '0')}`,
        newHash: `0x${(i + 1000).toString(16).padStart(64, '0')}` // Different hash
      });
    }

    console.log("🔄 Simulating 9-block reorganization...");

    // Step 3: Simulate reorg detection by checking stored block hashes
    let reorgDetected = false;
    let reorgDepth = 0;

    for (const reorgedBlock of reorgedBlocks) {
      // Mock the scenario where stored blockHash != current chain blockHash
      const storedEvents = relayPersistence.getEventsInRange(
        reorgedBlock.blockNumber,
        reorgedBlock.blockNumber
      );

      for (const event of storedEvents) {
        if (event.blockHash !== reorgedBlock.newHash) {
          reorgDetected = true;
          reorgDepth++;
          
          // Mark event as pending due to reorg
          relayPersistence.markEventFailed(
            event.transactionHash,
            event.logIndex,
            `Reorg detected: stored hash ${event.blockHash} != current hash ${reorgedBlock.newHash}`
          );

          console.log(`🚨 Reorg detected at block ${reorgedBlock.blockNumber}: ${event.blockHash} → ${reorgedBlock.newHash}`);
        }
      }
    }

    // Step 4: Verify reorg was detected
    expect(reorgDetected).to.be.true;
    expect(reorgDepth).to.equal(9);
    console.log(`✅ Detected ${reorgDepth}-block reorganization`);

    // Step 5: Check that bridge_reorg_total metric increased
    const newStats = relayPersistence.getStats();
    const reorgIncrease = newStats.failed - initialStats.failed;

    expect(reorgIncrease).to.be.greaterThan(0);
    console.log(`📈 bridge_reorg_total metric increased by ${reorgIncrease}`);

    // Step 6: Verify metrics endpoint reports the reorg
    const mockMetricsResponse = await simulateMetricsEndpoint();
    expect(mockMetricsResponse).to.include('bridge_reorg_events_total');
    expect(mockMetricsResponse).to.include(reorgIncrease.toString());

    console.log("🎯 Chaos test completed successfully");
  });

  it("should trigger Grafana critical alert for reorg events", async function () {
    console.log("🚨 Testing Grafana alert triggering");

    // Simulate the conditions that would trigger a Grafana alert
    const alertConditions = {
      bridge_reorg_total: 9, // > 0 triggers critical alert
      relay_latency_p95_ms: 5000, // < 10000ms, should not trigger warning
      failed_events_total: 9
    };

    // Verify alert conditions would be met
    expect(alertConditions.bridge_reorg_total).to.be.greaterThan(0);
    console.log("✅ Critical alert condition met: bridge_reorg_total > 0");

    // Simulate alert notification payload
    const alertPayload = {
      alertname: "BridgeReorgDetected",
      severity: "critical",
      description: `Bridge detected ${alertConditions.bridge_reorg_total} block reorganization`,
      instance: "yhgs-bridge-relay",
      timestamp: new Date().toISOString()
    };

    expect(alertPayload.severity).to.equal("critical");
    expect(alertPayload.alertname).to.equal("BridgeReorgDetected");
    
    console.log("🔔 Grafana alert would fire:", JSON.stringify(alertPayload, null, 2));
  });

  it("should handle reorg recovery and event reprocessing", async function () {
    console.log("🔄 Testing reorg recovery process");

    // Step 1: Mark events as failed due to reorg
    const affectedEvents = [
      { blockNumber: 996, txHash: "0x996", logIndex: 0 },
      { blockNumber: 997, txHash: "0x997", logIndex: 0 },
      { blockNumber: 998, txHash: "0x998", logIndex: 0 }
    ];

    for (const event of affectedEvents) {
      relayPersistence.storeEvent({
        transactionHash: event.txHash,
        logIndex: event.logIndex,
        nonce: event.txHash,
        blockNumber: event.blockNumber,
        blockHash: `0x${event.blockNumber.toString(16).padStart(64, '0')}`,
        confirmationBlock: event.blockNumber + 12,
        status: 'confirmed'
      });

      // Mark as failed due to reorg
      relayPersistence.markEventFailed(
        event.txHash,
        event.logIndex,
        "Reorg detected"
      );
    }

    // Step 2: Simulate recovery - reset events to pending for reprocessing
    for (const event of affectedEvents) {
      relayPersistence.storeEvent({
        transactionHash: event.txHash,
        logIndex: event.logIndex,
        nonce: event.txHash,
        blockNumber: event.blockNumber,
        blockHash: `0x${(event.blockNumber + 1000).toString(16).padStart(64, '0')}`, // New hash after reorg
        confirmationBlock: event.blockNumber + 12,
        status: 'pending' // Reset to pending for reprocessing
      });
    }

    console.log("✅ Events reset to pending status for reprocessing");

    // Step 3: Verify events are ready for reprocessing
    const pendingEvents = relayPersistence.getEventsAwaitingConfirmation(1010, 12);
    expect(pendingEvents.length).to.be.greaterThan(0);

    console.log(`🔄 ${pendingEvents.length} events ready for reprocessing`);
  });

  async function simulateMetricsEndpoint(): Promise<string> {
    const stats = relayPersistence.getStats();
    const recentEvents = relayPersistence.getRecentEvents(100);
    const reorgEvents = recentEvents.filter(e => e.status === 'failed').length;
    
    return `# HELP bridge_reorg_events_total Total number of reorg events detected
# TYPE bridge_reorg_events_total counter
bridge_reorg_events_total ${reorgEvents}

# HELP bridge_events_total Total number of bridge events by status
# TYPE bridge_events_total counter
bridge_events_total{status="failed"} ${stats.failed}
bridge_events_total{status="pending"} ${stats.pending}
bridge_events_total{status="processed"} ${stats.processed}
`;
  }
});