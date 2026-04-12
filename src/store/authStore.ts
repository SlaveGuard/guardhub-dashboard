import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface AuthState {
  token: string | null;
  user: any | null; // Replace 'any' with robust User interface later
  setAuth: (token: string, user: any) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      user: null,
      
      setAuth: (token, user) => set({ token, user }),
      
      logout: () => set({ token: null, user: null }),
      
      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'guardhub-auth-storage', // saves token securely in localStorage
    }
  )
);
