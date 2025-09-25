import { useEffect, useState, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { 
  InferenceTaskEvent, 
  InferenceTaskStatusResponse, 
  InferenceResultsResponse,
  inferenceService 
} from '@/services/inferenceService';

interface InferenceStatusState {
  status: InferenceTaskStatusResponse | null;
  events: InferenceTaskEvent[];
  isRealtimeConnected: boolean;
  isPollingActive: boolean;
  error: string | null;
  source: 'realtime' | 'polling' | 'idle';
}

interface UseInferenceStatusOptions {
  taskId: string | null;
  jobId?: string | null; // Support pour le jobID RunPod
  onStatusUpdate?: (status: InferenceTaskStatusResponse) => void;
  onEvent?: (event: InferenceTaskEvent) => void;
  onComplete?: (results: InferenceResultsResponse) => void;
  onError?: (error: string) => void;
  enableRealtime?: boolean; // Possibilité de désactiver Realtime
  enablePolling?: boolean;  // Possibilité de désactiver polling
}

export function useInferenceStatus(options: UseInferenceStatusOptions) {
  const { 
    taskId, 
    jobId, 
    onStatusUpdate, 
    onEvent, 
    onComplete, 
    onError,
    enableRealtime = true,
    enablePolling = true 
  } = options;
  
  const [state, setState] = useState<InferenceStatusState>({
    status: null,
    events: [],
    isRealtimeConnected: false,
    isPollingActive: false,
    error: null,
    source: 'idle'
  });

  // Références pour éviter les re-renders
  const realtimeChannelRef = useRef<any>(null);
  const hasCompletedRef = useRef(false);
  const lastStatusRef = useRef<string | null>(null);

  // Fonction de mise à jour du statut (commune aux deux sources)
  const updateStatus = useCallback((
    newStatus: InferenceTaskStatusResponse, 
    source: 'realtime' | 'polling'
  ) => {
    setState(prev => ({ ...prev, status: newStatus, source }));
    
    // Éviter les callbacks multiples pour le même statut final
    if (newStatus.status !== lastStatusRef.current) {
      lastStatusRef.current = newStatus.status;
      onStatusUpdate?.(newStatus);
      
      if (newStatus.status === 'FAILED' && newStatus.error_message) {
        onError?.(newStatus.error_message);
      }
    }

    // Marquer comme terminé pour éviter les callbacks multiples
    if (['COMPLETED', 'FAILED', 'CANCELLED'].includes(newStatus.status) && !hasCompletedRef.current) {
      hasCompletedRef.current = true;
      
      if (newStatus.status === 'COMPLETED') {
        // Récupérer les résultats finaux
        inferenceService.getTaskResults(taskId!)
          .then(results => onComplete?.(results))
          .catch(err => onError?.(`Erreur récupération résultats: ${err.message}`));
      }
    }
  }, [taskId, onStatusUpdate, onComplete, onError]);

  // Gestion des événements Realtime
  const handleRealtimeEvent = useCallback((event: InferenceTaskEvent) => {
    onEvent?.(event);
    
    const { event_type, payload } = event;
    
    setState(prev => {
      const newStatus: InferenceTaskStatusResponse = {
        task_id: event.inference_task_id,
        status: payload.status as any || prev.status?.status || 'IN_QUEUE',
        progress: payload.progress || prev.status?.progress || 0,
        message: payload.message || prev.status?.message || 'En attente...',
        results_count: prev.status?.results_count || 0,
        error_message: payload.error || prev.status?.error_message
      };

      // Traitement spécifique par type d'événement
      if (event_type === 'RESULT' && payload.status === 'COMPLETED') {
        newStatus.results_count = 1;
        newStatus.progress = 100;
      } else if (event_type === 'ERROR') {
        newStatus.status = 'FAILED';
        newStatus.error_message = payload.error;
      }

      updateStatus(newStatus, 'realtime');

      return {
        ...prev,
        events: [...prev.events, event]
      };
    });
  }, [onEvent, updateStatus]);

  // Configuration Realtime
  useEffect(() => {
    if (!taskId || !enableRealtime) {
      setState(prev => ({ ...prev, isRealtimeConnected: false }));
      return;
    }

    const channel = supabase
      .channel(`inference_task_${taskId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'inference_task_event',
          filter: `inference_task_id=eq.${taskId}`
        },
        (payload) => {
          const newEvent: InferenceTaskEvent = {
            id: payload.new.id,
            inference_task_id: payload.new.inference_task_id,
            event_type: payload.new.event_type,
            payload: typeof payload.new.payload === 'string' 
              ? JSON.parse(payload.new.payload) 
              : payload.new.payload,
            created_at: payload.new.created_at
          };
          handleRealtimeEvent(newEvent);
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'inference_task',
          filter: `id=eq.${taskId}`
        },
        (payload) => {
          const updatedTask = payload.new;
          const newStatus: InferenceTaskStatusResponse = {
            task_id: updatedTask.id,
            status: updatedTask.status,
            progress: updatedTask.progress || 0,
            message: getStatusMessage(updatedTask.status, updatedTask.progress),
            results_count: updatedTask.output ? 1 : 0,
            error_message: updatedTask.error_message
          };

          updateStatus(newStatus, 'realtime');
        }
      )
      .subscribe((status) => {
        const isConnected = status === 'SUBSCRIBED';
        setState(prev => ({ 
          ...prev, 
          isRealtimeConnected: isConnected,
          error: ['CHANNEL_ERROR', 'TIMED_OUT'].includes(status) 
            ? 'Connexion Realtime perdue' 
            : null
        }));

        // Fallback vers polling si Realtime échoue
        if (!isConnected && enablePolling && !state.isPollingActive) {
          console.warn('Realtime déconnecté, basculement vers polling...');
          // Le polling sera activé par l'effet suivant
        }
      });

    realtimeChannelRef.current = channel;

    return () => {
      if (realtimeChannelRef.current) {
        supabase.removeChannel(realtimeChannelRef.current);
        realtimeChannelRef.current = null;
      }
    };
  }, [taskId, enableRealtime, handleRealtimeEvent, updateStatus]);

  // Configuration Polling intelligent (fallback + principal)
  useEffect(() => {
    if (!taskId || !enablePolling) return;
    
    // Démarrer polling si :
    // 1. Realtime désactivé OU
    // 2. Realtime déconnecté OU 
    // 3. Pas encore de statut final
    const shouldStartPolling = 
      !enableRealtime || 
      !state.isRealtimeConnected || 
      !hasCompletedRef.current;

    if (shouldStartPolling && !state.isPollingActive) {
      setState(prev => ({ ...prev, isPollingActive: true }));

      console.log('🔄 Démarrage du polling intelligent pour taskId:', taskId);

      inferenceService.startPolling(
        taskId,
        // onStatusUpdate
        (status) => {
          updateStatus(status, 'polling');
        },
        // onComplete
        (results) => {
          setState(prev => ({ ...prev, isPollingActive: false }));
          onComplete?.(results);
        },
        // onError
        (error) => {
          setState(prev => ({ 
            ...prev, 
            isPollingActive: false, 
            error: `Polling error: ${error}` 
          }));
          onError?.(error);
        }
      );
    }

    // Nettoyage
    return () => {
      if (state.isPollingActive) {
        inferenceService.stopPolling(taskId);
        setState(prev => ({ ...prev, isPollingActive: false }));
      }
    };
  }, [taskId, enablePolling, state.isRealtimeConnected, state.isPollingActive, updateStatus, onComplete, onError]);

  // Nettoyage général
  useEffect(() => {
    return () => {
      if (taskId) {
        inferenceService.stopPolling(taskId);
      }
      hasCompletedRef.current = false;
      lastStatusRef.current = null;
    };
  }, [taskId]);

  // Fonction de reconnexion manuelle
  const reconnect = useCallback(() => {
    setState(prev => ({ 
      ...prev, 
      error: null, 
      isRealtimeConnected: false,
      isPollingActive: false 
    }));
    hasCompletedRef.current = false;
    lastStatusRef.current = null;
  }, []);

  // Fonction pour forcer le passage en polling
  const switchToPolling = useCallback(() => {
    if (realtimeChannelRef.current) {
      supabase.removeChannel(realtimeChannelRef.current);
      realtimeChannelRef.current = null;
    }
    setState(prev => ({ 
      ...prev, 
      isRealtimeConnected: false,
      isPollingActive: false // Will trigger polling in next effect
    }));
  }, []);

  return {
    ...state,
    reconnect,
    switchToPolling,
    // Informations de débogage
    debug: {
      taskId,
      jobId,
      hasCompleted: hasCompletedRef.current,
      lastStatus: lastStatusRef.current,
      realtimeEnabled: enableRealtime,
      pollingEnabled: enablePolling
    }
  };
}

// Fonction utilitaire identique à l'original
function getStatusMessage(status: string, progress: number = 0): string {
  switch (status) {
    case 'IN_QUEUE':
      return 'Tâche en attente de traitement';
    case 'IN_PROGRESS':
      if (progress < 30) return 'Préparation des images...';
      if (progress < 60) return 'Envoi à Runpod...';
      if (progress < 90) return 'Traitement en cours...';
      return 'Finalisation...';
    case 'COMPLETED':
      return 'Traitement terminé avec succès';
    case 'FAILED':
      return 'Échec du traitement';
    case 'CANCELLED':
      return 'Traitement annulé';
    default:
      return `Statut: ${status}`;
  }
}

export default useInferenceStatus;