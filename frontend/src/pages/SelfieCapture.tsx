import { useState, useRef } from "react";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Camera, Upload } from "lucide-react";
import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";

export default function SelfieCapture() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const navigate = useNavigate();
  const location = useLocation();
  const { selectedProducts, productConfigs } = location.state || {};

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        setCapturedImage(e.target?.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleCapture = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      const context = canvas.getContext('2d');
      
      if (context) {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        context.drawImage(video, 0, 0);
        const imageData = canvas.toDataURL('image/jpeg');
        setCapturedImage(imageData);
      }
    }
  };

  const handleContinue = () => {
    if (capturedImage) {
      navigate("/loading", {
        state: {
          selectedProducts,
          productConfigs,
          personImage: capturedImage
        }
      });
    }
  };

  const handleBack = () => {
    navigate("/");
  };

  return (
    <div className="min-h-screen bg-background">
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
            Prenez votre photo
          </h2>
          <p className="text-text-subtle font-light max-w-lg mx-auto">
            Prenez une photo de vous-même ou uploadez une image existante.
            Assurez-vous d'être bien centré et que votre visage soit visible.
          </p>
        </div>

        {/* Layout vertical divisé */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
          {/* Colonne gauche - Capture d'image */}
          <div className="bg-card rounded-lg p-6">
            <h3 className="text-xl font-medium text-foreground mb-6 text-center">
              Votre photo
            </h3>
            
            {!capturedImage ? (
              <div className="text-center">
                {/* Camera Preview */}
                <div className="w-full max-w-sm mx-auto aspect-[3/4] bg-surface-elevated rounded-lg mb-6 overflow-hidden">
                  <video
                    ref={videoRef}
                    className="w-full h-full object-cover"
                    autoPlay
                    muted
                    playsInline
                  />
                </div>

                {/* Hidden canvas for capture */}
                <canvas ref={canvasRef} className="hidden" />

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button
                    onClick={handleCapture}
                    size="lg"
                    className="flex items-center gap-2"
                  >
                    <Camera className="w-4 h-4" />
                    Prendre une photo
                  </Button>
                  
                  <Button
                    variant="outline"
                    size="lg"
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-2"
                  >
                    <Upload className="w-4 h-4" />
                    Uploader une image
                  </Button>
                </div>

                {/* Hidden file input */}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="text-center">
                {/* Captured Image Preview */}
                <div className="w-full max-w-sm mx-auto aspect-[3/4] bg-surface-elevated rounded-lg mb-6 overflow-hidden">
                  <img
                    src={capturedImage}
                    alt="Captured selfie"
                    className="w-full h-full object-cover"
                  />
                </div>

                {/* Action Buttons */}
                <div className="flex flex-col sm:flex-row justify-center gap-4">
                  <Button
                    variant="outline"
                    onClick={() => setCapturedImage(null)}
                    size="lg"
                  >
                    Reprendre
                  </Button>
                  
                  <Button
                    onClick={handleContinue}
                    size="lg"
                    className="flex items-center gap-2"
                    disabled={!capturedImage}
                  >
                    Continuer
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Colonne droite - Produits sélectionnés */}
          <div className="bg-card rounded-lg p-6">
            <h3 className="text-xl font-medium text-foreground mb-6 text-center">
              Produits sélectionnés ({productConfigs?.length || 0})
            </h3>
            
            {productConfigs && productConfigs.length > 0 ? (
              <div className="space-y-4">
                {productConfigs.map((product: any) => (
                  <div key={product.id} className="flex items-center gap-4 p-4 bg-surface-elevated rounded-lg">
                    <div className="w-20 h-24 bg-surface-elevated rounded-lg overflow-hidden flex-shrink-0">
                      <img
                        src={product.displayImage}
                        alt={product.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{product.name}</p>
                      <p className="text-xs text-text-subtle">{product.price}</p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12">
                <p className="text-muted-foreground">Aucun produit sélectionné</p>
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="mt-4"
                >
                  Retourner aux produits
                </Button>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
