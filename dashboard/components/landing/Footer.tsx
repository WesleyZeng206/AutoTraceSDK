import Link from 'next/link';

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-zinc-400 py-16 border-t border-zinc-800/60">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-sm tracking-tight">AT</span>
              </div>
              <span className="text-lg font-semibold text-white tracking-tight">AutoTrace</span>
            </div>
            <p className="text-sm text-zinc-500 max-w-xs leading-relaxed">
              Open source application telemetry for modern development teams. Simple setup, powerful insights.
            </p>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold mb-4 uppercase tracking-widest">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#setup" className="hover:text-white transition-colors">Setup Guide</a></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-xs font-semibold mb-4 uppercase tracking-widest">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="https://github.com/WesleyZeng206/AutoTraceSDK" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://www.npmjs.com/package/autotracesdk" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  npm Package</a>
              </li>
              <li><Link href="/register" className="hover:text-white transition-colors">Get Started</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800/60 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-xs text-zinc-600 font-mono">
            © {year} AutoTrace · MIT License
          </p>
          <a href="https://github.com/WesleyZeng206/AutoTraceSDK"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-zinc-600 hover:text-white transition-colors font-mono">
            github.com/WesleyZeng206/AutoTraceSDK
          </a>
        </div>
      </div>
    </footer>
  );
}
