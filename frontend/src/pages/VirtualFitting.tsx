import { useState, useEffect, useRef, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Download, Share2, X } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import inferenceService, { InferenceTaskStatusResponse, InferenceResultsResponse } from "@/services/inferenceService";
import useInferenceRealtime from "@/hooks/useInferenceRealtime";
import InferenceProgress from "@/components/InferenceProgress";

// Stable key generator for results
const getResultKey = (r: any, idx: number) =>
  r.id ?? r.product_id ?? r.result_signed_url ?? `r-${idx}`;

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
  
  // Fix: Proper typing for location state
  const { selectedProducts, productConfigs, avatarData, currentBodyImage, currentMaskImage, avatarS3Urls } = (location.state || {}) as {
    selectedProducts?: number[];
    productConfigs?: Array<any>;
    avatarData?: any;
    currentBodyImage?: string;
    currentMaskImage?: string;
    avatarS3Urls?: { person_s3_key?: string; mask_s3_key?: string };
  };

  // Nouveaux états pour l'inférence VTO
  const [isStartingInference, setIsStartingInference] = useState(false);
  const [currentTaskId, setCurrentTaskId] = useState<string | null>(null);
  const [inferenceResults, setInferenceResults] = useState<InferenceResultsResponse | null>(null);
  const [mode, setMode] = useState<'ready' | 'inference' | 'results'>('ready');

  // Fix: Protection against state updates after unmount
  const isMountedRef = useRef(true);
  useEffect(() => () => { isMountedRef.current = false; }, []);

  // Helper for safe state updates
  const safeSetState = (fn: () => void) => { 
    if (isMountedRef.current) fn(); 
  };

  // Fix: Stable callbacks to prevent realtime hook re-subscription loops
  const onStatusUpdate = useCallback((newStatus: any) => {
    if (import.meta.env.DEV) console.log("Status update:", newStatus);
  }, []);

  const onComplete = useCallback((resultsFromWS: InferenceResultsResponse) => {
    if (!isMountedRef.current) return;
    setInferenceResults(resultsFromWS);
    setMode("results");
    setLikedItems(new Set());
  }, []);

  const onError = useCallback((error: unknown) => {
    if (import.meta.env.DEV) console.error("Inference error:", error);
    toast.error(`Erreur d'inférence: ${String(error)}`);
  }, []);

  // Hook pour le suivi temps réel
  const { status, isConnected, error: realtimeError } = useInferenceRealtime({
    taskId: currentTaskId,
    onStatusUpdate,
    onComplete,
    onError,
  });

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
        selectedProducts,
        productConfigs,
        avatarData,
        currentBodyImage: currentBodyImage ? 'Image présente' : 'Pas d\'image',
        currentMaskImage: currentMaskImage ? 'Mask présent' : 'Pas de mask',
        avatarS3Urls
      });
    }
  }, [productConfigs, navigate]);

  // Helper to cancel running task
  const cancelIfRunning = async () => {
    if (!currentTaskId) return;
    try { 
      // await inferenceService.cancelTask(currentTaskId); // TODO: implement cancel API
    } catch (error) {
      if (import.meta.env.DEV) console.error("Cancel task failed:", error);
    }
  };

  const handleBack = async () => {
    if (mode === "inference" && currentTaskId) {
      const confirmLeave = window.confirm("Une inférence est en cours. Voulez-vous l'annuler et revenir ?");
      if (!confirmLeave) return;
      await cancelIfRunning();
    }
    navigate("/", { state: { keepSelection: true, selectedProducts, productConfigs }});
  };

  const startInference = async () => {
    if (!productConfigs?.length) return toast.error("Aucun produit sélectionné pour l'essayage");
    if (!isAuthenticated) return toast.error("Vous devez être connecté pour lancer une inférence");

    // Declare requestData in outer scope for debugging
    let requestData: any = null;

    try {
      setIsStartingInference(true);

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

      const response = await inferenceService.createInferenceTask(requestData);
      
      // 🔁 Only now switch to "inference" (after successful API response)
      setMode("inference");
      setCurrentTaskId(response.task_id);
      toast.success(`Inférence démarrée pour ${response.cloth_count} vêtement(s)`);
    } catch (error: any) {
      // 🔍 Debug 422 validation errors in detail
      if (error?.response?.status === 422) {
        console.groupCollapsed("createInferenceTask 422 payload + error");
        console.log("payload:", requestData);
        console.log("server error:", error?.response?.data);
        console.groupEnd();
      }
      toast.error(humanizeApiError(error)); // ⬅️ use safe formatter
      setMode("ready");
    } finally {
      setIsStartingInference(false);
    }
  };

  const resetInference = async () => {
    await cancelIfRunning();
    setCurrentTaskId(null);
    setInferenceResults(null);
    setMode("ready");
    setLikedItems(new Set());
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
                    onClick={startInference}
                    disabled={isStartingInference || !isAuthenticated}
                    className="px-8 py-3 text-lg"
                    size="lg"
                  >
                    {isStartingInference ? 'Démarrage...' : 'Commencer l\'essayage virtuel'}
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

        {/* Mode Inference - Suivi du progress */}
        {mode === 'inference' && (
          <div className="space-y-8">
            <div className="text-center">
              <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
                Traitement en cours...
              </h2>
              <p className="text-text-subtle font-light max-w-lg mx-auto">
                Votre essayage virtuel est en cours de traitement. Cela peut prendre quelques minutes.
              </p>
            </div>

            {/* Progress tracking */}
            <div className="max-w-2xl mx-auto">
              {status && (
                <div className="bg-card rounded-lg p-6">
                  <InferenceProgress status={status} />
                  
                  {/* Connexion status */}
                  <div className="mt-4 flex items-center justify-between text-xs text-text-subtle">
                    <span>
                      Connexion temps réel: {isConnected ? '✅ Connecté' : '⚠️ Déconnecté'}
                    </span>
                    {currentTaskId && (
                      <span>Task ID: {currentTaskId.slice(0, 8)}...</span>
                    )}
                  </div>

                  {realtimeError && (
                    <div className="mt-2 p-2 bg-red-50 border border-red-200 rounded text-xs text-red-600">
                      Erreur Realtime: {realtimeError}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="text-center">
              <Button
                variant="outline"
                onClick={resetInference}
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
              {inferenceResults && (
                <p className="text-sm text-text-subtle mt-2">
                  {inferenceResults.successful_results} succès • {inferenceResults.failed_results} échecs
                </p>
              )}
            </div>

            {/* Affichage des résultats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
              {inferenceResults?.results.map((result, index) => (
                <div key={`inference-${index}`} className="bg-card rounded-lg overflow-hidden">
                  <div className="aspect-[3/4] bg-surface-elevated overflow-hidden">
                    {result.status === 'success' && result.result_signed_url ? (
                      <img
                        src={result.result_signed_url}
                        alt={`Essayage virtuel ${index + 1}`}
                        className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                        onClick={() => setFullscreenImage(result.result_signed_url!)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-red-500">
                        <div className="text-center">
                          <X className="w-8 h-8 mx-auto mb-2" />
                          <p className="text-sm">Échec du traitement</p>
                          {result.error && (
                            <p className="text-xs mt-1">{result.error}</p>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="p-4 pb-2">
                    <h3 className="font-medium text-foreground text-base mb-3">
                      Vêtement {index + 1} {result.status === 'failed' ? '(Échec)' : ''}
                    </h3>
                    
                    {result.status === 'success' && (
                      <div className="flex gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleLike(`result-${index}`)}
                          className={cn(
                            "p-2",
                            likedItems.has(`result-${index}`) && "text-red-500"
                          )}
                          title={likedItems.has(`result-${index}`) ? "Retirer des favoris" : "Ajouter aux favoris"}
                        >
                          <Heart 
                            className={cn(
                              "w-4 h-4",
                              likedItems.has(`result-${index}`) && "fill-current"
                            )} 
                          />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDownload(result.result_signed_url!, `vetement-${index + 1}`)}
                          className="p-2"
                          title="Télécharger l'image"
                        >
                          <Download className="w-4 h-4" />
                        </Button>

                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleShare(result.result_signed_url!)}
                          className="p-2"
                          title="Partager l'image"
                        >
                          <Share2 className="w-4 h-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>

            {/* Boutons d'actions */}
            <div className="bg-card rounded-lg p-6 text-center mb-8">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Résumé de votre session
              </h3>
              <p className="text-text-subtle mb-4">
                Vous avez essayé {inferenceResults?.total_results || 0} vêtement{(inferenceResults?.total_results || 0) > 1 ? 's' : ''} virtuellement
              </p>
              <div className="flex justify-center gap-4">
                <Button
                  variant="outline"
                  onClick={resetInference}
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
        {currentTaskId && (
          <div className="text-center">
            <p className="text-xs text-text-subtle">
              Task ID: {currentTaskId.slice(0, 8)}...
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
