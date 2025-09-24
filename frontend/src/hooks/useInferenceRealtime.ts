import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { InferenceTaskEvent, InferenceTaskStatusResponse } from '@/services/inferenceService';

interface InferenceRealtimeState {
  status: InferenceTaskStatusResponse | null;
  events: InferenceTaskEvent[];
  isConnected: boolean;
  error: string | null;
}

interface UseInferenceRealtimeOptions {
  taskId: string | null;
  onStatusUpdate?: (status: InferenceTaskStatusResponse) => void;
  onEvent?: (event: InferenceTaskEvent) => void;
  onComplete?: (results: any) => void;
  onError?: (error: string) => void;
}

export function useInferenceRealtime(options: UseInferenceRealtimeOptions) {
  const { taskId, onStatusUpdate, onEvent, onComplete, onError } = options;
  
  const [state, setState] = useState<InferenceRealtimeState>({
    status: null,
    events: [],
    isConnected: false,
    error: null
  });

  // Fonction pour mettre à jour le statut basé sur les événements
  const updateStatusFromEvent = useCallback((event: InferenceTaskEvent) => {
    const { event_type, payload } = event;
    
    setState(prevState => {
      const newStatus: InferenceTaskStatusResponse = {
        task_id: event.inference_task_id,
        status: payload.status as any || prevState.status?.status || 'IN_QUEUE',
        progress: payload.progress || prevState.status?.progress || 0,
        message: payload.message || prevState.status?.message || 'En attente...',
        results_count: prevState.status?.results_count || 0,
        error_message: payload.error || prevState.status?.error_message
      };

      // Détecter si la tâche est terminée
      if (event_type === 'RESULT' && payload.status === 'COMPLETED') {
        newStatus.results_count = 1;
        newStatus.progress = 100;
        onComplete?.(payload);
      } else if (event_type === 'ERROR') {
        newStatus.status = 'FAILED';
        newStatus.error_message = payload.error;
        onError?.(payload.error || 'Erreur inconnue');
      }

      // Notifier les callbacks
      onStatusUpdate?.(newStatus);

      return {
        ...prevState,
        status: newStatus,
        events: [...prevState.events, event]
      };
    });
  }, [onStatusUpdate, onComplete, onError]);

  useEffect(() => {
    if (!taskId) {
      setState(prev => ({ ...prev, isConnected: false, error: null }));
      return;
    }

    // Canal pour les événements de tâche d'inférence
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
          console.log('Nouvel événement d\'inférence:', payload);
          
          const newEvent: InferenceTaskEvent = {
            id: payload.new.id,
            inference_task_id: payload.new.inference_task_id,
            event_type: payload.new.event_type,
            payload: typeof payload.new.payload === 'string' 
              ? JSON.parse(payload.new.payload) 
              : payload.new.payload,
            created_at: payload.new.created_at
          };

          onEvent?.(newEvent);
          updateStatusFromEvent(newEvent);
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
          console.log('Mise à jour de tâche d\'inférence:', payload);
          
          const updatedTask = payload.new;
          const newStatus: InferenceTaskStatusResponse = {
            task_id: updatedTask.id,
            status: updatedTask.status,
            progress: updatedTask.progress || 0,
            message: getStatusMessage(updatedTask.status, updatedTask.progress),
            results_count: updatedTask.output ? 1 : 0,
            error_message: updatedTask.error_message
          };

          setState(prev => ({ ...prev, status: newStatus }));
          onStatusUpdate?.(newStatus);

          // Vérifier si la tâche est terminée
          if (updatedTask.status === 'COMPLETED' && updatedTask.output) {
            try {
              const output = typeof updatedTask.output === 'string' 
                ? JSON.parse(updatedTask.output) 
                : updatedTask.output;
              onComplete?.(output);
            } catch (e) {
              console.error('Erreur lors du parsing de la sortie:', e);
            }
          }
        }
      )
      .subscribe((status) => {
        console.log('Statut de subscription Realtime:', status);
        
        setState(prev => ({
          ...prev,
          isConnected: status === 'SUBSCRIBED',
          error: status === 'CHANNEL_ERROR' || status === 'TIMED_OUT' 
            ? 'Erreur de connexion Realtime' 
            : null
        }));
      });

    // Nettoyage à la déconnexion
    return () => {
      console.log('Déconnexion du canal Realtime pour la tâche:', taskId);
      supabase.removeChannel(channel);
    };
  }, [taskId, updateStatusFromEvent]); // Seuls taskId et updateStatusFromEvent dans les dépendances

  // Fonction pour forcer la reconnexion
  const reconnect = useCallback(() => {
    setState(prev => ({ ...prev, error: null, isConnected: false }));
    // La reconnexion sera gérée par l'effet useEffect ci-dessus
  }, []);

  // Fonction pour nettoyer les événements
  const clearEvents = useCallback(() => {
    setState(prev => ({ ...prev, events: [] }));
  }, []);

  return {
    ...state,
    reconnect,
    clearEvents
  };
}

// Fonction utilitaire pour générer des messages de statut
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

export default useInferenceRealtime;