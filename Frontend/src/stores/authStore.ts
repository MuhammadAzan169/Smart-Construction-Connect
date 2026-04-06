import { create } from 'zustand';
import { api } from '@/lib/api';

export type UserRole = 'client' | 'company' | 'supplier' | 'admin';

interface User {
  user_id: string;
  display_name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status?: 'active' | 'pending' | 'banned';
  phone?: string;
  company_slug?: string;
  supplier_slug?: string;
  // Legacy aliases for backward compatibility
  id?: string;
  name?: string;
  companyFile?: string;
  supplierFile?: string;
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, role: UserRole) => Promise<void>;
  signup: (name: string, email: string, password: string, role: UserRole, phone?: string) => Promise<void>;
  logout: () => void;
  clearError: () => void;
}

let initialUser: User | null = null;
try {
  const stored = typeof window !== 'undefined' ? localStorage.getItem('scc_user') : null;
  if (stored) initialUser = JSON.parse(stored) as User;
} catch {
  // Corrupt localStorage — start fresh
  if (typeof window !== 'undefined') localStorage.removeItem('scc_user');
}

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  loading: false,
  error: null,
  login: async (email, password, role) => {
    set({ loading: true, error: null });
    try {
      const raw = await api.auth.login(email, password, role);
      const user = { ...raw, id: raw.user_id, name: raw.display_name, companyFile: raw.company_slug, supplierFile: raw.supplier_slug };
      // Save JWT token separately for the API client
      if (raw.access_token) {
        localStorage.setItem('scc_token', raw.access_token);
      }
      localStorage.setItem('scc_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Login failed';
      set({ loading: false, error: message });
      throw err;
    }
  },
  signup: async (name, email, password, role, phone = '') => {
    set({ loading: true, error: null });
    try {
      const raw = await api.auth.signup(name, email, password, role, phone);
      const user = { ...raw, id: raw.user_id, name: raw.display_name, companyFile: raw.company_slug, supplierFile: raw.supplier_slug };
      if (raw.access_token) {
        localStorage.setItem('scc_token', raw.access_token);
      }
      localStorage.setItem('scc_user', JSON.stringify(user));
      set({ user, isAuthenticated: true, loading: false });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Signup failed';
      set({ loading: false, error: message });
      throw err;
    }
  },
  logout: () => {
    localStorage.removeItem('scc_user');
    localStorage.removeItem('scc_token');
    set({ user: null, isAuthenticated: false });
  },
  clearError: () => set({ error: null }),
}));
