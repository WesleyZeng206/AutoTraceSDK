'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { register as apiRegister } from '@/lib/auth';

const registerSchema = z.object({
  email: z.string().min(1, 'Email is required').email('Invalid email format'),
  username: z
    .string()
    .min(3, 'Username must be at least 3 characters')
    .max(30, 'Username must be at most 30 characters')
    .regex(/^[a-zA-Z0-9_-]+$/, 'Username can only contain letters, numbers, underscores, and hyphens'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  confirmPassword: z.string().min(8, 'Please confirm your password'),
  teamName: z.string().optional(),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ['confirmPassword'],
});

type RegisterFormData = z.infer<typeof registerSchema>;

export default function RegisterPage() {
  const [error, setError] = useState<string>('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const { register, handleSubmit, formState: { errors }, watch,
  } = useForm<RegisterFormData>({
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

  const onSubmit = async (data: RegisterFormData) => {
    try {
      setError('');
      setIsLoading(true);
      await apiRegister(data.email, data.username, data.password, data.teamName);
      router.push('/login?registered=true');
    } catch (err: any) {
      setError(err.message || 'Registration failed. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#fafafa] flex">
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
            <h2 className="text-2xl font-bold text-zinc-900 mb-2">Create your account</h2>
            <p className="text-zinc-600">
              Already have an account?{' '}
              <Link href="/login" className="text-zinc-900 font-medium hover:underline">
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
              <label htmlFor="username" className="block text-sm font-medium text-zinc-700 mb-2">
                Username
              </label>
              <input
                {...register('username')}
                id="username"
                type="text"
                autoComplete="username"
                placeholder="johndoe"
                className={`w-full px-4 py-3 border ${
                  errors.username ? 'border-red-300' : 'border-zinc-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white`}/>
              {errors.username && (
                <p className="mt-2 text-sm text-red-600">{errors.username.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="email" className="block text-sm font-medium text-zinc-700 mb-2">
                Email
              </label>
              <input
                {...register('email')}
                id="email"
                type="email"
                autoComplete="email"
                placeholder="you@example.com"
                className={`w-full px-4 py-3 border ${
                  errors.email ? 'border-red-300' : 'border-zinc-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white`}/>
              {errors.email && (
                <p className="mt-2 text-sm text-red-600">{errors.email.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-zinc-700 mb-2">
                Password
              </label>
              <input
                {...register('password')}
                id="password"
                type="password"
                autoComplete="new-password"
                placeholder="Min. 8 characters"
                className={`w-full px-4 py-3 border ${
                  errors.password ? 'border-red-300' : 'border-zinc-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white`}/>
              {passwordStrength !== null && (
                <div className="mt-3">
                  <div className="flex gap-1 mb-1">
                    {[0, 1, 2, 3, 4].map((i) => (
                      <div
                        key={i}
                        className={`h-1 flex-1 rounded-full transition-colors ${
                          i < passwordStrength ? strengthColors[passwordStrength - 1] : 'bg-zinc-200'
                        }`}
                      />
                    ))}
                  </div>
                  <p className="text-xs text-zinc-500">
                    {strengthLabels[passwordStrength - 1] || 'Very weak'}
                  </p>
                </div>
              )}
              {errors.password && (
                <p className="mt-2 text-sm text-red-600">{errors.password.message}</p>
              )}
            </div>

            <div>
              <label htmlFor="confirmPassword" className="block text-sm font-medium text-zinc-700 mb-2">
                Confirm password
              </label>
              <input
                {...register('confirmPassword')}
                id="confirmPassword"
                type="password"
                autoComplete="new-password"
                placeholder="Confirm your password"
                className={`w-full px-4 py-3 border ${
                  errors.confirmPassword ? 'border-red-300' : 'border-zinc-300'
                } rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white`}/>
              {errors.confirmPassword && (
                <p className="mt-2 text-sm text-red-600">{errors.confirmPassword.message}</p>
              )}
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
                className="w-full px-4 py-3 border border-zinc-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-zinc-900 focus:border-transparent bg-white"/>
              <p className="mt-2 text-xs text-zinc-500">Leave blank to auto-generate from your username</p>
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
                  Creating account...
                </span>
              ) : (
                'Create account'
              )}
            </button>
          </form>

          <p className="mt-8 text-center text-sm text-zinc-500">
            By creating an account, you agree to our terms of service and privacy policy.
          </p>
        </div>
      </div>

      <div className="hidden lg:flex lg:w-1/2 bg-zinc-900 text-white p-12 flex-col justify-between">
        <div className="flex justify-end">
          <Link href="/" className="flex items-center gap-2">
            <div className="w-8 h-8 bg-white rounded-md flex items-center justify-center">
              <span className="text-black font-bold text-sm">AT</span>
            </div>
            <span className="text-lg font-semibold">AutoTrace</span>
          </Link>
        </div>

        <div className="max-w-md">
          <h1 className="text-4xl font-bold tracking-tight mb-6">
            Start monitoring in under 5 minutes
          </h1>

          <div className="space-y-6">
            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-sm font-mono">
                1
              </div>
              <div>
                <h3 className="font-medium mb-1">Create your account</h3>
                <p className="text-sm text-zinc-400">Set up your team and get your API key</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-sm font-mono">
                2
              </div>
              <div>
                <h3 className="font-medium mb-1">Install the SDK</h3>
                <p className="text-sm text-zinc-400">Add the npm package to your project</p>
              </div>
            </div>

            <div className="flex items-start gap-4">
              <div className="w-8 h-8 rounded-full bg-zinc-800 flex items-center justify-center flex-shrink-0 text-sm font-mono">
                3
              </div>
              <div>
                <h3 className="font-medium mb-1">View your metrics</h3>
                <p className="text-sm text-zinc-400">Real-time data starts flowing immediately</p>
              </div>
            </div>
          </div>
        </div>

        <div className="text-sm text-zinc-500">
          Free tier includes unlimited team members and 30-day data retention.
        </div>
      </div>
    </div>
  );
}
