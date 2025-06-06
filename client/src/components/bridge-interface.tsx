import { useState, useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Separator } from "@/components/ui/separator";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/use-wallet";
import { apiRequest } from "@/lib/queryClient";
import { ArrowUpDown, Shield, Loader2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import type { Chain } from "@/types/chains";
import { crossChainBridge } from "@/lib/bridge-contracts";

const CHAINS = [
  { id: "ethereum", name: "Ethereum", symbol: "ETH", icon: "Ξ" },
  { id: "polygon", name: "Polygon", symbol: "MATIC", icon: "🔷" },
  { id: "bsc", name: "BNB Smart Chain", symbol: "BNB", icon: "🟡" },
  { id: "solana", name: "Solana", symbol: "SOL", icon: "◎" },
  { id: "bitcoin", name: "Bitcoin", symbol: "BTC", icon: "₿" }
];

export function BridgeInterface() {
  const { walletState } = useWallet();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [fromChain, setFromChain] = useState<Chain>("ethereum");
  const [toChain, setToChain] = useState<Chain>("solana");
  const [token, setToken] = useState("ETH");
  const [amount, setAmount] = useState("");
  const [estimatedReceived, setEstimatedReceived] = useState("");
  const [bridgeStatus, setBridgeStatus] = useState<"idle" | "locking" | "minting" | "completed">("idle");

  const { data: bridgeRatesData } = useQuery({
    queryKey: ["/api/bridge/rates"]
  });

  const { data: tokensData } = useQuery({
    queryKey: ["/api/tokens"]
  });

  const bridgeRate = bridgeRatesData?.rates?.find(
    (rate: any) => rate.fromChain === fromChain && rate.toChain === toChain
  ) || bridgeRatesData?.find?.(
    (rate: any) => rate.fromChain === fromChain && rate.toChain === toChain
  );

  const bridgeMutation = useMutation({
    mutationFn: async (bridgeData: any) => {
      const response = await apiRequest("POST", "/api/bridge/transaction", bridgeData);
      return response.json();
    },
    onSuccess: () => {
      toast({
        title: "Bridge Transaction Submitted",
        description: "Your bridge transaction has been submitted and is being processed.",
      });
      setAmount("");
      setEstimatedReceived("");
      // Invalidate transactions to show the new pending transaction
      queryClient.invalidateQueries({ queryKey: ["/api/transactions", walletState.address] });
    },
    onError: (error: any) => {
      toast({
        title: "Bridge Failed",
        description: error.message || "Failed to submit bridge transaction",
        variant: "destructive",
      });
    }
  });

  // Calculate estimated received amount
  useEffect(() => {
    if (amount && bridgeRate) {
      const numAmount = parseFloat(amount);
      const fee = parseFloat(bridgeRate.fee) / 100;
      const received = numAmount * (1 - fee);
      setEstimatedReceived(received.toFixed(6));
    } else {
      setEstimatedReceived("");
    }
  }, [amount, bridgeRate]);

  const handleSwapChains = () => {
    const tempChain = fromChain;
    setFromChain(toChain);
    setToChain(tempChain);
  };

  const handleBridge = () => {
    if (!walletState.isConnected) {
      toast({
        title: "Wallet Not Connected",
        description: "Please connect your wallet first",
        variant: "destructive",
      });
      return;
    }

    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount",
        variant: "destructive",
      });
      return;
    }

    bridgeMutation.mutate({
      walletId: 1, // Mock wallet ID
      type: "bridge",
      fromToken: token,
      toToken: token,
      fromChain,
      toChain,
      amount
    });
  };

  const getChainIcon = (chainId: string) => {
    const chain = CHAINS.find(c => c.id === chainId);
    return chain?.icon || "🔗";
  };

  const tokens = tokensData?.tokens || tokensData || [];
  
  const getTokenPrice = (symbol: string) => {
    const foundToken = tokens.find((t: any) => t.symbol === symbol);
    return foundToken ? parseFloat(foundToken.price) : 0;
  };

  const formatUsdValue = (amount: string, symbol: string) => {
    if (!amount) return "$0.00";
    const price = getTokenPrice(symbol);
    const value = parseFloat(amount) * price;
    return `≈ $${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getBalance = (symbol: string) => {
    const balance = walletState.balances.find(b => b.token.symbol === symbol);
    return balance ? parseFloat(balance.amount) : 0;
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="text-2xl font-bold text-white">Cross-Chain Bridge</CardTitle>
          <div className="flex items-center space-x-2 text-sm text-slate-400">
            <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
            <Shield className="w-4 h-4 text-green-400" />
            <span>Secure Bridge</span>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* From Section */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300">From</label>
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-lg">
                  {getChainIcon(fromChain)}
                </div>
                <Select value={fromChain} onValueChange={setFromChain}>
                  <SelectTrigger className="border-0 bg-transparent text-white font-medium p-0 h-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {CHAINS.map(chain => (
                      <SelectItem key={chain.id} value={chain.id} className="text-white">
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-slate-400">
                Balance: {getBalance(fromToken).toFixed(4)} {fromToken}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <Input
                type="number"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="border-0 bg-transparent text-2xl font-medium p-0 h-auto text-white placeholder:text-slate-500"
              />
              <div className="flex items-center space-x-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAmount(getBalance(fromToken).toString())}
                  className="bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30"
                >
                  MAX
                </Button>
                <span className="text-sm text-slate-400">
                  {formatUsdValue(amount, fromToken)}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* Bridge Direction */}
        <div className="flex justify-center">
          <Button
            onClick={handleSwapChains}
            size="icon"
            variant="outline"
            className="bg-slate-800 border-slate-600 hover:bg-slate-700"
          >
            <ArrowUpDown className="w-4 h-4 text-slate-400" />
          </Button>
        </div>

        {/* To Section */}
        <div className="space-y-3">
          <label className="text-sm font-medium text-slate-300">To</label>
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-lg">
                  {getChainIcon(toChain)}
                </div>
                <Select value={toChain} onValueChange={setToChain}>
                  <SelectTrigger className="border-0 bg-transparent text-white font-medium p-0 h-auto">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-slate-800 border-slate-600">
                    {CHAINS.map(chain => (
                      <SelectItem key={chain.id} value={chain.id} className="text-white">
                        {chain.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <span className="text-sm text-slate-400">
                Balance: 0.0000 {toToken}
              </span>
            </div>
            <div className="flex items-center justify-between">
              <div className="text-2xl font-medium text-slate-300">
                {estimatedReceived || "0.0"}
              </div>
              <span className="text-sm text-slate-400">
                {formatUsdValue(estimatedReceived, toToken)}
              </span>
            </div>
          </div>
        </div>

        {/* Bridge Details */}
        {bridgeRate && (
          <div className="bg-slate-800 border border-slate-600 rounded-lg p-4 space-y-3">
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Bridge Fee</span>
              <span className="text-white">
                {bridgeRate.fee}% ({amount ? (parseFloat(amount) * parseFloat(bridgeRate.fee) / 100).toFixed(6) : '0'} {fromToken})
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Gas Fee (Est.)</span>
              <span className="text-white">$8.45</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-400">Transfer Time</span>
              <span className="text-green-400">~{bridgeRate.estimatedTime} minutes</span>
            </div>
            <Separator className="bg-slate-600" />
            <div className="flex justify-between font-medium">
              <span className="text-slate-300">You will receive</span>
              <span className="text-white">≈ {estimatedReceived || '0'} {toToken}</span>
            </div>
          </div>
        )}

        {/* Bridge Button */}
        <Button
          onClick={handleBridge}
          disabled={!walletState.isConnected || !amount || bridgeMutation.isPending}
          className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 py-6 text-lg font-semibold"
        >
          {bridgeMutation.isPending ? (
            <>
              <Loader2 className="w-5 h-5 mr-2 animate-spin" />
              Processing...
            </>
          ) : !walletState.isConnected ? (
            "Connect Wallet to Bridge"
          ) : (
            "Bridge Tokens"
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
