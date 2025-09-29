import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Download, Share2, Loader2 } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";

export default function VirtualFitting() {
  const isAuthenticated = useAuthStore(s => s.isAuthenticated);
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  
  // Location state
  const { productConfigs, currentBodyImage, avatarS3Urls, results: incomingResults, sessionId } = (location.state || {}) as {
    productConfigs?: Array<any>;
    currentBodyImage?: string;
    avatarS3Urls?: { person_s3_key?: string; mask_s3_key?: string };
    results?: Array<any>;
    sessionId?: string;
  };

  // Handle incoming results from LoadingScreen or redirect if no results
  useEffect(() => {
    if (incomingResults && incomingResults.length > 0) {
      console.log('🎯 Résultats reçus du LoadingScreen:', {
        count: incomingResults.length,
        sessionId,
        results: incomingResults
      });

      // Check if all results failed
      const allFailed = incomingResults.every((result: any) => result.status === 'failed');
      
      if (allFailed) {
        console.log('❌ Tous les essayages ont échoué, retour à la sélection de produits');
        toast.error("L'essayage virtuel a échoué. Veuillez réessayer.");
        navigate(-1); // Go back to previous page
        return;
      }

      // Transform results to expected format
      const transformedResults = {
        job_id: sessionId || 'parallel_tryon',
        status: 'COMPLETED',
        output: { images: incomingResults },
        result_url: incomingResults[0]?.result_image,
        results: incomingResults
      };
      
      setResults(transformedResults);
      return;
    }
    
    // If no incoming results but we have products, redirect to LoadingScreen for proper processing
    if (productConfigs && productConfigs.length > 0 && !incomingResults) {
      console.log('🔄 No results from LoadingScreen, redirecting for proper parallel processing');

      // Extract person image from available sources
      let personImage = currentBodyImage;
      if (!personImage && avatarS3Urls?.person_s3_key) {
        personImage = avatarS3Urls.person_s3_key;
      }
      
      if (personImage) {
        const selectedProducts = productConfigs.map(p => p.id);
        navigate("/loading", {
          state: {
            selectedProducts,
            productConfigs,
            personImage,
            useExistingAvatar: true
          }
        });
        return;
      }
    }
  }, [incomingResults, sessionId, productConfigs, currentBodyImage, avatarS3Urls, navigate]);

  // Redirect if no products
  const hasRedirectedRef = useRef(false);
  useEffect(() => {
    if (hasRedirectedRef.current) return;
    if (!productConfigs?.length && !results) {
      hasRedirectedRef.current = true;
      toast.error("Aucun produit sélectionné. Retour à la sélection.");
      navigate("/", { replace: true });
    }
  }, [productConfigs, results, navigate]);

  const handleLike = (itemId: string) => {
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(itemId)) {
        newSet.delete(itemId);
      } else {
        newSet.add(itemId);
      }
      return newSet;
    });
  };

  const handleDownload = async (imageUrl: string, filename: string) => {
    try {
      const response = await fetch(imageUrl);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${filename}.jpg`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success('Image téléchargée !');
    } catch (error) {
      toast.error('Erreur lors du téléchargement');
    }
  };

  const handleShare = async (imageUrl: string) => {
    if (navigator.share) {
    try {
        await navigator.share({ 
          title: 'Mon essayage virtuel', 
          url: imageUrl 
        });
      } catch (error) {
        navigator.clipboard.writeText(imageUrl);
        toast.success('URL copiée dans le presse-papiers !');
      }
    } else {
      navigator.clipboard.writeText(imageUrl);
      toast.success('URL copiée dans le presse-papiers !');
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate("/")}
              className="p-2"
            >
              <ArrowLeft className="w-4 h-4" />
            </Button>
            <div>
              <h1 className="text-2xl font-light tracking-wider text-foreground">
                démo
              </h1>
              <p className="text-text-subtle text-sm font-light">
                Résultats d'essayage virtuel
              </p>
            </div>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Redirection en cours */}
        {productConfigs && productConfigs.length > 0 && !results && (
              <div className="bg-card rounded-lg p-8 text-center">
                <h3 className="text-lg font-medium text-foreground mb-2">
              Redirection en cours...
                </h3>
                <p className="text-text-subtle mb-4">
              Redirection vers le système de traitement pour vos {productConfigs.length} vêtement(s).
            </p>
            <div className="flex justify-center">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          </div>
        )}

        {/* Résultats */}
        {results && (
          <div className="space-y-12">
            <div className="text-center">
              <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
                Vos essayages virtuels
              </h2>
              <p className="text-text-subtle font-light max-w-lg mx-auto">
                Voici vos résultats d'essayage virtuel. Vous pouvez aimer, télécharger ou partager vos looks favoris.
              </p>
                <p className="text-sm text-text-subtle mt-2">
                {results.results && Array.isArray(results.results) 
                  ? `${results.results.length} résultat(s) d'essayage virtuel`
                  : "Résultat d'essayage virtuel disponible"
                }
                </p>
            </div>

            {/* Affichage des résultats */}
            <div className="mb-12">
              {/* Single result (legacy) */}
              {results?.result_url && !results?.results && (
                <div className="flex justify-center">
              <div className="w-full max-w-sm">
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
                          Résultat d'essayage
                    </h3>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="sm" onClick={() => handleLike('single-result')} className="p-2">
                            <Heart className={cn("w-4 h-4", likedItems.has('single-result') && "fill-current text-red-500")} />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleDownload(results.result_url!, 'result')} className="p-2">
                            <Download className="w-4 h-4" />
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => handleShare(results.result_url!)} className="p-2">
                            <Share2 className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* Multiple results (parallel try-on) */}
              {results?.results && Array.isArray(results.results) && results.results.length > 0 && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
                  {results.results.map((result: any, index: number) => (
                    <div key={result.product_id || index} className="bg-card rounded-lg overflow-hidden">
                      <div className="aspect-[3/4] bg-surface-elevated overflow-hidden">
                        {result.status === 'success' && result.result_image ? (
                          <img
                            src={result.result_image}
                            alt={`Essayage ${result.product_name || `produit ${result.product_id}`}`}
                            className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                            onClick={() => setFullscreenImage(result.result_image)}
                          />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center bg-gray-100">
                            <div className="text-center p-4">
                              <div className="text-4xl mb-2">❌</div>
                              <p className="text-sm text-gray-600">
                                Essayage échoué
                              </p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="p-4 pb-2">
                        <h3 className="font-medium text-foreground text-base mb-1">
                          {result.product_name || `Produit ${result.product_id}`}
                        </h3>
                        {result.status === 'failed' && (
                          <p className="text-xs text-red-500 mb-3">
                            ❌ Échec de l'essayage
                          </p>
                        )}
                        {result.status === 'success' && result.result_image && (
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleLike(`product-${result.product_id}`)}
                              className="p-2"
                            >
                              <Heart 
                                className={cn(
                                  "w-4 h-4",
                                  likedItems.has(`product-${result.product_id}`) && "fill-current text-red-500"
                                )} 
                              />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDownload(result.result_image, `product-${result.product_id}`)}
                              className="p-2"
                            >
                              <Download className="w-4 h-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleShare(result.result_image)}
                              className="p-2"
                            >
                              <Share2 className="w-4 h-4" />
                            </Button>
                          </div>
                        )}
                  </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="bg-card rounded-lg p-6 text-center mb-8">
              <h3 className="text-lg font-medium text-foreground mb-2">
                Résumé de votre session
              </h3>
              <p className="text-text-subtle mb-4">
                {results?.results && Array.isArray(results.results)
                  ? `Vous avez terminé votre essayage virtuel pour ${results.results.length} vêtement(s)`
                  : "Vous avez terminé votre essayage virtuel"
                }
              </p>
              <div className="flex justify-center gap-4">
                <Button variant="outline" onClick={() => navigate("/")}>
                  Nouvel essayage
                </Button>
                <Button onClick={() => toast.success(`Vous avez aimé ${likedItems.size} vêtement(s) !`)}>
                  Voir mes favoris ({likedItems.size})
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Pas de données */}
        {!productConfigs?.length && !results && (
          <div className="bg-card rounded-lg p-8 text-center">
            <h3 className="text-lg font-medium text-foreground mb-2">
              Aucune donnée disponible
            </h3>
            <p className="text-text-subtle mb-4">
              Aucun produit ou résultat à afficher.
            </p>
            <Button onClick={() => navigate('/')}>
              Retourner à la sélection
            </Button>
          </div>
        )}
      </main>

      {/* Fullscreen Modal */}
      {fullscreenImage && (
        <div className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50" onClick={() => setFullscreenImage(null)}>
          <div className="relative max-w-4xl max-h-full p-4">
            <img
              src={fullscreenImage}
              alt="Essayage virtuel en plein écran"
              className="max-w-full max-h-full object-contain"
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setFullscreenImage(null)}
              className="absolute top-2 right-2 text-white hover:text-gray-300"
            >
              ✕
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
