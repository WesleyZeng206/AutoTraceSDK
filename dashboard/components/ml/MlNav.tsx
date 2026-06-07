'use client';

import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';
import { TeamSwitcher } from '@/components/TeamSwitcher';

const links = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/ml', label: 'ML' },
  { href: '/api-keys', label: 'API Keys' },
  { href: '/team-members', label: 'Team' },
  { href: '/docs', label: 'Docs' },
];

export function MlNav({ active }: { active: string }) {
  const { user, logout } = useAuth();

  return (
    <nav className="bg-white border-b border-zinc-200 sticky top-0 z-50">
      <div className="max-w-7xl mx-auto px-6">
        <div className="flex items-center justify-between h-14">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-2.5">
              <div className="w-7 h-7 bg-amber-500 rounded-md flex items-center justify-center shadow-sm">
                <span className="text-white font-bold text-xs tracking-tight">AT</span>
              </div>
              <span className="text-base font-semibold text-zinc-900 tracking-tight">AutoTrace</span>
            </Link>
            <div className="flex items-center gap-0.5">
              {links.map((link) => {
                const isActive = active === link.href || (link.href === '/ml' && active.startsWith('/ml'));
                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={
                      isActive
                        ? 'px-3 py-1.5 text-sm font-medium text-amber-700 bg-amber-50 rounded-md'
                        : 'px-3 py-1.5 text-sm font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50 rounded-md transition-colors'
                    }>
                    {link.label}
                  </Link>
                );
              })}
            </div>
          </div>
          <div className="flex items-center gap-4">
            <TeamSwitcher />
            <div className="h-5 w-px bg-zinc-200" />
            <span className="text-sm text-zinc-500 font-medium">{user?.username}</span>
            <button onClick={logout} className="text-sm text-zinc-400 hover:text-zinc-700 transition-colors">
              Sign out
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
}
