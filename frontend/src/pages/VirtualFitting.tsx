import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Download, Share2, Loader2, Mail } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/store/useAuthStore";
import { toast } from "sonner";
import { sendTryOnSummary, type SummaryItem } from "@/services/tryOnService";

export default function VirtualFitting() {
  const { isAuthenticated, user } = useAuthStore();
  const [likedItems, setLikedItems] = useState<Set<string>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const [results, setResults] = useState<any | null>(null);
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [emailInput, setEmailInput] = useState("");
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [selectedResult, setSelectedResult] = useState<any | null>(null);
  
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
      console.log('🔽 Téléchargement:', { imageUrl, filename });
      
      if (!imageUrl) {
        toast.error('URL d\'image invalide');
        return;
      }

      // Method 1: Try fetch with blob for direct download
      try {
        const response = await fetch(imageUrl, {
          mode: 'cors',
          headers: {
            'Accept': 'image/*',
          }
        });
        
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const blob = await response.blob();
        const url = URL.createObjectURL(blob);
        
        // Force download by creating a link with download attribute
        const a = document.createElement('a');
        a.href = url;
        a.download = `${filename}.jpg`;
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
        
        toast.success('Image téléchargée !');
        return;
        
      } catch (fetchError) {
        console.warn('⚠️ Fetch failed, using canvas method:', fetchError);
      }

      // Method 2: Use canvas to convert and download (works for most images)
      try {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        
        await new Promise((resolve, reject) => {
          img.onload = resolve;
          img.onerror = reject;
          img.src = imageUrl;
        });

        // Create canvas and draw image
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx?.drawImage(img, 0, 0);

        // Convert to blob and download
        canvas.toBlob((blob) => {
          if (blob) {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
            a.download = `${filename}.jpg`;
            a.style.display = 'none';
      document.body.appendChild(a);
      a.click();
            document.body.removeChild(a);
      URL.revokeObjectURL(url);
            toast.success('Image téléchargée !');
          } else {
            throw new Error('Canvas to blob conversion failed');
          }
        }, 'image/jpeg', 0.95);

      } catch (canvasError) {
        console.warn('⚠️ Canvas method failed:', canvasError);
        
        // Method 3: Direct link as last resort (will open in new tab)
        const a = document.createElement('a');
        a.href = imageUrl;
        a.download = `${filename}.jpg`;
        a.target = '_blank';
        a.style.display = 'none';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        
        toast.info('Image ouverte dans un nouvel onglet. Faites clic droit > Enregistrer l\'image.');
      }
      
    } catch (error) {
      console.error('❌ Download error:', error);
      toast.error('Erreur lors du téléchargement. Essayez de faire un clic droit > Enregistrer l\'image.');
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

  const handleSendEmail = async () => {
    if (!emailInput || !emailInput.includes('@')) {
      toast.error('Veuillez saisir une adresse email valide');
      return;
    }

    setIsSendingEmail(true);
    
    try {
      // Préparer les données selon le format backend
      const items: SummaryItem[] = [];
      
      // Single result (legacy)
      if (results?.result_url && !results?.results) {
        items.push({
          product_id: 1,
          name: "Résultat d'essayage",
          result_image_url: results.result_url
        });
      }
      
      // Multiple results (parallel try-on)
      if (results?.results && Array.isArray(results.results)) {
        results.results.forEach((result: any) => {
          if (result.status === 'success' && result.result_image) {
            items.push({
              product_id: result.product_id,
              name: result.product_name || `Produit ${result.product_id}`,
              result_image_url: result.result_image,
              // Essayer de récupérer les infos du produit depuis productConfigs
              price: productConfigs?.find(p => parseInt(p.id) === result.product_id)?.price,
              brand: productConfigs?.find(p => parseInt(p.id) === result.product_id)?.brand,
              image_url: productConfigs?.find(p => parseInt(p.id) === result.product_id)?.displayImage
            });
          }
        });
      }

      if (items.length === 0) {
        toast.error('Aucun résultat valide à envoyer');
        return;
      }

      console.log('📧 Envoi email avec items:', items);

      await sendTryOnSummary({
        email: emailInput,
        session_id: sessionId,
        items: items
      });

      toast.success('Email envoyé avec succès !');
      setShowEmailModal(false);
      setEmailInput("");
      
    } catch (error) {
      console.error('❌ Erreur envoi email:', error);
      toast.error('Erreur lors de l\'envoi de l\'email');
    } finally {
      setIsSendingEmail(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          <div className="flex items-center justify-between">
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
            
            {/* Bouton Email */}
            {results && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (user?.email) {
                    setEmailInput(user.email);
                  }
                  setShowEmailModal(true);
                }}
                className="flex items-center gap-2"
              >
                <Mail className="w-4 h-4" />
                Envoyer par email
              </Button>
            )}
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
                          <Button 
                            variant="ghost" 
                            size="sm" 
                            onClick={() => {
                              console.log('🔽 Download single result:', results.result_url);
                              if (results.result_url) {
                                handleDownload(results.result_url, 'result');
                              } else {
                                toast.error('Aucune image à télécharger');
                              }
                            }} 
                            className="p-2"
                          >
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
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 max-w-7xl mx-auto">
                  {results.results.map((result: any, index: number) => {
                    // Récupérer l'image du vêtement original depuis productConfigs
                    const originalProduct = productConfigs?.find(p => parseInt(p.id) === result.product_id);
                    const originalImage = originalProduct?.displayImage || originalProduct?.apiImage;
                    
                    return (
                      <div key={result.product_id || index} className="bg-card rounded-lg overflow-hidden">
                        <div className="aspect-[3/4] bg-surface-elevated overflow-hidden relative">
                          {result.status === 'success' && result.result_image ? (
                            <>
                              {/* Image de résultat principale */}
                              <img
                                src={result.result_image}
                                alt={`Essayage ${result.product_name || `produit ${result.product_id}`}`}
                                className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                                onClick={() => setSelectedResult({
                                  ...result,
                                  originalProduct: originalProduct,
                                  originalImage: originalImage
                                })}
                              />
                              
                              {/* Overlay du vêtement original en bas à droite */}
                              {originalImage && (
                                <div className="absolute bottom-3 right-3 w-24 h-32 rounded-lg overflow-hidden shadow-lg border-2 border-white bg-white">
                                  <img
                                    src={originalImage}
                                    alt={`Vêtement original - ${result.product_name}`}
                                    className="w-full h-full object-cover"
                                  />
                                </div>
                              )}
                            </>
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
                              onClick={() => {
                                console.log('🔽 Download product result:', { 
                                  productId: result.product_id, 
                                  imageUrl: result.result_image,
                                  status: result.status 
                                });
                                if (result.result_image && result.status === 'success') {
                                  handleDownload(result.result_image, `product-${result.product_id}`);
                                } else {
                                  toast.error('Image non disponible pour le téléchargement');
                                }
                              }}
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
                    );
                  })}
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

      {/* Detail Modal */}
      {selectedResult && (
        <div 
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4" 
          onClick={() => setSelectedResult(null)}
        >
          <div 
            className="bg-white rounded-xl max-w-6xl w-full h-[90vh] overflow-hidden relative" 
            onClick={(e) => e.stopPropagation()}
          >
            
            {/* Close button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSelectedResult(null)}
              className="absolute top-4 right-4 z-10 text-gray-400 hover:text-gray-600"
            >
              ✕
            </Button>

            {/* Content Container */}
            <div className="h-full flex flex-col px-8 pb-8">
              
              {/* Main Content Area */}
              <div className="flex gap-8 h-full">
                
                {/* Left Column - Result Image */}
                <div className="flex-1 flex flex-col">
                  {/* Title Area - 8% of container */}
                  <div className="h-[8%] flex items-center justify-center">
                    <h3 className="text-lg font-semibold text-gray-900">Votre Essayage</h3>
                  </div>
                  
                  {/* Image Area - 92% of container */}
                  <div className="h-[92%] bg-white overflow-hidden">
                    <img
                      src={selectedResult.result_image}
                      alt={`Résultat essayage - ${selectedResult.product_name}`}
                      className="w-full h-full object-contain"
                    />
                  </div>
                </div>

                {/* Right Column - Original Product */}
                <div className="flex-1 flex flex-col">
                  {/* Title Area - 8% of container */}
                  <div className="h-[8%] flex items-center justify-center">
                    <h3 className="text-lg font-semibold text-gray-900">Vêtement Original</h3>
                  </div>
                  
                  {/* Image Area - 70% of container */}
                  <div className="h-[70%] bg-white overflow-hidden">
                    {selectedResult.originalImage ? (
                      <img
                        src={selectedResult.originalImage}
                        alt={`Vêtement original - ${selectedResult.product_name}`}
                        className="w-full h-full object-contain"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-gray-500">
                        Image non disponible
                      </div>
                    )}
                  </div>
                  
                  {/* Product Info Area - 22% of container */}
                  <div className="h-[22%] flex flex-col justify-center text-center px-4">
                    <h4 className="text-xl font-bold text-gray-900 mb-2">
                      {selectedResult.product_name || `Produit ${selectedResult.product_id}`}
                    </h4>
                    {selectedResult.originalProduct?.brand && (
                      <p className="text-sm text-gray-600 font-medium mb-1">
                        {selectedResult.originalProduct.brand}
                      </p>
                    )}
                    {selectedResult.originalProduct?.price && (
                      <p className="text-lg font-bold text-gray-600">
                        {selectedResult.originalProduct.price}
                      </p>
                    )}
                  </div>
                </div>
                
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Email Modal */}
      {showEmailModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" onClick={() => setShowEmailModal(false)}>
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-medium text-gray-900 mb-4">
              Envoyer les résultats par email
            </h3>
            <p className="text-sm text-gray-600 mb-4">
              Recevez vos essayages virtuels directement dans votre boîte mail.
            </p>
            
            <div className="mb-4">
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-2">
                Adresse email
              </label>
              <input
                type="email"
                id="email"
                value={emailInput}
                onChange={(e) => setEmailInput(e.target.value)}
                placeholder="votre@email.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                autoFocus
              />
            </div>
            
            <div className="flex gap-3 justify-end">
              <Button
                variant="ghost"
                onClick={() => setShowEmailModal(false)}
                disabled={isSendingEmail}
              >
                Annuler
              </Button>
              <Button
                onClick={handleSendEmail}
                disabled={isSendingEmail || !emailInput}
                className="flex items-center gap-2"
              >
                {isSendingEmail ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Envoi...
                  </>
                ) : (
                  <>
                    <Mail className="w-4 h-4" />
                    Envoyer
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
