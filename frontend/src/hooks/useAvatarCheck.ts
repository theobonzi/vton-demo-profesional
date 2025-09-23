import { useState, useEffect } from 'react';
import { checkUserHasAvatar } from '@/services/avatarService';
import { useAuthStore } from '@/store/useAuthStore';
import { toast } from 'sonner';
import { AvatarCheckResponse } from '@/types';

interface UseAvatarCheckResult {
  hasAvatar: boolean;
  avatarData: AvatarCheckResponse | null;
  isLoading: boolean;
  error: string | null;
  refetch: () => Promise<void>;
}

/**
 * Hook pour vérifier si l'utilisateur a un avatar (image body)
 */
export function useAvatarCheck(): UseAvatarCheckResult {
  const [hasAvatar, setHasAvatar] = useState(false);
  const [avatarData, setAvatarData] = useState<AvatarCheckResponse | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const { isAuthenticated } = useAuthStore();

  const checkAvatar = async () => {
    if (!isAuthenticated) {
      setHasAvatar(false);
      setAvatarData(null);
      setError(null);
      return;
    }

    setIsLoading(true);
    setError(null);
    
    try {
      const response = await checkUserHasAvatar();
      setHasAvatar(response.has_avatar);
      setAvatarData(response);
    } catch (err: any) {
      const errorMessage = err?.response?.data?.detail || err?.message || 'Erreur lors de la vérification avatar';
      setError(errorMessage);
      setHasAvatar(false);
      setAvatarData(null);
      
      // Ne pas afficher de toast pour les erreurs 401 (non authentifié)
      if (err?.response?.status !== 401) {
        toast.error(`Erreur avatar: ${errorMessage}`);
      }
    } finally {
      setIsLoading(false);
    }
  };

  // Vérifier automatiquement au montage et quand l'authentification change
  useEffect(() => {
    checkAvatar();
  }, [isAuthenticated]);

  return {
    hasAvatar,
    avatarData,
    isLoading,
    error,
    refetch: checkAvatar,
  };
}

/**
 * Fonction utilitaire pour vérifier l'avatar avant le workflow try-on
 */
export async function checkAvatarBeforeTryOn(): Promise<{
  hasAvatar: boolean;
  avatarData?: AvatarCheckResponse;
  needsCreation: boolean;
}> {
  try {
    const response = await checkUserHasAvatar();
    
    return {
      hasAvatar: response.has_avatar,
      avatarData: response.has_avatar ? response : undefined,
      needsCreation: !response.has_avatar,
    };
  } catch (error: any) {
    // En cas d'erreur, considérer qu'il faut créer un avatar
    console.warn('Erreur vérification avatar, création nécessaire:', error);
    return {
      hasAvatar: false,
      needsCreation: true,
    };
  }
}