import { Button } from "@/components/ui/button";
import { Loader2, X } from "lucide-react";

interface AvatarCreationProgressProps {
  isCreating: boolean;
  progress: number;
  currentStep: string;
  onCancel?: () => void;
}

export function AvatarCreationProgress({ 
  isCreating, 
  progress, 
  currentStep, 
  onCancel 
}: AvatarCreationProgressProps) {
  if (!isCreating) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-card rounded-lg p-8 max-w-md mx-4 w-full">
        <div className="text-center">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-medium text-foreground">
              Création de votre avatar
            </h3>
            {onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-8 w-8 p-0"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>

          {/* Progress Circle */}
          <div className="relative w-32 h-32 mx-auto mb-6">
            <svg className="w-32 h-32 transform -rotate-90" viewBox="0 0 36 36">
              {/* Background circle */}
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                className="text-border"
              />
              {/* Progress circle */}
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeDasharray={`${progress}, 100`}
                className="text-primary transition-all duration-500 ease-in-out"
              />
            </svg>
            
            {/* Progress percentage */}
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-lg font-medium text-foreground">
                {progress}%
              </span>
            </div>
          </div>

          {/* Current Step */}
          <div className="mb-6">
            <div className="flex items-center justify-center gap-2 mb-2">
              <Loader2 className="w-4 h-4 animate-spin text-primary" />
              <span className="text-sm text-text-subtle">Traitement en cours</span>
            </div>
            <p className="text-sm text-foreground font-medium">
              {currentStep}
            </p>
          </div>

          {/* Steps List */}
          <div className="text-left space-y-2 mb-6">
            <div className="text-xs text-text-subtle">
              <p className={`flex items-center gap-2 ${progress >= 15 ? 'text-primary' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${progress >= 15 ? 'bg-primary' : 'bg-border'}`}></span>
                Upload sur S3
              </p>
              <p className={`flex items-center gap-2 ${progress >= 25 ? 'text-primary' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${progress >= 25 ? 'bg-primary' : 'bg-border'}`}></span>
                Enregistrement
              </p>
              <p className={`flex items-center gap-2 ${progress >= 45 ? 'text-primary' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${progress >= 45 ? 'bg-primary' : 'bg-border'}`}></span>
                Génération masques
              </p>
              <p className={`flex items-center gap-2 ${progress >= 65 ? 'text-primary' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${progress >= 65 ? 'bg-primary' : 'bg-border'}`}></span>
                Sauvegarde masques
              </p>
              <p className={`flex items-center gap-2 ${progress >= 85 ? 'text-primary' : ''}`}>
                <span className={`w-2 h-2 rounded-full ${progress >= 85 ? 'bg-primary' : 'bg-border'}`}></span>
                Finalisation
              </p>
            </div>
          </div>

          {/* Info Text */}
          <div className="text-xs text-text-subtle">
            <p>Cette opération peut prendre quelques minutes.</p>
            <p className="mt-1">Veuillez patienter pendant le traitement...</p>
          </div>
        </div>
      </div>
    </div>
  );
}