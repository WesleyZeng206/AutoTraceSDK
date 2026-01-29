'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { TeamProvider } from '@/contexts/TeamContext';
import { TeamSwitcher } from '@/components/TeamSwitcher';

const sections = [
  { id: 'getting-started', label: 'Getting Started', subsections: [
    { id: 'installation', label: 'Installation' },
    { id: 'quick-start', label: 'Quick Start' },
  ]},
  { id: 'configuration', label: 'Configuration', subsections: [
    { id: 'options', label: 'Options' },
    { id: 'sampling', label: 'Sampling' },
    { id: 'retries', label: 'Retries' },
  ]},
  { id: 'dashboard', label: 'Dashboard', subsections: [
    { id: 'metrics', label: 'Metrics' },
    { id: 'routes', label: 'Routes' },
    { id: 'charts', label: 'Charts' },
  ]},
  { id: 'anomalies', label: 'Anomaly Detection', subsections: [
    { id: 'how-it-works', label: 'How It Works' },
    { id: 'severity', label: 'Severity Levels' },
  ]},
  { id: 'advanced', label: 'Advanced', subsections: [
    { id: 'persistence', label: 'Persistent Queue' },
    { id: 'production', label: 'Production Tips' },
  ]},
];

function CodeBlock({ children, title }: { children: string; title?: string }) {
  const [copied, setCopied] = useState(false);

  const copy = () => {
    navigator.clipboard.writeText(children);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="relative group my-4">
      {title && (
        <div className="flex items-center justify-between bg-zinc-800 px-4 py-2 rounded-t-lg border-b border-zinc-700">
          <span className="text-xs font-medium text-zinc-400">{title}</span>
        </div>
      )}
      <div className={`relative ${title ? 'rounded-b-lg' : 'rounded-lg'}`}>
        <pre className={`bg-zinc-900 text-zinc-100 p-4 overflow-x-auto text-[13px] leading-relaxed ${title ? 'rounded-b-lg' : 'rounded-lg'}`}>
          <code>{children}</code>
        </pre>
        <button
          onClick={copy}
          className="absolute top-3 right-3 p-1.5 rounded bg-zinc-700/50 hover:bg-zinc-700 text-zinc-400 hover:text-zinc-200 opacity-0 group-hover:opacity-100 transition-all">
          {copied ? (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg> ) : (
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
}

function InlineCode({ children }: { children: React.ReactNode }) {
  return (
    <code className="px-1.5 py-0.5 bg-zinc-100 rounded text-[13px] font-mono text-zinc-800">{children}</code>
  );
}

function Callout({ type, children }: { type: 'info' | 'warning' | 'tip'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-sky-50 border-sky-200 text-sky-900',
    warning: 'bg-amber-50 border-amber-200 text-amber-900',
    tip: 'bg-emerald-50 border-emerald-200 text-emerald-900',
  };
  const icons = {
    info: <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" /></svg>,
    warning: <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" /></svg>,
    tip: <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M11.3 1.046A1 1 0 0112 2v5h4a1 1 0 01.82 1.573l-7 10A1 1 0 018 18v-5H4a1 1 0 01-.82-1.573l7-10a1 1 0 011.12-.38z" clipRule="evenodd" /></svg>,
  };
  return (
    <div className={`flex gap-3 p-4 rounded-lg border text-sm my-4 ${styles[type]}`}>
      {icons[type]}
      <div>{children}</div>
    </div>
  );
}

function PropTable({ props }: { props: { name: string; type: string; required?: boolean; default?: string; description: string }[] }) {
  return (
    <div className="my-4 border border-zinc-200 rounded-lg overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-zinc-50 border-b border-zinc-200">
            <th className="text-left px-4 py-2 font-medium text-zinc-700">Property</th>
            <th className="text-left px-4 py-2 font-medium text-zinc-700">Type</th>
            <th className="text-left px-4 py-2 font-medium text-zinc-700">Default</th>
          </tr>
        </thead>
        <tbody>
          {props.map((prop, i) => (
            <tr key={prop.name} className={i !== props.length - 1 ? 'border-b border-zinc-100' : ''}>
              <td className="px-4 py-3">
                <InlineCode>{prop.name}</InlineCode>
                {prop.required && <span className="ml-1.5 text-red-500 text-xs">required</span>}
                <p className="text-zinc-500 text-xs mt-1">{prop.description}</p>
              </td>
              <td className="px-4 py-3 text-zinc-600 font-mono text-xs">{prop.type}</td>
              <td className="px-4 py-3 text-zinc-500 text-xs">{prop.default || '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function DocsContent() {
  const { user, logout } = useAuth();
  const [activeSection, setActiveSection] = useState('getting-started');

  const scrollToSection = (id: string) => {
    setActiveSection(id);
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <div className="min-h-screen bg-white">
      <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
        <div className="max-w-[1400px] mx-auto px-6">
          <div className="flex items-center justify-between h-14">
            <div className="flex items-center gap-8">
              <Link href="/" className="flex items-center gap-2">
                <div className="w-7 h-7 bg-zinc-900 rounded-md flex items-center justify-center">
                  <span className="text-white font-bold text-xs">AT</span>
                </div>
                <span className="text-base font-semibold text-zinc-900">AutoTrace</span>
              </Link>
              <div className="flex items-center gap-1">
                {user ? (<>
                    <Link href="/dashboard" className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                      Dashboard
                    </Link>
                    <Link href="/api-keys" className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                      API Keys
                    </Link>
                    <Link href="/team-members" className="px-3 py-1.5 text-sm font-medium text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors">
                      Team
                    </Link>
                  </>
                ) : null} <Link href="/docs" className="px-3 py-1.5 text-sm font-medium text-zinc-900 bg-zinc-100 rounded-md">
                  Docs
                </Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {user ? (<>
                  <TeamSwitcher />
                  <div className="h-6 w-px bg-zinc-200" />
                  <span className="text-sm text-zinc-600">{user.username}</span>
                  <button onClick={logout} className="text-sm text-zinc-500 hover:text-zinc-900 transition-colors">
                    Sign out
                  </button>
                </>) : (<>
                  <Link href="/login" className="text-sm text-zinc-600 hover:text-zinc-900 transition-colors">
                    Sign in
                  </Link>
                  <Link href="/register" className="px-3 py-1.5 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-md transition-colors">
                    Get Started
                  </Link>
                </>
              )}
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-[1400px] mx-auto flex">
        <aside className="w-64 flex-shrink-0 border-r border-zinc-100 h-[calc(100vh-56px)] sticky top-14 overflow-y-auto py-8 px-6">
          <nav className="space-y-6">
            {sections.map((section) => (
              <div key={section.id}>
                <button
                  onClick={() => scrollToSection(section.id)}
                  className={`text-sm font-semibold mb-2 block w-full text-left ${
                    activeSection === section.id ? 'text-zinc-900' : 'text-zinc-500 hover:text-zinc-700'
                  }`}>
                  {section.label}
                </button>
                <ul className="space-y-1 ml-3 border-l border-zinc-100">
                  {section.subsections.map((sub) => (
                    <li key={sub.id}>
                      <button onClick={() => scrollToSection(sub.id)}
                        className={`text-[13px] pl-3 py-1 block w-full text-left transition-colors ${
                          activeSection === sub.id ? 'text-zinc-900 border-l-2 border-zinc-900 -ml-px' : 'text-zinc-500 hover:text-zinc-700'}`}>
                        {sub.label}
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </nav>

          <div className="mt-8 pt-6 border-t border-zinc-100">
            <p className="text-xs font-medium text-zinc-400 uppercase tracking-wider mb-3">Resources</p>
            <ul className="space-y-2">
              <li>
                <a href="https://github.com/WesleyZeng206/AutoTraceSDK" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                  GitHub
                </a>
              </li>
              <li>
                <a href="https://www.npmjs.com/package/autotracesdk" target="_blank" rel="noopener noreferrer" className="text-sm text-zinc-600 hover:text-zinc-900 flex items-center gap-2">
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24"><path d="M0 7.334v8h6.666v1.332H12v-1.332h12v-8H0zm6.666 6.664H5.334v-4H3.999v4H1.335V8.667h5.331v5.331zm4 0v1.336H8.001V8.667h5.334v5.332h-2.669v-.001zm12.001 0h-1.33v-4h-1.336v4h-1.335v-4h-1.33v4h-2.671V8.667h8.002v5.331z"/></svg>
                  npm
                </a>
              </li>
            </ul>
          </div>
        </aside>

        <main className="flex-1 min-w-0 px-12 py-10 max-w-3xl">
          <section id="getting-started" className="scroll-mt-20">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Getting Started</span>
            <h1 className="text-3xl font-bold text-zinc-900 mt-2 mb-4">AutoTrace SDK</h1>
            <p className="text-lg text-zinc-600 leading-relaxed mb-8">
              Lightweight Express.js middleware for automatic request telemetry, latency tracking, and anomaly detection.
            </p>

            <div className="grid grid-cols-3 gap-4 mb-12">
              <div className="p-4 rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" /></svg>
                </div>
                <h3 className="font-medium text-zinc-900 text-sm">Zero config</h3>
                <p className="text-xs text-zinc-500 mt-1">Works out of the box with Express.js</p>
              </div>
              <div className="p-4 rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" /></svg>
                </div>
                <h3 className="font-medium text-zinc-900 text-sm">Real-time metrics</h3>
                <p className="text-xs text-zinc-500 mt-1">Latency, errors, percentiles</p>
              </div>
              <div className="p-4 rounded-lg border border-zinc-200 hover:border-zinc-300 transition-colors">
                <div className="w-8 h-8 rounded-lg bg-zinc-100 flex items-center justify-center mb-3">
                  <svg className="w-4 h-4 text-zinc-600" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                </div>
                <h3 className="font-medium text-zinc-900 text-sm">Anomaly detection</h3>
                <p className="text-xs text-zinc-500 mt-1">Automatic spike detection</p>
              </div>
            </div>

            <h2 id="installation" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Installation</h2>
            <p className="text-zinc-600 mb-4">Install the SDK with your preferred package manager:</p>
            <CodeBlock title="Terminal">npm install autotracesdk</CodeBlock>
            <p className="text-sm text-zinc-500 mt-2">
              Also available via <InlineCode>yarn add autotracesdk</InlineCode> or <InlineCode>pnpm add autotracesdk</InlineCode>
            </p>

            <Callout type="info">
              Requires Node.js 16+ and Express.js 4.x or newer. TypeScript is optional but recommended.
            </Callout>

            <h2 id="quick-start" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Quick Start</h2>
            <p className="text-zinc-600 mb-4">
              First, get your API key from the <Link href="/api-keys" className="text-zinc-900 underline underline-offset-2">API Keys</Link> page. Then add the middleware to your Express app:
            </p>
            <CodeBlock title="app.ts">{`import express from 'express';
import { createAutoTraceSDKMiddleware } from 'autotracesdk';

const app = express();

app.use(createAutoTraceSDKMiddleware({
  serviceName: 'my-api',
  ingestionUrl: 'http://localhost:4000/telemetry',
  apiKey: process.env.AUTOTRACE_API_KEY,
}));

app.get('/api/users', (req, res) => {
  res.json({ users: [] });
});

app.listen(3000);`}</CodeBlock>

            <Callout type="warning">
              Store your API key securely. Never commit it to version control.
            </Callout>
          </section>

          <section id="configuration" className="mt-20 scroll-mt-20">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Configuration</span>
            <h1 className="text-2xl font-bold text-zinc-900 mt-2 mb-6">Configuration Options</h1>

            <h2 id="options" className="text-xl font-semibold text-zinc-900 mt-8 mb-4 scroll-mt-20">Options</h2>
            <PropTable props={[
              { name: 'serviceName', type: 'string', required: true, description: 'Identifies your service in the dashboard' },
              { name: 'ingestionUrl', type: 'string', required: true, description: 'URL of the ingestion service' },
              { name: 'apiKey', type: 'string', description: 'Your API key (starts with at_live_)' },
              { name: 'batchSize', type: 'number', default: '10', description: 'Events to collect before sending' },
              { name: 'batchInterval', type: 'number', default: '5000', description: 'Max wait time (ms) before flushing' },
              { name: 'debug', type: 'boolean', default: 'false', description: 'Enable console logging' },
              { name: 'enableLocalBuffer', type: 'boolean', default: 'true', description: 'Buffer events if ingestion is down' },
            ]} />

            <h2 id="sampling" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Sampling</h2>
            <p className="text-zinc-600 mb-4">Reduce telemetry volume while preserving important data:</p>
            <CodeBlock title="Sampling configuration">{`sampling: {
  samplingRate: 0.1,           // Sample 10% of requests
  alwaysSampleErrors: true,    // Always capture errors
  alwaysSampleSlow: 500,       // Always capture requests >500ms
  routeRules: [
    { pattern: '/health', rate: 0.01 },
    { pattern: '/api/critical', rate: 1.0 },
  ],
}`}</CodeBlock>

            <h2 id="retries" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Retries</h2>
            <p className="text-zinc-600 mb-4">Configure retry behavior for failed telemetry delivery:</p>
            <CodeBlock title="Retry configuration">{`retryOptions: {
  maxRetries: 3,
  baseDelayMs: 1000,
  maxDelayMs: 10000,
  jitterMs: 200,
},
batchRetryOptions: {
  maxRetries: 5,
  delayMs: 2000,
},`}</CodeBlock>
          </section>

          <section id="dashboard" className="mt-20 scroll-mt-20">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Dashboard</span>
            <h1 className="text-2xl font-bold text-zinc-900 mt-2 mb-6">Understanding the Dashboard</h1>

            <h2 id="metrics" className="text-xl font-semibold text-zinc-900 mt-8 mb-4 scroll-mt-20">Metrics</h2>
            <div className="space-y-4 mb-8">
              <div className="flex gap-4 p-4 rounded-lg border border-zinc-200">
                <div className="w-10 h-10 rounded-lg bg-zinc-900 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">#</span>
                </div>
                <div>
                  <h4 className="font-medium text-zinc-900">Total Requests</h4>
                  <p className="text-sm text-zinc-500">HTTP requests received in the selected time range</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-lg border border-zinc-200">
                <div className="w-10 h-10 rounded-lg bg-red-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">%</span>
                </div>
                <div>
                  <h4 className="font-medium text-zinc-900">Error Rate</h4>
                  <p className="text-sm text-zinc-500">Percentage of 4xx and 5xx responses</p>
                </div>
              </div>
              <div className="flex gap-4 p-4 rounded-lg border border-zinc-200">
                <div className="w-10 h-10 rounded-lg bg-sky-500 flex items-center justify-center flex-shrink-0">
                  <span className="text-white text-xs font-bold">ms</span>
                </div>
                <div>
                  <h4 className="font-medium text-zinc-900">Latency (P50, P90, P99)</h4>
                  <p className="text-sm text-zinc-500">Response time percentiles across all requests</p>
                </div>
              </div>
            </div>

            <h2 id="routes" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Route Status</h2>
            <p className="text-zinc-600 mb-4">Routes are color-coded based on health thresholds:</p>
            <div className="space-y-3 mb-8">
              <div className="flex items-center gap-3 text-sm">
                <span className="w-3 h-3 rounded-full bg-emerald-500"></span>
                <span className="font-medium text-zinc-900">Healthy</span>
                <span className="text-zinc-500">Error rate &lt;1% and latency &lt;500ms</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-3 h-3 rounded-full bg-amber-500"></span>
                <span className="font-medium text-zinc-900">Warning</span>
                <span className="text-zinc-500">Error rate 1-5% or latency 500ms-1s</span>
              </div>
              <div className="flex items-center gap-3 text-sm">
                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                <span className="font-medium text-zinc-900">Critical</span>
                <span className="text-zinc-500">Error rate &gt;5% or latency &gt;1s</span>
              </div>
            </div>

            <h2 id="charts" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Charts</h2>
            <p className="text-zinc-600 mb-4">
              The latency chart shows three percentile lines:
            </p>
            <ul className="list-none space-y-2 text-sm text-zinc-600">
              <li className="flex items-center gap-2">
                <span className="w-8 h-0.5 bg-emerald-500"></span>
                <span><strong>P50</strong> — Median response time (typical experience)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-8 h-0.5 bg-amber-500"></span>
                <span><strong>P95</strong> — 95th percentile (slower requests)</span>
              </li>
              <li className="flex items-center gap-2">
                <span className="w-8 h-0.5 bg-red-500"></span>
                <span><strong>P99</strong> — 99th percentile (worst case)</span>
              </li>
            </ul>
            <Callout type="tip">
              Large gaps between P50 and P99 indicate inconsistent performance. Investigate outliers.
            </Callout>
          </section>

          <section id="anomalies" className="mt-20 scroll-mt-20">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Anomaly Detection</span>
            <h1 className="text-2xl font-bold text-zinc-900 mt-2 mb-6">Automatic Anomaly Detection</h1>
            <p className="text-zinc-600 mb-8">
              AutoTrace automatically detects unusual patterns using statistical analysis. No ML models required.
            </p>

            <h2 id="how-it-works" className="text-xl font-semibold text-zinc-900 mt-8 mb-4 scroll-mt-20">How It Works</h2>
            <ol className="space-y-4 mb-8">
              <li className="flex gap-4">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center flex-shrink-0">1</span>
                <div>
                  <h4 className="font-medium text-zinc-900">Baseline Calculation</h4>
                  <p className="text-sm text-zinc-500">Analyzes 48 hours of metrics to establish normal patterns</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center flex-shrink-0">2</span>
                <div>
                  <h4 className="font-medium text-zinc-900">Z-Score Calculation</h4>
                  <p className="text-sm text-zinc-500">Measures how far current metrics deviate from the baseline</p>
                </div>
              </li>
              <li className="flex gap-4">
                <span className="w-6 h-6 rounded-full bg-zinc-900 text-white text-xs flex items-center justify-center flex-shrink-0">3</span>
                <div>
                  <h4 className="font-medium text-zinc-900">Real-time Scoring</h4>
                  <p className="text-sm text-zinc-500">Detection runs on-demand when you query the dashboard</p>
                </div>
              </li>
            </ol>

            <h2 id="severity" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Severity Levels</h2>
            <div className="space-y-4">
              <div className="p-4 rounded-lg border-l-4 border-red-500 bg-red-50">
                <h4 className="font-semibold text-red-900">Critical</h4>
                <p className="text-sm text-red-800">Z-score 3.0+ — Investigate immediately</p>
              </div>
              <div className="p-4 rounded-lg border-l-4 border-amber-500 bg-amber-50">
                <h4 className="font-semibold text-amber-900">Warning</h4>
                <p className="text-sm text-amber-800">Z-score 2.0-3.0 — Monitor closely</p>
              </div>
              <div className="p-4 rounded-lg border-l-4 border-zinc-300 bg-zinc-50">
                <h4 className="font-semibold text-zinc-700">Info</h4>
                <p className="text-sm text-zinc-600">Z-score &lt;2.0 — Within normal variation</p>
              </div>
            </div>
          </section>

          <section id="advanced" className="mt-20 scroll-mt-20">
            <span className="text-xs font-medium text-zinc-400 uppercase tracking-wider">Advanced</span>
            <h1 className="text-2xl font-bold text-zinc-900 mt-2 mb-6">Advanced Configuration</h1>

            <h2 id="persistence" className="text-xl font-semibold text-zinc-900 mt-8 mb-4 scroll-mt-20">Persistent Queue</h2>
            <p className="text-zinc-600 mb-4">
              Keep telemetry safe on disk during network interruptions or deployments:
            </p>
            <CodeBlock title="Persistent queue">{`persistentQueue: {
  enabled: true,
  queueDir: './.autotrace-queue',
  maxQueueSize: 10000,
  persistInterval: 1000,
  autoFlushOnExit: true,
}`}</CodeBlock>
            <p className="text-sm text-zinc-500 mt-4">
              Events are stored as JSONL files and replayed automatically when ingestion recovers.
            </p>

            <h2 id="production" className="text-xl font-semibold text-zinc-900 mt-12 mb-4 scroll-mt-20">Production Tips</h2>
            <ul className="space-y-3 text-sm text-zinc-600">
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                <span>Use environment variables for API keys and URLs</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                <span>Sample high-traffic endpoints like <InlineCode>/health</InlineCode></span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                <span>Always enable <InlineCode>alwaysSampleErrors: true</InlineCode></span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                <span>Enable local buffering for resilience</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                <span>Use HTTPS for ingestion URL in production</span>
              </li>
              <li className="flex items-start gap-2">
                <svg className="w-4 h-4 text-emerald-500 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20"><path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" /></svg>
                <span>Set reasonable retry limits to avoid overwhelming ingestion</span>
              </li>
            </ul>
          </section>

          <footer className="mt-20 pt-8 border-t border-zinc-100">
            <p className="text-sm text-zinc-500">
              Need help? <a href="https://github.com/WesleyZeng206/AutoTraceSDK/issues" target="_blank" rel="noopener noreferrer" className="text-zinc-900 underline underline-offset-2">Open an issue</a> on GitHub.
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

function DocsWrapper() {
  const { user } = useAuth();

  if (user) {
    return (
      <TeamProvider>
        <DocsContent />
      </TeamProvider>);
  }

  return <DocsContent />;
}

export default function Documentation() {
  return <DocsWrapper />;
}
