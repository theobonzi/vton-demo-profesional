import { useRef } from "react";
import { Button } from "@/components/ui/button";
import { Camera, Upload } from "lucide-react";

interface ImageCaptureProps {
  capturedImage: string | null;
  onImageCapture: (image: string) => void;
  onImageUpload: (image: string) => void;
  onClear: () => void;
  title?: string;
  subtitle?: string;
}

export function ImageCapture({
  capturedImage,
  onImageCapture,
  onImageUpload,
  onClear,
  title = "Votre photo",
  subtitle = "Prenez une photo de vous-même ou uploadez une image existante. Assurez-vous d'être bien centré et que votre visage soit visible."
}: ImageCaptureProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        const imageData = e.target?.result as string;
        onImageUpload(imageData);
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
        onImageCapture(imageData);
      }
    }
  };

  const handleContinue = () => {
    if (capturedImage) {
      onImageUpload(capturedImage);
    }
  };

  return (
    <div className="bg-card rounded-lg p-6">
      <h3 className="text-xl font-medium text-foreground mb-2 text-center">
        {title}
      </h3>
      <p className="text-text-subtle text-sm mb-6 text-center">
        {subtitle}
      </p>
      
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
              alt="Image capturée"
              className="w-full h-full object-cover"
            />
          </div>

          {/* Action Buttons */}
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Button
              variant="outline"
              onClick={onClear}
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
  );
}