import { create } from 'zustand';
import type { TryOnResponse } from '@/types';
import { createTryOn, waitForTryOnCompletion } from '@/services/tryOnService';

type TryOnStatus = TryOnResponse | null;

interface TryOnState {
  currentSession: TryOnStatus;
  isProcessing: boolean;
  error: string | null;
}

interface TryOnActions {
  launchTryOn: (personImageUrl: string, productIds: number[]) => Promise<void>;
  clearCurrentSession: () => void;
}

type TryOnStore = TryOnState & TryOnActions;

export const useTryOnStore = create<TryOnStore>((set) => ({
  currentSession: null,
  isProcessing: false,
  error: null,

  launchTryOn: async (personImageUrl: string, productIds: number[]) => {
    set({ isProcessing: true, error: null });

    try {
      const response = await createTryOn({
        person_image_url: personImageUrl,
        product_ids: productIds,
      });

      const finalSession = await waitForTryOnCompletion(response.session_id);

      set({
        currentSession: {
          session_id: response.session_id,
          status: finalSession.status,
          results: finalSession.results,
          error_message: finalSession.error_message,
        },
        isProcessing: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : "Erreur lors de la création de l'essayage virtuel",
        isProcessing: false,
      });
    }
  },

  clearCurrentSession: () => {
    set({ currentSession: null, error: null });
  },
}));
