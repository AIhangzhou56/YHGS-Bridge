import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useWallet } from "@/hooks/use-wallet";
import { Wallet, Smartphone, QrCode, Loader2 } from "lucide-react";

interface WalletConnectionProps {
  open: boolean;
  onClose: () => void;
}

export function WalletConnection({ open, onClose }: WalletConnectionProps) {
  const { connectWallet, isConnecting, connectionError } = useWallet();

  const walletOptions = [
    {
      name: "MetaMask",
      description: "Connect using browser wallet",
      icon: Wallet,
      color: "bg-orange-500"
    },
    {
      name: "WalletConnect",
      description: "Scan with wallet to connect",
      icon: QrCode,
      color: "bg-blue-500"
    },
    {
      name: "Coinbase Wallet",
      description: "Connect using Coinbase Wallet",
      icon: Smartphone,
      color: "bg-purple-500"
    }
  ];

  const handleWalletSelect = async (walletName: string) => {
    await connectWallet(walletName);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md bg-slate-900 border-slate-700">
        <DialogHeader>
          <DialogTitle className="text-xl font-semibold text-white">Connect Wallet</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-3">
          {connectionError && (
            <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm">
              Failed to connect wallet. Please try again.
            </div>
          )}
          
          {walletOptions.map((wallet) => {
            const IconComponent = wallet.icon;
            return (
              <Button
                key={wallet.name}
                onClick={() => handleWalletSelect(wallet.name)}
                disabled={isConnecting}
                className="w-full flex items-center space-x-4 p-4 h-auto justify-start bg-slate-800 hover:bg-slate-700 border border-slate-600"
                variant="outline"
              >
                {isConnecting ? (
                  <Loader2 className="w-10 h-10 animate-spin text-blue-400" />
                ) : (
                  <div className={`w-10 h-10 ${wallet.color} rounded-lg flex items-center justify-center`}>
                    <IconComponent className="w-5 h-5 text-white" />
                  </div>
                )}
                <div className="text-left">
                  <p className="font-medium text-white">{wallet.name}</p>
                  <p className="text-sm text-slate-400">{wallet.description}</p>
                </div>
              </Button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
