import { create } from 'zustand';
import { TryOnResponse, TryOnSession } from '@/types';
import { createTryOn, getTryOnStatus } from '@/services/tryOnService';

interface TryOnState {
  currentSession: TryOnResponse | null;
  sessions: TryOnSession[];
  isProcessing: boolean;
  progress: {
    current: number;
    total: number;
    currentItem?: string;
  };
  error: string | null;
}

interface TryOnActions {
  createTryOn: (personImageUrl: string, productIds: number[]) => Promise<void>;
  getSessionStatus: (sessionId: string) => Promise<void>;
  setProcessing: (processing: boolean) => void;
  setProgress: (current: number, total: number, currentItem?: string) => void;
  setError: (error: string | null) => void;
  clearCurrentSession: () => void;
}

type TryOnStore = TryOnState & TryOnActions;

export const useTryOnStore = create<TryOnStore>((set) => ({
  // État initial
  currentSession: null,
  sessions: [],
  isProcessing: false,
  progress: { current: 0, total: 0 },
  error: null,

  // Actions
  createTryOn: async (personImageUrl: string, productIds: number[]) => {
    set({ isProcessing: true, error: null });
    try {
      const response = await createTryOn({
        person_image_url: personImageUrl,
        product_ids: productIds,
      });
      
      set({
        currentSession: response,
        isProcessing: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la création de l\'essayage',
        isProcessing: false,
      });
    }
  },

  getSessionStatus: async (sessionId: string) => {
    try {
      const session = await getTryOnStatus(sessionId);

      set({
        currentSession: {
          session_id: session.session_id,
          status: session.status,
          results: session.results,
          error_message: session.error_message,
        },
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la récupération du statut',
      });
    }
  },

  setProcessing: (processing: boolean) => {
    set({ isProcessing: processing });
  },

  setProgress: (current: number, total: number, currentItem?: string) => {
    set({
      progress: { current, total, currentItem },
    });
  },

  setError: (error: string | null) => {
    set({ error });
  },

  clearCurrentSession: () => {
    set({
      currentSession: null,
      error: null,
      progress: { current: 0, total: 0 },
    });
  },
}));
