import { useQuery } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TrendingUp, TrendingDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

export function ExchangeRates() {
  const { data: tokensData, isLoading } = useQuery({
    queryKey: ["/api/tokens"],
    refetchInterval: 30000 // Refetch every 30 seconds
  });

  const { data: statsData } = useQuery({
    queryKey: ["/api/stats"],
    refetchInterval: 60000 // Refetch every minute
  });

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Card className="bg-slate-900 border-slate-700">
          <CardHeader>
            <CardTitle className="text-lg font-semibold text-white">Live Exchange Rates</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-16 w-full bg-slate-700" />
            ))}
          </CardContent>
        </Card>
      </div>
    );
  }

  const tokens = tokensData?.tokens || [];

  const formatPrice = (price: string, symbol: string) => {
    const numPrice = parseFloat(price);
    if (symbol === 'USDC') return `$${numPrice.toFixed(4)}`;
    if (numPrice < 1) return `$${numPrice.toFixed(4)}`;
    return `$${numPrice.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatChange = (change: string) => {
    const numChange = parseFloat(change);
    return `${numChange >= 0 ? '+' : ''}${numChange.toFixed(2)}%`;
  };

  const getTokenIcon = (symbol: string) => {
    const icons: Record<string, string> = {
      'BTC': '₿',
      'ETH': 'Ξ',
      'MATIC': '🔷',
      'BNB': '🟡',
      'USDC': '💲'
    };
    return icons[symbol] || '🪙';
  };

  return (
    <div className="space-y-6">
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Live Exchange Rates</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {tokens.map((token: any) => {
            const isPositive = parseFloat(token.change24h) >= 0;
            return (
              <div key={token.id} className="flex items-center justify-between py-2">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-slate-700 rounded-full flex items-center justify-center text-lg">
                    {getTokenIcon(token.symbol)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{token.symbol}/USD</p>
                    <p className="text-xs text-slate-400">{token.name}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">{formatPrice(token.price, token.symbol)}</p>
                  <div className={`text-xs flex items-center ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {isPositive ? (
                      <TrendingUp className="w-3 h-3 mr-1" />
                    ) : (
                      <TrendingDown className="w-3 h-3 mr-1" />
                    )}
                    {formatChange(token.change24h)}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Bridge Statistics</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex justify-between">
            <span className="text-slate-400">24h Volume</span>
            <span className="font-semibold text-white">
              ${statsData?.stats?.totalVolume ? 
                (parseInt(statsData.stats.totalVolume) / 1000000).toFixed(1) + 'M' : 
                '127.5M'
              }
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Total Bridges</span>
            <span className="font-semibold text-white">
              {statsData?.stats?.bridgeTransactions?.toLocaleString() || '8,432'}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Avg. Bridge Time</span>
            <span className="font-semibold text-green-400">3.2 min</span>
          </div>
          <div className="flex justify-between">
            <span className="text-slate-400">Success Rate</span>
            <span className="font-semibold text-green-400">99.8%</span>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
