import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { Loader2, Play, Square, Wifi, WifiOff, Activity, CheckCircle, AlertCircle } from 'lucide-react';

interface RelayStatus {
  isRunning: boolean;
  processedEvents: number;
  ethereumBlock: number;
  bscBlock: number;
  ethBridge: string;
  bscBridge: string;
  ethSigner: string;
  bscSigner: string;
}

export function RelayMonitor() {
  const [status, setStatus] = useState<RelayStatus | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [connectionTest, setConnectionTest] = useState<boolean | null>(null);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const { toast } = useToast();

  useEffect(() => {
    fetchStatus();
    
    if (autoRefresh) {
      const interval = setInterval(fetchStatus, 5000);
      return () => clearInterval(interval);
    }
  }, [autoRefresh]);

  const fetchStatus = async () => {
    try {
      const response = await fetch('/api/relay/status');
      const data = await response.json();
      
      if (response.ok) {
        setStatus(data.status);
      } else {
        console.error('Failed to fetch relay status:', data.error);
      }
    } catch (error) {
      console.error('Error fetching relay status:', error);
    }
  };

  const testConnections = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/relay/test-connections');
      const data = await response.json();
      
      if (response.ok) {
        setConnectionTest(data.connected);
        toast({
          title: data.connected ? "Connections Successful" : "Connection Failed",
          description: data.connected ? "Both Ethereum and BSC networks are accessible" : "Network connectivity issues detected",
          variant: data.connected ? "default" : "destructive"
        });
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      setConnectionTest(false);
      toast({
        title: "Connection Test Failed",
        description: error.message || "Failed to test network connections",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const startRelay = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/relay/start', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Relay Started",
          description: "Ethereum-BSC relay service is now active"
        });
        fetchStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Failed to Start Relay",
        description: error.message || "Could not start the relay service",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const stopRelay = async () => {
    setIsLoading(true);
    try {
      const response = await fetch('/api/relay/stop', {
        method: 'POST'
      });
      const data = await response.json();
      
      if (response.ok) {
        toast({
          title: "Relay Stopped",
          description: "Ethereum-BSC relay service has been stopped"
        });
        fetchStatus();
      } else {
        throw new Error(data.error);
      }
    } catch (error: any) {
      toast({
        title: "Failed to Stop Relay",
        description: error.message || "Could not stop the relay service",
        variant: "destructive"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const formatAddress = (address: string) => {
    if (address === "unknown" || !address) return "Not configured";
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <div className="space-y-6">
      {/* Service Status Header */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-3">
            <div className={`w-3 h-3 rounded-full ${status?.isRunning ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></div>
            <span>Ethereum → BSC Relay Service</span>
            <Badge variant={status?.isRunning ? "default" : "secondary"}>
              {status?.isRunning ? "ACTIVE" : "STOPPED"}
            </Badge>
          </CardTitle>
          <CardDescription>
            Automated relay service for ERC-20 lock events from Ethereum to BSC minting
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            <Button
              onClick={status?.isRunning ? stopRelay : startRelay}
              disabled={isLoading}
              variant={status?.isRunning ? "destructive" : "default"}
              size="sm"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {status?.isRunning ? (
                <>
                  <Square className="mr-2 h-4 w-4" />
                  Stop Relay
                </>
              ) : (
                <>
                  <Play className="mr-2 h-4 w-4" />
                  Start Relay
                </>
              )}
            </Button>
            
            <Button
              onClick={testConnections}
              disabled={isLoading}
              variant="outline"
              size="sm"
            >
              {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {connectionTest === true ? (
                <Wifi className="mr-2 h-4 w-4 text-green-500" />
              ) : connectionTest === false ? (
                <WifiOff className="mr-2 h-4 w-4 text-red-500" />
              ) : (
                <Wifi className="mr-2 h-4 w-4" />
              )}
              Test Connections
            </Button>

            <Button
              onClick={() => setAutoRefresh(!autoRefresh)}
              variant="outline"
              size="sm"
            >
              <Activity className={`mr-2 h-4 w-4 ${autoRefresh ? 'animate-pulse' : ''}`} />
              Auto Refresh {autoRefresh ? 'On' : 'Off'}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Network Status */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ethereum Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Latest Block:</span>
              <span className="font-mono">{status?.ethereumBlock?.toLocaleString() || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bridge Contract:</span>
              <span className="font-mono text-xs">{formatAddress(status?.ethBridge || '')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Signer Address:</span>
              <span className="font-mono text-xs">{formatAddress(status?.ethSigner || '')}</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">BSC Network</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Latest Block:</span>
              <span className="font-mono">{status?.bscBlock?.toLocaleString() || 'N/A'}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Bridge Contract:</span>
              <span className="font-mono text-xs">{formatAddress(status?.bscBridge || '')}</span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground">Signer Address:</span>
              <span className="font-mono text-xs">{formatAddress(status?.bscSigner || '')}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Processing Statistics */}
      <Card>
        <CardHeader>
          <CardTitle>Processing Statistics</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="text-center">
              <div className="text-3xl font-bold text-blue-400">
                {status?.processedEvents || 0}
              </div>
              <div className="text-sm text-muted-foreground">Events Processed</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-green-400">
                {status?.isRunning ? 'ACTIVE' : 'STOPPED'}
              </div>
              <div className="text-sm text-muted-foreground">Service Status</div>
            </div>
            <div className="text-center">
              <div className="text-3xl font-bold text-purple-400">
                {connectionTest === true ? 'CONNECTED' : connectionTest === false ? 'FAILED' : 'UNKNOWN'}
              </div>
              <div className="text-sm text-muted-foreground">Network Status</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Service Information */}
      <Card>
        <CardHeader>
          <CardTitle>How the Relay Works</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              The relay service monitors Ethereum for ERC-20 lock events and automatically submits mint proofs to BSC.
            </AlertDescription>
          </Alert>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="space-y-2">
              <h4 className="font-medium flex items-center">
                <span className="w-6 h-6 bg-blue-500 text-white rounded-full flex items-center justify-center text-xs mr-2">1</span>
                Listen for Locks
              </h4>
              <p className="text-muted-foreground">
                Monitors Ethereum bridge contract for Locked events targeting BSC
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center">
                <span className="w-6 h-6 bg-purple-500 text-white rounded-full flex items-center justify-center text-xs mr-2">2</span>
                Generate Proof
              </h4>
              <p className="text-muted-foreground">
                Creates cryptographic proof of the lock event with block validation
              </p>
            </div>
            <div className="space-y-2">
              <h4 className="font-medium flex items-center">
                <span className="w-6 h-6 bg-green-500 text-white rounded-full flex items-center justify-center text-xs mr-2">3</span>
                Submit Mint
              </h4>
              <p className="text-muted-foreground">
                Submits mint transaction to BSC bridge contract with proof
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Configuration Requirements */}
      <Card>
        <CardHeader>
          <CardTitle>Configuration Requirements</CardTitle>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Ensure the following environment variables are configured for the relay to function:
            </AlertDescription>
          </Alert>
          
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div>
              <h5 className="font-medium mb-2">Ethereum Configuration:</h5>
              <ul className="space-y-1 text-muted-foreground">
                <li>• ETHEREUM_RPC (Sepolia endpoint)</li>
                <li>• ETHEREUM_PRIVATE_KEY</li>
                <li>• ETHEREUM_BRIDGE_CONTRACT</li>
              </ul>
            </div>
            <div>
              <h5 className="font-medium mb-2">BSC Configuration:</h5>
              <ul className="space-y-1 text-muted-foreground">
                <li>• BSC_TESTNET_RPC</li>
                <li>• BSC_PRIVATE_KEY</li>
                <li>• BSC_BRIDGE_CONTRACT</li>
              </ul>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}