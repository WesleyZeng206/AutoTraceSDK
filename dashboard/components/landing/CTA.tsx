'use client';

import Link from 'next/link';

export function CTA() {
  return (
    <section className="py-32 bg-zinc-900">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-3xl mx-auto text-center">
          <h2 className="text-4xl lg:text-5xl font-bold text-white tracking-tight mb-6">
            Start monitoring your application today
          </h2>
          <p className="text-lg text-zinc-400 mb-10 max-w-xl mx-auto">
            Join developers who ship with confidence. Free tier includes everything you need to get started.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Link
              href="/register"
              className="w-full sm:w-auto px-8 py-4 bg-white text-zinc-900 rounded-lg font-medium hover:bg-zinc-100 transition-colors">
              Create Free Account
            </Link>
            <a href="https://github.com/WesleyZeng206/AutoTraceSDK" target="_blank" rel="noopener noreferrer" className="w-full sm:w-auto px-8 py-4 border border-zinc-700 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors">
              View on GitHub
            </a>
          </div>

          <div className="mt-16 pt-16 border-t border-zinc-800">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
              <div>
                <div className="text-3xl font-bold text-white mb-1">{'<'}100ms</div>
                <div className="text-sm text-zinc-500">Ingestion latency</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">99.9%</div>
                <div className="text-sm text-zinc-500">Uptime SLA</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">30 days</div>
                <div className="text-sm text-zinc-500">Data retention</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white mb-1">Open</div>
                <div className="text-sm text-zinc-500">Source license</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
