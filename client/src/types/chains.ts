export type Chain = "ethereum" | "polygon" | "bsc" | "solana" | "bitcoin";

export interface ChainConfig {
  id: Chain;
  name: string;
  symbol: string;
  icon: string;
  rpcUrl: string;
  explorerUrl: string;
  bridgeContract?: string;
  lockContract?: string;
  mintContract?: string;
  isEvm: boolean;
}

export interface Token {
  id: number;
  symbol: string;
  name: string;
  chain: Chain;
  icon: string;
  price: string;
  change24h: string;
  contractAddress?: string;
  decimals: number;
}

export interface BridgeEvent {
  token: string;
  sender: string;
  targetChain: Chain;
  targetAddress: string;
  amount: string;
  nonce: string;
  txHash: string;
  blockNumber: number;
}

export interface CrossChainTransaction {
  id: string;
  type: "lock" | "mint" | "burn" | "release";
  srcChain: Chain;
  dstChain: Chain;
  token: string;
  amount: string;
  status: "pending" | "locked" | "minting" | "completed" | "failed";
  srcTxHash?: string;
  dstTxHash?: string;
  nonce: string;
  targetAddress: string;
  lockContractAddress?: string;
  createdAt: Date;
}

export const SUPPORTED_CHAINS: ChainConfig[] = [
  {
    id: "ethereum",
    name: "Ethereum",
    symbol: "ETH",
    icon: "Ξ",
    rpcUrl: "https://mainnet.infura.io/v3/",
    explorerUrl: "https://etherscan.io",
    bridgeContract: "0x1234...abcd",
    lockContract: "0x5678...efgh",
    mintContract: "0x9abc...def0",
    isEvm: true
  },
  {
    id: "polygon",
    name: "Polygon",
    symbol: "MATIC",
    icon: "🔷",
    rpcUrl: "https://polygon-rpc.com/",
    explorerUrl: "https://polygonscan.com",
    bridgeContract: "0x2345...bcde",
    lockContract: "0x6789...fghi",
    mintContract: "0xabcd...ef01",
    isEvm: true
  },
  {
    id: "bsc",
    name: "BNB Smart Chain",
    symbol: "BNB",
    icon: "🟡",
    rpcUrl: "https://bsc-dataseed.binance.org/",
    explorerUrl: "https://bscscan.com",
    bridgeContract: "0x3456...cdef",
    lockContract: "0x789a...ghij",
    mintContract: "0xbcde...f012",
    isEvm: true
  },
  {
    id: "solana",
    name: "Solana",
    symbol: "SOL",
    icon: "◎",
    rpcUrl: "https://api.mainnet-beta.solana.com",
    explorerUrl: "https://explorer.solana.com",
    bridgeContract: "BR1dg3Prog1111111111111111111111111111111111",
    isEvm: false
  },
  {
    id: "bitcoin",
    name: "Bitcoin",
    symbol: "BTC",
    icon: "₿",
    rpcUrl: "https://blockstream.info/api/",
    explorerUrl: "https://blockstream.info",
    isEvm: false
  }
];