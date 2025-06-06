import { Header } from "@/components/header";
import { BridgeInterface } from "@/components/bridge-interface";
import { ExchangeRates } from "@/components/exchange-rates";
import { PortfolioOverview } from "@/components/portfolio-overview";
import { TransactionHistory } from "@/components/transaction-history";

export default function Bridge() {
  return (
    <div className="min-h-screen bg-slate-950">
      <Header />
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main Bridge Interface */}
          <div className="lg:col-span-2">
            <BridgeInterface />
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            <ExchangeRates />
          </div>
        </div>

        {/* Portfolio and History Section */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-8">
          <PortfolioOverview />
          <TransactionHistory />
        </div>
      </div>
    </div>
  );
}
