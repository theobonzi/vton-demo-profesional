import { useState, useCallback, useRef, useEffect } from 'react';
import { runpodService, JobStatusResponse } from '@/services/runpodService';

interface UseRunPodJobOptions {
  onStatusUpdate?: (status: JobStatusResponse) => void;
  onComplete?: (result: JobStatusResponse) => void;
  onError?: (error: string) => void;
  maxAttempts?: number;
  initialInterval?: number;
}

interface RunPodJobState {
  jobId: string | null;
  status: JobStatusResponse | null;
  isPolling: boolean;
  error: string | null;
}

export function useRunPodJob(options: UseRunPodJobOptions = {}) {
  const {
    onStatusUpdate,
    onComplete,
    onError,
    maxAttempts = 30,
    initialInterval = 2000
  } = options;

  const [state, setState] = useState<RunPodJobState>({
    jobId: null,
    status: null,
    isPolling: false,
    error: null
  });

  const isMountedRef = useRef(true);
  const pollingActiveRef = useRef(false);

  // Wrapper pour les updates sécurisés
  const safeSetState = useCallback((updater: (prev: RunPodJobState) => RunPodJobState) => {
    if (isMountedRef.current) {
      setState(updater);
    }
  }, []);

  // Callbacks internes
  const handleStatusUpdate = useCallback((status: JobStatusResponse) => {
    safeSetState(prev => ({ ...prev, status }));
    onStatusUpdate?.(status);
  }, [onStatusUpdate, safeSetState]);

  const handleComplete = useCallback((result: JobStatusResponse) => {
    // Sauvegarder le résultat en localStorage
    try {
      const existingJobData = localStorage.getItem(`runpod_job_${result.job_id}`);
      if (existingJobData) {
        const jobData = JSON.parse(existingJobData);
        jobData.status = 'COMPLETED';
        jobData.result = result;
        jobData.completedTime = Date.now();
        localStorage.setItem(`runpod_job_${result.job_id}`, JSON.stringify(jobData));
        console.log('💾 Résultat sauvegardé en localStorage pour:', result.job_id);
      }
    } catch (e) {
      console.warn('⚠️ Impossible de sauvegarder le résultat:', e);
    }
    
    safeSetState(prev => ({ ...prev, isPolling: false, status: result }));
    pollingActiveRef.current = false;
    onComplete?.(result);
  }, [onComplete, safeSetState]);

  const handleError = useCallback((error: string) => {
    safeSetState(prev => ({ ...prev, isPolling: false, error }));
    pollingActiveRef.current = false;
    onError?.(error);
  }, [onError, safeSetState]);

  // 🔒 DISABLED: Restoration des jobs depuis localStorage au montage
  // Cette fonctionnalité cause des problèmes avec les anciens résultats
  useEffect(() => {
    console.log('🚫 Restauration automatique désactivée pour éviter les conflits');
    
    // // Vérifier s'il y a des jobs en cours
    // const checkForPendingJobs = () => {
    //   const keys = Object.keys(localStorage).filter(key => key.startsWith('runpod_job_'));
    //   
    //   for (const key of keys) {
    //     try {
    //       const jobData = JSON.parse(localStorage.getItem(key) || '{}');
    //       
    //       // Si le job est terminé, on le charge directement
    //       if (jobData.status === 'COMPLETED' && jobData.result) {
    //         console.log('🔄 Restauration job terminé:', jobData.jobId);
    //         safeSetState(prev => ({
    //           ...prev,
    //           jobId: jobData.jobId,
    //           status: jobData.result,
    //           isPolling: false
    //         }));
    //         return; // On prend le premier job trouvé
    //       }
    //       
    //       // Si le job est en cours et récent (moins de 30min), on continue le polling
    //       const age = Date.now() - jobData.startTime;
    //       if (age < 30 * 60 * 1000 && ['IN_QUEUE', 'IN_PROGRESS'].includes(jobData.status)) {
    //         console.log('🔄 Reprise polling job en cours:', jobData.jobId);
    //         safeSetState(prev => ({
    //           ...prev,
    //           jobId: jobData.jobId,
    //           status: {
    //             job_id: jobData.jobId,
    //             status: jobData.status,
    //             output: null,
    //             error: null
    //           } as JobStatusResponse,
    //           isPolling: true
    //         }));
    //         
    //         // Reprendre le polling
    //         pollingActiveRef.current = true;
    //         runpodService.pollJobStatus(
    //           jobData.jobId,
    //           handleStatusUpdate,
    //           handleComplete,
    //           handleError,
    //           maxAttempts,
    //           initialInterval
    //         );
    //         return;
    //       }
    //     } catch (e) {
    //       console.warn('⚠️ Job data corrompu, suppression:', key);
    //       localStorage.removeItem(key);
    //     }
    //   }
    // };
    // 
    // checkForPendingJobs();
  }, [handleStatusUpdate, handleComplete, handleError, maxAttempts, initialInterval, safeSetState]);

  // Cleanup au démontage
  useEffect(() => {
    return () => {
      isMountedRef.current = false;
      pollingActiveRef.current = false;
    };
  }, []);

  // Créer et démarrer un job
  const startJob = useCallback(async (jobRequest: any) => {
    try {
      safeSetState(prev => ({ ...prev, error: null, isPolling: false }));
      
      console.log('🚀 Création du job RunPod...', jobRequest);
      
      // 1. Créer le job
      const jobResponse = await runpodService.createJob(jobRequest);
      const jobId = jobResponse.job_id;
      
      // 2. Sauvegarder en localStorage pour persistance
      const jobData = {
        jobId,
        status: 'IN_QUEUE',
        startTime: Date.now(),
        request: jobRequest
      };
      localStorage.setItem(`runpod_job_${jobId}`, JSON.stringify(jobData));
      
      safeSetState(prev => ({
        ...prev,
        jobId,
        status: {
          job_id: jobId,
          status: 'IN_QUEUE',
          output: null,
          error: null
        } as JobStatusResponse,
        isPolling: true
      }));

      console.log('✅ Job créé et sauvegardé:', jobId);

      // 3. Démarrer le polling
      pollingActiveRef.current = true;
      
      runpodService.pollJobStatus(
        jobId,
        handleStatusUpdate,
        handleComplete,
        handleError,
        maxAttempts,
        initialInterval
      );

      return jobId;

    } catch (error: any) {
      console.error('❌ Erreur création job:', error);
      const errorMessage = error.response?.data?.detail || error.message || 'Erreur inconnue';
      safeSetState(prev => ({ ...prev, error: errorMessage }));
      throw error;
    }
  }, [handleStatusUpdate, handleComplete, handleError, maxAttempts, initialInterval, safeSetState]);

  // Arrêter le polling (optionnel - le polling s'arrête automatiquement)
  const stopPolling = useCallback(() => {
    pollingActiveRef.current = false;
    safeSetState(prev => ({ ...prev, isPolling: false }));
  }, [safeSetState]);

  // Annuler le job
  const cancelJob = useCallback(async () => {
    if (!state.jobId) return;
    
    try {
      await runpodService.cancelJob(state.jobId);
      stopPolling();
      safeSetState(prev => ({
        ...prev,
        status: prev.status ? { ...prev.status, status: 'CANCELLED' } : null
      }));
    } catch (error: any) {
      console.error('❌ Erreur annulation job:', error);
    }
  }, [state.jobId, stopPolling, safeSetState]);

  // Reset complet
  const reset = useCallback(() => {
    stopPolling();
    
    // Nettoyer localStorage si on a un job actuel
    if (state.jobId) {
      localStorage.removeItem(`runpod_job_${state.jobId}`);
      console.log('🗑️ Job supprimé du localStorage:', state.jobId);
    }
    
    safeSetState(() => ({
      jobId: null,
      status: null,
      isPolling: false,
      error: null
    }));
  }, [stopPolling, safeSetState, state.jobId]);

  // Vérifier manuellement le statut
  const checkStatus = useCallback(async () => {
    if (!state.jobId) return null;
    
    try {
      const status = await runpodService.getJobStatus(state.jobId);
      safeSetState(prev => ({ ...prev, status }));
      return status;
    } catch (error: any) {
      console.error('❌ Erreur vérification statut:', error);
      return null;
    }
  }, [state.jobId, safeSetState]);

  return {
    // État
    ...state,
    
    // Actions
    startJob,
    stopPolling,
    cancelJob,
    reset,
    checkStatus,
    
    // Helpers
    isActive: pollingActiveRef.current,
    isCompleted: state.status?.status === 'COMPLETED',
    isFailed: state.status?.status === 'FAILED',
    
    // Debug info
    debug: {
      jobId: state.jobId,
      isPolling: state.isPolling,
      pollingActive: pollingActiveRef.current,
      mounted: isMountedRef.current
    }
  };
}

export default useRunPodJob;