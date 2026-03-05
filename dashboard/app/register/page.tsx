'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { register as apiRegister } from '@/lib/auth';
import { registerSchema, type RegisterFormInput } from '@/lib/authValidation';

export default function RegisterPage() {
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, watch } = useForm<RegisterFormInput>({
    resolver: zodResolver(registerSchema),
  });

  const password = watch('password', '');

  const getPasswordStrength = (pwd: string) => {
    if (!pwd) return null;
    let strength = 0;
    if (pwd.length >= 8) strength++;
    if (pwd.length >= 12) strength++;
    if (/[A-Z]/.test(pwd) && /[a-z]/.test(pwd)) strength++;
    if (/[0-9]/.test(pwd)) strength++;
    if (/[^A-Za-z0-9]/.test(pwd)) strength++;
    return strength;
  };

  const passwordStrength = getPasswordStrength(password);
  const strengthLabels = ['Very weak', 'Weak', 'Fair', 'Good', 'Strong'];
  const strengthColors = ['bg-red-500', 'bg-orange-500', 'bg-yellow-500', 'bg-emerald-400', 'bg-emerald-500'];

  const onSubmit = async (data: RegisterFormInput) => {
    try {
      setError('');
      setIsLoading(true);
      const clean = registerSchema.parse(data);
      await apiRegister(clean.email, clean.username, clean.password, clean.teamName);
      router.push('/login?registered=true');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left — form */}
      <div className="flex-1 flex items-start justify-center p-8 pt-12 bg-white overflow-y-auto">
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
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Create your account</h2>
            <p className="text-zinc-500">
              Already have an account?{' '}
              <Link href="/login" className="text-amber-600 font-medium hover:text-amber-700">
                Sign in
              </Link>
            </p>
          </div>

          {error && (
            <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-sm text-red-800">{error}</p>
            </div>
          )}

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
            <div>
              <label htmlFor="username" className="block text-sm font-medium text-zinc-700 mb-2">Username</label>
              <input
                {...register('username')}
                id="username"
                type="text"
                autoComplete="username"
                placeholder="johndoe"
                className={`w-full px-4 py-3 border ${errors.username ? 'border-red-300' : 'border-zinc-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white`} />
              {errors.username && <p className="mt-2 text-sm text-red-600">{errors.username.message}</p>}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-2">Email</label>
              <input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`w-full px-4 py-3 border ${errors.email ? 'border-red-300' : 'border-zinc-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white`} />
              {errors.email && <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-2">Password</label>
              <input
                {...register('password')}
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className={`w-full px-4 py-3 border ${errors.password ? 'border-red-300' : 'border-zinc-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white`} />
              {passwordStrength !== null && (
                <div className="mt-3">
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-zinc-200'}`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">{strengthLabels[passwordStrength - 1] || 'Very weak'}</p>
                </div>
              )}
              {errors.password && <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 mb-2">Confirm password</label>
              <input
                {...register('confirmPassword')}
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className={`w-full px-4 py-3 border ${errors.confirmPassword ? 'border-red-300' : 'border-zinc-300'} rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white`} />
              {errors.confirmPassword && <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>}
            </div>

            <div>
              <label htmlFor="teamName" className="block text-sm font-medium text-zinc-700 mb-2">
                Team name <span className="text-zinc-400 font-normal">(optional)</span>
              </label>
              <input
                {...register('teamName')}
                id="teamName"
                type="text"
                placeholder="My Team"
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent bg-white" />
              <p className="mt-2 text-xs text-zinc-500">Leave blank to auto-generate from your username</p>
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
                  Creating account...
                </span>
              ) : 'Create account'}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-400">
            By creating an account, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>

      {/* Right — dark brand panel */}
      <div className="hidden lg:flex lg:w-[420px] flex-shrink-0 bg-[#0a0a0a] text-white p-12 flex-col justify-between relative overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}
        />
        <div
          className="absolute inset-0 pointer-events-none"
          style={{ background: 'radial-gradient(ellipse at 80% 30%, rgba(245,158,11,0.12) 0%, transparent 60%)' }}
        />

        <div className="relative z-10 flex justify-end">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-8 h-8 bg-amber-500 rounded-md flex items-center justify-center shadow-sm">
              <span className="text-white font-bold text-sm tracking-tight">AT</span>
            </div>
            <span className="text-lg font-semibold tracking-tight">AutoTrace</span>
          </Link>
        </div>

        <div className="relative z-10">
          <p className="text-xs font-semibold text-amber-500 uppercase tracking-widest mb-3">Getting started</p>
          <h2 className="text-3xl font-bold tracking-tight mb-10">Up and running in under 5 minutes</h2>

          <div className="space-y-8">
            {[
              { n: '01', title: 'Create your account', desc: 'Set up your team and generate an API key' },
              { n: '02', title: 'Install the SDK', desc: 'npm install autotracesdk — one line' },
              { n: '03', title: 'Add the middleware', desc: 'Three lines of config, zero infrastructure' },
            ].map((step) => (
              <div key={step.n} className="flex items-start gap-4">
                <span className="text-2xl font-bold font-mono text-amber-500/40 tabular-nums w-8 flex-shrink-0 leading-none mt-0.5">{step.n}</span>
                <div>
                  <h4 className="font-semibold text-white">{step.title}</h4>
                  <p className="text-sm text-zinc-400 mt-1 leading-relaxed">{step.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-xs text-zinc-600 font-mono">
          Free · MIT license · Self-hostable
        </div>
      </div>
    </div>
  );
}
