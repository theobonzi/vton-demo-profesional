import api from './api';

// Types simplifiés pour RunPod
export interface RunJobRequest {
  // Images vêtements (choix entre URLs ou base64)
  cloth_image_urls?: string[];
  cloth_images?: string[];
  
  // Avatar (optionnel)
  person_image_data?: string;
  mask_image_data?: string;
  person_s3_key?: string;
  mask_s3_key?: string;
  
  // Paramètres
  steps?: number;
  guidance_scale?: number;
}

export interface RunJobResponse {
  job_id: string;
  status: string;
  message: string;
}

export interface JobStatusResponse {
  job_id: string;
  status: 'IN_PROGRESS' | 'COMPLETED' | 'FAILED' | 'CANCELLED' | 'IN_QUEUE';
  output?: any;
  error?: string;
  result_url?: string; // URL S3 signée si disponible
}

class RunPodService {
  /**
   * Créer un job RunPod
   */
  async createJob(request: RunJobRequest): Promise<RunJobResponse> {
    const response = await api.post('/runpod/run', request);
    return response.data;
  }

  /**
   * Récupérer le statut d'un job
   */
  async getJobStatus(jobId: string): Promise<JobStatusResponse> {
    const response = await api.get(`/runpod/status/${jobId}`);
    return response.data;
  }

  /**
   * Annuler un job
   */
  async cancelJob(jobId: string): Promise<{message: string}> {
    const response = await api.delete(`/runpod/cancel/${jobId}`);
    return response.data;
  }

  /**
   * Polling simple avec backoff exponentiel
   */
  async pollJobStatus(
    jobId: string,
    onStatusUpdate: (status: JobStatusResponse) => void,
    onComplete: (result: JobStatusResponse) => void,
    onError: (error: string) => void,
    maxAttempts: number = 60, // Double le nombre de tentatives
    initialInterval: number = 3000 // Augmente l'intervalle initial
  ): Promise<void> {
    let attempts = 0;
    let currentInterval = initialInterval;

    console.log(`🚀 Démarrage polling pour job ${jobId} (max: ${maxAttempts}, interval: ${initialInterval}ms)`);

    const poll = async () => {
      try {
        attempts++;
        console.log(`🔄 Polling tentative ${attempts}/${maxAttempts} pour job ${jobId}`);
        
        const status = await this.getJobStatus(jobId);
        console.log(`📊 Status reçu:`, {
          job_id: status.job_id,
          status: status.status,
          result_url: status.result_url,
          hasOutput: !!status.output
        });
        
        onStatusUpdate(status);

        // Vérifier si terminé
        if (status.status === 'COMPLETED') {
          console.log(`✅ Job ${jobId} terminé avec succès - Appelant onComplete...`);
          console.log(`🎯 Result URL:`, status.result_url);
          onComplete(status);
          return;
        }

        if (status.status === 'FAILED') {
          console.log(`❌ Job ${jobId} échoué: ${status.error}`);
          onError(status.error || 'Job failed');
          return;
        }

        // Continuer si pas terminé et sous les limites
        if (attempts < maxAttempts && status.status !== 'CANCELLED') {
          // Backoff exponentiel avec jitter
          const jitter = 0.8 + (Math.random() * 0.4); // ±20%
          const nextInterval = Math.min(currentInterval * 1.5, 30000) * jitter; // Max 30s
          
          console.log(`⏳ Prochaine vérification dans ${Math.round(nextInterval)}ms`);
          
          setTimeout(poll, nextInterval);
          currentInterval = nextInterval;
        } else {
          console.log(`⏰ Timeout atteint pour job ${jobId}`);
          onError(`Timeout: maximum ${maxAttempts} tentatives atteint`);
        }

      } catch (error: any) {
        console.error(`❌ Erreur lors du polling job ${jobId}:`, error);
        
        // Retry avec backoff en cas d'erreur réseau
        if (attempts < maxAttempts && error.response?.status !== 404) {
          const retryInterval = currentInterval * 2; // Double l'intervalle
          console.log(`🔄 Retry dans ${retryInterval}ms après erreur`);
          setTimeout(poll, retryInterval);
          currentInterval = retryInterval;
        } else {
          console.log(`💥 Erreur fatale pour job ${jobId}: ${error.message}`);
          onError(`Erreur de polling: ${error.message}`);
        }
      }
    };

    // Démarrer le polling
    poll();
  }

  /**
   * Helper pour convertir File en base64
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
   * Helper pour traiter plusieurs images
   */
  async processImages(files: File[]): Promise<string[]> {
    return Promise.all(files.map(file => this.fileToBase64(file)));
  }
}

export const runpodService = new RunPodService();
export default runpodService;