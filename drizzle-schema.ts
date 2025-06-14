// drizzle/schema.ts
import {
  pgTable,
  serial,
  text,
  integer,
  numeric,
  timestamp,
  boolean,
  varchar,
  index,
  uniqueIndex,
  json,
  bigint,
  primaryKey,
} from 'drizzle-orm/pg-core';
import { relations } from 'drizzle-orm';

// Networks table - stores supported blockchain networks
export const networks = pgTable('networks', {
  id: serial('id').primaryKey(),
  name: varchar('name', { length: 50 }).notNull().unique(),
  chainId: integer('chain_id').notNull().unique(),
  rpcUrl: text('rpc_url').notNull(),
  blockExplorer: text('block_explorer').notNull(),
  nativeCurrency: varchar('native_currency', { length: 10 }).notNull(),
  bridgeContract: varchar('bridge_contract', { length: 42 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  avgBlockTime: integer('avg_block_time').default(15), // seconds
  confirmations: integer('confirmations').default(12),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    chainIdIdx: index('idx_networks_chain_id').on(table.chainId),
    activeIdx: index('idx_networks_active').on(table.isActive),
  };
});

// Tokens table - stores supported tokens
export const tokens = pgTable('tokens', {
  id: serial('id').primaryKey(),
  symbol: varchar('symbol', { length: 20 }).notNull().unique(),
  name: varchar('name', { length: 100 }).notNull(),
  decimals: integer('decimals').notNull(),
  isNative: boolean('is_native').default(false).notNull(),
  icon: text('icon'),
  coingeckoId: varchar('coingecko_id', { length: 100 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    symbolIdx: index('idx_tokens_symbol').on(table.symbol),
  };
});

// Token contracts table - maps tokens to specific networks
export const tokenContracts = pgTable('token_contracts', {
  id: serial('id').primaryKey(),
  tokenId: integer('token_id').notNull().references(() => tokens.id),
  networkId: integer('network_id').notNull().references(() => networks.id),
  contractAddress: varchar('contract_address', { length: 42 }),
  isWrapped: boolean('is_wrapped').default(false).notNull(),
  minBridgeAmount: numeric('min_bridge_amount', { precision: 28, scale: 18 }).notNull(),
  maxBridgeAmount: numeric('max_bridge_amount', { precision: 28, scale: 18 }).notNull(),
  dailyLimit: numeric('daily_limit', { precision: 28, scale: 18 }).notNull(),
  bridgeFee: integer('bridge_fee').notNull(), // basis points
  isActive: boolean('is_active').default(true).notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    tokenNetworkUnique: uniqueIndex('idx_token_network_unique').on(table.tokenId, table.networkId),
    addressIdx: index('idx_token_contracts_address').on(table.contractAddress),
    activeIdx: index('idx_token_contracts_active').on(table.isActive),
  };
});

// Validators table - stores validator information
export const validators = pgTable('validators', {
  id: serial('id').primaryKey(),
  address: varchar('address', { length: 42 }).notNull().unique(),
  blsPubKey: text('bls_pub_key').notNull().unique(),
  name: varchar('name', { length: 100 }),
  stake: numeric('stake', { precision: 28, scale: 18 }).notNull(),
  isActive: boolean('is_active').default(true).notNull(),
  isJailed: boolean('is_jailed').default(false).notNull(),
  jailedUntil: timestamp('jailed_until'),
  lastHeartbeat: timestamp('last_heartbeat').defaultNow().notNull(),
  missedHeartbeats: integer('missed_heartbeats').default(0).notNull(),
  performanceScore: integer('performance_score').default(10000).notNull(), // basis points
  totalSlashed: numeric('total_slashed', { precision: 28, scale: 18 }).default('0').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    addressIdx: index('idx_validators_address').on(table.address),
    activeIdx: index('idx_validators_active').on(table.isActive),
    performanceIdx: index('idx_validators_performance').on(table.performanceScore),
  };
});

// Bridge transactions table - main transaction records
export const bridgeTransactions = pgTable('bridge_transactions', {
  id: serial('id').primaryKey(),
  txHash: varchar('tx_hash', { length: 66 }).notNull().unique(),
  srcChain: integer('src_chain').notNull().references(() => networks.chainId),
  dstChain: integer('dst_chain').notNull().references(() => networks.chainId),
  srcTxHash: varchar('src_tx_hash', { length: 66 }).notNull(),
  dstTxHash: varchar('dst_tx_hash', { length: 66 }),
  token: varchar('token', { length: 42 }).notNull(),
  amount: numeric('amount', { precision: 28, scale: 18 }).notNull(),
  fee: numeric('fee', { precision: 28, scale: 18 }).notNull(),
  sender: varchar('sender', { length: 42 }).notNull(),
  recipient: varchar('recipient', { length: 42 }).notNull(),
  status: varchar('status', { length: 20 }).notNull().default('pending'),
  nonce: bigint('nonce', { mode: 'bigint' }),
  requiredSignatures: integer('required_signatures').notNull(),
  receivedSignatures: integer('received_signatures').default(0).notNull(),
  errorMessage: text('error_message'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (table) => {
  return {
    statusIdx: index('idx_bridge_tx_status').on(table.status),
    chainIdx: index('idx_bridge_tx_chains').on(table.srcChain, table.dstChain),
    senderIdx: index('idx_bridge_tx_sender').on(table.sender),
    recipientIdx: index('idx_bridge_tx_recipient').on(table.recipient),
    createdAtIdx: index('idx_bridge_tx_created').on(table.createdAt),
    compositeIdx: index('idx_bridge_tx_composite').on(table.srcChain, table.dstChain, table.status),
  };
});

// Validator signatures table - tracks validator signatures for transactions
export const validatorSignatures = pgTable('validator_signatures', {
  id: serial('id').primaryKey(),
  txHash: varchar('tx_hash', { length: 66 }).notNull().references(() => bridgeTransactions.txHash),
  validatorId: integer('validator_id').notNull().references(() => validators.id),
  signature: text('signature').notNull(),
  signedAt: timestamp('signed_at').defaultNow().notNull(),
}, (table) => {
  return {
    txValidatorUnique: uniqueIndex('idx_tx_validator_unique').on(table.txHash, table.validatorId),
    txHashIdx: index('idx_signatures_tx_hash').on(table.txHash),
  };
});

// Liquidity pools table - tracks liquidity on each network
export const liquidityPools = pgTable('liquidity_pools', {
  id: serial('id').primaryKey(),
  networkId: integer('network_id').notNull().references(() => networks.id),
  tokenId: integer('token_id').notNull().references(() => tokens.id),
  totalLiquidity: numeric('total_liquidity', { precision: 28, scale: 18 }).notNull(),
  availableLiquidity: numeric('available_liquidity', { precision: 28, scale: 18 }).notNull(),
  lockedLiquidity: numeric('locked_liquidity', { precision: 28, scale: 18 }).notNull(),
  utilization: numeric('utilization', { precision: 5, scale: 2 }).notNull().default('0'),
  apy: numeric('apy', { precision: 5, scale: 2 }).default('0'),
  lastRebalance: timestamp('last_rebalance'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (table) => {
  return {
    networkTokenUnique: uniqueIndex('idx_liquidity_network_token').on(table.networkId, table.tokenId),
    utilizationIdx: index('idx_liquidity_utilization').on(table.utilization),
  };
});

// Bridge configuration table - stores system configuration
export const bridgeConfig = pgTable('bridge_config', {
  id: serial('id').primaryKey(),
  key: varchar('key', { length: 100 }).notNull().unique(),
  value: text('value').notNull(),
  description: text('description'),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
  updatedBy: varchar('updated_by', { length: 42 }),
});

// Fee revenue table - tracks collected fees
export const feeRevenue = pgTable('fee_revenue', {
  id: serial('id').primaryKey(),
  txHash: varchar('tx_hash', { length: 66 }).notNull().references(() => bridgeTransactions.txHash),
  token: varchar('token', { length: 42 }).notNull(),
  amount: numeric('amount', { precision: 28, scale: 18 }).notNull(),
  usdValue: numeric('usd_value', { precision: 18, scale: 2 }),
  validatorShare: numeric('validator_share', { precision: 28, scale: 18 }),
  treasuryShare: numeric('treasury_share', { precision: 28, scale: 18 }),
  collectedAt: timestamp('collected_at').defaultNow().notNull(),
}, (table) => {
  return {
    txHashIdx: index('idx_fee_revenue_tx').on(table.txHash),
    collectedIdx: index('idx_fee_revenue_collected').on(table.collectedAt),
  };
});

// Analytics snapshots table - periodic system metrics
export const analyticsSnapshots = pgTable('analytics_snapshots', {
  id: serial('id').primaryKey(),
  timestamp: timestamp('timestamp').defaultNow().notNull(),
  totalVolume24h: numeric('total_volume_24h', { precision: 18, scale: 2 }),
  totalTransactions24h: integer('total_transactions_24h'),
  uniqueUsers24h: integer('unique_users_24h'),
  totalValueLocked: numeric('total_value_locked', { precision: 18, scale: 2 }),
  avgTransactionTime: integer('avg_transaction_time'), // seconds
  successRate: numeric('success_rate', { precision: 5, scale: 2 }),
  topTokens: json('top_tokens').$type<Array<{token: string, volume: string}>>(),
  topRoutes: json('top_routes').$type<Array<{route: string, count: number}>>(),
  validatorMetrics: json('validator_metrics').$type<Record<string, any>>(),
}, (table) => {
  return {
    timestampIdx: index('idx_analytics_timestamp').on(table.timestamp),
  };
});

// Alert events table - system alerts and incidents
export const alertEvents = pgTable('alert_events', {
  id: serial('id').primaryKey(),
  type: varchar('type', { length: 50 }).notNull(), // circuit_breaker, slashing, high_failure, etc
  severity: varchar('severity', { length: 20 }).notNull(), // info, warning, critical
  title: varchar('title', { length: 200 }).notNull(),
  description: text('description'),
  metadata: json('metadata').$type<Record<string, any>>(),
  resolved: boolean('resolved').default(false).notNull(),
  resolvedAt: timestamp('resolved_at'),
  resolvedBy: varchar('resolved_by', { length: 42 }),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (table) => {
  return {
    typeIdx: index('idx_alerts_type').on(table.type),
    severityIdx: index('idx_alerts_severity').on(table.severity),
    resolvedIdx: index('idx_alerts_resolved').on(table.resolved),
    createdIdx: index('idx_alerts_created').on(table.createdAt),
  };
});

// Define relations
export const networksRelations = relations(networks, ({ many }) => ({
  tokenContracts: many(tokenContracts),
  liquidityPools: many(liquidityPools),
}));

export const tokensRelations = relations(tokens, ({ many }) => ({
  tokenContracts: many(tokenContracts),
  liquidityPools: many(liquidityPools),
}));

export const tokenContractsRelations = relations(tokenContracts, ({ one }) => ({
  token: one(tokens, {
    fields: [tokenContracts.tokenId],
    references: [tokens.id],
  }),
  network: one(networks, {
    fields: [tokenContracts.networkId],
    references: [networks.id],
  }),
}));

export const validatorsRelations = relations(validators, ({ many }) => ({
  signatures: many(validatorSignatures),
}));

export const bridgeTransactionsRelations = relations(bridgeTransactions, ({ many, one }) => ({
  signatures: many(validatorSignatures),
  feeRevenue: one(feeRevenue),
}));

export const validatorSignaturesRelations = relations(validatorSignatures, ({ one }) => ({
  transaction: one(bridgeTransactions, {
    fields: [validatorSignatures.txHash],
    references: [bridgeTransactions.txHash],
  }),
  validator: one(validators, {
    fields: [validatorSignatures.validatorId],
    references: [validators.id],
  }),
}));

export const liquidityPoolsRelations = relations(liquidityPools, ({ one }) => ({
  network: one(networks, {
    fields: [liquidityPools.networkId],
    references: [networks.id],
  }),
  token: one(tokens, {
    fields: [liquidityPools.tokenId],
    references: [tokens.id],
  }),
}));

export const feeRevenueRelations = relations(feeRevenue, ({ one }) => ({
  transaction: one(bridgeTransactions, {
    fields: [feeRevenue.txHash],
    references: [bridgeTransactions.txHash],
  }),
}));

// Type exports for TypeScript
export type Network = typeof networks.$inferSelect;
export type NewNetwork = typeof networks.$inferInsert;
export type Token = typeof tokens.$inferSelect;
export type NewToken = typeof tokens.$inferInsert;
export type TokenContract = typeof tokenContracts.$inferSelect;
export type NewTokenContract = typeof tokenContracts.$inferInsert;
export type Validator = typeof validators.$inferSelect;
export type NewValidator = typeof validators.$inferInsert;
export type BridgeTransaction = typeof bridgeTransactions.$inferSelect;
export type NewBridgeTransaction = typeof bridgeTransactions.$inferInsert;
export type ValidatorSignature = typeof validatorSignatures.$inferSelect;
export type NewValidatorSignature = typeof validatorSignatures.$inferInsert;
export type LiquidityPool = typeof liquidityPools.$inferSelect;
export type NewLiquidityPool = typeof liquidityPools.$inferInsert;
export type BridgeConfig = typeof bridgeConfig.$inferSelect;
export type NewBridgeConfig = typeof bridgeConfig.$inferInsert;
export type FeeRevenue = typeof feeRevenue.$inferSelect;
export type NewFeeRevenue = typeof feeRevenue.$inferInsert;
export type AnalyticsSnapshot = typeof analyticsSnapshots.$inferSelect;
export type NewAnalyticsSnapshot = typeof analyticsSnapshots.$inferInsert;
export type AlertEvent = typeof alertEvents.$inferSelect;
export type NewAlertEvent = typeof alertEvents.$inferInsert;