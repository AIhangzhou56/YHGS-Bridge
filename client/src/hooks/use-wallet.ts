import { useState, useCallback } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import type { WalletState, TokenBalance } from "@/types/crypto";

export function useWallet() {
  const [walletState, setWalletState] = useState<WalletState>({
    isConnected: false,
    address: null,
    chain: null,
    balances: [],
    totalBalance: 0
  });

  const queryClient = useQueryClient();

  // Mock wallet addresses for demo
  const mockWallets = [
    { name: "MetaMask", address: "0x742d35Cc6A3d444b3e4E5a7f4e87A9E78A5f6A8b" },
    { name: "WalletConnect", address: "0x1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b" },
    { name: "Coinbase Wallet", address: "0x9f8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3b2a1f0e" }
  ];

  const connectWalletMutation = useMutation({
    mutationFn: async (walletType: string) => {
      const mockWallet = mockWallets.find(w => w.name === walletType);
      if (!mockWallet) throw new Error("Wallet type not supported");

      const response = await apiRequest("POST", "/api/wallet/connect", {
        address: mockWallet.address,
        chain: "ethereum"
      });
      return response.json();
    },
    onSuccess: (data) => {
      setWalletState({
        isConnected: true,
        address: data.wallet.address,
        chain: data.wallet.chain,
        balances: [],
        totalBalance: 0
      });
      // Invalidate and refetch balances
      queryClient.invalidateQueries({ queryKey: ["/api/wallet", data.wallet.address, "balances"] });
    }
  });

  const disconnectWalletMutation = useMutation({
    mutationFn: async () => {
      if (!walletState.address) return;
      
      const response = await apiRequest("POST", "/api/wallet/disconnect", {
        address: walletState.address
      });
      return response.json();
    },
    onSuccess: () => {
      setWalletState({
        isConnected: false,
        address: null,
        chain: null,
        balances: [],
        totalBalance: 0
      });
    }
  });

  const { data: balancesData } = useQuery({
    queryKey: ["/api/wallet", walletState.address, "balances"],
    enabled: !!walletState.address && walletState.isConnected,
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  // Update wallet state when balances are fetched
  const updateBalances = useCallback(() => {
    if (balancesData?.balances) {
      const balances: TokenBalance[] = balancesData.balances.map((balance: any) => ({
        token: balance.token,
        amount: balance.amount,
        value: parseFloat(balance.amount) * parseFloat(balance.token.price)
      }));

      const totalBalance = balances.reduce((sum, balance) => sum + balance.value, 0);

      setWalletState(prev => ({
        ...prev,
        balances,
        totalBalance
      }));
    }
  }, [balancesData]);

  // Call updateBalances when balancesData changes
  useState(() => {
    updateBalances();
  });

  const connectWallet = useCallback((walletType: string) => {
    connectWalletMutation.mutate(walletType);
  }, [connectWalletMutation]);

  const disconnectWallet = useCallback(() => {
    disconnectWalletMutation.mutate();
  }, [disconnectWalletMutation]);

  return {
    walletState,
    connectWallet,
    disconnectWallet,
    isConnecting: connectWalletMutation.isPending,
    isDisconnecting: disconnectWalletMutation.isPending,
    connectionError: connectWalletMutation.error
  };
}
