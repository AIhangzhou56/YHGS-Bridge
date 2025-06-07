import { TestnetBridge } from '@/components/testnet-bridge';

export default function Testnet() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Bridge Testnet</h1>
          <p className="text-lg text-slate-300">
            Test ETH ↔ SOL bridge functionality with live transaction monitoring
          </p>
        </div>
        <TestnetBridge />
      </div>
    </div>
  );
}