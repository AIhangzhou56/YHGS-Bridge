import { 
  users, 
  wallets, 
  tokens, 
  balances, 
  transactions, 
  bridgeRates,
  type User, 
  type InsertUser,
  type Wallet,
  type InsertWallet,
  type Token,
  type InsertToken,
  type Balance,
  type InsertBalance,
  type Transaction,
  type InsertTransaction,
  type BridgeRate,
  type InsertBridgeRate
} from "@shared/schema";
import { db } from "./db";
import { eq, and } from "drizzle-orm";

export interface IStorage {
  // User operations
  getUser(id: number): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

  // Wallet operations
  getWallet(id: number): Promise<Wallet | undefined>;
  getWalletByAddress(address: string): Promise<Wallet | undefined>;
  createWallet(wallet: InsertWallet): Promise<Wallet>;
  updateWalletConnection(id: number, isConnected: boolean): Promise<void>;

  // Token operations
  getAllTokens(): Promise<Token[]>;
  getToken(id: number): Promise<Token | undefined>;
  getTokenBySymbol(symbol: string): Promise<Token | undefined>;
  updateTokenPrice(id: number, price: string, change24h: string): Promise<void>;

  // Balance operations
  getWalletBalances(walletId: number): Promise<(Balance & { token: Token })[]>;
  updateBalance(walletId: number, tokenId: number, amount: string): Promise<void>;

  // Transaction operations
  getWalletTransactions(walletId: number): Promise<Transaction[]>;
  createTransaction(transaction: InsertTransaction): Promise<Transaction>;
  updateTransactionStatus(id: number, status: string, txHash?: string, receivedAmount?: string): Promise<void>;

  // Bridge rate operations
  getBridgeRate(fromChain: string, toChain: string): Promise<BridgeRate | undefined>;
  getAllBridgeRates(): Promise<BridgeRate[]>;
}

export class MemStorage implements IStorage {
  private users: Map<number, User>;
  private wallets: Map<number, Wallet>;
  private tokens: Map<number, Token>;
  private balances: Map<number, Balance>;
  private transactions: Map<number, Transaction>;
  private bridgeRates: Map<number, BridgeRate>;
  private currentId: number;

  constructor() {
    this.users = new Map();
    this.wallets = new Map();
    this.tokens = new Map();
    this.balances = new Map();
    this.transactions = new Map();
    this.bridgeRates = new Map();
    this.currentId = 1;
    this.initializeData();
  }

  private initializeData() {
    // Initialize tokens with placeholders (prices updated by CoinGecko service)
    const initialTokens: InsertToken[] = [
      {
        symbol: "BTC",
        name: "Bitcoin",
        chain: "bitcoin",
        icon: "https://cryptologos.cc/logos/bitcoin-btc-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "ETH",
        name: "Ethereum",
        chain: "ethereum",
        icon: "https://cryptologos.cc/logos/ethereum-eth-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "BNB",
        name: "Binance Coin",
        chain: "bsc",
        icon: "https://cryptologos.cc/logos/bnb-bnb-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "USDT",
        name: "Tether",
        chain: "ethereum",
        icon: "https://cryptologos.cc/logos/tether-usdt-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "USDC",
        name: "USD Coin",
        chain: "ethereum",
        icon: "https://cryptologos.cc/logos/usd-coin-usdc-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "DAI",
        name: "Dai",
        chain: "ethereum",
        icon: "https://cryptologos.cc/logos/multi-collateral-dai-dai-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "WBTC",
        name: "Wrapped Bitcoin",
        chain: "ethereum",
        icon: "https://cryptologos.cc/logos/wrapped-bitcoin-wbtc-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "UNI",
        name: "Uniswap",
        chain: "ethereum",
        icon: "https://cryptologos.cc/logos/uniswap-uni-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "LINK",
        name: "Chainlink",
        chain: "ethereum",
        icon: "https://cryptologos.cc/logos/chainlink-link-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "MATIC",
        name: "Polygon",
        chain: "polygon",
        icon: "https://cryptologos.cc/logos/polygon-matic-logo.png",
        price: "0.00",
        change24h: "0.00"
      },
      {
        symbol: "AVAX",
        name: "Avalanche",
        chain: "avalanche",
        icon: "https://cryptologos.cc/logos/avalanche-avax-logo.png",
        price: "0.00",
        change24h: "0.00"
      }
    ];

    initialTokens.forEach(token => {
      const id = this.currentId++;
      this.tokens.set(id, { ...token, id });
    });

    // Initialize bridge rates
    const mockBridgeRates: InsertBridgeRate[] = [
      { fromChain: "ethereum", toChain: "polygon", fee: "0.05", estimatedTime: 5 },
      { fromChain: "ethereum", toChain: "bsc", fee: "0.03", estimatedTime: 3 },
      { fromChain: "polygon", toChain: "ethereum", fee: "0.08", estimatedTime: 10 },
      { fromChain: "polygon", toChain: "bsc", fee: "0.04", estimatedTime: 4 },
      { fromChain: "bsc", toChain: "ethereum", fee: "0.06", estimatedTime: 7 },
      { fromChain: "bsc", toChain: "polygon", fee: "0.04", estimatedTime: 4 }
    ];

    mockBridgeRates.forEach(rate => {
      const id = this.currentId++;
      this.bridgeRates.set(id, { ...rate, id });
    });
  }

  async getUser(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(user => user.username === username);
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const id = this.currentId++;
    const user: User = { ...insertUser, id };
    this.users.set(id, user);
    return user;
  }

  async getWallet(id: number): Promise<Wallet | undefined> {
    return this.wallets.get(id);
  }

  async getWalletByAddress(address: string): Promise<Wallet | undefined> {
    return Array.from(this.wallets.values()).find(wallet => wallet.address === address);
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const id = this.currentId++;
    const wallet: Wallet = { 
      ...insertWallet, 
      id,
      userId: insertWallet.userId || null,
      isConnected: insertWallet.isConnected || false
    };
    this.wallets.set(id, wallet);

    // Initialize mock balances for the new wallet
    const tokenIds = Array.from(this.tokens.keys());
    const mockBalances = [
      { walletId: id, tokenId: tokenIds[0], amount: "2.45" }, // ETH
      { walletId: tokenIds[2], tokenId: tokenIds[2], amount: "1247.89" }, // MATIC
      { walletId: id, tokenId: tokenIds[3], amount: "15.67" }, // BNB
      { walletId: id, tokenId: tokenIds[4], amount: "1055.23" } // USDC
    ];

    mockBalances.forEach(balance => {
      const balanceId = this.currentId++;
      this.balances.set(balanceId, { ...balance, id: balanceId });
    });

    return wallet;
  }

  async updateWalletConnection(id: number, isConnected: boolean): Promise<void> {
    const wallet = this.wallets.get(id);
    if (wallet) {
      wallet.isConnected = isConnected;
      this.wallets.set(id, wallet);
    }
  }

  async getAllTokens(): Promise<Token[]> {
    return Array.from(this.tokens.values());
  }

  async getToken(id: number): Promise<Token | undefined> {
    return this.tokens.get(id);
  }

  async getTokenBySymbol(symbol: string): Promise<Token | undefined> {
    return Array.from(this.tokens.values()).find(token => token.symbol === symbol);
  }

  async updateTokenPrice(id: number, price: string, change24h: string): Promise<void> {
    const token = this.tokens.get(id);
    if (token) {
      token.price = price;
      token.change24h = change24h;
      this.tokens.set(id, token);
    }
  }

  async getWalletBalances(walletId: number): Promise<(Balance & { token: Token })[]> {
    const balances = Array.from(this.balances.values()).filter(balance => balance.walletId === walletId);
    return balances.map(balance => {
      const token = this.tokens.get(balance.tokenId!);
      return { ...balance, token: token! };
    });
  }

  async updateBalance(walletId: number, tokenId: number, amount: string): Promise<void> {
    const existingBalance = Array.from(this.balances.values()).find(
      balance => balance.walletId === walletId && balance.tokenId === tokenId
    );

    if (existingBalance) {
      existingBalance.amount = amount;
      this.balances.set(existingBalance.id, existingBalance);
    } else {
      const id = this.currentId++;
      this.balances.set(id, { id, walletId, tokenId, amount });
    }
  }

  async getWalletTransactions(walletId: number): Promise<Transaction[]> {
    return Array.from(this.transactions.values())
      .filter(tx => tx.walletId === walletId)
      .sort((a, b) => new Date(b.createdAt!).getTime() - new Date(a.createdAt!).getTime());
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const id = this.currentId++;
    const transaction: Transaction = { 
      ...insertTransaction, 
      id, 
      walletId: insertTransaction.walletId || null,
      receivedAmount: insertTransaction.receivedAmount || null,
      txHash: insertTransaction.txHash || null,
      sourceTxHash: insertTransaction.sourceTxHash || null,
      nonce: insertTransaction.nonce || null,
      targetAddress: insertTransaction.targetAddress || null,
      lockContractAddress: insertTransaction.lockContractAddress || null,
      createdAt: new Date()
    };
    this.transactions.set(id, transaction);
    return transaction;
  }

  async updateTransactionStatus(id: number, status: string, txHash?: string, receivedAmount?: string): Promise<void> {
    const transaction = this.transactions.get(id);
    if (transaction) {
      transaction.status = status;
      if (txHash) transaction.txHash = txHash;
      if (receivedAmount) transaction.receivedAmount = receivedAmount;
      this.transactions.set(id, transaction);
    }
  }

  async getBridgeRate(fromChain: string, toChain: string): Promise<BridgeRate | undefined> {
    return Array.from(this.bridgeRates.values()).find(
      rate => rate.fromChain === fromChain && rate.toChain === toChain
    );
  }

  async getAllBridgeRates(): Promise<BridgeRate[]> {
    return Array.from(this.bridgeRates.values());
  }
}

export class DatabaseStorage implements IStorage {
  async getUser(id: number): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user || undefined;
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.username, username));
    return user || undefined;
  }

  async createUser(insertUser: InsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(insertUser)
      .returning();
    return user;
  }

  async getWallet(id: number): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.id, id));
    return wallet || undefined;
  }

  async getWalletByAddress(address: string): Promise<Wallet | undefined> {
    const [wallet] = await db.select().from(wallets).where(eq(wallets.address, address));
    return wallet || undefined;
  }

  async createWallet(insertWallet: InsertWallet): Promise<Wallet> {
    const [wallet] = await db
      .insert(wallets)
      .values(insertWallet)
      .returning();
    return wallet;
  }

  async updateWalletConnection(id: number, isConnected: boolean): Promise<void> {
    await db
      .update(wallets)
      .set({ isConnected })
      .where(eq(wallets.id, id));
  }

  async getAllTokens(): Promise<Token[]> {
    return await db.select().from(tokens);
  }

  async getToken(id: number): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.id, id));
    return token || undefined;
  }

  async getTokenBySymbol(symbol: string): Promise<Token | undefined> {
    const [token] = await db.select().from(tokens).where(eq(tokens.symbol, symbol));
    return token || undefined;
  }

  async updateTokenPrice(id: number, price: string, change24h: string): Promise<void> {
    await db
      .update(tokens)
      .set({ price, change24h })
      .where(eq(tokens.id, id));
  }

  async getWalletBalances(walletId: number): Promise<(Balance & { token: Token })[]> {
    const result = await db
      .select()
      .from(balances)
      .leftJoin(tokens, eq(balances.tokenId, tokens.id))
      .where(eq(balances.walletId, walletId));

    return result.map(row => ({
      ...row.balances,
      token: row.tokens!
    }));
  }

  async updateBalance(walletId: number, tokenId: number, amount: string): Promise<void> {
    const [existingBalance] = await db
      .select()
      .from(balances)
      .where(and(eq(balances.walletId, walletId), eq(balances.tokenId, tokenId)));

    if (existingBalance) {
      await db
        .update(balances)
        .set({ amount })
        .where(eq(balances.id, existingBalance.id));
    } else {
      await db
        .insert(balances)
        .values({ walletId, tokenId, amount });
    }
  }

  async getWalletTransactions(walletId: number): Promise<Transaction[]> {
    return await db
      .select()
      .from(transactions)
      .where(eq(transactions.walletId, walletId))
      .orderBy(transactions.createdAt);
  }

  async createTransaction(insertTransaction: InsertTransaction): Promise<Transaction> {
    const [transaction] = await db
      .insert(transactions)
      .values(insertTransaction)
      .returning();
    return transaction;
  }

  async updateTransactionStatus(id: number, status: string, txHash?: string, receivedAmount?: string): Promise<void> {
    await db
      .update(transactions)
      .set({ 
        status, 
        ...(txHash && { txHash }),
        ...(receivedAmount && { receivedAmount })
      })
      .where(eq(transactions.id, id));
  }

  async getBridgeRate(fromChain: string, toChain: string): Promise<BridgeRate | undefined> {
    const [rate] = await db
      .select()
      .from(bridgeRates)
      .where(and(eq(bridgeRates.fromChain, fromChain), eq(bridgeRates.toChain, toChain)));
    return rate || undefined;
  }

  async getAllBridgeRates(): Promise<BridgeRate[]> {
    return await db.select().from(bridgeRates);
  }
}

export const storage = new DatabaseStorage();
