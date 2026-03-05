'use client';

import { useState } from 'react';

const steps = [
  {
    number: '01',
    title: 'Install the SDK',
    description: 'Add the package to your Node.js project. Works with Express, Fastify, and other frameworks.',
    code: `$ npm install autotracesdk`,
    filename: 'terminal',
  },
  {
    number: '02',
    title: 'Add the middleware',
    description: 'Initialize with your service name and API key. Just a few lines of code.',
    code: `import { createAutoTraceSDKMiddleware } from 'autotracesdk';

app.use(createAutoTraceSDKMiddleware({
  serviceName: 'my-api',
  ingestionUrl: 'http://localhost:4000/telemetry',
  apiKey: process.env.AUTOTRACE_KEY
}));`,
    filename: 'app.js',
  },
  {
    number: '03',
    title: 'View your dashboard',
    description: 'Metrics start flowing immediately. No additional configuration needed.',
    code: null,
    filename: 'dashboard',
  },
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="setup" className="py-32 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">Quick Start</p>
          <h2 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">
            Up and running in under five minutes
          </h2>
          <p className="text-lg text-zinc-500">
            No agents to deploy, no infrastructure to manage. Just code.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-3">
            {steps.map((step, index) => (
              <button
                key={index}
                onClick={() => setActiveStep(index)}
                className={`w-full text-left p-6 rounded-xl border transition-all ${
                  activeStep === index ? 'border-amber-400 bg-white shadow-md shadow-amber-50' : 'border-zinc-200 bg-white/60 hover:border-zinc-300 hover:bg-white' }`}>
                <div className="flex items-start gap-4">
                  <span className={`text-sm font-mono font-bold tabular-nums ${
                    activeStep === index ? 'text-amber-500' : 'text-zinc-300'
                  }`}>
                    {step.number}
                  </span>
                  <div>
                    <h3 className={`text-base font-semibold tracking-tight mb-1 ${
                      activeStep === index ? 'text-zinc-900' : 'text-zinc-600' }`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-zinc-500 leading-relaxed">{step.description}</p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="sticky top-8">
              <div className="bg-zinc-900 rounded-xl overflow-hidden border border-zinc-800">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-white/5 bg-black/20">
                  <div className="w-3 h-3 rounded-full bg-red-500/70" />
                  <div className="w-3 h-3 rounded-full bg-yellow-500/70" />
                  <div className="w-3 h-3 rounded-full bg-emerald-500/70" />
                  <span className="ml-3 text-xs text-zinc-500 font-mono">
                    {steps[activeStep].filename}
                  </span>
                </div>
                <div className="p-6 min-h-[280px]">
                  {steps[activeStep].code ? (
                    activeStep === 0 ? (
                      <pre className="text-sm font-mono">
                        <span className="text-zinc-500">$</span>
                        {' '}
                        <span className="text-amber-400">npm install</span>
                        {' '}
                        <span className="text-zinc-300">autotracesdk</span>
                      </pre>) : (
                      <div className="font-mono text-sm space-y-1">
                        <div><span className="text-purple-400">import</span><span className="text-zinc-300"> {'{ createAutoTraceSDKMiddleware }'} </span><span className="text-purple-400">from</span><span className="text-amber-400"> 'autotracesdk'</span></div>
                        <div className="pt-2 text-zinc-300">app.<span className="text-sky-400">use</span>(createAutoTraceSDKMiddleware({'{'}</div>
                        <div className="pl-4 text-zinc-300">serviceName: <span className="text-emerald-400">'my-api'</span>,</div>
                        <div className="pl-4 text-zinc-300">ingestionUrl: <span className="text-emerald-400">'http://localhost:4000/telemetry'</span>,</div>
                        <div className="pl-4 text-zinc-300">apiKey: process.env.<span className="text-amber-400">AUTOTRACE_KEY</span></div>
                        <div className="text-zinc-300">{'})}'}</div>
                      </div>)) : (
                    <div className="space-y-4">
                      <p className="text-xs text-zinc-500 uppercase tracking-wider mb-4">Dashboard preview</p>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-zinc-800/80 border border-white/5 rounded-lg p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Requests</div>
                          <div className="text-xl font-bold text-white font-mono">12,847</div>
                        </div>
                        <div className="bg-zinc-800/80 border border-white/5 rounded-lg p-4">
                          <div className="text-xs text-zinc-500 uppercase tracking-wide mb-1.5">Latency</div>
                          <div className="text-xl font-bold text-white font-mono">45<span className="text-sm text-zinc-500 font-normal">ms</span></div>
                        </div>
                      </div>
                      <div className="bg-black/20 border border-white/5 rounded-lg p-4">
                        <div className="text-xs text-zinc-500 mb-3">Response time</div>
                        <div className="flex items-end gap-0.5 h-16">
                          {Array.from({ length: 24 }).map((_, i) => {
                            const h = 20 + Math.sin(i * 0.7) * 30 + 20;
                            const isRecent = i >= 18;
                            return (
                              <div
                                key={i}
                                className="flex-1 rounded-sm"
                                style={{
                                  height: `${h}%`,
                                  backgroundColor: isRecent ? 'rgba(245,158,11,0.65)' : 'rgba(255,255,255,0.07)',
                                }}/>);
                          })}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
