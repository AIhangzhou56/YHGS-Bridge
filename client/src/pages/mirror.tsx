import { Navigation } from "@/components/navigation";
import { MirrorBridge } from '@/components/mirror-bridge';

export default function Mirror() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-orange-900 to-slate-900">
      <Navigation />
      <div className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-4xl font-bold text-white mb-2">ERC-20 Mirror Bridge</h1>
          <p className="text-lg text-slate-300">
            Lock ERC-20 tokens on Ethereum and mint mirrored BEP-20 tokens on BSC
          </p>
        </div>
        <MirrorBridge />
      </div>
    </div>
  );
}