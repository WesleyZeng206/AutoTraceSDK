export function Features() {
  return (
    <section id="features" className="py-32 bg-white">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-20">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">The Platform</p>
          <h2 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">
            Everything you need to understand your application
          </h2>
          <p className="text-lg text-zinc-500">
            Built for developers who want observability without the complexity of enterprise platforms.
          </p>
        </div>

        <div className="space-y-16">
          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div>
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Performance</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight mb-4">Real-time Metrics</h3>
              <p className="text-zinc-500 mb-6 leading-relaxed">
                Watch your application performance as it happens. Latency, throughput, and error rates update every second with sub-100ms ingestion latency.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-amber-500 font-mono">{'<'}100ms</span>
                <span className="text-zinc-400">ingestion latency</span>
              </div>
            </div>
            <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
              <div className="grid grid-cols-3 gap-3 mb-5">
                {[{ label: 'Requests', value: '12.4k', color: 'text-white' }, { label: 'Latency', value: '42ms', color: 'text-white' },{ label: 'Errors', value: '0.1%', color: 'text-emerald-400' },].map((m) => (
                  <div key={m.label} className="bg-black/30 border border-white/5 rounded-lg p-3">
                    <div className="text-xs text-zinc-500 mb-1.5">{m.label}</div>
                    <div className={`text-xl font-bold font-mono ${m.color}`}>{m.value}</div>
                  </div>))}
              </div>
              <div className="flex items-end gap-0.5 h-20">
                {Array.from({ length: 28 }).map((_, i) => {
                  const h = 20 + Math.sin(i * 0.6) * 25 + 20;
                  const isRecent = i >= 22;
                  return (
                    <div key={i}
                      className="flex-1 rounded-sm"
                      style={{
                        height: `${h}%`,
                        backgroundColor: isRecent ? 'rgba(245,158,11,0.7)' : 'rgba(255,255,255,0.08)', }}/>);})}
              </div>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 items-center">
            <div className="order-2 lg:order-1 bg-zinc-900 rounded-xl border border-zinc-800 overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse" />
                  <span className="text-xs font-mono text-zinc-400">anomaly detector</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-semibold text-red-400 bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded">1 critical</span>
                  <span className="text-[10px] font-semibold text-amber-400 bg-amber-500/10 border border-amber-500/20 px-2 py-0.5 rounded">1 warning</span>
                </div>
              </div>

              <div className="grid grid-cols-[1fr_96px_40px] gap-3 px-4 py-2 border-b border-white/[0.04]">
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Route</div>
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider">Deviation</div>
                <div className="text-[10px] font-semibold text-zinc-400 uppercase tracking-wider text-right">z-score</div>
              </div>

              {[{ route: '/api/checkout', svc: 'payment-api', metric: 'avg latency', z: 4.2, severity: 'critical' },
                { route: '/api/auth/login', svc: 'auth-service', metric: 'error rate', z: 2.8, severity: 'warning' },
                { route: '/api/users/me', svc: 'user-service', metric: 'avg latency', z: 0.4, severity: 'normal' },
              ].map((item) => (
                <div key={item.route} className="grid grid-cols-[1fr_96px_40px] gap-3 items-center px-4 py-3 border-b border-white/[0.04] last:border-0">
                  <div>
                    <code className="text-xs font-mono text-zinc-300">{item.route}</code>
                    <div className="text-[10px] text-zinc-500 mt-0.5">{item.svc} · {item.metric}</div>
                  </div>
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full ${item.severity === 'critical' ? 'bg-red-500' : item.severity === 'warning' ? 'bg-amber-400' : 'bg-zinc-700'}`}
                        style={{ width: `${Math.min(item.z / 5, 1) * 100}%` }}/>
                    </div>
                    <span className={`text-[10px] font-semibold uppercase w-8 text-right ${item.severity === 'critical' ? 'text-red-400' : item.severity === 'warning' ? 'text-amber-400' : 'text-zinc-600'}`}>
                      {item.severity === 'normal' ? '——' : item.severity.slice(0, 4).toUpperCase()}
                    </span>
                  </div>
                  <div className="text-xs font-mono font-semibold text-zinc-100 text-right tabular-nums">
                    {item.z.toFixed(1)}σ
                  </div>
                </div>
              ))}
            </div>
            <div className="order-1 lg:order-2">
              <p className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-2">Intelligence</p>
              <h3 className="text-2xl font-bold text-zinc-900 tracking-tight mb-4">Anomaly Detection</h3>
              <p className="text-zinc-500 mb-6 leading-relaxed">
                Automatically surface unusual patterns using statistical analysis. Get alerted before issues become incidents.
              </p>
              <div className="flex items-baseline gap-2">
                <span className="text-4xl font-bold text-amber-500 font-mono">99.9%</span>
                <span className="text-zinc-400">detection accuracy</span>
              </div>
            </div>
          </div>

          <div className="bg-zinc-900 rounded-2xl p-8 lg:p-12 border border-zinc-800">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <p className="text-xs font-semibold text-zinc-500 uppercase tracking-widest mb-2">Setup</p>
                <h3 className="text-2xl font-bold text-white tracking-tight mb-4">Zero Configuration</h3>
                <p className="text-zinc-400 mb-8 leading-relaxed">
                  Add the middleware, set your API key, and you're done. Auto-instruments Express routes out of the box. Built-in queue with automatic retries ensures your telemetry survives deploys.
                </p>
                <div className="flex items-center gap-10">
                  <div>
                    <span className="text-3xl font-bold text-amber-400 font-mono">4</span>
                    <span className="text-zinc-500 ml-2 text-sm">lines of code</span>
                  </div>
                  <div>
                    <span className="text-3xl font-bold text-amber-400 font-mono">0</span>
                    <span className="text-zinc-500 ml-2 text-sm">events lost</span>
                  </div>
                </div>
              </div>
              <div className="bg-black/40 border border-white/10 rounded-xl overflow-hidden">
                <div className="flex items-center gap-1.5 px-4 py-3 border-b border-white/5">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <span className="ml-3 text-xs text-zinc-500 font-mono">app.js</span>
                </div>
                <div className="p-5 font-mono text-sm space-y-1">
                  <div><span className="text-purple-400">import</span><span className="text-zinc-300"> {'{ createAutoTraceSDKMiddleware }'} </span><span className="text-purple-400">from</span><span className="text-amber-400"> 'autotracesdk'</span></div>
                  <div className="pt-2 text-zinc-300">app.<span className="text-sky-400">use</span>(createAutoTraceSDKMiddleware({'{'}</div>
                  <div className="pl-4 text-zinc-300">serviceName: <span className="text-emerald-400">'my-api'</span>,</div>
                  <div className="pl-4 text-zinc-300">ingestionUrl: <span className="text-emerald-400">'http://localhost:4000/telemetry'</span>,</div>
                  <div className="pl-4 text-zinc-300">apiKey: process.env.<span className="text-amber-400">AUTOTRACE_KEY</span></div>
                  <div className="text-zinc-300">{'})}'}</div>
                </div>
              </div>
            </div>
          </div>

          <div className="grid md:grid-cols-3 gap-8 pt-4">
            {[{ stat: 'Unlimited', label: 'Team Members', desc: 'Organize by team with isolated API keys and role-based access controls.' },
              { stat: '30 days', label: 'Data Retention', desc: 'Query your data across any time range. Find patterns and track improvements.' },
              { stat: 'MIT', label: 'Open License', desc: 'Self-host or use our managed service. Your data stays yours.' },
            ].map((item) => (
              <div key={item.label} className="text-center">
                <div className="text-4xl font-bold text-amber-500 font-mono mb-2">{item.stat}</div>
                <div className="text-xs font-semibold text-zinc-400 uppercase tracking-widest mb-3">{item.label}</div>
                <p className="text-zinc-500 text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
