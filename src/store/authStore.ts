import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { logger } from '../lib/logger';

interface AuthState {
  token: string | null;
  refreshToken: string | null;
  user: any | null;
  setAuth: (token: string, refreshToken: string, user: any) => void;
  setTokens: (token: string, refreshToken: string) => void;
  logout: () => void;
  isAuthenticated: () => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      token: null,
      refreshToken: null,
      user: null,

      setAuth: (token, refreshToken, user) => set({ token, refreshToken, user }),

      setTokens: (token, refreshToken) =>
        set((state) => ({
          token,
          refreshToken,
          user: state.user,
        })),

      logout: () => {
        logger.info('AuthStore', 'User logged out');
        set({ token: null, refreshToken: null, user: null });
      },

      isAuthenticated: () => !!get().token,
    }),
    {
      name: 'guardhub-auth-storage',
      onRehydrateStorage: () => (state) => {
        logger.info('AuthStore', 'Auth state initialised', {
          isAuthenticated: !!state?.token,
        });
      },
    },
  ),
);
