import { pgTable, text, serial, decimal, integer, boolean, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
});

export const wallets = pgTable("wallets", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => users.id),
  address: text("address").notNull().unique(),
  chain: text("chain").notNull(),
  isConnected: boolean("is_connected").default(false),
});

export const tokens = pgTable("tokens", {
  id: serial("id").primaryKey(),
  symbol: text("symbol").notNull(),
  name: text("name").notNull(),
  chain: text("chain").notNull(),
  icon: text("icon").notNull(),
  price: decimal("price", { precision: 18, scale: 8 }).notNull(),
  change24h: decimal("change_24h", { precision: 6, scale: 4 }).notNull(),
});

export const balances = pgTable("balances", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").references(() => wallets.id),
  tokenId: integer("token_id").references(() => tokens.id),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
});

export const transactions = pgTable("transactions", {
  id: serial("id").primaryKey(),
  walletId: integer("wallet_id").references(() => wallets.id),
  type: text("type").notNull(), // "bridge", "swap"
  fromToken: text("from_token").notNull(),
  toToken: text("to_token").notNull(),
  fromChain: text("from_chain").notNull(),
  toChain: text("to_chain").notNull(),
  amount: decimal("amount", { precision: 18, scale: 8 }).notNull(),
  receivedAmount: decimal("received_amount", { precision: 18, scale: 8 }),
  status: text("status").notNull(), // "pending", "completed", "failed"
  txHash: text("tx_hash"),
  createdAt: timestamp("created_at").defaultNow(),
});

export const bridgeRates = pgTable("bridge_rates", {
  id: serial("id").primaryKey(),
  fromChain: text("from_chain").notNull(),
  toChain: text("to_chain").notNull(),
  fee: decimal("fee", { precision: 6, scale: 4 }).notNull(), // percentage
  estimatedTime: integer("estimated_time").notNull(), // minutes
});

export const insertUserSchema = createInsertSchema(users).pick({
  username: true,
  password: true,
});

export const insertWalletSchema = createInsertSchema(wallets).omit({
  id: true,
});

export const insertTokenSchema = createInsertSchema(tokens).omit({
  id: true,
});

export const insertBalanceSchema = createInsertSchema(balances).omit({
  id: true,
});

export const insertTransactionSchema = createInsertSchema(transactions).omit({
  id: true,
  createdAt: true,
});

export const insertBridgeRateSchema = createInsertSchema(bridgeRates).omit({
  id: true,
});

export type User = typeof users.$inferSelect;
export type InsertUser = z.infer<typeof insertUserSchema>;

export type Wallet = typeof wallets.$inferSelect;
export type InsertWallet = z.infer<typeof insertWalletSchema>;

export type Token = typeof tokens.$inferSelect;
export type InsertToken = z.infer<typeof insertTokenSchema>;

export type Balance = typeof balances.$inferSelect;
export type InsertBalance = z.infer<typeof insertBalanceSchema>;

export type Transaction = typeof transactions.$inferSelect;
export type InsertTransaction = z.infer<typeof insertTransactionSchema>;

export type BridgeRate = typeof bridgeRates.$inferSelect;
export type InsertBridgeRate = z.infer<typeof insertBridgeRateSchema>;
