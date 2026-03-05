'use client';

import { useState, Suspense, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { loginSchema } from '@/lib/authValidation';

const logLines = [{ t: '12:04:01', svc: 'payment-api', route: 'POST /api/checkout', ms: 43, status: 200 },
  { t: '12:04:01', svc: 'auth-service', route: 'POST /api/auth/login', ms: 18, status: 200 },
  { t: '12:04:02', svc: 'user-service', route: 'GET /api/users/me', ms: 12, status: 200 },
  { t: '12:04:03', svc: 'payment-api', route: 'GET /api/products', ms: 67, status: 200 },
  { t: '12:04:04', svc: 'auth-service', route: 'POST /api/auth/refresh', ms: 9, status: 200 },
  { t: '12:04:05', svc: 'user-service', route: 'PUT /api/users/profile', ms: 31, status: 200 },
  { t: '12:04:05', svc: 'payment-api', route: 'POST /api/checkout', ms: 512, status: 500 },
  { t: '12:04:06', svc: 'auth-service', route: 'GET /api/auth/verify', ms: 7, status: 200 },];

function LoginContent() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();
  const { login } = useAuth();
  const searchParams = useSearchParams();
  const justRegistered = searchParams.get('registered') === 'true';

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError('');

    const ok = loginSchema.safeParse({ emailOrUsername: email, password, rememberMe });

    if (!ok.success) {
      setError(ok.error.issues[0]?.message || 'Please check your credentials.');
      return;
    }

    setIsLoading(true);

    try {
      const clean = ok.data;
      await login(clean.emailOrUsername, clean.password, clean.rememberMe);
      setIsLoading(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to the server. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-[520px] flex-shrink-0 bg-[#0a0a0a] relative overflow-hidden flex-col p-12">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}/>
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 20% 60%, rgba(245,158,11,0.12) 0%, transparent 60%)' }}/>

        <div className="relative z-10 flex flex-col h-full text-white">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm tracking-tight">AT</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">AutoTrace</span>
          </Link>

          <div className="mt-auto mb-8">
            <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">Live telemetry</p>
            <h2 className="text-3xl font-bold tracking-tight mb-3">Your metrics, in real time.</h2>
            <p className="text-zinc-400 text-sm leading-relaxed max-w-xs">
              Every request, every latency spike, every anomaly — captured automatically.
            </p>
          </div>

          <div className="bg-zinc-900/80 border border-white/10 rounded-xl overflow-hidden mb-8">
            <div className="flex items-center gap-2 px-4 py-2.5 border-b border-white/5 bg-black/20">
              <div className="w-2.5 h-2.5 rounded-full bg-red-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-yellow-500/70" />
              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/70" />
              <span className="ml-2 text-xs text-zinc-500 font-mono">telemetry stream</span>
              <div className="ml-auto flex items-center gap-1.5 text-xs text-emerald-400">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                live
              </div>
            </div>
            <div className="p-4 space-y-2 font-mono text-xs">
              {logLines.map((l, i) => (
                <div key={i} className="flex items-center gap-2 min-w-0">
                  <span className="text-zinc-600 flex-shrink-0">{l.t}</span>
                  <span className="text-amber-400/70 flex-shrink-0">{l.svc}</span>
                  <span className="text-zinc-400 flex-1 truncate">{l.route}</span>
                  <span className={`flex-shrink-0 ${l.status >= 500 ? 'text-red-400' : 'text-emerald-400'}`}>{l.ms}ms</span>
                  <span className={`flex-shrink-0 ${l.status >= 500 ? 'text-red-500' : 'text-zinc-600'}`}>{l.status}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-8 text-sm">
            <div>
              <span className="text-amber-400 font-bold font-mono">{'<'}100ms</span>
              <span className="text-zinc-500 ml-2">latency</span>
            </div>
            <div>
              <span className="text-amber-400 font-bold font-mono">99.9%</span>
              <span className="text-zinc-500 ml-2">uptime</span>
            </div>
            <div>
              <span className="text-amber-400 font-bold font-mono">MIT</span>
              <span className="text-zinc-500 ml-2">license</span>
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">AT</span>
              </div>
              <span className="text-lg font-semibold text-zinc-900">AutoTrace</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Welcome back</h2>
            <p className="text-zinc-500">
              Don't have an account?{' '}
              <Link href="/register" className="text-amber-600 font-medium hover:text-amber-700">
                Create one
              </Link>
            </p>
          </div>

          {justRegistered && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-800">Account created successfully. Please sign in to continue.</p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>)}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-2">
                Email or username
              </label>
              <input id="email"
                type="text"
                autoComplete="username"
                placeholder="you@example.com or johndoe"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white" />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-2">Password</label>
              <input id="password" type="password" autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white" />
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-amber-500 border-zinc-300 rounded focus:ring-amber-500" />
              <label htmlFor="rememberMe" className="ml-2 text-sm text-zinc-600">
                Remember me for 30 days</label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-amber-500 text-white rounded-lg font-medium hover:bg-amber-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>) : 'Sign in'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-400"> By signing in, you agree to our terms of service and privacy policy.</p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#0a0a0a]"><div className="text-zinc-500">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}
