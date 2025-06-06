import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWallet } from "@/hooks/use-wallet";
import { Skeleton } from "@/components/ui/skeleton";

export function PortfolioOverview() {
  const { walletState } = useWallet();

  if (!walletState.isConnected) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent className="text-center py-8">
          <p className="text-slate-400">Connect your wallet to view portfolio</p>
        </CardContent>
      </Card>
    );
  }

  if (walletState.balances.length === 0) {
    return (
      <Card className="bg-slate-900 border-slate-700">
        <CardHeader>
          <CardTitle className="text-lg font-semibold text-white">Portfolio Overview</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 w-full bg-slate-700" />
          ))}
        </CardContent>
      </Card>
    );
  }

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

  const formatAmount = (amount: string, symbol: string) => {
    const num = parseFloat(amount);
    if (symbol === 'USDC' || num > 100) {
      return num.toFixed(2);
    }
    return num.toFixed(4);
  };

  const formatValue = (value: number) => {
    return `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const formatChange = (change: string) => {
    const numChange = parseFloat(change);
    return `${numChange >= 0 ? '+' : ''}${numChange.toFixed(1)}%`;
  };

  return (
    <Card className="bg-slate-900 border-slate-700">
      <CardHeader>
        <CardTitle className="text-lg font-semibold text-white">Portfolio Overview</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-center mb-6">
          <div className="text-3xl font-bold text-white">
            {formatValue(walletState.totalBalance)}
          </div>
          <div className="text-slate-400">Total Balance</div>
          <div className="text-green-400 text-sm mt-1">+$284.12 (2.26%)</div>
        </div>

        <div className="space-y-3">
          {walletState.balances.map((balance, index) => {
            const isPositive = parseFloat(balance.token.change24h) >= 0;
            return (
              <div key={index} className="flex items-center justify-between p-4 bg-slate-800 rounded-lg">
                <div className="flex items-center space-x-3">
                  <div className="w-10 h-10 bg-slate-700 rounded-full flex items-center justify-center text-lg">
                    {getTokenIcon(balance.token.symbol)}
                  </div>
                  <div>
                    <p className="font-medium text-white">{balance.token.symbol}</p>
                    <p className="text-sm text-slate-400">
                      {formatAmount(balance.amount, balance.token.symbol)} {balance.token.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-white">{formatValue(balance.value)}</p>
                  <p className={`text-sm ${isPositive ? 'text-green-400' : 'text-red-400'}`}>
                    {formatChange(balance.token.change24h)}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}
