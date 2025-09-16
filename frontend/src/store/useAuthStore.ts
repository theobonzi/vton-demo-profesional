import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { User } from '@/types';
import { toast } from 'sonner';
import { getSupabase } from '@/lib/supabaseClient';

interface AuthState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAuthenticated: boolean;
}

interface AuthActions {
  login: (email: string, password: string) => Promise<void>;
  // Returns true if auto-logged, false if confirmation required
  register: (email: string, password: string) => Promise<boolean>;
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
          const { data, error } = await getSupabase().auth.signInWithPassword({ email, password });
          if (error || !data.session) {
            throw error || new Error('Échec de la connexion');
          }

          const s = data.session;
          const supaUser = s.user;
          const mappedUser: User = {
            id: 0,
            email: supaUser.email || email,
            username: (supaUser.user_metadata?.username as string) || (email.split('@')[0]),
            is_active: true,
            created_at: supaUser.created_at || new Date().toISOString(),
          };

          localStorage.setItem('token', s.access_token);
          localStorage.setItem('user', JSON.stringify(mappedUser));

          set({
            user: mappedUser,
            token: s.access_token,
            isAuthenticated: true,
            isLoading: false,
          });
          toast.success('Connexion réussie !');
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      register: async (email: string, password: string) => {
        set({ isLoading: true });
        try {
          const { data, error } = await getSupabase().auth.signUp({
            email,
            password,
            options: {
              emailRedirectTo: `${window.location.origin}/login`,
              data: { username: email.split('@')[0] },
            },
          });
          if (error) throw error;

          // If confirmation disabled, session is returned
          if (data.session) {
            const session = data.session;
            const supaUser = session.user;
            const mappedUser: User = {
              id: 0,
              email: supaUser.email || email,
              username: (supaUser.user_metadata?.username as string) || (email.split('@')[0]),
              is_active: true,
              created_at: supaUser.created_at || new Date().toISOString(),
            };
            localStorage.setItem('token', session.access_token);
            localStorage.setItem('user', JSON.stringify(mappedUser));
            set({ user: mappedUser, token: session.access_token, isAuthenticated: true, isLoading: false });
            toast.success('Account created and signed in');
            return true;
          }

          // Confirmation email flow
          set({ isLoading: false });
          toast.success('Verification email sent. Please confirm your email to continue.');
          return false;
        } catch (error) {
          set({ isLoading: false });
          throw error;
        }
      },

      logout: () => {
        try { getSupabase().auth.signOut(); } catch {}
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        set({
          user: null,
          token: null,
          isAuthenticated: false,
        });
        toast.success('Déconnexion réussie');
      },

      loadUser: async () => {
        set({ isLoading: true });
        let session = null as any;
        try {
          const { data } = await getSupabase().auth.getSession();
          session = data.session;
        } catch (e) {
          set({ isLoading: false });
          return;
        }
        if (!session) {
          set({ isLoading: false });
          return;
        }
        const supaUser = session.user;
        const mappedUser: User = {
          id: 0,
          email: supaUser.email || '',
          username: (supaUser.user_metadata?.username as string) || (supaUser.email?.split('@')[0] || 'user'),
          is_active: true,
          created_at: supaUser.created_at || new Date().toISOString(),
        };
        localStorage.setItem('token', session.access_token);
        localStorage.setItem('user', JSON.stringify(mappedUser));
        set({ user: mappedUser, token: session.access_token, isAuthenticated: true, isLoading: false });
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
