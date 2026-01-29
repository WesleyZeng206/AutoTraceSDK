'use client';

import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import type { User, Team, AuthResponse } from '@/lib/auth';
import { login as apiLogin, logout as apiLogout } from '@/lib/auth';

interface AuthContextType {
  user: User | null;
  teams: Team[] | null;
  isLoading: boolean;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [teams, setTeams] = useState<Team[] | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    refreshUser();
  }, []);

  const refreshUser = async () => {
    try {
      setIsLoading(true);
      const response = await fetch('/api/auth/me', {
        credentials: 'include',
      });

      if (response.ok) {
        const data: AuthResponse = await response.json();
        setUser(data.user);
        setTeams(data.teams);
      } else {
        setUser(null);
        setTeams(null);
      }
    } catch (error) {
      setUser(null);
      setTeams(null);
    } finally {
      setIsLoading(false);
    }
  };

  const login = async (email: string, password: string, rememberMe?: boolean) => {
    const result = await apiLogin(email, password, rememberMe);
    await refreshUser();
    router.push('/dashboard');
  };

  const logout = async () => {
    await apiLogout();
    setUser(null);
    setTeams(null);
    localStorage.removeItem('current_team_id');
    router.push('/login');
  };

  return (
    <AuthContext.Provider value={{ user, teams, isLoading, login, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
