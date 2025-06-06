import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useWallet } from "@/hooks/use-wallet";
import { ArrowRight, Clock, CheckCircle, XCircle } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function TransactionHistory() {
  const { walletState } = useWallet();

  const { data: transactionsData, isLoading } = useQuery({
    queryKey: ["/api/transactions", walletState.address],
    enabled: !!walletState.address,
    refetchInterval: 10000 // Refetch every 10 seconds to catch status updates
  });

  if (!walletState.isConnected) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-slate-400">Connect your wallet to view transactions</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-20 w-full bg-slate-700" />
          ))}
        </CardContent>
      </Card>
    );
  }

  const transactions = transactionsData?.transactions || [];

  if (transactions.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Recent Transactions</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-slate-400">No transactions yet</p>
        </CardContent>
      </Card>
    );
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "completed":
        return <CheckCircle className="w-5 h-5 text-green-400" />;
      case "pending":
        return <Clock className="w-5 h-5 text-yellow-400" />;
      case "failed":
        return <XCircle className="w-5 h-5 text-red-400" />;
      default:
        return <Clock className="w-5 h-5 text-slate-400" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "completed":
        return "bg-green-400/20 text-green-400";
      case "pending":
        return "bg-yellow-400/20 text-yellow-400";
      case "failed":
        return "bg-red-400/20 text-red-400";
      default:
        return "bg-slate-400/20 text-slate-400";
    }
  };

  const formatTime = (date: string) => {
    const now = new Date();
    const txTime = new Date(date);
    const diffMs = now.getTime() - txTime.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60));

    if (diffMins < 60) {
      return `${diffMins}m ago`;
    } else if (diffHours < 24) {
      return `${diffHours}h ago`;
    } else {
      return txTime.toLocaleDateString();
    }
  };

  const formatTxHash = (hash: string) => {
    if (!hash) return "Pending...";
    return `${hash.slice(0, 6)}...${hash.slice(-4)}`;
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="text-lg font-semibold text-white">Recent Transactions</CardTitle>
        <button className="text-blue-400 hover:text-blue-300 text-sm">View All</button>
      </CardHeader>
      <CardContent className="space-y-4">
        {transactions.map((tx: any) => (
          <div key={tx.id} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center">
                {getStatusIcon(tx.status)}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <p className="font-medium text-white">
                    Bridge {tx.fromToken} → {tx.toToken}
                  </p>
                  <ArrowRight className="w-3 h-3 text-slate-400" />
                </div>
                <p className="text-sm text-slate-400 font-mono">
                  {formatTxHash(tx.txHash)}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="font-semibold text-white">
                {parseFloat(tx.amount).toFixed(4)} {tx.fromToken}
              </p>
              <div className="flex items-center space-x-2">
                <Badge className={`text-xs ${getStatusColor(tx.status)}`}>
                  {tx.status.charAt(0).toUpperCase() + tx.status.slice(1)}
                </Badge>
                <span className="text-xs text-slate-400">
                  {formatTime(tx.createdAt)}
                </span>
              </div>
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
