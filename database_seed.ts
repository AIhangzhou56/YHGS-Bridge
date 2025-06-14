// server/db/seed.ts - Database initialization and seed data
import { db } from './index.js';
import { 
  networks, 
  tokens, 
  tokenContracts, 
  validators, 
  bridgeConfig,
  liquidityPools 
} from './schema.js';

export async function initializeDatabase() {
  console.log('🔄 Initializing YHGS Bridge database...');
  
  try {
    // Clear existing data in development
    if (process.env.NODE_ENV === 'development') {
      console.log('🧹 Clearing existing data...');
      await db.delete(liquidityPools);
      await db.delete(tokenContracts);
      await db.delete(tokens);
      await db.delete(networks);
      await db.delete(validators);
      await db.delete(bridgeConfig);
    }

    // Insert networks
    console.log('🌐 Setting up networks...');
    const networkData = [
      {
        name: 'ethereum',
        chainId: 1,
        rpcUrl: process.env.ETHEREUM_RPC_URL || 'https://eth-mainnet.g.alchemy.com/v2/your-api-key',
        blockExplorer: 'https://etherscan.io',
        nativeCurrency: 'ETH',
        bridgeContract: process.env.ETHEREUM_BRIDGE_CONTRACT || '0x742d35Cc6634C0532925a3b8D451C3D6F5C8f0AA',
        isActive: true
      },
      {
        name: 'bsc',
        chainId: 56,
        rpcUrl: process.env.BSC_RPC_URL || 'https://bsc-dataseed1.binance.org',
        blockExplorer: 'https://bscscan.com',
        nativeCurrency: 'BNB',
        bridgeContract: process.env.BSC_BRIDGE_CONTRACT || '0x8f4bA9c2C9A3e6Fa8B5aB8B7A5F6D8e9C0B1A2C3',
        isActive: true
      },
      {
        name: 'polygon',
        chainId: 137,
        rpcUrl: process.env.POLYGON_RPC_URL || 'https://polygon-rpc.com',
        blockExplorer: 'https://polygonscan.com',
        nativeCurrency: 'MATIC',
        bridgeContract: process.env.POLYGON_BRIDGE_CONTRACT || '0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B',
        isActive: true
      },
      {
        name: 'arbitrum',
        chainId: 42161,
        rpcUrl: process.env.ARBITRUM_RPC_URL || 'https://arb1.arbitrum.io/rpc',
        blockExplorer: 'https://arbiscan.io',
        nativeCurrency: 'ETH',
        bridgeContract: process.env.ARBITRUM_BRIDGE_CONTRACT || '0x9f8E7B9A8b7C6d5e4F3a2B1c0D9e8F7a6B5c4D3e',
        isActive: true
      },
      {
        name: 'optimism',
        chainId: 10,
        rpcUrl: process.env.OPTIMISM_RPC_URL || 'https://mainnet.optimism.io',
        blockExplorer: 'https://optimistic.etherscan.io',
        nativeCurrency: 'ETH',
        bridgeContract: process.env.OPTIMISM_BRIDGE_CONTRACT || '0x2f3e4d5c6B7a8F9e0A1b2C3d4E5f6A7b8C9d0E1f',
        isActive: true
      }
    ];

    const insertedNetworks = await db.insert(networks).values(networkData).returning();
    console.log(`✅ Inserted ${insertedNetworks.length} networks`);

    // Insert tokens
    console.log('🪙 Setting up tokens...');
    const tokenData = [
      {
        symbol: 'YHGS',
        name: 'YHGS Token',
        decimals: 18,
        isNative: false,
        icon: 'https://example.com/yhgs-icon.png'
      },
      {
        symbol: 'USDT',
        name: 'Tether USD',
        decimals: 6,
        isNative: false,
        icon: 'https://example.com/usdt-icon.png'
      },
      {
        symbol: 'USDC',
        name: 'USD Coin',
        decimals: 6,
        isNative: false,
        icon: 'https://example.com/usdc-icon.png'
      },
      {
        symbol: 'ETH',
        name: 'Ethereum',
        decimals: 18,
        isNative: true,
        icon: 'https://example.com/eth-icon.png'
      },
      {
        symbol: 'BNB',
        name: 'Binance Coin',
        decimals: 18,
        isNative: true,
        icon: 'https://example.com/bnb-icon.png'
      },
      {
        symbol: 'MATIC',
        name: 'Polygon',
        decimals: 18,
        isNative: true,
        icon: 'https://example.com/matic-icon.png'
      }
    ];

    const insertedTokens = await db.insert(tokens).values(tokenData).returning();
    console.log(`✅ Inserted ${insertedTokens.length} tokens`);

    // Create mappings for easier access
    const networkMap = new Map(insertedNetworks.map(n => [n.name, n]));
    const tokenMap = new Map(insertedTokens.map(t => [t.symbol, t]));

    // Insert token contracts
    console.log('📄 Setting up token contracts...');
    const tokenContractData = [];

    // YHGS Token contracts (example addresses)
    const yhgsContracts = [
      { network: 'ethereum', address: '0x742d35Cc6634C0532925a3b8D451C3D6F5C8f0AA', isWrapped: false },
      { network: 'bsc', address: '0x8f4bA9c2C9A3e6Fa8B5aB8B7A5F6D8e9C0B1A2C3', isWrapped: true },
      { network: 'polygon', address: '0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B', isWrapped: true },
      { network: 'arbitrum', address: '0x9f8E7B9A8b7C6d5e4F3a2B1c0D9e8F7a6B5c4D3e', isWrapped: true },
      { network: 'optimism', address: '0x2f3e4d5c6B7a8F9e0A1b2C3d4E5f6A7b8C9d0E1f', isWrapped: true }
    ];

    // USDT contracts
    const usdtContracts = [
      { network: 'ethereum', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', isWrapped: false },
      { network: 'bsc', address: '0x55d398326f99059fF775485246999027B3197955', isWrapped: false },
      { network: 'polygon', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', isWrapped: false },
      { network: 'arbitrum', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', isWrapped: false },
      { network: 'optimism', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', isWrapped: false }
    ];

    // USDC contracts
    const usdcContracts = [
      { network: 'ethereum', address: '0xA0b86a33E6417c6b1b00442288c8dd8E8c3b7Ed4', isWrapped: false },
      { network: 'bsc', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', isWrapped: false },
      { network: 'polygon', address: '0x2791Bca1f2de4661ED88A30C99A7a9449Aa84174', isWrapped: false },
      { network: 'arbitrum', address: '0xFF970A61A04b1cA14834A43f5dE4533eBDDB5CC8', isWrapped: false },
      { network: 'optimism', address: '0x7F5c764cBc14f9669B88837ca1490cCa17c31607', isWrapped: false }
    ];

    // Native token contracts (null address for native tokens)
    const nativeContracts = [
      { network: 'ethereum', token: 'ETH', address: null },
      { network: 'bsc', token: 'BNB', address: null },
      { network: 'polygon', token: 'MATIC', address: null },
      { network: 'arbitrum', token: 'ETH', address: null },
      { network: 'optimism', token: 'ETH', address: null }
    ];

    // Add YHGS contracts
    for (const contract of yhgsContracts) {
      const network = networkMap.get(contract.network);
      const token = tokenMap.get('YHGS');
      if (network && token) {
        tokenContractData.push({
          tokenId: token.id,
          networkId: network.id,
          contractAddress: contract.address,
          isWrapped: contract.isWrapped,
          minBridgeAmount: '1000000000000000000', // 1 token
          maxBridgeAmount: '1000000000000000000000000', // 1M tokens
          bridgeFee: '100', // 1%
          isActive: true
        });
      }
    }

    // Add USDT contracts
    for (const contract of usdtContracts) {
      const network = networkMap.get(contract.network);
      const token = tokenMap.get('USDT');
      if (network && token) {
        tokenContractData.push({
          tokenId: token.id,
          networkId: network.id,
          contractAddress: contract.address,
          isWrapped: contract.isWrapped,
          minBridgeAmount: '1000000', // 1 USDT
          maxBridgeAmount: '100000000000', // 100k USDT
          bridgeFee: '50', // 0.5%
          isActive: true
        });
      }
    }

    // Add USDC contracts
    for (const contract of usdcContracts) {
      const network = networkMap.get(contract.network);
      const token = tokenMap.get('USDC');
      if (network && token) {
        tokenContractData.push({
          tokenId: token.id,
          networkId: network.id,
          contractAddress: contract.address,
          isWrapped: contract.isWrapped,
          minBridgeAmount: '1000000', // 1 USDC
          maxBridgeAmount: '100000000000', // 100k USDC
          bridgeFee: '50', // 0.5%
          isActive: true
        });
      }
    }

    // Add native token contracts
    for (const contract of nativeContracts) {
      const network = networkMap.get(contract.network);
      const token = tokenMap.get(contract.token);
      if (network && token) {
        tokenContractData.push({
          tokenId: token.id,
          networkId: network.id,
          contractAddress: contract.address,
          isWrapped: false,
          minBridgeAmount: '10000000000000000', // 0.01 ETH/BNB/MATIC
          maxBridgeAmount: '10000000000000000000000', // 10k ETH/BNB/MATIC
          bridgeFee: '100', // 1%
          isActive: true
        });
      }
    }

    const insertedContracts = await db.insert(tokenContracts).values(tokenContractData).returning();
    console.log(`✅ Inserted ${insertedContracts.length} token contracts`);

    // Insert validators
    console.log('👥 Setting up validators...');
    const validatorData = [
      {
        address: process.env.VALIDATOR_1_ADDRESS || '0x742d35Cc6634C0532925a3b8D451C3D6F5C8f0AA',
        name: 'YHGS Validator 1',
        isActive: true,
        stake: '100000000000000000000000' // 100k tokens
      },
      {
        address: process.env.VALIDATOR_2_ADDRESS || '0x8f4bA9c2C9A3e6Fa8B5aB8B7A5F6D8e9C0B1A2C3',
        name: 'YHGS Validator 2',
        isActive: true,
        stake: '100000000000000000000000'
      },
      {
        address: process.env.VALIDATOR_3_ADDRESS || '0x1a2B3c4D5e6F7a8B9c0D1e2F3a4B5c6D7e8F9a0B',
        name: 'YHGS Validator 3',
        isActive: true,
        stake: '100000000000000000000000'
      }
    ];

    const insertedValidators = await db.insert(validators).values(validatorData).returning();
    console.log(`✅ Inserted ${insertedValidators.length} validators`);

    // Insert bridge configuration
    console.log('⚙️ Setting up bridge configuration...');
    const configData = [
      {
        key: 'BRIDGE_FEE_BASIS_POINTS',
        value: '100',
        description: 'Default bridge fee in basis points (100 = 1%)'
      },
      {
        key: 'MIN_VALIDATORS_REQUIRED',
        value: '2',
        description: 'Minimum number of validator signatures required'
      },
      {
        key: 'BRIDGE_ENABLED',
        value: 'true',
        description: 'Whether the bridge is currently enabled'
      },
      {
        key: 'MAINTENANCE_MODE',
        value: 'false',
        description: 'Whether the bridge is in maintenance mode'
      },
      {
        key: 'MAX_DAILY_VOLUME',
        value: '1000000000000000000000000',
        description: 'Maximum daily bridge volume in wei (1M tokens)'
      }
    ];

    const insertedConfig = await db.insert(bridgeConfig).values(configData).returning();
    console.log(`✅ Inserted ${insertedConfig.length} configuration entries`);

    // Initialize liquidity pools
    console.log('💧 Setting up liquidity pools...');
    const liquidityData = [];

    for (const contract of insertedContracts) {
      liquidityData.push({
        networkId: contract.networkId,
        tokenId: contract.tokenId,
        totalLiquidity: '1000000000000000000000000', // 1M tokens initial liquidity
        availableLiquidity: '1000000000000000000000000',
        lockedLiquidity: '0'
      });
    }

    const insertedLiquidity = await db.insert(liquidityPools).values(liquidityData).returning();
    console.log(`✅ Inserted ${insertedLiquidity.length} liquidity pools`);

    console.log('🎉 Database initialization completed successfully!');
    
    return {
      networks: insertedNetworks.length,
      tokens: insertedTokens.length,
      contracts: insertedContracts.length,
      validators: insertedValidators.length,
      config: insertedConfig.length,
      liquidity: insertedLiquidity.length
    };

  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    throw error;
  }
}