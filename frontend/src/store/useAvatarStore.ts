import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { 
  UserAvatar, 
  AvatarCheckResponse, 
  CreateAvatarRequest, 
  CreateAvatarResponse,
  AvatarStatusResponse 
} from '@/types';
import { 
  checkUserHasAvatar, 
  createAvatar, 
  getAvatarStatus, 
  waitForAvatarCompletion, 
  getUserAvatars 
} from '@/services/avatarService';
import { toast } from 'sonner';

interface AvatarState {
  // État de l'avatar actuel
  hasAvatar: boolean;
  currentAvatar: UserAvatar | null;
  avatarCheckData: AvatarCheckResponse | null;
  
  // Liste des avatars
  avatars: UserAvatar[];
  
  // État de création/vérification
  isChecking: boolean;
  isCreating: boolean;
  creationProgress: number;
  creationStep: string;
  creationSessionId: string | null;
  
  // Erreurs
  error: string | null;
}

interface AvatarActions {
  // Vérification avatar
  checkAvatar: () => Promise<void>;
  
  // Création avatar
  createNewAvatar: (request: CreateAvatarRequest) => Promise<string | null>;
  waitForCreation: (sessionId: string) => Promise<boolean>;
  
  // Gestion des avatars
  loadUserAvatars: () => Promise<void>;
  setCurrentAvatar: (avatar: UserAvatar | null) => void;
  
  // Gestion d'état
  clearError: () => void;
  reset: () => void;
}

type AvatarStore = AvatarState & AvatarActions;

const initialState: AvatarState = {
  hasAvatar: false,
  currentAvatar: null,
  avatarCheckData: null,
  avatars: [],
  isChecking: false,
  isCreating: false,
  creationProgress: 0,
  creationStep: '',
  creationSessionId: null,
  error: null,
};

export const useAvatarStore = create<AvatarStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      // Actions
      checkAvatar: async () => {
        set({ isChecking: true, error: null });
        try {
          const response = await checkUserHasAvatar();
          
          set({
            hasAvatar: response.has_avatar,
            avatarCheckData: response,
            currentAvatar: response.avatar || null,
            isChecking: false,
          });
          
        } catch (error: any) {
          const errorMessage = error?.response?.data?.detail || error?.message || 'Erreur lors de la vérification avatar';
          set({
            error: errorMessage,
            hasAvatar: false,
            currentAvatar: null,
            avatarCheckData: null,
            isChecking: false,
          });
          
          // Ne pas afficher de toast pour les erreurs 401 (non authentifié)
          if (error?.response?.status !== 401) {
            toast.error(`Erreur avatar: ${errorMessage}`);
          }
        }
      },

      createNewAvatar: async (request: CreateAvatarRequest): Promise<string | null> => {
        set({ 
          isCreating: true, 
          error: null, 
          creationProgress: 0, 
          creationStep: 'Initialisation...', 
          creationSessionId: null 
        });
        
        try {
          const response = await createAvatar(request);
          
          set({
            creationSessionId: response.session_id,
            creationStep: 'Création initiée...',
            creationProgress: 10,
          });
          
          toast.success('Création d\'avatar initiée');
          return response.session_id;
          
        } catch (error: any) {
          const errorMessage = error?.response?.data?.detail || error?.message || 'Erreur lors de la création avatar';
          set({
            error: errorMessage,
            isCreating: false,
            creationProgress: 0,
            creationStep: '',
            creationSessionId: null,
          });
          
          toast.error(`Erreur création avatar: ${errorMessage}`);
          return null;
        }
      },

      waitForCreation: async (sessionId: string): Promise<boolean> => {
        try {
          // Polling du statut avec mise à jour temps réel
          const checkStatus = async () => {
            const status = await getAvatarStatus(sessionId);
            
            set({
              creationProgress: status.progress,
              creationStep: status.current_step || '',
            });
            
            return status;
          };
          
          // Attendre la completion avec polling manuel pour mise à jour UI
          const maxAttempts = 15;
          const delayMs = 3000;
          
          for (let attempt = 0; attempt < maxAttempts; attempt++) {
            const status = await checkStatus();
            
            if (status.status === 'completed') {
              set({
                isCreating: false,
                creationProgress: 100,
                creationStep: 'Terminé!',
                hasAvatar: true,
                currentAvatar: status.result ? {
                  body_id: status.result.body_id,
                  user_id: status.result.user_id,
                  label: status.result.label,
                  body_bucket: '', // Sera rempli lors du checkAvatar
                  body_key: '',
                  body_mime: '',
                  created_at: status.result.created_at,
                  body_masks: [],
                } : null,
              });
              
              toast.success('Avatar créé avec succès!');
              
              // Recharger les données complètes
              await get().checkAvatar();
              return true;
            }
            
            if (status.status === 'failed') {
              set({
                isCreating: false,
                error: status.error || 'Création avatar échouée',
                creationProgress: 0,
                creationStep: 'Échec',
              });
              
              toast.error(`Création avatar échouée: ${status.error}`);
              return false;
            }
            
            // Attendre avant la prochaine vérification
            if (attempt < maxAttempts - 1) {
              await new Promise(resolve => setTimeout(resolve, delayMs));
            }
          }
          
          // Timeout
          set({
            isCreating: false,
            error: 'Timeout: Création avatar non terminée',
            creationProgress: 0,
            creationStep: 'Timeout',
          });
          
          toast.error('Timeout: Création avatar trop longue');
          return false;
          
        } catch (error: any) {
          const errorMessage = error?.response?.data?.detail || error?.message || 'Erreur lors du suivi création';
          set({
            isCreating: false,
            error: errorMessage,
            creationProgress: 0,
            creationStep: 'Erreur',
          });
          
          toast.error(`Erreur suivi création: ${errorMessage}`);
          return false;
        }
      },

      loadUserAvatars: async () => {
        try {
          const avatars = await getUserAvatars();
          set({ avatars });
        } catch (error: any) {
          const errorMessage = error?.response?.data?.detail || error?.message || 'Erreur lors du chargement avatars';
          set({ error: errorMessage });
          
          if (error?.response?.status !== 401) {
            toast.error(`Erreur chargement avatars: ${errorMessage}`);
          }
        }
      },

      setCurrentAvatar: (avatar: UserAvatar | null) => {
        set({ 
          currentAvatar: avatar,
          hasAvatar: !!avatar,
        });
      },

      clearError: () => {
        set({ error: null });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: 'avatar-storage',
      partialize: (state) => ({
        hasAvatar: state.hasAvatar,
        currentAvatar: state.currentAvatar,
        avatarCheckData: state.avatarCheckData,
        avatars: state.avatars,
      }),
    }
  )
);