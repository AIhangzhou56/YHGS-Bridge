import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { ExternalLink, Copy, CheckCircle, Loader2 } from 'lucide-react';

export function SimpleTestnet() {
  const [amount, setAmount] = useState('');
  const [token, setToken] = useState<'ETH' | 'USDC'>('ETH');
  const [direction, setDirection] = useState<'eth-to-sol' | 'sol-to-eth'>('eth-to-sol');
  const [isLoading, setIsLoading] = useState(false);
  const [testResult, setTestResult] = useState<any>(null);
  const { toast } = useToast();

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
    setTestResult(null);
    
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
      setTestResult(data.transaction);

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

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "Copied",
      description: "Address copied to clipboard"
    });
  };

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
                <div>Chain ID: 11155111</div>
                <div className="flex items-center space-x-2">
                  <span>Contract: 0x742d35Cc...</span>
                  <Copy 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => copyToClipboard('0x742d35Cc6634C0532925a3b8D35Cc6634C0532925')}
                  />
                </div>
                <a 
                  href="https://sepoliafaucet.com/" 
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
                <div>Cluster: devnet</div>
                <div className="flex items-center space-x-2">
                  <span>Program: BR1dg3Prog...</span>
                  <Copy 
                    className="h-3 w-3 cursor-pointer" 
                    onClick={() => copyToClipboard('BR1dg3Prog1111111111111111111111111111111111')}
                  />
                </div>
                <a 
                  href="https://faucet.solana.com/" 
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

      {/* Test Result */}
      {testResult && (
        <Card>
          <CardHeader>
            <CardTitle>Test Transaction Result</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center space-x-3">
                <Badge variant="outline" className="bg-blue-500 text-white">
                  {testResult.status?.toUpperCase() || 'PENDING'}
                </Badge>
                <span className="font-medium">
                  {testResult.amount} {testResult.token}
                </span>
                <span className="text-sm text-muted-foreground">
                  {testResult.fromChain?.toUpperCase()} → {testResult.toChain?.toUpperCase()}
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-muted-foreground">Transaction ID</div>
                  <div className="font-mono text-xs">{testResult.id}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Bridge Fee</div>
                  <div>{testResult.fee} {testResult.token}</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Estimated Time</div>
                  <div>{testResult.estimatedTime} seconds</div>
                </div>
                <div>
                  <div className="text-muted-foreground">Status</div>
                  <div>{testResult.status || 'pending'}</div>
                </div>
              </div>

              <Alert>
                <CheckCircle className="h-4 w-4" />
                <AlertDescription>
                  Bridge test initiated successfully! The transaction will be processed through the testnet bridge infrastructure.
                </AlertDescription>
              </Alert>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}