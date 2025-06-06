export interface Chain {
  id: string;
  name: string;
  symbol: string;
  icon: string;
  rpcUrl: string;
  explorerUrl: string;
}

export interface TokenBalance {
  token: {
    id: number;
    symbol: string;
    name: string;
    chain: string;
    icon: string;
    price: string;
    change24h: string;
  };
  amount: string;
  value: number;
}

export interface BridgeQuote {
  fromChain: string;
  toChain: string;
  fromToken: string;
  toToken: string;
  amount: string;
  estimatedReceived: string;
  bridgeFee: string;
  gasFee: string;
  totalFee: string;
  estimatedTime: number;
}

export interface WalletState {
  isConnected: boolean;
  address: string | null;
  chain: string | null;
  balances: TokenBalance[];
  totalBalance: number;
}

export interface TransactionStatus {
  id: string;
  type: "bridge" | "swap";
  status: "pending" | "completed" | "failed";
  fromToken: string;
  toToken: string;
  fromChain: string;
  toChain: string;
  amount: string;
  receivedAmount?: string;
  txHash?: string;
  createdAt: Date;
}

export const SUPPORTED_CHAINS: Chain[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    icon: "🔷",
    rpcUrl: "https://mainnet.infura.io/v3/",
    explorerUrl: "https://etherscan.io"
  },
  {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    icon: "💜",
    rpcUrl: "https://polygon-rpc.com/",
    explorerUrl: "https://polygonscan.com"
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    symbol: "BNB",
    icon: "🟡",
    rpcUrl: "https://bsc-dataseed.binance.org/",
    explorerUrl: "https://bscscan.com"
  }
];
