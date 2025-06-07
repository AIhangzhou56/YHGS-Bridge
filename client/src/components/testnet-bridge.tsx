import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Clock, ExternalLink, Copy, CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

interface TestTransaction {
  id: string;
  fromChain: 'ethereum' | 'solana';
  toChain: 'ethereum' | 'solana';
  token: string;
  amount: string;
  fromAddress: string;
  toAddress: string;
  status: 'pending' | 'locked' | 'minting' | 'completed' | 'failed';
  txHash?: string;
  estimatedTime: number;
  fee: string;
  createdAt: string;
  completedAt?: string;
}

interface TestnetConfig {
  ethereum: {
    chainId: number;
    rpcUrl: string;
    bridgeContract: string;
    faucetUrl: string;
    explorer: string;
  };
  solana: {
    cluster: string;
    rpcUrl: string;
    bridgeProgram: string;
    faucetUrl: string;
    explorer: string;
  };
}

export function TestnetBridge() {
  const [config, setConfig] = useState<TestnetConfig | null>(null);
  const [transactions, setTransactions] = useState<TestTransaction[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'ETH' | 'USDC'>('ETH');
  const [direction, setDirection] = useState<'eth-to-sol' | 'sol-to-eth'>('eth-to-sol');
  const { toast } = useToast();

  // Load testnet configuration
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const response = await fetch('/api/testnet/config');
        const data = await response.json();
        setConfig(data.config);
      } catch (error) {
        toast({
          title: "Configuration Error",
          description: "Failed to load testnet configuration",
          variant: "destructive"
        });
      }
    };
    loadConfig();
  }, [toast]);

  // Poll for transaction updates
  useEffect(() => {
    const pollTransactions = async () => {
      try {
        const response = await fetch('/api/testnet/status');
        const data = await response.json();
        setTransactions(data.transactions || []);
      } catch (error) {
        console.error('Failed to poll transactions:', error);
      }
    };

    const interval = setInterval(pollTransactions, 2000);
    pollTransactions();

    return () => clearInterval(interval);
  }, []);

  const handleBridgeTest = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast({
        title: "Invalid Amount",
        description: "Please enter a valid amount to bridge",
        variant: "destructive"
      });
      return;
    }

    setIsLoading(true);
    
    try {
      const endpoint = direction === 'eth-to-sol' ? 'initiate-eth-to-sol' : 'initiate-sol-to-eth';
      const fromAddress = direction === 'eth-to-sol' 
        ? '0x742d35Cc6634C0532925a3b8D35Cc6634C0532925'
        : 'EthSoLBridgeTest1111111111111111111111111111';
      const toAddress = direction === 'eth-to-sol'
        ? 'EthSoLBridgeTest1111111111111111111111111111'
        : '0x742d35Cc6634C0532925a3b8D35Cc6634C0532925';

      const response = await fetch(`/api/testnet/${endpoint}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          amount,
          token,
          fromAddress,
          toAddress
        })
      });

      const data = await response.json();

      toast({
        title: "Bridge Test Initiated",
        description: data.message || "Test transaction started successfully"
      });

      setAmount('');
    } catch (error: any) {
      toast({
        title: "Bridge Test Failed",
        description: error.message || "Failed to initiate test transaction",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'pending': return 'bg-yellow-500';
      case 'locked': return 'bg-blue-500';
      case 'minting': return 'bg-purple-500';
      case 'completed': return 'bg-green-500';
      case 'failed': return 'bg-red-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusProgress = (status: string) => {
    switch (status) {
      case 'pending': return 25;
      case 'locked': return 50;
      case 'minting': return 75;
      case 'completed': return 100;
      case 'failed': return 0;
      default: return 0;
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard"
    });
  };

  const formatElapsedTime = (createdAt: string, completedAt?: string) => {
    const start = new Date(createdAt);
    const end = completedAt ? new Date(completedAt) : new Date();
    const diff = Math.floor((end.getTime() - start.getTime()) / 1000);
    
    if (diff < 60) return `${diff}s`;
    if (diff < 3600) return `${Math.floor(diff / 60)}m ${diff % 60}s`;
    return `${Math.floor(diff / 3600)}h ${Math.floor((diff % 3600) / 60)}m`;
  };

  if (!config) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading testnet configuration...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Testnet Information */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
            <span>ETH ↔ SOL Bridge Testnet</span>
          </CardTitle>
          <CardDescription>
            Test cross-chain bridging between Ethereum Sepolia and Solana Devnet
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Ethereum Sepolia</h4>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div>Chain ID: {config.ethereum.chainId}</div>
                <div className="flex items-center space-x-2">
                  <span>Contract: {config.ethereum.bridgeContract.slice(0, 10)}...</span>
                  <Copy 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => copyToClipboard(config.ethereum.bridgeContract)}
                  />
                </div>
                <a 
                  href={config.ethereum.faucetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-400 hover:text-blue-300"
                >
                  <span>Get test ETH</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium text-sm">Solana Devnet</h4>
              <div className="text-xs space-y-1 text-muted-foreground">
                <div>Cluster: {config.solana.cluster}</div>
                <div className="flex items-center space-x-2">
                  <span>Program: {config.solana.bridgeProgram.slice(0, 10)}...</span>
                  <Copy 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => copyToClipboard(config.solana.bridgeProgram)}
                  />
                </div>
                <a 
                  href={config.solana.faucetUrl} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="flex items-center space-x-1 text-blue-400 hover:text-blue-300"
                >
                  <span>Get test SOL</span>
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Bridge Test Interface */}
      <Card>
        <CardHeader>
          <CardTitle>Test Bridge Transaction</CardTitle>
          <CardDescription>
            Initiate a test bridge transaction between Ethereum and Solana
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Direction</Label>
              <div className="flex space-x-2">
                <Button
                  variant={direction === 'eth-to-sol' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDirection('eth-to-sol')}
                >
                  ETH → SOL
                </Button>
                <Button
                  variant={direction === 'sol-to-eth' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setDirection('sol-to-eth')}
                >
                  SOL → ETH
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label>Token</Label>
              <div className="flex space-x-2">
                <Button
                  variant={token === 'ETH' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setToken('ETH')}
                >
                  {direction === 'eth-to-sol' ? 'ETH' : 'SOL'}
                </Button>
                <Button
                  variant={token === 'USDC' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setToken('USDC')}
                >
                  USDC
                </Button>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="amount">Amount</Label>
              <Input
                id="amount"
                type="number"
                step="0.001"
                min="0"
                placeholder="0.0"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
              />
            </div>
          </div>
          
          <Button 
            onClick={handleBridgeTest} 
            disabled={isLoading || !amount}
            className="w-full"
          >
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {isLoading ? 'Initiating Bridge Test...' : 'Start Bridge Test'}
          </Button>
        </CardContent>
      </Card>

      {/* Transaction History */}
      <Card>
        <CardHeader>
          <CardTitle>Test Transactions</CardTitle>
          <CardDescription>
            Real-time status of your test bridge transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {transactions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No test transactions yet. Start a bridge test above.
            </div>
          ) : (
            <div className="space-y-4">
              {transactions.map((tx) => (
                <div key={tx.id} className="border rounded-lg p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-3">
                      <Badge variant="outline" className={`${getStatusColor(tx.status)} text-white`}>
                        {tx.status.toUpperCase()}
                      </Badge>
                      <span className="font-medium">
                        {tx.amount} {tx.token}
                      </span>
                      <span className="text-sm text-muted-foreground">
                        {tx.fromChain.toUpperCase()} → {tx.toChain.toUpperCase()}
                      </span>
                    </div>
                    <div className="flex items-center space-x-2 text-sm text-muted-foreground">
                      <Clock className="h-4 w-4" />
                      <span>{formatElapsedTime(tx.createdAt, tx.completedAt)}</span>
                    </div>
                  </div>

                  <Progress value={getStatusProgress(tx.status)} className="h-2" />

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                      <div className="text-muted-foreground">Transaction ID</div>
                      <div className="font-mono text-xs">{tx.id}</div>
                    </div>
                    <div>
                      <div className="text-muted-foreground">Bridge Fee</div>
                      <div>{tx.fee} {tx.token}</div>
                    </div>
                  </div>

                  {tx.txHash && (
                    <div className="text-sm">
                      <div className="text-muted-foreground">Transaction Hash</div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-xs">{tx.txHash}</span>
                        <Copy 
                          className="h-3 w-3 cursor-pointer" 
                          onClick={() => copyToClipboard(tx.txHash!)}
                        />
                      </div>
                    </div>
                  )}

                  {tx.status === 'completed' && (
                    <Alert>
                      <CheckCircle className="h-4 w-4" />
                      <AlertDescription>
                        Bridge completed successfully! Tokens have been minted on {tx.toChain}.
                      </AlertDescription>
                    </Alert>
                  )}

                  {tx.status === 'failed' && (
                    <Alert variant="destructive">
                      <AlertCircle className="h-4 w-4" />
                      <AlertDescription>
                        Bridge transaction failed. Please try again.
                      </AlertDescription>
                    </Alert>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}