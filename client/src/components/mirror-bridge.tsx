import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { useToast } from '@/hooks/use-toast';
import { Loader2, ArrowRight, Copy, ExternalLink, Info } from 'lucide-react';

interface MirrorTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  totalSupply: string;
}

interface BridgeFees {
  ethereumGasFee: string;
  bscGasFee: string;
  bridgeFee: string;
  totalFee: string;
}

export function MirrorBridge() {
  const [tokenAddress, setTokenAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [userAddress, setUserAddress] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [mirrorInfo, setMirrorInfo] = useState<MirrorTokenInfo | null>(null);
  const [fees, setFees] = useState<BridgeFees | null>(null);
  const [bridgeResult, setBridgeResult] = useState<any>(null);
  const { toast } = useToast();

  // Popular ERC-20 token addresses for quick selection
  const popularTokens = [
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', name: 'Tether USD' },
    { symbol: 'USDC', address: '0xA0b86a33E6441E6E80A56Ec6FFe77ec1492D9C6C', name: 'USD Coin' },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', name: 'Dai Stablecoin' },
    { symbol: 'LINK', address: '0x514910771AF9Ca656af840dff83E8264EcF986CA', name: 'Chainlink' },
    { symbol: 'UNI', address: '0x1f9840a85d5aF5bf1D1762F925BDADdC4201F984', name: 'Uniswap' }
  ];

  const handleTokenSelect = (token: typeof popularTokens[0]) => {
    setTokenAddress(token.address);
    setMirrorInfo(null);
    setFees(null);
  };

  const checkMirrorToken = async () => {
    if (!tokenAddress) {
      toast({
        title: "Token Required",
        description: "Please enter an ERC-20 token address",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch(`/api/bridge/mirror-token/${tokenAddress}`);
      const data = await response.json();
      
      if (response.ok) {
        setMirrorInfo(data.mirrorToken);
        toast({
          title: "Mirror Token Found",
          description: `Found existing mirror token: ${data.mirrorToken.symbol}`
        });
      } else {
        setMirrorInfo(null);
        toast({
          title: "New Mirror Token",
          description: "Mirror token will be created during first bridge transaction"
        });
      }
    } catch (error) {
      console.error('Error checking mirror token:', error);
      toast({
        title: "Check Failed",
        description: "Failed to check mirror token status",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const estimateFees = async () => {
    if (!tokenAddress || !amount) {
      toast({
        title: "Missing Information",
        description: "Please enter both token address and amount",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    try {
      const response = await fetch('/api/bridge/estimate-mirror-fee', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokenAddress,
          amount
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setFees(data.fees);
        toast({
          title: "Fees Estimated",
          description: `Total bridge fee: ${parseFloat(data.fees.totalFee).toFixed(6)} ETH`
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error estimating fees:', error);
      toast({
        title: "Estimation Failed",
        description: error.message || "Failed to estimate bridge fees",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const initiateBridge = async () => {
    if (!tokenAddress || !amount || !userAddress) {
      toast({
        title: "Missing Information",
        description: "Please fill in all required fields",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    setBridgeResult(null);

    try {
      const response = await fetch('/api/bridge/lock-erc20', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          tokenAddress,
          amount,
          userAddress
        })
      });

      const data = await response.json();
      
      if (response.ok) {
        setBridgeResult(data);
        toast({
          title: "Bridge Initiated",
          description: "ERC-20 lock and BSC mirror mint process started"
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      console.error('Error initiating bridge:', error);
      toast({
        title: "Bridge Failed",
        description: error.message || "Failed to initiate bridge transaction",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard"
    });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-orange-500 rounded-full"></div>
            <span>ERC-20 → BSC Mirror Bridge</span>
          </CardTitle>
          <CardDescription>
            Lock ERC-20 tokens on Ethereum and mint mirrored BEP-20 tokens on BSC
          </CardDescription>
        </CardHeader>
      </Card>

      {/* Popular Tokens */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Popular ERC-20 Tokens</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
            {popularTokens.map((token) => (
              <Button
                key={token.symbol}
                variant="outline"
                size="sm"
                onClick={() => handleTokenSelect(token)}
                className="flex flex-col h-auto py-2"
              >
                <span className="font-medium">{token.symbol}</span>
                <span className="text-xs text-muted-foreground">{token.name}</span>
              </Button>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Bridge Configuration */}
      <Card>
        <CardHeader>
          <CardTitle>Bridge Configuration</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="tokenAddress">ERC-20 Token Address</Label>
              <div className="flex space-x-2">
                <Input
                  id="tokenAddress"
                  placeholder="0x..."
                  value={tokenAddress}
                  onChange={(e) => setTokenAddress(e.target.value)}
                  className="font-mono text-sm"
                />
                <Button
                  variant="outline"
                  onClick={checkMirrorToken}
                  disabled={isLoading || !tokenAddress}
                >
                  Check
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="userAddress">Your Wallet Address</Label>
              <Input
                id="userAddress"
                placeholder="0x..."
                value={userAddress}
                onChange={(e) => setUserAddress(e.target.value)}
                className="font-mono text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="amount">Amount to Bridge</Label>
            <div className="flex space-x-2">
              <Input
                id="amount"
                type="number"
                step="0.000001"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
              <Button
                variant="outline"
                onClick={estimateFees}
                disabled={isLoading || !tokenAddress || !amount}
              >
                Estimate Fees
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Mirror Token Info */}
      {mirrorInfo && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-green-500/20 text-green-400">
                Mirror Token Exists
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Name:</span>
                <span className="ml-2 font-medium">{mirrorInfo.name}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Symbol:</span>
                <span className="ml-2 font-medium">{mirrorInfo.symbol}</span>
              </div>
              <div>
                <span className="text-muted-foreground">Address:</span>
                <div className="flex items-center space-x-1">
                  <span className="font-mono text-xs">{mirrorInfo.address.slice(0, 10)}...</span>
                  <Copy 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => copyToClipboard(mirrorInfo.address)}
                  />
                </div>
              </div>
              <div>
                <span className="text-muted-foreground">Total Supply:</span>
                <span className="ml-2 font-medium">{parseFloat(mirrorInfo.totalSupply).toLocaleString()}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bridge Fees */}
      {fees && (
        <Card>
          <CardHeader>
            <CardTitle>Bridge Fees Breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Ethereum Gas Fee:</span>
                <span className="font-medium">{parseFloat(fees.ethereumGasFee).toFixed(6)} ETH</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">BSC Gas Fee:</span>
                <span className="font-medium">{parseFloat(fees.bscGasFee).toFixed(6)} BNB</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Bridge Fee (0.1%):</span>
                <span className="font-medium">{parseFloat(fees.bridgeFee).toFixed(6)} ETH</span>
              </div>
              <div className="flex justify-between font-medium">
                <span>Total Fee:</span>
                <span>{parseFloat(fees.totalFee).toFixed(6)} ETH</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Bridge Action */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-center space-x-4 mb-4">
            <div className="text-center">
              <div className="w-12 h-12 bg-blue-500/20 rounded-full flex items-center justify-center mb-2">
                <span className="text-sm font-medium">ETH</span>
              </div>
              <span className="text-xs text-muted-foreground">Lock ERC-20</span>
            </div>
            <ArrowRight className="h-6 w-6 text-muted-foreground" />
            <div className="text-center">
              <div className="w-12 h-12 bg-orange-500/20 rounded-full flex items-center justify-center mb-2">
                <span className="text-sm font-medium">BSC</span>
              </div>
              <span className="text-xs text-muted-foreground">Mint Mirror</span>
            </div>
          </div>
          
          <Button 
            onClick={initiateBridge}
            disabled={isLoading || !tokenAddress || !amount || !userAddress}
            className="w-full"
            size="lg"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Processing Bridge...' : 'Start ERC-20 → BSC Bridge'}
          </Button>
        </CardContent>
      </Card>

      {/* Bridge Result */}
      {bridgeResult && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center space-x-2">
              <Badge variant="outline" className="bg-green-500/20 text-green-400">
                Bridge Ready
              </Badge>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <Alert>
              <Info className="h-4 w-4" />
              <AlertDescription>
                {bridgeResult.message || "Bridge transaction is ready to be executed"}
              </AlertDescription>
            </Alert>

            {bridgeResult.mirrorToken && (
              <div className="space-y-2">
                <h4 className="font-medium">Mirror Token Details</h4>
                <div className="bg-slate-800 p-3 rounded-lg space-y-1 text-sm">
                  <div>Name: {bridgeResult.mirrorToken.name}</div>
                  <div>Symbol: {bridgeResult.mirrorToken.symbol}</div>
                  <div className="flex items-center space-x-2">
                    <span>Address: {bridgeResult.mirrorToken.address}</span>
                    <Copy 
                      className="h-3 w-3 cursor-pointer" 
                      onClick={() => copyToClipboard(bridgeResult.mirrorToken.address)}
                    />
                  </div>
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Amount:</span>
                <span className="ml-2 font-medium">{amount} tokens</span>
              </div>
              <div>
                <span className="text-muted-foreground">Status:</span>
                <span className="ml-2 font-medium">Ready to Execute</span>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}