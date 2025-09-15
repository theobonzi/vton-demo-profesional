import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Heart, Download, Share2 } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function VirtualFitting() {
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const hasLoggedRef = useRef(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProducts, productConfigs, personImage, results, sessionId } = location.state || {};

  useEffect(() => {
    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true;
    }
  }, []);

  const handleBack = () => {
    navigate("/");
  };

  const handleLike = (productId: number) => {
    setLikedItems(prev => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleDownload = (imageUrl: string, productName: string) => {
    const link = document.createElement('a');
    link.href = imageUrl;
    link.download = `essayage-${productName.replace(/\s+/g, '-').toLowerCase()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (imageUrl: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Mon essayage virtuel',
          text: 'Regardez mon essayage virtuel !',
          url: imageUrl
        });
      } catch (error) {
        console.log('Erreur lors du partage:', error);
      }
    } else {
      navigator.clipboard.writeText(imageUrl);
      alert('URL copiée dans le presse-papiers !');
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
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
            Vos essayages virtuels
          </h2>
          <p className="text-text-subtle font-light max-w-lg mx-auto">
            Voici vos résultats d'essayage virtuel. Vous pouvez aimer, télécharger ou partager vos looks favoris.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 mb-12">
          {results?.map((result: any, index: number) => (
            <div key={result.product_id || index} className="bg-card rounded-lg overflow-hidden">
              <div className="aspect-[3/4] bg-surface-elevated overflow-hidden">
                <img
                  src={result.result_image || personImage}
                  alt={`Essayage ${result.product_name}`}
                  className="w-full h-full object-cover cursor-pointer transition-transform duration-300 hover:scale-105"
                  onClick={() => setFullscreenImage(result.result_image || personImage)}
                />
              </div>

              <div className="p-4 pb-2">
                <h3 className="font-medium text-foreground text-base mb-3 line-clamp-2">
                  {result.product_name}
                </h3>
                
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleLike(result.product_id)}
                    className={cn(
                      "p-2",
                      likedItems.has(result.product_id) && "text-red-500"
                    )}
                    title={likedItems.has(result.product_id) ? "Retirer des favoris" : "Ajouter aux favoris"}
                  >
                    <Heart 
                      className={cn(
                        "w-4 h-4",
                        likedItems.has(result.product_id) && "fill-current"
                      )} 
                    />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDownload(result.result_image || personImage, result.product_name)}
                    className="p-2"
                    title="Télécharger l'image"
                  >
                    <Download className="w-4 h-4" />
                  </Button>

                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleShare(result.result_image || personImage)}
                    className="p-2"
                    title="Partager l'image"
                  >
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="bg-card rounded-lg p-6 text-center mb-8">
          <h3 className="text-lg font-medium text-foreground mb-2">
            Résumé de votre session
          </h3>
          <p className="text-text-subtle mb-4">
            Vous avez essayé {results?.length || 0} vêtement{results?.length > 1 ? 's' : ''} virtuellement
          </p>
          <div className="flex justify-center gap-4">
            <Button
              variant="outline"
              onClick={handleBack}
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

        {sessionId && (
          <div className="text-center">
            <p className="text-xs text-text-subtle">
              Session: {sessionId}
            </p>
          </div>
        )}
      </main>

      {fullscreenImage && (
        <div
          className="fixed inset-0 bg-black bg-opacity-90 flex items-center justify-center z-50"
          onClick={() => setFullscreenImage(null)}
        >
          <div className="max-w-4xl max-h-full p-4">
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
