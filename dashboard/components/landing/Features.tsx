export function Features() {
  return (
    <section id="features" className="py-32 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-20">
          <h2 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">
            Everything you need to understand your application
          </h2>
          <p className="text-lg text-zinc-600">
            Built for developers who want observability without the complexity of enterprise platforms.
          </p>
        </div>

        <div className="space-y-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <div className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">Performance</div>
              <h3 className="text-2xl font-bold text-zinc-900 mb-4">Real-time Metrics</h3>
              <p className="text-zinc-600 mb-6">
                Watch your application performance as it happens. Latency, throughput, and error rates update every second with sub-100ms ingestion latency.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-zinc-900">{'<'}100ms</span>
                <span className="text-zinc-500">ingestion latency</span>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-6">
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="bg-zinc-800 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Requests</div>
                  <div className="text-xl font-semibold text-white">12.4k</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Latency</div>
                  <div className="text-xl font-semibold text-white">42ms</div>
                </div>
                <div className="bg-zinc-800 rounded-lg p-3">
                  <div className="text-xs text-zinc-500 mb-1">Errors</div>
                  <div className="text-xl font-semibold text-emerald-400">0.1%</div>
                </div>
              </div>
              <div className="flex items-end gap-1 h-24">
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={i}
                    className="flex-1 bg-zinc-700 rounded-sm"
                    style={{ height: `${25 + Math.sin(i * 0.5) * 20 + Math.random() * 30}%` }}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-zinc-50 rounded-xl p-6 border border-zinc-200">
              <div className="space-y-3">
                <div className="flex items-center gap-3 p-3 bg-red-50 border border-red-200 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-red-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-900">Latency spike on /api/users</div>
                    <div className="text-xs text-zinc-500">z-score 4.2 · baseline 45ms</div>
                  </div>
                  <span className="text-xs text-zinc-500">2m ago</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-900">Error rate increase on /api/auth</div>
                    <div className="text-xs text-zinc-500">z-score 2.8 · baseline 0.5%</div>
                  </div>
                  <span className="text-xs text-zinc-500">5m ago</span>
                </div>
                <div className="flex items-center gap-3 p-3 bg-zinc-100 rounded-lg">
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                  <div className="flex-1">
                    <div className="text-sm font-medium text-zinc-900">All systems normal</div>
                    <div className="text-xs text-zinc-500">No anomalies detected</div>
                  </div>
                  <span className="text-xs text-zinc-500">now</span>
                </div>
              </div>
            </div>
            <div className="order-1 lg:order-2">
              <div className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">Intelligence</div>
              <h3 className="text-2xl font-bold text-zinc-900 mb-4">Anomaly Detection</h3>
              <p className="text-zinc-600 mb-6">
                Automatically surface unusual patterns in your data using statistical analysis. Get alerted before issues become incidents.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-zinc-900">99.9%</span>
                <span className="text-zinc-500">detection accuracy</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8 lg:p-12">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="text-sm font-medium text-zinc-500 uppercase tracking-wider mb-2">Setup</div>
                <h3 className="text-2xl font-bold text-white mb-4">Zero Configuration</h3>
                <p className="text-zinc-400 mb-6">
                  Add the middleware, set your API key, and you're done. Auto-instruments Express routes out of the box. Built-in queue with automatic retries ensures your telemetry survives deploys.
                </p>
                <div className="flex items-center gap-8">
                  <div>
                    <span className="text-3xl font-bold text-white">4</span>
                    <span className="text-zinc-500 ml-2">lines of code</span>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-white">0</span>
                    <span className="text-zinc-500 ml-2">events lost</span>
                  </div>
                </div>
              </div>
              <div className="bg-zinc-800 rounded-xl p-4 font-mono text-sm">
                <div className="text-zinc-500">// app.js</div>
                <div className="mt-2">
                  <span className="text-purple-400">import</span>
                  <span className="text-zinc-300"> {'{ createAutoTraceSDKMiddleware }'} </span>
                  <span className="text-purple-400">from</span>
                  <span className="text-emerald-400"> 'autotracesdk'</span>
                </div>
                <div className="mt-4 text-zinc-300">
                  app.<span className="text-yellow-400">use</span>(createAutoTraceSDKMiddleware({'{'}
                </div>
                <div className="text-zinc-300 pl-4">
                  serviceName: <span className="text-emerald-400">'my-api'</span>,
                </div>
                <div className="text-zinc-300 pl-4">
                  ingestionUrl: <span className="text-emerald-400">'http://localhost:4000/telemetry'</span>,
                </div>
                <div className="text-zinc-300 pl-4">
                  apiKey: process.env.<span className="text-orange-400">AUTOTRACE_KEY</span>
                </div>
                <div className="text-zinc-300">{'}'})</div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900 mb-2">Unlimited</div>
              <div className="text-sm text-zinc-500 uppercase tracking-wider mb-4">Team Members</div>
              <p className="text-zinc-600 text-sm">
                Organize by team with isolated API keys and role-based access controls.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900 mb-2">30 days</div>
              <div className="text-sm text-zinc-500 uppercase tracking-wider mb-4">Data Retention</div>
              <p className="text-zinc-600 text-sm">
                Query your data across any time range. Find patterns and track improvements.
              </p>
            </div>
            <div className="text-center">
              <div className="text-4xl font-bold text-zinc-900 mb-2">Open</div>
              <div className="text-sm text-zinc-500 uppercase tracking-wider mb-4">Source License</div>
              <p className="text-zinc-600 text-sm">
                MIT licensed. Self-host or use our managed service. Your choice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
