import { dashboardConfig } from './config';
import { fetchJson } from './http';

const INGESTION_URL = dashboardConfig.publicIngestionUrl;

export interface User {
  id: string;
  email: string;
  username: string;
}

export interface Team {
  id: string;
  name: string;
  slug: string;
  role: string;
}

export interface AuthResponse {
  user: User;
  teams: Team[];
}

export interface LoginResponse {
  message: string;
  user: AuthResponse;
}

export interface RegisterResponse {
  message: string;
  userId: string;
  teamId: string;
}

/**
 * Register a new user
 */
export async function register(
  email: string,
  username: string,
  password: string,
  teamName?: string
): Promise<RegisterResponse> {
  return fetchJson<RegisterResponse>(`${INGESTION_URL}/auth/register`, {
    method: 'POST',
    json: { email, username, password, teamName },
    credentials: 'omit',
  });
}

/**
 * Login user
 */
export async function login(email: string, password: string, rememberMe?: boolean): Promise<LoginResponse> {
  return fetchJson<LoginResponse>(`/api/auth/login`, {
    method: 'POST',
    json: { email, password, rememberMe },
  });
}

/**
 * Logout user
 */
export async function logout(): Promise<void> {
  await fetchJson(`/api/auth/logout`, { method: 'POST' });
}

/**
 * Get current user 
 */
export async function getCurrentUser(token?: string): Promise<AuthResponse | null> {
  try {
    const headers: HeadersInit = {};
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const response = await fetch(`/api/auth/me`, { headers, credentials: 'include' });

    if (!response.ok) {
      return null;
    }

    return response.json();
  } catch (error) {
    console.error('Failed to get current user:', error);
    return null;
  }
}

/**
 * Validate session token
 */
export async function validateSession(token: string): Promise<AuthResponse | null> {
  return getCurrentUser(token);
}
