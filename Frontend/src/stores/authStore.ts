import { create } from 'zustand';

export type UserRole = 'client' | 'company' | 'supplier' | 'admin';

interface User {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  status?: 'active' | 'pending' | 'banned';
}

interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  login: (email: string, password: string, role: UserRole) => void;
  signup: (name: string, email: string, password: string, role: UserRole) => void;
  logout: () => void;
}

const stored = typeof window !== 'undefined' ? localStorage.getItem('scc_user') : null;
const initialUser: User | null = stored ? JSON.parse(stored) : null;

export const useAuthStore = create<AuthState>((set) => ({
  user: initialUser,
  isAuthenticated: !!initialUser,
  login: (email, _password, role) => {
    const user: User = {
      id: crypto.randomUUID(),
      name: email.split('@')[0],
      email,
      role,
      status: 'active',
    };
    localStorage.setItem('scc_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  signup: (name, email, _password, role) => {
    const needsApproval = role === 'company' || role === 'supplier';
    const user: User = {
      id: crypto.randomUUID(),
      name,
      email,
      role,
      status: needsApproval ? 'pending' : 'active',
    };
    localStorage.setItem('scc_user', JSON.stringify(user));
    set({ user, isAuthenticated: true });
  },
  logout: () => {
    localStorage.removeItem('scc_user');
    set({ user: null, isAuthenticated: false });
  },
}));
