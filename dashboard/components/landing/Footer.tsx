import Link from 'next/link';

const year = new Date().getFullYear();

export function Footer() {
  return (
    <footer className="bg-[#0a0a0a] text-zinc-400 py-16 border-t border-zinc-800">
      <div className="max-w-6xl mx-auto px-6">
        <div className="grid md:grid-cols-4 gap-12 mb-12">
          <div className="md:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
                <span className="text-black font-bold text-sm">AT</span>
              </div>
              <span className="text-lg font-semibold text-white">AutoTrace</span>
            </div>
            <p className="text-sm text-zinc-500 max-w-sm">
              Open source application telemetry for modern development teams. Simple setup, powerful insights.
            </p>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider">Product</h4>
            <ul className="space-y-3 text-sm">
              <li><a href="#features" className="hover:text-white transition-colors">Features</a></li>
              <li><a href="#setup" className="hover:text-white transition-colors">Setup Guide</a></li>
              <li><Link href="/dashboard" className="hover:text-white transition-colors">Dashboard</Link></li>
              <li><Link href="/docs" className="hover:text-white transition-colors">Documentation</Link></li>
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold mb-4 uppercase tracking-wider">Resources</h4>
            <ul className="space-y-3 text-sm">
              <li>
                <a href="https://github.com/WesleyZeng206/AutoTraceSDK" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://www.npmjs.com/package/autotracesdk"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-white transition-colors">
                  npm Package
                </a>
              </li>
              <li><Link href="/register" className="hover:text-white transition-colors">Get Started</Link></li>
            </ul>
          </div>
        </div>

        <div className="pt-8 border-t border-zinc-800 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-zinc-600">
            {year} AutoTrace. MIT License.
          </p>
          <div className="flex gap-6 text-sm">
            <a href="https://github.com/WesleyZeng206/AutoTraceSDK" target="_blank" rel="noopener noreferrer" className="hover:text-white transition-colors">
              GitHub
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
}
