'use client';

import Link from 'next/link';
import { useState, useEffect } from 'react';

const generateMetric = () => ({
  latency: Math.floor(Math.random() * 150) + 20,
  requests: Math.floor(Math.random() * 1000) + 500,
  errors: Math.floor(Math.random() * 5),
});

export function Hero() {
  const [metrics, setMetrics] = useState(generateMetric());
  const [isLive, setIsLive] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(generateMetric());
    }, 2000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="relative min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      <div
        className="absolute inset-0 opacity-[0.02]"
        style={{
          backgroundImage: `linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)`,
          backgroundSize: '60px 60px'
        }}/>

      <nav className="relative z-20 border-b border-white/5">
        <div className="max-w-6xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
                <span className="text-black font-bold text-sm">AT</span>
              </div>
              <span className="text-lg font-semibold tracking-tight">AutoTrace</span>
            </div>
            <div className="flex items-center gap-8">
              <a href="#features" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Features
              </a>
              <a href="#setup" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Setup
              </a>
              <Link href="/docs" className="text-sm text-zinc-400 hover:text-white transition-colors">
                Docs
              </Link>
              <a href="https://github.com/WesleyZeng206/AutoTraceSDK" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-400 hover:text-white transition-colors">
                GitHub
              </a>
              <Link href="/login" className="text-sm px-4 py-2 bg-white text-black rounded-md font-medium hover:bg-zinc-200 transition-colors">
                Sign In
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="relative z-10 max-w-6xl mx-auto px-6 pt-24 pb-32">
        <div className="grid lg:grid-cols-2 gap-16 items-start">
          <div className="space-y-8">
            <div className="inline-flex items-center gap-2 text-sm text-zinc-400 border border-zinc-800 rounded-full px-4 py-1.5">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
              Open Source Telemetry
            </div>

            <h1 className="text-5xl lg:text-6xl font-bold tracking-tight leading-[1.1]">
              Application observability,{' '}
              <span className="text-zinc-500">simplified.</span>
            </h1>

            <p className="text-lg text-zinc-400 leading-relaxed max-w-lg">
              Track performance metrics, detect anomalies, and understand your application's behavior with a single npm package. No complex setup required.
            </p>

            <div className="space-y-4">
              <div className="bg-zinc-900/50 border border-zinc-800 rounded-lg p-4 font-mono text-sm">
                <span className="text-zinc-500">$</span>{' '}
                <span className="text-emerald-400">npm install</span>{' '}
                <span className="text-white">autotracesdk</span>
              </div>

              <div className="flex flex-wrap gap-3">
                <Link href="/register" className="px-6 py-3 bg-white text-black rounded-md font-medium hover:bg-zinc-200 transition-colors">
                  Get Started Free
                </Link>
                <Link href="/docs" className="px-6 py-3 border border-zinc-700 text-white rounded-md font-medium hover:bg-zinc-900 transition-colors" >
                  Read the Docs
                </Link>
              </div>
            </div>
          </div>

          <div className="relative">
            <div className="bg-zinc-900/80 border border-zinc-800 rounded-xl overflow-hidden backdrop-blur-sm">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800 bg-zinc-900/50">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                </div>
                <div className="flex items-center gap-2 text-xs">
                  <span className={`flex items-center gap-1 ${isLive ? 'text-emerald-400' : 'text-zinc-500'}`}>
                    <span className="relative flex h-1.5 w-1.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                    </span>
                    Live
                  </span>
                </div>
              </div>

              <div className="p-6 space-y-6">
                <div className="grid grid-cols-3 gap-4">
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Requests/min</div>
                    <div className="text-2xl font-semibold tabular-nums">{metrics.requests.toLocaleString()}</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Avg Latency</div>
                    <div className="text-2xl font-semibold tabular-nums">{metrics.latency}ms</div>
                  </div>
                  <div className="bg-zinc-800/50 rounded-lg p-4">
                    <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1">Errors</div>
                    <div className={`text-2xl font-semibold tabular-nums ${metrics.errors > 3 ? 'text-amber-400' : 'text-emerald-400'}`}>
                      {metrics.errors}
                    </div>
                  </div>
                </div>

                <div className="bg-zinc-800/30 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs text-zinc-500">Response Time (last 60s)</span>
                  </div>
                  <div className="flex items-end gap-1 h-16">
                    {Array.from({ length: 30 }).map((_, i) => {
                      const height = 20 + Math.random() * 80;
                      return (
                        <div key={i}
                          className="flex-1 bg-zinc-700 rounded-sm transition-all duration-300"
                          style={{
                            height: `${height}%`,
                            opacity: i > 24 ? 1 : 0.3 + (i / 30) * 0.7
                          }}/>);
                    })}
                  </div>
                </div>

                <div className="space-y-2">
                  <div className="text-xs text-zinc-500 uppercase tracking-wide mb-2">Active Services</div>
                  {['api-gateway', 'auth-service', 'user-service'].map((service, i) => (
                    <div key={service} className="flex items-center justify-between py-2 px-3 bg-zinc-800/30 rounded-lg">
                      <span className="text-sm text-zinc-300">{service}</span>
                      <span className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                        healthy
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute -inset-px bg-gradient-to-b from-zinc-700/20 to-transparent rounded-xl pointer-events-none" />
          </div>
        </div>
      </div>

      <div className="absolute bottom-0 left-0 right-0 h-32 bg-gradient-to-t from-[#0a0a0a] to-transparent" />
    </div>
  );
}
