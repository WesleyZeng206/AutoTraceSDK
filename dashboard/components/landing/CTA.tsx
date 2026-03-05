'use client';

import Link from 'next/link';

export function CTA() {
  return (
    <section className="py-32 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-4">Get Started</p>
          <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
            Start monitoring your application today
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto leading-relaxed">
            Free to self-host. Open source. Everything you need to understand what your application is doing.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-400 transition-colors">
              Create Free Account
            </Link>
            <a
              href="https://github.com/WesleyZeng206/AutoTraceSDK"
              target="_blank"
              rel="noopener noreferrer"
              className="w-full sm:w-auto px-8 py-4 border border-zinc-700 text-zinc-300 rounded-lg font-medium hover:bg-zinc-800 hover:text-white transition-colors">
              View on GitHub
            </a>
          </div>

          <div className="mt-16 pt-16 border-t border-zinc-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              {[
                { value: '<100ms', label: 'Ingestion latency' },
                { value: '99.9%', label: 'Uptime SLA' },
                { value: '30 days', label: 'Data retention' },
                { value: 'MIT', label: 'Open source' },
              ].map((item) => (
                <div key={item.label}>
                  <div className="text-2xl font-bold text-amber-400 font-mono mb-1">{item.value}</div>
                  <div className="text-sm text-zinc-500">{item.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
