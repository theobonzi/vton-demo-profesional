import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { login as loginApi, register as registerApi, getCurrentUser, saveAuthData, logout as logoutApi } from '@/services/authService';
import { toast } from 'sonner';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, username: string, password: string) => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  setLoading: (loading: boolean) => void;
}

type AuthStore = AuthState & AuthActions;

export const useAuthStore = create<AuthStore>()(
  persist(
    (set, get) => ({
      // État initial
      user: null,
      token: null,
      isLoading: false,
      isAuthenticated: false,

      // Actions
      login: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const tokenData = await loginApi({ email, password });
          const user = await getCurrentUser();
          
          set({
            user,
            token: tokenData.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          
          saveAuthData(tokenData.access_token, user);
          toast.success('Connexion réussie !');
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email: string, username: string, password: string) => {
        set({ isLoading: true });
        try {
          await registerApi({ email, username, password });
          // Après l'inscription, connecter automatiquement l'utilisateur
          await get().login(email, password);
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        logoutApi();
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        toast.success('Déconnexion réussie');
      },

      loadUser: async () => {
        const token = localStorage.getItem('token');
        if (!token) return;

        set({ isLoading: true });
        try {
          const user = await getCurrentUser();
          set({
            user,
            token,
            isAuthenticated: true,
            isLoading: false,
          });
        } catch (error) {
          // Token invalide, déconnecter
          get().logout();
        }
      },

      setLoading: (loading: boolean) => {
        set({ isLoading: loading });
      },
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        user: state.user,
        token: state.token,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
