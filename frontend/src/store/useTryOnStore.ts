import { create } from 'zustand';
import { TryOnResponse, TryOnResult, TryOnSession } from '@/types';
import { createTryOn, createBatchTryOn, getSessionStatus, getUserSessions } from '@/services/tryOnService';

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
  createBatchTryOn: (personImageUrl: string, productIds: number[], maxConcurrent?: number) => Promise<void>;
  getSessionStatus: (sessionId: string) => Promise<void>;
  loadUserSessions: () => Promise<void>;
  setProcessing: (processing: boolean) => void;
  setProgress: (current: number, total: number, currentItem?: string) => void;
  setError: (error: string | null) => void;
  clearCurrentSession: () => void;
}

type TryOnStore = TryOnState & TryOnActions;

export const useTryOnStore = create<TryOnStore>((set, get) => ({
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

  createBatchTryOn: async (personImageUrl: string, productIds: number[], maxConcurrent: number = 3) => {
    set({ 
      isProcessing: true, 
      error: null,
      progress: { current: 0, total: productIds.length }
    });
    
    try {
      const response = await createBatchTryOn(
        personImageUrl,
        productIds,
        maxConcurrent
      );
      
      set({
        currentSession: {
          session_id: response.session_id,
          status: response.status,
          results: response.results,
          error_message: response.error_message,
        },
        isProcessing: false,
        progress: { current: productIds.length, total: productIds.length },
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur lors de la création des essayages',
        isProcessing: false,
      });
    }
  },

  getSessionStatus: async (sessionId: string) => {
    try {
      const session = await getSessionStatus(sessionId);
      
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

  loadUserSessions: async () => {
    try {
      const sessions = await getUserSessions();
      set({ sessions });
    } catch (error) {
      console.error('Erreur lors du chargement des sessions:', error);
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
