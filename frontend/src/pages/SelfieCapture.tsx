import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2 } from "lucide-react";
import { useNavigate, useLocation, Link } from "react-router-dom";
import { useAuthStore } from "@/store/useAuthStore";
import { useAvatarStore } from "@/store/useAvatarStore";
import { AvatarDisplay } from "@/components/avatar/AvatarDisplay";
import { AvatarCreationProgress } from "@/components/avatar/AvatarCreationProgress";
import { ImageCapture } from "@/components/capture/ImageCapture";
import { SelectedProductsSidebar } from "@/components/product/SelectedProductsSidebar";
import { toast } from "sonner";

// Fonction pour convertir une URL d'image en base64 via un canvas
const convertUrlToBase64 = (url: string): Promise<string> => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous'; // Tenter de gérer CORS
    
    img.onload = () => {
      try {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        
        if (!ctx) {
          reject(new Error('Impossible de créer le contexte canvas'));
          return;
        }
        
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        
        // Dessiner l'image sur le canvas
        ctx.drawImage(img, 0, 0);
        
        // Convertir en base64
        const base64 = canvas.toDataURL('image/jpeg', 0.9);
        resolve(base64);
      } catch (error) {
        reject(error);
      }
    };
    
    img.onerror = () => {
      reject(new Error('Impossible de charger l\'image depuis l\'URL'));
    };
    
    img.src = url;
  });
};

export default function SelfieCapture() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isUploadingForAvatar, setIsUploadingForAvatar] = useState(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProducts, productConfigs } = location.state || {};
  
  // Stores
  const { isAuthenticated, isLoading: authLoading } = useAuthStore();
  const { 
    hasAvatar, 
    avatarCheckData, 
    isChecking, 
    isCreating, 
    creationProgress, 
    creationStep,
    checkAvatar, 
    createNewAvatar, 
    waitForCreation 
  } = useAvatarStore();

  // Vérifier l'avatar au montage si authentifié
  useEffect(() => {
    if (isAuthenticated && !authLoading) {
      checkAvatar();
    }
  }, [isAuthenticated, authLoading]); // Ne vérifier que quand auth est stable

  // Handlers pour avatar existant
  const handleContinueWithAvatar = async () => {
    console.log("🚀 handleContinueWithAvatar clicked", { 
      avatarCheckData, 
      selectedProducts, 
      productConfigs 
    });
    
    // Vérifications avant navigation
    if (!selectedProducts || selectedProducts.length === 0) {
      console.error("❌ No selectedProducts found");
      toast.error("Aucun produit sélectionné");
      return;
    }
    
    if (!productConfigs || productConfigs.length === 0) {
      console.error("❌ No productConfigs found");
      toast.error("Configuration produits manquante");
      return;
    }
    
    if (!avatarCheckData?.body_url) {
      console.error("❌ No avatar body_url found", avatarCheckData);
      toast.error("Avatar introuvable");
      return;
    }
    
    // Solution simple : passer directement les URLs S3 au backend
    console.log("✅ Passage des URLs S3 directement au backend");
    console.log("Debug avatarCheckData.avatar:", avatarCheckData.avatar);
    
    // Récupérer les bonnes clés depuis la structure des données
    const personS3Key = avatarCheckData.avatar?.body_key; // Utiliser body_key au lieu de person_s3_key
    const maskS3Key = avatarCheckData.avatar?.body_masks?.[0]?.object_key; // Premier mask disponible
    
    console.log("Debug S3 keys:", { personS3Key, maskS3Key });
    
    navigate("/virtual-fitting", {
      state: {
        selectedProducts,
        productConfigs,
        avatarS3Urls: {
          body_url: avatarCheckData.body_url,
          mask_url: avatarCheckData.mask_urls?.upper || avatarCheckData.mask_urls?.overall, 
          person_s3_key: personS3Key,
          mask_s3_key: maskS3Key
        }
      }
    });
  };

  const handleModifyAvatar = () => {
    setIsUploadingForAvatar(true);
    setCapturedImage(null);
  };

  // Handlers pour capture d'image
  const handleImageCapture = (imageData: string) => {
    setCapturedImage(imageData);
  };

  const handleImageUpload = async (imageData: string) => {
    console.log("📷 handleImageUpload called", { 
      isUploadingForAvatar, 
      hasAvatar,
      selectedProducts, 
      productConfigs 
    });
    
    // Si l'utilisateur n'a pas d'avatar OU veut modifier son avatar existant
    if (isUploadingForAvatar || !hasAvatar) {
      // Créer nouvel avatar
      try {
        console.log("🔨 Creating new avatar...");
        const sessionId = await createNewAvatar({
          person_image_data: imageData,
          label: `Avatar ${new Date().toLocaleDateString('fr-FR')}`
        });
        
        if (sessionId) {
          console.log("⏳ Waiting for avatar creation...");
          // Attendre completion avec suivi temps réel
          const success = await waitForCreation(sessionId);
          if (success) {
            console.log("✅ Avatar created successfully");
            setIsUploadingForAvatar(false);
            setCapturedImage(null);
            toast.success('Avatar créé avec succès!');
            
            // Une fois l'avatar créé, si on a des produits sélectionnés, 
            // rediriger vers l'essayage virtuel
            if (selectedProducts && selectedProducts.length > 0 && productConfigs) {
              toast.success('Avatar créé ! Redirection vers l\'essayage virtuel.', {
                duration: 2000
              });
              
              // Utiliser directement l'image capturée au lieu de récupérer depuis la base
              // L'image est déjà en base64 dans imageData
              console.log("✅ Utilisation de l'image capturée pour l'essayage");
              
              // Attendre un peu pour que l'utilisateur voie le message
              setTimeout(() => {
                navigate("/loading", {
                  state: {
                    selectedProducts,
                    productConfigs,
                    personImage: imageData, // Image pour l'essayage virtuel
                    useExistingAvatar: true // Utiliser l'avatar qui vient d'être créé
                  }
                });
              }, 1500);
            }
          }
        }
      } catch (error) {
        console.error('Erreur création avatar:', error);
        setIsUploadingForAvatar(false);
        toast.error('Erreur lors de la création de l\'avatar');
      }
    } else {
      // Comportement obsolète - ne devrait plus arriver avec la nouvelle logique
      console.warn("⚠️ Direct try-on without avatar creation - this should not happen");
      
      // Vérifications avant navigation
      if (!selectedProducts || selectedProducts.length === 0) {
        console.error("❌ No selectedProducts found for try-on");
        toast.error("Aucun produit sélectionné");
        return;
      }
      
      if (!productConfigs || productConfigs.length === 0) {
        console.error("❌ No productConfigs found for try-on");
        toast.error("Configuration produits manquante");
        return;
      }
      
      navigate("/loading", {
        state: {
          selectedProducts,
          productConfigs,
          personImage: imageData, // Image pour l'essayage virtuel
          useExistingAvatar: true // Utiliser l'avatar existant
        }
      });
    }
  };

  const handleClearImage = () => {
    setCapturedImage(null);
  };

  const handleBack = () => {
    // navigate("/");
  };

  // Affichage conditionnel selon l'état
  // Attendre que l'authentification soit stable
  if (authLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-text-subtle">Vérification de la session...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <h1 className="text-2xl font-light tracking-wider text-foreground mb-4">
            démo
          </h1>
          <p className="text-text-subtle text-sm font-light mb-8">
            Essayage Virtuel
          </p>
          <div className="text-center">
            <p className="text-foreground mb-4">Connexion requise</p>
            <p className="text-text-subtle text-sm mb-6">
              Vous devez être connecté pour accéder à cette page.
            </p>
            <div className="space-x-4">
              <Link 
                to="/login" 
                className="inline-flex items-center px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90 transition-colors"
              >
                Se connecter
              </Link>
              <Link 
                to="/register" 
                className="inline-flex items-center px-4 py-2 border border-border rounded-md hover:bg-accent transition-colors"
              >
                Créer un compte
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (isChecking && isAuthenticated) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin text-primary mx-auto mb-4" />
          <p className="text-text-subtle">Vérification de votre avatar...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Avatar Creation Progress Overlay */}
      <AvatarCreationProgress
        isCreating={isCreating}
        progress={creationProgress}
        currentStep={creationStep}
      />

      {/* Header */}
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

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* Instructions */}


        {/* Layout divisé */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonne gauche - Conditionnelle */}
          {hasAvatar && !capturedImage && !isUploadingForAvatar && isAuthenticated ? (
            <AvatarDisplay 
              avatarData={avatarCheckData!}
              onContinue={handleContinueWithAvatar}
              onModify={handleModifyAvatar}
            />
          ) : (
            <ImageCapture 
              capturedImage={capturedImage}
              onImageCapture={handleImageCapture}
              onImageUpload={handleImageUpload}
              onClear={handleClearImage}
              title={isUploadingForAvatar ? "Nouveau mannequin" : !hasAvatar ? "Créer votre mannequin" : "Votre photo"}
              subtitle={isUploadingForAvatar 
                ? "Uploadez une nouvelle image pour mettre à jour votre mannequin."
                : !hasAvatar 
                  ? "Uploadez une photo pour créer votre mannequin personnel. Il sera utilisé pour tous vos essayages futurs."
                  : "Prenez une photo de vous-même ou uploadez une image existante."
              }
            />
          )}
          
          {/* Colonne droite */}
          <SelectedProductsSidebar 
            productConfigs={productConfigs || []}
            onBack={handleBack}
          />
        </div>
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
    </div>
  );
}
