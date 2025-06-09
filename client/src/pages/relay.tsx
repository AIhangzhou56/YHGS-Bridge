import { Navigation } from "@/components/navigation";
import { RelayMonitor } from '@/components/relay-monitor';

export default function Relay() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-slate-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">Ethereum ↔ BSC Relay</h1>
          <p className="text-lg text-slate-300">
            Monitor and control the automated relay service for cross-chain bridge operations
          </p>
        </div>
        <RelayMonitor />
      </div>
    </div>
  );
}