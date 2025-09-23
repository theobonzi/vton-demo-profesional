import { useEffect, useState, useRef } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { createTryOn, waitForTryOnCompletion } from "@/services/tryOnService";

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initialisation...");
  const [isProcessing, setIsProcessing] = useState(false);
  const hasStartedRef = useRef(false);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProducts, productConfigs, personImage, useExistingAvatar } = location.state || {};

  useEffect(() => {
    if (hasStartedRef.current || isProcessing) {
      return;
    }

    const startTryOn = async () => {
      try {
        hasStartedRef.current = true;
        setIsProcessing(true);

        if (!personImage || !selectedProducts || selectedProducts.length === 0) {
          navigate("/");
          return;
        }

        setProgress(10);
        setStatus("Initialisation de l'essayage virtuel...");
        await new Promise(resolve => setTimeout(resolve, 1000));

        setProgress(20);
        setStatus(useExistingAvatar 
          ? "Préparation avec votre mannequin..." 
          : "Préparation des données..."
        );
        
        const products_info = productConfigs?.map((config: any) => ({
          id: parseInt(config.id),
          name: config.name,
          price: config.price,
          image_url: config.displayImage
        })) || [];
        
        const tryOnRequest = {
          person_image_url: personImage,
          product_ids: selectedProducts,
          products_info: products_info,
          session_id: `session_${Date.now()}`,
          use_existing_avatar: useExistingAvatar || false
        };

        setProgress(30);
        setStatus(`Lancement de l'essayage virtuel pour ${selectedProducts.length} vêtement(s)...`);
        
        const tryOnResponse = await createTryOn(tryOnRequest);

        setProgress(50);
        setStatus(useExistingAvatar 
          ? "Traitement avec votre mannequin..." 
          : "Traitement de votre image..."
        );
        await new Promise(resolve => setTimeout(resolve, 1000));

        setProgress(70);
        setStatus(useExistingAvatar 
          ? "Application des vêtements..." 
          : "Suppression de l'arrière-plan..."
        );
        await new Promise(resolve => setTimeout(resolve, 1000));

        setProgress(90);
        setStatus("Génération des essayages virtuels...");

        const finalResult = await waitForTryOnCompletion(tryOnResponse.session_id);

        setProgress(100);
        setStatus("Terminé !");

        setTimeout(() => {
          const resultsArray = finalResult.results ? Object.values(finalResult.results) : [];
          
          navigate("/virtual-fitting", {
            state: {
              selectedProducts,
              productConfigs,
              personImage,
              results: resultsArray,
              sessionId: tryOnResponse.session_id
            }
          });
        }, 1000);

      } catch (error) {
        setStatus("Erreur lors du traitement");
        setTimeout(() => {
          navigate("/");
        }, 2000);
      } finally {
        setIsProcessing(false);
      }
    };

    startTryOn();
  }, []);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-light tracking-wider text-foreground mb-2">
            démo
          </h1>
          <p className="text-text-subtle text-sm font-light">
            Essayage Virtuel
          </p>
        </div>

        <div className="relative w-32 h-32 mx-auto mb-8">
          <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className="text-border"
            />
            <path
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeDasharray={`${progress}, 100`}
              className="text-primary transition-all duration-500 ease-in-out"
            />
          </svg>
          
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-lg font-medium text-foreground">
              {progress}%
            </span>
          </div>
        </div>

        <div className="mb-8">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Loader2 className="w-4 h-4 animate-spin text-primary" />
            <span className="text-sm text-text-subtle">Traitement en cours</span>
          </div>
          <p className="text-sm text-foreground font-medium">
            {status}
          </p>
        </div>

        <div className="text-xs text-text-subtle">
          <p>Veuillez patienter pendant le traitement de votre essayage virtuel.</p>
          <p className="mt-1">Ce processus peut prendre quelques instants...</p>
        </div>
      </div>
    </div>
  );
}
