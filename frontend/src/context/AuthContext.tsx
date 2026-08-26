import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { ReactNode } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';
const TOKEN_KEY = 'codelens_jwt';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AuthUser {
  id: number;
  full_name: string;
  email: string;
  created_at: string;
}

export interface RegisterData {
  full_name: string;
  email: string;
  password: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  isAuthenticated: boolean;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (data: RegisterData) => Promise<void>;
  logout: () => void;
  updateUser: (data: { full_name?: string; email?: string }) => Promise<void>;
}

// ─── Context ──────────────────────────────────────────────────────────────────

const AuthContext = createContext<AuthContextValue | null>(null);

// ─── Axios helpers ────────────────────────────────────────────────────────────

function setAuthHeader(token: string | null) {
  if (token) {
    axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    delete axios.defaults.headers.common['Authorization'];
  }
}

// ─── Provider ─────────────────────────────────────────────────────────────────

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true); // true while restoring session

  // Restore session on app start — validates JWT against /me
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      setLoading(false);
      return;
    }
    setAuthHeader(token);
    axios
      .get<AuthUser>(`${API_URL}/auth/me`)
      .then((res) => setUser(res.data))
      .catch(() => {
        // Token expired or invalid — clear it
        localStorage.removeItem(TOKEN_KEY);
        setAuthHeader(null);
      })
      .finally(() => setLoading(false));
  }, []);

  // ── login (email-based) ────────────────────────────────────────────────────
  const login = useCallback(async (email: string, password: string) => {
    const res = await axios.post<{ access_token: string; token_type: string }>(
      `${API_URL}/auth/login`,
      { email, password }
    );
    const token = res.data.access_token;
    localStorage.setItem(TOKEN_KEY, token);
    setAuthHeader(token);
    // Fetch user profile from /me (never exposes password_hash)
    const meRes = await axios.get<AuthUser>(`${API_URL}/auth/me`);
    setUser(meRes.data);
  }, []);

  // ── register ───────────────────────────────────────────────────────────────
  const register = useCallback(
    async (data: RegisterData) => {
      await axios.post(`${API_URL}/auth/register`, {
        full_name: data.full_name,
        email: data.email,
        password: data.password,
      });
      // Auto-login after successful registration
      await login(data.email, data.password);
    },
    [login]
  );

  // ── update profile ─────────────────────────────────────────────────────────
  const updateUser = useCallback(async (data: { full_name?: string; email?: string }) => {
    await axios.put(`${API_URL}/auth/me`, data);
    // Refresh in-memory user from the server
    const meRes = await axios.get<AuthUser>(`${API_URL}/auth/me`);
    setUser(meRes.data);
  }, []);

  // ── logout ─────────────────────────────────────────────────────────────────
  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    setAuthHeader(null);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated: !!user,
        loading,
        login,
        register,
        logout,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
