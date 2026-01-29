'use client';

import { useState, Suspense, FormEvent } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

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

    if (!email || !password) {
      setError('Please enter both email and password.');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }

    setIsLoading(true);

    try {
      await login(email, password, rememberMe);
      setIsLoading(false);
      router.refresh();
    } catch (err: any) {
      setError(err?.message || 'Unable to connect to the server. Please try again.');
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 text-white p-12 flex-col justify-between">
        <div>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <span className="text-black font-bold text-sm">AT</span>
            </div>
            <span className="text-lg font-semibold">AutoTrace</span>
          </Link>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold tracking-tight mb-6">
            Application observability, simplified.
          </h1>
          <p className="text-zinc-400 text-lg leading-relaxed">
            Track performance metrics, detect anomalies, and understand your application's behavior with a single npm package.
          </p>
        </div>

        <div className="flex items-center gap-8 text-sm text-zinc-500">
          <div>
            <span className="text-white font-semibold">{'<'}100ms</span>
            <span className="ml-2">latency</span>
          </div>
          <div>
            <span className="text-white font-semibold">99.9%</span>
            <span className="ml-2">uptime</span>
          </div>
          <div>
            <span className="text-white font-semibold">Open</span>
            <span className="ml-2">source</span>
          </div>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <Link href="/" className="flex items-center gap-2">
              <div className="w-8 h-8 bg-zinc-900 rounded-md flex items-center justify-center">
                <span className="text-white font-bold text-sm">AT</span>
              </div>
              <span className="text-lg font-semibold text-zinc-900">AutoTrace</span>
            </Link>
          </div>

          <div className="mb-8">
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Sign in to your account</h2>
            <p className="text-zinc-600">
              Don't have an account?{' '}
              <Link href="/register" className="text-zinc-900 font-medium hover:underline">
                Create one
              </Link>
            </p>
          </div>

          {justRegistered && (
            <div className="mb-6 p-4 bg-emerald-50 border border-emerald-200 rounded-lg">
              <p className="text-sm text-emerald-800">
                Account created successfully. Please sign in to continue.
              </p>
            </div>
          )}

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-2">
                Email
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"/>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"/>
            </div>

            <div className="flex items-center">
              <input
                id="rememberMe"
                type="checkbox"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
                className="w-4 h-4 text-zinc-900 border-zinc-300 rounded focus:ring-zinc-900"/>
              <label htmlFor="rememberMe" className="ml-2 text-sm text-zinc-600">
                Remember me for 30 days
              </label>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 bg-zinc-900 text-white rounded-lg font-medium hover:bg-zinc-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed">
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <svg className="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                  </svg>
                  Signing in...
                </span>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            By signing in, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen flex items-center justify-center bg-[#fafafa]"><div className="text-zinc-500">Loading...</div></div>}>
      <LoginContent />
    </Suspense>
  );
}
