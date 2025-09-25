import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Download, Share2 } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import useRunPodJob from "@/hooks/useRunPodJob";
import { JobStatusResponse } from "@/services/runpodService";

// Helper to format API errors safely for toast display
function humanizeApiError(e: any): string {
  const detail = e?.response?.data?.detail;
  if (Array.isArray(detail)) {
    // Pydantic list of errors
    const lines = detail.map((d: any) => {
      const field = Array.isArray(d.loc) ? d.loc.join(".") : String(d.loc ?? "");
      const msg = String(d.msg ?? d.message ?? "Erreur de validation");
      return field ? `${field}: ${msg}` : msg;
    });
    return lines.join("\n");
  }
  if (typeof detail === "string") return detail;
  if (typeof detail === "object") return JSON.stringify(detail);
  return String(e?.message || "Erreur inconnue");
}

export default function VirtualFitting() {
  // Fix: Use proper auth state subscription instead of getState()
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  
  // Fix: Use string keys for likes (more stable)
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Location state for RunPod job
  const { productConfigs, currentBodyImage, currentMaskImage, avatarS3Urls } = (location.state || {}) as {
    productConfigs?: Array<any>;
    currentBodyImage?: string;
    currentMaskImage?: string;
    avatarS3Urls?: { person_s3_key?: string; mask_s3_key?: string };
  };

  // États simplifiés pour le système RunPod
  const [isStartingJob, setIsStartingJob] = useState(false);
  const [results, setResults] = useState<any | null>(null);
  const [mode, setMode] = useState<'ready' | 'processing' | 'results'>('ready');
  const [forceReset, setForceReset] = useState(0); // Force reset trigger

  // Debug mode changes
  useEffect(() => {
    console.log('🎯 Mode changé vers:', mode);
  }, [mode]);

  // 🔥 FORCE CLEAR all localStorage jobs on mount 
  useEffect(() => {
    console.log('🔥 FORCE CLEAR - Nettoyage complet localStorage au montage');
    
    // Clear ALL RunPod jobs from localStorage
    const keys = Object.keys(localStorage).filter(key => key.startsWith('runpod_job_'));
    keys.forEach(key => {
      localStorage.removeItem(key);
      console.log('🗑️ Job supprimé:', key);
    });
    
    // Force component reset
    setResults(null);
    setMode('ready');
    setForceReset(prev => prev + 1);
  }, []); // Only on mount

  // Fix: Protection against state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => {
    return () => { 
      isMountedRef.current = false;
    };
  }, []);

  // Helper for safe state updates
  const safeSetState = (fn: () => void) => { 
    if (isMountedRef.current) fn(); 
  };

  // Hook RunPod simplifié avec callbacks
  const {
    jobId,
    status,
    isPolling,
    error: jobError,
    startJob,
    reset: resetJob,
    isCompleted,
    isFailed
  } = useRunPodJob({
    forceReset, // Pass reset trigger
    onStatusUpdate: useCallback((status: JobStatusResponse) => {
      console.log("📊 Job status update:", {
        jobId: status.job_id,
        status: status.status,
        hasOutput: !!status.output,
        hasResultUrl: !!status.result_url,
        resultUrl: status.result_url
      });
    }, []),

    onComplete: useCallback((result: JobStatusResponse) => {
      console.log("🎯 onComplete callback called with:", {
        jobId: result.job_id,
        resultUrl: result.result_url,
        hasOutput: !!result.output,
        mounted: isMountedRef.current
      });
      
      // 🔥 FORCE UPDATE even if component seems unmounted
      console.log("🔄 FORCE Setting results regardless of mount status...");
      try {
        setResults(result);
        setMode("results");
        setLikedItems(new Set());
        console.log("✅ FORCE Mode switched to results");
        
        // Try to trigger a re-render
        setForceReset(prev => prev + 1);
        
      } catch (error) {
        console.error("❌ Error in onComplete:", error);
      }
    }, []),

    onError: useCallback((error: string) => {
      if (!isMountedRef.current) return;
      if (import.meta.env.DEV) console.error("❌ Job error:", error);
      toast.error(`Erreur RunPod: ${error}`);
      setMode("ready"); // Retour au mode ready pour retry
    }, [])
  });

  // 🚫 DISABLED: Effet de restauration pour éviter les conflits
  // useEffect(() => {
  //   console.log('🔍 Effet de restauration:', {
  //     jobId,
  //     status: status?.status,
  //     resultUrl: status?.result_url,
  //     currentMode: mode,
  //     isStartingJob
  //   });
  //   
  //   // Ne pas restaurer si on est en train de démarrer un nouveau job
  //   if (isStartingJob) {
  //     console.log('⏸️ Skip restauration - nouveau job en cours');
  //     return;
  //   }
  //   
  //   if (jobId && status) {
  //     if (status.status === 'COMPLETED' && status.result_url) {
  //       console.log('🔄 Job restauré en mode résultats - Changement de mode...');
  //       setResults(status);
  //       setMode('results');
  //       setLikedItems(new Set()); // Reset des likes
  //       console.log('✅ Mode changé vers results');
  //     } else if (['IN_QUEUE', 'IN_PROGRESS'].includes(status.status)) {
  //       console.log('🔄 Job restauré en mode traitement');
  //       setMode('processing');
  //     }
  //   }
  // }, [jobId, status, isStartingJob]);

  // Fix: Guarded redirect to prevent update loops
  const hasRedirectedRef = useRef(false);
  
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!productConfigs?.length) {
      hasRedirectedRef.current = true;
      toast.error("Aucun produit sélectionné. Retour à la sélection.");
      navigate("/", { replace: true });
      return;
    }
    // Don't call setMode('ready') here - default is already 'ready'
    
    if (import.meta.env.DEV) {
      console.log('VirtualFitting - Données reçues:', {
        productConfigs: productConfigs?.length || 0,
        currentBodyImage: currentBodyImage ? 'Image présente' : 'Pas d\'image',
        currentMaskImage: currentMaskImage ? 'Mask présent' : 'Pas de mask',
        avatarS3Urls
      });
    }
  }, [productConfigs, navigate]);

  // Helper to cancel running job
  const cancelIfRunning = async () => {
    if (!jobId) return;
    try {
      await resetJob();
      if (import.meta.env.DEV) console.log("🛑 Job tracking stopped for:", jobId);
    } catch (error) {
      if (import.meta.env.DEV) console.error("Cancel job failed:", error);
    }
  };

  const handleBack = async () => {
    if (mode === "processing" && jobId) {
      const confirmLeave = window.confirm("Un traitement est en cours. Voulez-vous l'annuler et revenir ?");
      if (!confirmLeave) return;
      await cancelIfRunning();
    }
    navigate("/", { state: { keepSelection: true, productConfigs }});
  };

  const startRunPodJob = async () => {
    if (!productConfigs?.length) return toast.error("Aucun produit sélectionné pour l'essayage");
    if (!isAuthenticated) return toast.error("Vous devez être connecté pour lancer un traitement");

    // Declare requestData in outer scope for debugging
    let requestData: any = null;

    try {
      setIsStartingJob(true);
      
      // 🧹 IMPORTANT: Reset state before starting new job
      console.log("🔄 Démarrage nouveau job - Reset de l'état...");
      setResults(null);
      setMode("ready");
      
      // Clear existing job data from localStorage and state
      resetJob();

      if (import.meta.env.DEV) console.log("ProductConfigs reçus:", productConfigs);

      // ✅ Prefer URLs over base64 (avoid CORS/memory issues)
      const cloth_image_urls: string[] = productConfigs
        .map(p => p.apiImage || p.displayImage)
        .filter(Boolean);

      if (!cloth_image_urls.length) throw new Error("Aucune image de produit valide trouvée");

      requestData = {
        cloth_image_urls,
        steps: 50,
        guidance_scale: 2.5,
      };

      if (avatarS3Urls?.person_s3_key) {
        requestData.person_s3_key = avatarS3Urls.person_s3_key;
        if (avatarS3Urls.mask_s3_key) requestData.mask_s3_key = avatarS3Urls.mask_s3_key;
        if (import.meta.env.DEV) console.log("✅ Utilisation des clés S3:", avatarS3Urls);
      } else if (currentBodyImage) {
        requestData.person_image_data = currentBodyImage;
        if (currentMaskImage) requestData.mask_image_data = currentMaskImage;
        if (import.meta.env.DEV) console.log("✅ Utilisation image directe");
      } else {
        throw new Error("Aucune donnée avatar disponible pour l'essayage");
      }

      if (import.meta.env.DEV) console.log("📤 Données finales:", requestData);

      await startJob(requestData);
      
      // 🔁 Only now switch to "processing" (after successful API response)
      setMode("processing");
      toast.success(`Traitement démarré pour ${cloth_image_urls.length} vêtement(s)`);
    } catch (error: any) {
      // 🔍 Debug 422 validation errors in detail
      if (error?.response?.status === 422) {
        console.groupCollapsed("startRunPodJob 422 payload + error");
        console.log("payload:", requestData);
        console.log("server error:", error?.response?.data);
        console.groupEnd();
      }
      toast.error(humanizeApiError(error)); // ⬅️ use safe formatter
      setMode("ready");
    } finally {
      setIsStartingJob(false);
    }
  };

  const resetRunPodJob = async () => {
    await cancelIfRunning();
    setResults(null);
    setMode("ready");
    setLikedItems(new Set());
    if (import.meta.env.DEV) console.log("🔄 RunPod job reset completed");
  };

  // Fix: Use stable keys for likes
  const handleLike = (resultKey: string) => {
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(resultKey)) {
        newSet.delete(resultKey);
      } else {
        newSet.add(resultKey);
      }
      return newSet;
    });
  };

  // Fix: Handle cross-origin downloads properly
  const handleDownload = async (imageUrl: string, productName: string) => {
    try {
      const res = await fetch(imageUrl);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `essayage-${productName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
    } catch (error) {
      if (import.meta.env.DEV) console.error('Download failed:', error);
      toast.error("Le téléchargement a échoué");
    }
  };

  // Fix: Proper share with toast feedback
  const handleShare = async (imageUrl: string) => {
    try {
      if (navigator.share) {
        await navigator.share({ 
          title: 'Mon essayage virtuel', 
          url: imageUrl 
        });
      } else {
        await navigator.clipboard.writeText(imageUrl);
        toast.success('URL copiée dans le presse-papiers');
      }
    } catch (error) {
      if (import.meta.env.DEV) console.error('Share failed:', error);
      toast.error('Le partage a échoué');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between gap-4">
            <Button
              variant="ghost"
              onClick={handleBack}
              className="flex items-center gap-2"
            >
              <ArrowLeft className="w-4 h-4" />
              Retour
            </Button>
            
            <div>
              <h1 className="text-2xl font-light tracking-wider text-foreground">
                démo
              </h1>
              <p className="text-text-subtle text-sm mt-1 font-light">
                Essayage Virtuel
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Mode Ready - Affichage des produits sélectionnés */}
        {mode === 'ready' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
                Essayage virtuel avec Runpod
              </h2>
              <p className="text-text-subtle font-light max-w-lg mx-auto">
                Vous allez essayer virtuellement les {productConfigs?.length || 0} vêtement{(productConfigs?.length || 0) > 1 ? 's' : ''} sélectionné{(productConfigs?.length || 0) > 1 ? 's' : ''}
              </p>
            </div>

            {/* Affichage des produits sélectionnés */}
            {productConfigs && productConfigs.length > 0 && (
              <div className="space-y-6">
                <h3 className="text-lg font-medium text-foreground text-center">
                  Vêtements à essayer ({productConfigs.length})
                </h3>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                  {productConfigs.map((product, index) => (
                    <div key={product.id} className="bg-card rounded-lg overflow-hidden">
                      <div className="aspect-[3/4] bg-surface-elevated overflow-hidden">
                        <img
                          src={product.displayImage}
                          alt={product.name}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="p-3">
                        <h4 className="font-medium text-foreground text-sm mb-1 line-clamp-2">
                          {product.name}
                        </h4>
                        <p className="text-xs text-text-subtle line-clamp-1">
                          {product.brand}
                        </p>
                        <p className="text-sm font-medium text-foreground mt-1">
                          {product.price}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Bouton pour lancer l'inférence */}
                <div className="bg-card rounded-lg p-8 text-center">
                  <div className="mb-4">
                    <h3 className="text-lg font-medium text-foreground mb-2">
                      Prêt pour l'essayage virtuel ?
                    </h3>
                    <p className="text-text-subtle">
                      L'IA va créer vos essayages en utilisant votre avatar et les vêtements sélectionnés.
                    </p>
                    <p className="text-xs text-text-subtle mt-2">
                      Temps estimé: {Math.ceil(((productConfigs?.length || 0) * 30) / 60)} minute{Math.ceil(((productConfigs?.length || 0) * 30) / 60) > 1 ? 's' : ''}
                    </p>
                  </div>
                  
                  <Button
                    onClick={startRunPodJob}
                    disabled={isStartingJob || !isAuthenticated}
                    className="px-8 py-3 text-lg"
                    size="lg"
                  >
                    {isStartingJob ? 'Démarrage...' : 'Commencer l\'essayage virtuel'}
                  </Button>
                  
                  {!isAuthenticated && (
                    <p className="text-xs text-red-500 mt-2">
                      Vous devez être connecté pour lancer l'essayage virtuel
                    </p>
                  )}
                </div>
              </div>
            )}

            {/* Message si pas de produits */}
            {(!productConfigs || productConfigs.length === 0) && (
              <div className="bg-card rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium text-foreground mb-2">
                  Aucun produit sélectionné
                </h3>
                <p className="text-text-subtle mb-4">
                  Vous devez d'abord sélectionner des produits sur la page d'accueil.
                </p>
                <Button onClick={() => navigate('/')}>
                  Retourner à la sélection
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Mode Processing - Suivi du progress */}
        {mode === 'processing' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
                Traitement en cours...
              </h2>
              <p className="text-text-subtle font-light max-w-lg mx-auto">
                Votre essayage virtuel est en cours de traitement. Cela peut prendre quelques minutes.
              </p>
            </div>

            {/* Progress tracking simplifié */}
            <div className="max-w-2xl mx-auto">
              {status && (
                <div className="bg-card rounded-lg p-6">
                  <div className="text-center space-y-4">
                    <div className="inline-flex items-center space-x-3">
                      <div className="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
                      <span className="font-medium text-foreground">
                        {status.status === 'IN_QUEUE' && 'En attente...'}
                        {status.status === 'IN_PROGRESS' && 'Traitement en cours...'}
                        {status.status === 'COMPLETED' && 'Terminé !'}
                        {status.status === 'FAILED' && 'Échec'}
                      </span>
                    </div>
                    
                    <div className="flex items-center justify-center space-x-6 text-xs text-text-subtle">
                      <span>
                        Polling: {isPolling ? '🔄 Actif' : '⏸️ Inactif'}
                      </span>
                      <span className="font-mono bg-surface-elevated px-2 py-1 rounded">
                        {status.status}
                      </span>
                      {jobId && (
                        <span>ID: {jobId.slice(0, 8)}...</span>
                      )}
                    </div>
                  </div>

                  {jobError && (
                    <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded text-sm text-red-600 text-center">
                      ❌ {jobError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-center">
              <Button
                variant="outline"
                onClick={resetRunPodJob}
              >
                Annuler et recommencer
              </Button>
            </div>
          </div>
        )}

        {/* Mode Results - Affichage des résultats */}
        {mode === 'results' && (
          <div className="space-y-8">
            <div className="mb-12 text-center">
              <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
                Vos essayages virtuels
              </h2>
              <p className="text-text-subtle font-light max-w-lg mx-auto">
                Voici vos résultats d'essayage virtuel. Vous pouvez aimer, télécharger ou partager vos looks favoris.
              </p>
              {results && (
                <p className="text-sm text-text-subtle mt-2">
                  Résultat disponible
                </p>
              )}
            </div>

            {/* Affichage des résultats - centré */}
            <div className="flex justify-center mb-12">
              <div className="w-full max-w-sm">
              {results?.result_url && (
                <div className="bg-card rounded-lg overflow-hidden">
                  <div className="aspect-[3/4] bg-surface-elevated overflow-hidden">
                    <img
                      src={results.result_url}
                      alt="Essayage virtuel"
                      className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                      onClick={() => setFullscreenImage(results.result_url!)}
                    />
                  </div>

                  <div className="p-4 pb-2">
                    <h3 className="font-medium text-foreground text-base mb-3">
                      Résultat RunPod
                    </h3>
                    
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleLike('runpod-result')}
                        className={cn(
                          "p-2",
                          likedItems.has('runpod-result') && "text-red-500"
                        )}
                        title={likedItems.has('runpod-result') ? "Retirer des favoris" : "Ajouter aux favoris"}
                      >
                        <Heart 
                          className={cn(
                            "w-4 h-4",
                            likedItems.has('runpod-result') && "fill-current"
                          )} 
                        />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleDownload(results.result_url!, 'runpod-result')}
                        className="p-2"
                        title="Télécharger l'image"
                      >
                        <Download className="w-4 h-4" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleShare(results.result_url!)}
                        className="p-2"
                        title="Partager l'image"
                      >
                        <Share2 className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              )}
              </div>
            </div>

            {/* Boutons d'actions */}
            <div className="bg-card rounded-lg p-6 text-center mb-8">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Résumé de votre session
              </h3>
              <p className="text-text-subtle mb-4">
                Vous avez terminé votre essayage virtuel avec RunPod
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={resetRunPodJob}
                >
                  Nouvel essayage
                </Button>
                <Button
                  onClick={() => {
                    const likedCount = likedItems.size;
                    alert(`Vous avez aimé ${likedCount} vêtement${likedCount > 1 ? 's' : ''} !`);
                  }}
                >
                  Voir mes favoris ({likedItems.size})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Session info */}
        {jobId && (
          <div className="text-center">
            <p className="text-xs text-text-subtle">
              Job ID: {jobId.slice(0, 8)}...
            </p>
          </div>
        )}
      </main>
      {/* Auth CTA */}
      {!isAuthenticated && (
        <div className="px-6 pb-8 text-center text-sm text-muted-foreground">
          Vous avez un compte ?
          <Link to="/login" className="ml-1 underline">Se connecter</Link>
          {' '}•{' '}
          <Link to="/register" className="underline">Créer un compte</Link>
        </div>
      )}

      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="max-w-4xl max-h-full p-4" onClick={(e) => e.stopPropagation()}>
            <img
              src={fullscreenImage}
              alt="Image plein écran"
              className="max-w-full max-h-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
