import api from './api';

export interface CreateInferenceTaskRequest {
  cloth_images: string[];
  steps?: number;
  guidance_scale?: number;
}

export interface CreateInferenceTaskResponse {
  task_id: string;
  status: string;
  message: string;
  cloth_count: number;
}

export interface InferenceTaskStatusResponse {
  task_id: string;
  status: 'IN_QUEUE' | 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  progress: number;
  message: string;
  results_count: number;
  error_message?: string;
}

export interface InferenceResultItem {
  cloth_s3_key: string;
  result_s3_key?: string;
  result_signed_url?: string;
  status: 'success' | 'failed';
  error?: string;
}

export interface InferenceResultsResponse {
  task_id: string;
  status: string;
  results: InferenceResultItem[];
  total_results: number;
  successful_results: number;
  failed_results: number;
}

export interface InferenceTaskEvent {
  id: number;
  inference_task_id: string;
  event_type: 'STATE' | 'PROGRESS' | 'RESULT' | 'ERROR';
  payload: {
    status?: string;
    progress?: number;
    message?: string;
    result_s3_key?: string;
    error?: string;
  };
  created_at: string;
}

export interface PollingInfo {
  recommendedInterval: number;
  maxAttempts: number;
  timeout: number;
  shouldStop: boolean;
  priority: 'normal' | 'high';
}

export interface PollingManager {
  taskId: string;
  attempts: number;
  startTime: number;
  currentInterval: number;
  maxAttempts: number;
  totalTimeout: number;
  isActive: boolean;
}

class InferenceService {
  /**
   * Créer une nouvelle tâche d'inférence VTO
   */
  async createInferenceTask(request: CreateInferenceTaskRequest): Promise<CreateInferenceTaskResponse> {
    const response = await api.post('/inference_tasks', request);
    return response.data;
  }

  /**
   * Récupérer le statut d'une tâche d'inférence
   */
  async getTaskStatus(taskId: string): Promise<InferenceTaskStatusResponse & { pollingInfo?: PollingInfo }> {
    const response = await api.get(`/inference_tasks/${taskId}/status`);
    
    // Extraire les headers de contrôle polling depuis le backend
    const pollingInfo: PollingInfo = {
      recommendedInterval: parseInt(response.headers['x-poll-interval'] || '5'),
      maxAttempts: parseInt(response.headers['x-poll-max-attempts'] || '30'),
      timeout: parseInt(response.headers['x-poll-timeout'] || '300'),
      shouldStop: response.headers['x-poll-stop'] === 'true',
      priority: response.headers['x-poll-priority'] || 'normal'
    };
    
    return { ...response.data, pollingInfo };
  }

  /**
   * Récupérer les résultats d'une tâche d'inférence
   */
  async getTaskResults(taskId: string): Promise<InferenceResultsResponse> {
    const response = await api.get(`/inference_tasks/${taskId}/results`);
    return response.data;
  }

  /**
   * Obtenir une URL signée pour un résultat
   */
  async getResultSignedUrl(taskId: string): Promise<{
    signed_url: string;
    s3_key: string;
    expires_in: number;
  }> {
    const response = await api.get(`/inference_tasks/${taskId}/signed-url`);
    return response.data;
  }

  /**
   * Convertir une image File en base64
   */
  async fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') {
          resolve(reader.result);
        } else {
          reject(new Error('Failed to convert file to base64'));
        }
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  /**
   * Convertir plusieurs images en base64
   */
  async filesToBase64(files: File[]): Promise<string[]> {
    return Promise.all(files.map(file => this.fileToBase64(file)));
  }

  /**
   * Extraire la partie base64 d'une data URL
   */
  extractBase64FromDataUrl(dataUrl: string): string {
    if (dataUrl.startsWith('data:')) {
      return dataUrl.split(',')[1];
    }
    return dataUrl;
  }

  /**
   * Obtenir le type MIME à partir d'une data URL
   */
  getMimeTypeFromDataUrl(dataUrl: string): string {
    if (dataUrl.startsWith('data:')) {
      const match = dataUrl.match(/^data:([^;]+);base64,/);
      return match ? match[1] : 'image/jpeg';
    }
    return 'image/jpeg';
  }

  /**
   * Valider une image base64
   */
  validateBase64Image(base64String: string): boolean {
    try {
      // Vérifier si c'est une data URL valide
      if (base64String.startsWith('data:image/')) {
        const base64Data = this.extractBase64FromDataUrl(base64String);
        // Vérifier si le base64 peut être décodé
        atob(base64Data);
        return true;
      }
      
      // Vérifier si c'est du base64 pur
      atob(base64String);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Redimensionner une image avant l'envoi (optionnel)
   */
  async resizeImage(file: File, maxWidth: number = 1024, maxHeight: number = 1024): Promise<string> {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      img.onload = () => {
        // Calculer les nouvelles dimensions
        let { width, height } = img;
        
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height);
          width *= ratio;
          height *= ratio;
        }

        canvas.width = width;
        canvas.height = height;

        // Dessiner l'image redimensionnée
        ctx?.drawImage(img, 0, 0, width, height);

        // Convertir en base64
        const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
        resolve(dataUrl);
      };

      img.onerror = reject;
      img.src = URL.createObjectURL(file);
    });
  }

  /**
   * Traiter plusieurs images avec redimensionnement
   */
  async processImages(files: File[], resize: boolean = true): Promise<string[]> {
    if (resize) {
      return Promise.all(files.map(file => this.resizeImage(file)));
    } else {
      return this.filesToBase64(files);
    }
  }

  // Gestion du polling optimisé selon votre brief
  private activePollers: Map<string, PollingManager> = new Map();

  /**
   * Polling intelligent avec backoff exponentiel + jitter selon le brief
   */
  async startPolling(
    taskId: string, 
    onStatusUpdate: (status: InferenceTaskStatusResponse) => void,
    onComplete: (results: InferenceResultsResponse) => void,
    onError: (error: string) => void
  ): Promise<void> {
    // Arrêter tout polling existant pour cette tâche
    this.stopPolling(taskId);

    const manager: PollingManager = {
      taskId,
      attempts: 0,
      startTime: Date.now(),
      currentInterval: 2000, // Start avec 2s
      maxAttempts: 30,
      totalTimeout: 300000, // 5 minutes
      isActive: true
    };

    this.activePollers.set(taskId, manager);

    const poll = async () => {
      if (!manager.isActive) return;

      try {
        manager.attempts++;
        const statusResponse = await this.getTaskStatus(taskId);
        
        // Utiliser les recommandations du backend si disponibles
        if (statusResponse.pollingInfo) {
          const info = statusResponse.pollingInfo;
          manager.maxAttempts = info.maxAttempts;
          manager.totalTimeout = info.timeout * 1000;
          
          if (info.shouldStop) {
            this.stopPolling(taskId);
            if (statusResponse.status === 'COMPLETED') {
              const results = await this.getTaskResults(taskId);
              onComplete(results);
            }
            return;
          }
          
          // Utiliser l'intervalle recommandé avec jitter
          const baseInterval = info.recommendedInterval * 1000;
          const jitter = 0.8 + (Math.random() * 0.4); // ±20% jitter
          manager.currentInterval = Math.round(baseInterval * jitter);
        }

        onStatusUpdate(statusResponse);

        // Vérifications de fin
        const elapsed = Date.now() - manager.startTime;
        const shouldContinue = manager.isActive && 
                              manager.attempts < manager.maxAttempts &&
                              elapsed < manager.totalTimeout &&
                              !['COMPLETED', 'FAILED', 'CANCELLED'].includes(statusResponse.status);

        if (!shouldContinue) {
          this.stopPolling(taskId);
          
          if (statusResponse.status === 'COMPLETED') {
            const results = await this.getTaskResults(taskId);
            onComplete(results);
          } else if (statusResponse.status === 'FAILED') {
            onError(statusResponse.error_message || 'Tâche échouée');
          } else if (manager.attempts >= manager.maxAttempts) {
            onError('Timeout: nombre maximum de tentatives atteint');
          } else if (elapsed >= manager.totalTimeout) {
            onError('Timeout: temps maximum dépassé');
          }
          return;
        }

        // Programmer le prochain poll
        setTimeout(poll, manager.currentInterval);

      } catch (error) {
        console.error(`Erreur lors du polling pour ${taskId}:`, error);
        
        // En cas d'erreur 429 (rate limit), augmenter l'intervalle
        if (error.response?.status === 429) {
          const retryAfter = parseInt(error.response.headers['retry-after'] || '5') * 1000;
          manager.currentInterval = Math.max(manager.currentInterval, retryAfter);
          setTimeout(poll, manager.currentInterval);
        } else {
          this.stopPolling(taskId);
          onError(`Erreur de polling: ${error.message}`);
        }
      }
    };

    // Démarrer le polling
    poll();
  }

  /**
   * Arrêter le polling pour une tâche
   */
  stopPolling(taskId: string): void {
    const manager = this.activePollers.get(taskId);
    if (manager) {
      manager.isActive = false;
      this.activePollers.delete(taskId);
    }
  }

  /**
   * Arrêter tout le polling (utile lors de la fermeture/navigation)
   */
  stopAllPolling(): void {
    for (const [taskId, manager] of this.activePollers.entries()) {
      manager.isActive = false;
    }
    this.activePollers.clear();
  }

  /**
   * Obtenir les informations de polling actives
   */
  getActivePollers(): string[] {
    return Array.from(this.activePollers.keys());
  }
}

export const inferenceService = new InferenceService();
export default inferenceService;