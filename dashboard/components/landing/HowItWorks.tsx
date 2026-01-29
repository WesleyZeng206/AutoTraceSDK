'use client';

import { useState } from 'react';

const steps = [
  { number: '01',
    title: 'Install the SDK',
    description: 'Add the package to your Node.js project. Works with Express, Fastify, and other frameworks.',
    code: `npm install autotracesdk`
  },{number: '02',
    title: 'Add the middleware',
    description: 'Initialize the SDK with your service name and ingestion URL. Just a few lines of code.',
    code: `import { createAutoTraceSDKMiddleware } from 'autotracesdk';

app.use(createAutoTraceSDKMiddleware({
  serviceName: 'my-api',
  ingestionUrl: 'http://localhost:4000/telemetry',
  apiKey: process.env.AUTOTRACE_KEY
}));`
  },
  {
    number: '03',
    title: 'View your dashboard',
    description: 'Metrics start flowing immediately. No additional configuration needed.',
    code: null
  }
];

export function HowItWorks() {
  const [activeStep, setActiveStep] = useState(0);

  return (
    <section id="setup" className="py-32 bg-zinc-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="max-w-2xl mb-16">
          <h2 className="text-4xl font-bold text-zinc-900 tracking-tight mb-4">
            Up and running in under five minutes
          </h2>
          <p className="text-lg text-zinc-600">
            No agents to deploy, and no infrastructure to manage. Just code.
          </p>
        </div>

        <div className="grid lg:grid-cols-2 gap-12">
          <div className="space-y-6">
            {steps.map((step, index) => (
              <button
                key={index}
                onClick={() => setActiveStep(index)}
                className={`w-full text-left p-6 rounded-xl border transition-all ${
                  activeStep === index ? 'border-zinc-900 bg-white shadow-md' : 'border-zinc-200 bg-white/50 hover:border-zinc-300'
                }`}>
                <div className="flex items-start gap-4">
                  <span className={`text-sm font-mono ${
                    activeStep === index ? 'text-zinc-900' : 'text-zinc-400' }`}>
                    {step.number}
                  </span>
                  <div>
                    <h3 className={`text-lg font-semibold mb-1 ${
                      activeStep === index ? 'text-zinc-900' : 'text-zinc-700' }`}>
                      {step.title}
                    </h3>
                    <p className="text-sm text-zinc-600">
                      {step.description}
                    </p>
                  </div>
                </div>
              </button>
            ))}
          </div>

          <div className="relative">
            <div className="sticky top-8">
              <div className="bg-zinc-900 rounded-xl overflow-hidden">
                <div className="flex items-center gap-2 px-4 py-3 border-b border-zinc-800">
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <div className="w-3 h-3 rounded-full bg-zinc-700" />
                  <span className="ml-4 text-xs text-zinc-500 font-mono">
                    {activeStep === 0 ? 'terminal' : activeStep === 1 ? 'app.js' : 'dashboard'}
                  </span>
                </div>
                <div className="p-6 min-h-[300px]">
                  {steps[activeStep].code ? (
                    <pre className="text-sm font-mono">
                      <code className="text-emerald-400">{steps[activeStep].code}</code>
                    </pre>) : (
                    <div className="space-y-4">
                      <div className="text-sm text-zinc-500 mb-4">Your dashboard preview</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="bg-zinc-800 rounded-lg p-4">
                          <div className="text-xs text-zinc-500 mb-1">Requests</div>
                          <div className="text-xl font-semibold text-white">12,847</div>
                        </div>
                        <div className="bg-zinc-800 rounded-lg p-4">
                          <div className="text-xs text-zinc-500 mb-1">Latency</div>
                          <div className="text-xl font-semibold text-white">45ms</div>
                        </div>
                      </div>
                      <div className="flex items-end gap-1 h-20 mt-4">
                        {Array.from({ length: 20 }).map((_, i) => (
                          <div
                            key={i}
                            className="flex-1 bg-emerald-500/60 rounded-sm"
                            style={{ height: `${30 + Math.random() * 70}%` }}
                          />))}
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
