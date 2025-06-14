// app/components/Bridge/BridgeInterface.tsx
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useAccount, useBalance, useChainId, useSwitchChain } from 'wagmi';
import { parseUnits, formatUnits } from 'viem';
import { useDebounce } from '@/hooks/useDebounce';
import { NetworkSelector } from './NetworkSelector';
import { TokenSelector } from './TokenSelector';
import { FeePreview } from './FeePreview';
import { TransactionStepper } from './TransactionStepper';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Alert } from '@/components/ui/Alert';
import { ArrowDownIcon, Loader2Icon } from 'lucide-react';
import { useBridgeStore } from '@/stores/bridge.store';
import { useWebSocket } from '@/hooks/useWebSocket';
import { bridgeApi } from '@/lib/api/bridge';
import { SUPPORTED_NETWORKS, SUPPORTED_TOKENS } from '@/lib/constants';
import { cn } from '@/lib/utils';

export function BridgeInterface() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChain } = useSwitchChain();
  
  // Bridge store
  const {
    srcChain,
    dstChain,
    selectedToken,
    amount,
    setSrcChain,
    setDstChain,
    setSelectedToken,
    setAmount,
    swapChains,
    activeTransaction,
    setActiveTransaction,
  } = useBridgeStore();
  
  // Local state
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feeEstimate, setFeeEstimate] = useState<any>(null);
  
  // Debounced amount for fee calculation
  const debouncedAmount = useDebounce(amount, 500);
  
  // Get token balance
  const { data: balance } = useBalance({
    address,
    token: selectedToken?.address as `0x${string}` | undefined,
    chainId: srcChain,
  });
  
  // WebSocket for real-time updates
  const { subscribe, unsubscribe } = useWebSocket();
  
  // Validate inputs
  const validation = useMemo(() => {
    if (!isConnected) return { valid: false, error: 'Connect wallet to continue' };
    if (!srcChain || !dstChain) return { valid: false, error: 'Select networks' };
    if (srcChain === dstChain) return { valid: false, error: 'Select different networks' };
    if (!selectedToken) return { valid: false, error: 'Select a token' };
    if (!amount || parseFloat(amount) <= 0) return { valid: false, error: 'Enter an amount' };
    
    const amountBigInt = parseUnits(amount, selectedToken.decimals);
    if (balance && amountBigInt > balance.value) {
      return { valid: false, error: 'Insufficient balance' };
    }
    
    if (feeEstimate) {
      const totalAmount = amountBigInt + BigInt(feeEstimate.totalFee);
      if (balance && totalAmount > balance.value) {
        return { valid: false, error: 'Insufficient balance for fees' };
      }
    }
    
    return { valid: true, error: null };
  }, [isConnected, srcChain, dstChain, selectedToken, amount, balance, feeEstimate]);
  
  // Fetch fee estimate
  useEffect(() => {
    if (!selectedToken || !debouncedAmount || !srcChain || !dstChain) {
      setFeeEstimate(null);
      return;
    }
    
    const fetchFees = async () => {
      try {
        const estimate = await bridgeApi.estimateFees({
          token: selectedToken.address,
          amount: parseUnits(debouncedAmount, selectedToken.decimals).toString(),
          srcChain,
          dstChain,
        });
        setFeeEstimate(estimate);
      } catch (err) {
        console.error('Failed to fetch fee estimate:', err);
      }
    };
    
    fetchFees();
  }, [selectedToken, debouncedAmount, srcChain, dstChain]);
  
  // Handle chain switching
  const handleChainSwitch = async (newChainId: number, type: 'src' | 'dst') => {
    if (type === 'src') {
      setSrcChain(newChainId);
      
      // Switch wallet to source chain if needed
      if (chainId !== newChainId) {
        await switchChain({ chainId: newChainId });
      }
    } else {
      setDstChain(newChainId);
    }
  };
  
  // Handle bridge transaction
  const handleBridge = async () => {
    if (!validation.valid || !address || !selectedToken) return;
    
    setIsLoading(true);
    setError(null);
    
    try {
      // Create deposit transaction
      const amountBigInt = parseUnits(amount, selectedToken.decimals);
      
      const { txHash, transaction } = await bridgeApi.deposit({
        token: selectedToken.address,
        amount: amountBigInt.toString(),
        dstChain,
        receiver: address,
      });
      
      // Set active transaction for tracking
      setActiveTransaction({
        txHash,
        status: 'pending',
        srcChain,
        dstChain,
        token: selectedToken,
        amount,
        timestamp: Date.now(),
      });
      
      // Subscribe to WebSocket updates
      subscribe(`bridge:status:${txHash}`, (data) => {
        setActiveTransaction((prev) => ({
          ...prev!,
          status: data.status,
          dstTxHash: data.dstTxHash,
        }));
      });
      
      // Clear form
      setAmount('');
      
    } catch (err: any) {
      setError(err.message || 'Transaction failed');
    } finally {
      setIsLoading(false);
    }
  };
  
  // Cleanup WebSocket subscription
  useEffect(() => {
    return () => {
      if (activeTransaction?.txHash) {
        unsubscribe(`bridge:status:${activeTransaction.txHash}`);
      }
    };
  }, [activeTransaction?.txHash]);
  
  return (
    <div className="w-full max-w-lg mx-auto space-y-6">
      {/* Active transaction tracker */}
      {activeTransaction && (
        <TransactionStepper
          transaction={activeTransaction}
          onClose={() => setActiveTransaction(null)}
        />
      )}
      
      {/* Bridge card */}
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-lg border border-gray-200 dark:border-gray-800 p-6">
        <h2 className="text-2xl font-bold mb-6">Bridge Assets</h2>
        
        {/* Network selection */}
        <div className="space-y-4">
          {/* Source chain */}
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
              From
            </label>
            <NetworkSelector
              value={srcChain}
              onChange={(chain) => handleChainSwitch(chain, 'src')}
              networks={SUPPORTED_NETWORKS}
              label="Source Network"
            />
          </div>
          
          {/* Swap button */}
          <div className="flex justify-center -my-2">
            <button
              onClick={swapChains}
              className="p-2 rounded-full bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
              aria-label="Swap networks"
            >
              <ArrowDownIcon className="w-5 h-5" />
            </button>
          </div>
          
          {/* Destination chain */}
          <div>
            <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
              To
            </label>
            <NetworkSelector
              value={dstChain}
              onChange={(chain) => handleChainSwitch(chain, 'dst')}
              networks={SUPPORTED_NETWORKS.filter(n => n.chainId !== srcChain)}
              label="Destination Network"
            />
          </div>
        </div>
        
        {/* Token selection */}
        <div className="mt-6">
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
            Token
          </label>
          <TokenSelector
            value={selectedToken}
            onChange={setSelectedToken}
            tokens={SUPPORTED_TOKENS}
            chainId={srcChain}
          />
        </div>
        
        {/* Amount input */}
        <div className="mt-6">
          <label className="text-sm text-gray-600 dark:text-gray-400 mb-1 block">
            Amount
          </label>
          <div className="relative">
            <Input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.0"
              className="pr-20 text-lg"
              min="0"
              step="any"
            />
            {balance && (
              <button
                onClick={() => setAmount(formatUnits(balance.value, selectedToken?.decimals || 18))}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                MAX
              </button>
            )}
          </div>
          {balance && (
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              Balance: {formatUnits(balance.value, selectedToken?.decimals || 18)} {selectedToken?.symbol}
            </p>
          )}
        </div>
        
        {/* Fee preview */}
        {feeEstimate && amount && (
          <div className="mt-6">
            <FeePreview
              estimate={feeEstimate}
              token={selectedToken!}
              amount={amount}
            />
          </div>
        )}
        
        {/* Error message */}
        {error && (
          <Alert variant="error" className="mt-4">
            {error}
          </Alert>
        )}
        
        {/* Bridge button */}
        <Button
          onClick={handleBridge}
          disabled={!validation.valid || isLoading}
          className="w-full mt-6"
          size="lg"
        >
          {isLoading ? (
            <>
              <Loader2Icon className="w-4 h-4 mr-2 animate-spin" />
              Processing...
            </>
          ) : validation.error ? (
            validation.error
          ) : (
            'Bridge'
          )}
        </Button>
      </div>
      
      {/* Info section */}
      <div className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
        <p>• Estimated time: 2-15 minutes depending on network</p>
        <p>• Minimum signatures required: 5/7 validators</p>
        <p>• High value transactions (&gt;$100k) require 6/7 signatures</p>
      </div>
    </div>
  );
}

// app/components/Bridge/NetworkSelector.tsx
import { useState } from 'react';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Network {
  chainId: number;
  name: string;
  icon: string;
  nativeCurrency: string;
}

interface NetworkSelectorProps {
  value: number | null;
  onChange: (chainId: number) => void;
  networks: Network[];
  label?: string;
}

export function NetworkSelector({ value, onChange, networks, label }: NetworkSelectorProps) {
  const [query, setQuery] = useState('');
  
  const selectedNetwork = networks.find(n => n.chainId === value);
  
  const filteredNetworks = query
    ? networks.filter(n => 
        n.name.toLowerCase().includes(query.toLowerCase())
      )
    : networks;
  
  return (
    <Combobox value={value} onChange={onChange}>
      <div className="relative">
        <Combobox.Input
          className={cn(
            'w-full px-4 py-3 pr-10 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700',
            'rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'cursor-pointer'
          )}
          displayValue={() => selectedNetwork?.name || 'Select network'}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search networks..."
        />
        
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        </Combobox.Button>
        
        <Combobox.Options className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredNetworks.length === 0 && query !== '' ? (
            <div className="px-4 py-2 text-gray-500">No networks found</div>
          ) : (
            filteredNetworks.map((network) => (
              <Combobox.Option
                key={network.chainId}
                value={network.chainId}
                className={({ active }) =>
                  cn(
                    'relative px-4 py-3 cursor-pointer flex items-center gap-3',
                    active ? 'bg-blue-50 dark:bg-blue-900/20' : ''
                  )
                }
              >
                {({ selected }) => (
                  <>
                    <Image
                      src={network.icon}
                      alt={network.name}
                      width={24}
                      height={24}
                      className="rounded-full"
                    />
                    <div className="flex-1">
                      <div className="font-medium">{network.name}</div>
                      <div className="text-sm text-gray-500 dark:text-gray-400">
                        {network.nativeCurrency}
                      </div>
                    </div>
                    {selected && (
                      <CheckIcon className="w-5 h-5 text-blue-600" />
                    )}
                  </>
                )}
              </Combobox.Option>
            ))
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}

// app/components/Bridge/TokenSelector.tsx
import { useState, useEffect } from 'react';
import { Combobox } from '@headlessui/react';
import { CheckIcon, ChevronDownIcon } from 'lucide-react';
import { useBalance, useAccount } from 'wagmi';
import { formatUnits } from 'viem';
import Image from 'next/image';
import { cn } from '@/lib/utils';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
}

interface TokenSelectorProps {
  value: Token | null;
  onChange: (token: Token) => void;
  tokens: Token[];
  chainId?: number;
}

export function TokenSelector({ value, onChange, tokens, chainId }: TokenSelectorProps) {
  const [query, setQuery] = useState('');
  const { address } = useAccount();
  
  const filteredTokens = query
    ? tokens.filter(t => 
        t.symbol.toLowerCase().includes(query.toLowerCase()) ||
        t.name.toLowerCase().includes(query.toLowerCase())
      )
    : tokens;
  
  return (
    <Combobox value={value} onChange={onChange}>
      <div className="relative">
        <Combobox.Input
          className={cn(
            'w-full px-4 py-3 pr-10 text-left bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700',
            'rounded-lg shadow-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent',
            'cursor-pointer'
          )}
          displayValue={(token: Token | null) => token?.symbol || 'Select token'}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search tokens..."
        />
        
        <Combobox.Button className="absolute inset-y-0 right-0 flex items-center pr-3">
          <ChevronDownIcon className="w-5 h-5 text-gray-500" />
        </Combobox.Button>
        
        <Combobox.Options className="absolute z-10 w-full mt-1 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded-lg shadow-lg max-h-60 overflow-auto">
          {filteredTokens.length === 0 && query !== '' ? (
            <div className="px-4 py-2 text-gray-500">No tokens found</div>
          ) : (
            filteredTokens.map((token) => (
              <TokenOption
                key={token.address}
                token={token}
                chainId={chainId}
                userAddress={address}
              />
            ))
          )}
        </Combobox.Options>
      </div>
    </Combobox>
  );
}

function TokenOption({ 
  token, 
  chainId, 
  userAddress 
}: { 
  token: Token; 
  chainId?: number; 
  userAddress?: string;
}) {
  const { data: balance } = useBalance({
    address: userAddress as `0x${string}`,
    token: token.address as `0x${string}`,
    chainId,
  });
  
  return (
    <Combobox.Option
      value={token}
      className={({ active }) =>
        cn(
          'relative px-4 py-3 cursor-pointer flex items-center gap-3',
          active ? 'bg-blue-50 dark:bg-blue-900/20' : ''
        )
      }
    >
      {({ selected }) => (
        <>
          <Image
            src={token.icon}
            alt={token.symbol}
            width={32}
            height={32}
            className="rounded-full"
          />
          <div className="flex-1">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium">{token.symbol}</div>
                <div className="text-sm text-gray-500 dark:text-gray-400">
                  {token.name}
                </div>
              </div>
              {balance && (
                <div className="text-sm text-right">
                  <div className="font-medium">
                    {formatUnits(balance.value, token.decimals)}
                  </div>
                  <div className="text-gray-500 dark:text-gray-400">
                    Balance
                  </div>
                </div>
              )}
            </div>
          </div>
          {selected && (
            <CheckIcon className="w-5 h-5 text-blue-600" />
          )}
        </>
      )}
    </Combobox.Option>
  );
}

// app/components/Bridge/FeePreview.tsx
import { useMemo } from 'react';
import { formatUnits } from 'viem';
import { InfoIcon } from 'lucide-react';
import { Tooltip } from '@/components/ui/Tooltip';

interface FeePreviewProps {
  estimate: {
    baseFee: string;
    securityFee: string;
    liquidityFee: string;
    totalFee: string;
    estimatedTime: number;
  };
  token: {
    symbol: string;
    decimals: number;
  };
  amount: string;
}

export function FeePreview({ estimate, token, amount }: FeePreviewProps) {
  const fees = useMemo(() => {
    return {
      base: formatUnits(BigInt(estimate.baseFee), token.decimals),
      security: formatUnits(BigInt(estimate.securityFee), token.decimals),
      liquidity: formatUnits(BigInt(estimate.liquidityFee), token.decimals),
      total: formatUnits(BigInt(estimate.totalFee), token.decimals),
    };
  }, [estimate, token.decimals]);
  
  const receiveAmount = useMemo(() => {
    const amountBigInt = parseUnits(amount, token.decimals);
    const feeBigInt = BigInt(estimate.totalFee);
    const receiveBigInt = amountBigInt - feeBigInt;
    return formatUnits(receiveBigInt, token.decimals);
  }, [amount, estimate.totalFee, token.decimals]);
  
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 rounded-lg p-4 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          You will receive
        </span>
        <span className="font-semibold text-lg">
          {receiveAmount} {token.symbol}
        </span>
      </div>
      
      <div className="border-t border-gray-200 dark:border-gray-700 pt-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            Network Fee
            <Tooltip content="Gas cost for cross-chain transaction">
              <InfoIcon className="w-3 h-3" />
            </Tooltip>
          </span>
          <span>{fees.base} {token.symbol}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            Security Fee
            <Tooltip content="0.2% fee for validator operations">
              <InfoIcon className="w-3 h-3" />
            </Tooltip>
          </span>
          <span>{fees.security} {token.symbol}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm">
          <span className="text-gray-600 dark:text-gray-400 flex items-center gap-1">
            Liquidity Fee
            <Tooltip content="0.05% fee for liquidity providers">
              <InfoIcon className="w-3 h-3" />
            </Tooltip>
          </span>
          <span>{fees.liquidity} {token.symbol}</span>
        </div>
        
        <div className="flex items-center justify-between text-sm font-medium pt-2 border-t border-gray-200 dark:border-gray-700">
          <span>Total Fees</span>
          <span>{fees.total} {token.symbol}</span>
        </div>
      </div>
      
      <div className="flex items-center justify-between text-sm">
        <span className="text-gray-600 dark:text-gray-400">
          Estimated Time
        </span>
        <span>{estimate.estimatedTime} minutes</span>
      </div>
    </div>
  );
}

// app/stores/bridge.store.ts
import { create } from 'zustand';
import { immer } from 'zustand/middleware/immer';

interface Token {
  address: string;
  symbol: string;
  name: string;
  decimals: number;
  icon: string;
}

interface Transaction {
  txHash: string;
  status: 'pending' | 'signing' | 'completed' | 'failed';
  srcChain: number;
  dstChain: number;
  token: Token;
  amount: string;
  timestamp: number;
  srcTxHash?: string;
  dstTxHash?: string;
}

interface BridgeState {
  // Form state
  srcChain: number | null;
  dstChain: number | null;
  selectedToken: Token | null;
  amount: string;
  
  // Transaction state
  activeTransaction: Transaction | null;
  transactionHistory: Transaction[];
  
  // Actions
  setSrcChain: (chainId: number) => void;
  setDstChain: (chainId: number) => void;
  setSelectedToken: (token: Token) => void;
  setAmount: (amount: string) => void;
  swapChains: () => void;
  setActiveTransaction: (tx: Transaction | null) => void;
  addToHistory: (tx: Transaction) => void;
}

export const useBridgeStore = create<BridgeState>()(
  immer((set) => ({
    // Initial state
    srcChain: null,
    dstChain: null,
    selectedToken: null,
    amount: '',
    activeTransaction: null,
    transactionHistory: [],
    
    // Actions
    setSrcChain: (chainId) => set((state) => {
      state.srcChain = chainId;
    }),
    
    setDstChain: (chainId) => set((state) => {
      state.dstChain = chainId;
    }),
    
    setSelectedToken: (token) => set((state) => {
      state.selectedToken = token;
    }),
    
    setAmount: (amount) => set((state) => {
      state.amount = amount;
    }),
    
    swapChains: () => set((state) => {
      const temp = state.srcChain;
      state.srcChain = state.dstChain;
      state.dstChain = temp;
    }),
    
    setActiveTransaction: (tx) => set((state) => {
      state.activeTransaction = tx;
      if (tx && tx.status === 'completed') {
        state.transactionHistory.unshift(tx);
      }
    }),
    
    addToHistory: (tx) => set((state) => {
      state.transactionHistory.unshift(tx);
    }),
  }))
);