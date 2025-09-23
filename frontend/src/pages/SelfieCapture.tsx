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
  const handleContinueWithAvatar = () => {
    console.log("🚀 handleContinueWithAvatar clicked", { 
      avatarCheckData, 
      selectedProducts, 
      productConfigs 
    });
    
    // Vérifications avant navigation
    if (!selectedProducts || selectedProducts.length === 0) {
      console.error("❌ No selectedProducts found");
      toast.error("Aucun produit sélectionné");
      // navigate("/");
      return;
    }
    
    if (!productConfigs || productConfigs.length === 0) {
      console.error("❌ No productConfigs found");
      toast.error("Configuration produits manquante");
      // navigate("/");
      return;
    }
    
    if (!avatarCheckData?.body_url) {
      console.error("❌ No avatar body_url found", avatarCheckData);
      toast.error("Avatar introuvable");
      return;
    }
    
    console.log("✅ All checks passed, navigating to /loading with existing avatar");
    navigate("/loading", {
      state: {
        selectedProducts,
        productConfigs,
        personImage: avatarCheckData.body_url,
        useExistingAvatar: true
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
            // proposer de lancer l'essayage
            if (selectedProducts && selectedProducts.length > 0 && productConfigs) {
              toast.success('Avatar créé ! Vous pouvez maintenant lancer l\'essayage virtuel.', {
                duration: 4000
              });
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
          personImage: imageData,
          useExistingAvatar: false
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
        <div className="mb-8 text-center">
          <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
            {hasAvatar && !capturedImage && !isUploadingForAvatar 
              ? "Votre mannequin" 
              : isUploadingForAvatar
                ? "Nouveau mannequin"
                : !hasAvatar
                  ? "Créer votre mannequin"
                  : "Prenez votre photo"
            }
          </h2>
          <p className="text-text-subtle font-light max-w-lg mx-auto">
            {hasAvatar && !capturedImage && !isUploadingForAvatar
              ? "Utilisez votre mannequin existant ou modifiez-le en uploadant une nouvelle photo."
              : isUploadingForAvatar
                ? "Uploadez une nouvelle image pour remplacer votre mannequin actuel."
                : !hasAvatar
                  ? "Créez d'abord votre mannequin personnel en uploadant une photo. Il sera utilisé pour tous vos essayages futurs."
                  : "Prenez une photo de vous-même ou uploadez une image existante. Assurez-vous d'être bien centré et que votre visage soit visible."
            }
          </p>
        </div>

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
