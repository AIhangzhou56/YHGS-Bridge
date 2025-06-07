import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { WalletConnection } from "./wallet-connection";
import { useState } from "react";
import { BringToFront, Wallet, TrendingUp } from "lucide-react";

export function Header() {
  const { walletState, disconnectWallet } = useWallet();
  const [showWalletModal, setShowWalletModal] = useState(false);

  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  return (
    <>
      <header className="bg-slate-900 border-b border-slate-800 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center space-x-8">
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-gradient-to-r from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                  <BringToFront className="w-4 h-4 text-white" />
                </div>
                <span className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                  CryptoVault
                </span>
              </div>
              <nav className="hidden md:flex space-x-6">
                <a href="/bridge" className="text-blue-400 font-medium">Bridge</a>
                <a href="/mirror" className="text-slate-400 hover:text-slate-200 transition-colors">Mirror</a>
                <a href="/relay" className="text-slate-400 hover:text-slate-200 transition-colors">Relay</a>
                <a href="/testnet" className="text-slate-400 hover:text-slate-200 transition-colors">Testnet</a>
              </nav>
            </div>
            
            <div className="flex items-center space-x-4">
              <div className="hidden sm:block">
                <div className="bg-slate-800 px-3 py-2 rounded-lg text-sm">
                  <span className="text-slate-400">Gas:</span>
                  <span className="text-green-400 ml-1">45 gwei</span>
                </div>
              </div>
              
              {walletState.isConnected ? (
                <div className="flex items-center space-x-4">
                  <div className="hidden sm:block text-right">
                    <div className="text-lg font-semibold">
                      ${walletState.totalBalance.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                    </div>
                    <div className="text-sm text-green-400">+2.45% (24h)</div>
                  </div>
                  <Button
                    onClick={disconnectWallet}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {formatAddress(walletState.address!)}
                  </Button>
                </div>
              ) : (
                <Button
                  onClick={() => setShowWalletModal(true)}
                  className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
                >
                  <Wallet className="w-4 h-4 mr-2" />
                  Connect Wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <WalletConnection 
        open={showWalletModal} 
        onClose={() => setShowWalletModal(false)} 
      />
    </>
  );
}
