import api from './api';
import { 
  UserAvatar, 
  AvatarCheckResponse, 
  CreateAvatarRequest, 
  CreateAvatarResponse, 
  AvatarStatusResponse 
} from '@/types';

/**
 * Vérifier si l'utilisateur connecté a déjà une image body (avatar)
 */
export async function checkUserHasAvatar(): Promise<AvatarCheckResponse> {
  try {
    const response = await api.get('/avatar/check');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la vérification avatar:', error);
    throw error;
  }
}

/**
 * Créer un nouvel avatar pour l'utilisateur
 */
export async function createAvatar(request: CreateAvatarRequest): Promise<CreateAvatarResponse> {
  try {
    const response = await api.post('/avatar/create', request);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la création avatar:', error);
    throw error;
  }
}

/**
 * Vérifier le statut de création d'un avatar
 */
export async function getAvatarStatus(sessionId: string): Promise<AvatarStatusResponse> {
  try {
    const response = await api.get(`/avatar/status/${sessionId}`);
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération statut avatar:', error);
    throw error;
  }
}

/**
 * Attendre la fin de création d'un avatar avec polling
 */
export async function waitForAvatarCompletion(
  sessionId: string,
  maxAttempts: number = 15,
  delayMs: number = 3000
): Promise<AvatarStatusResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getAvatarStatus(sessionId);
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    // Attendre avant la prochaine vérification
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error('Timeout: Création avatar non terminée dans le délai imparti');
}

/**
 * Récupérer tous les avatars de l'utilisateur
 */
export async function getUserAvatars(): Promise<UserAvatar[]> {
  try {
    const response = await api.get('/avatar/list');
    return response.data;
  } catch (error) {
    console.error('Erreur lors de la récupération avatars:', error);
    throw error;
  }
}

/**
 * Construire l'URL complète d'une image S3
 */
export function buildS3Url(bucket: string, key: string): string {
  return `https://${bucket}.s3.amazonaws.com/${key}`;
}

/**
 * Service par défaut pour la compatibilité
 */
export const avatarService = {
  checkUserHasAvatar,
  createAvatar,
  getAvatarStatus,
  waitForAvatarCompletion,
  getUserAvatars,
  buildS3Url,
};