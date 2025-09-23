import { Button } from "@/components/ui/button";
import { Edit2, ArrowRight } from "lucide-react";
import { AvatarCheckResponse } from "@/types";

interface AvatarDisplayProps {
  avatarData: AvatarCheckResponse;
  onContinue: () => void;
  onModify: () => void;
}

export function AvatarDisplay({ avatarData, onContinue, onModify }: AvatarDisplayProps) {
  return (
    <div className="bg-card rounded-lg p-6">
      <h3 className="text-xl font-medium text-foreground mb-6 text-center">
        Votre mannequin
      </h3>
      
      <div className="text-center">
        {/* Avatar Image Preview */}
        <div className="w-full max-w-sm mx-auto aspect-[3/4] bg-surface-elevated rounded-lg mb-6 overflow-hidden">
          {avatarData.body_url ? (
            <img
              src={avatarData.body_url}
              alt="Votre avatar"
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted-foreground">
              <span>Avatar introuvable</span>
            </div>
          )}
        </div>

        {/* Avatar Info */}
        {avatarData.avatar && (
          <div className="mb-6 p-4 bg-surface-elevated rounded-lg">
            <p className="text-sm font-medium text-foreground mb-1">
              {avatarData.avatar.label}
            </p>
            <p className="text-xs text-text-subtle">
              Créé le {new Date(avatarData.avatar.created_at).toLocaleDateString('fr-FR')}
            </p>
            {avatarData.mask_urls && (
              <p className="text-xs text-text-subtle mt-1">
                Masques disponibles: {Object.keys(avatarData.mask_urls).length}
              </p>
            )}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row justify-center gap-4">
          <Button
            variant="outline"
            size="lg"
            onClick={onModify}
            className="flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Modifier
          </Button>
          
          <Button
            onClick={onContinue}
            size="lg"
            className="flex items-center gap-2"
          >
            Continuer
            <ArrowRight className="w-4 h-4" />
          </Button>
        </div>

        {/* Help Text */}
        <p className="text-xs text-text-subtle mt-4 max-w-sm mx-auto">
          Utilisez votre mannequin existant ou modifiez-le en uploadant une nouvelle photo.
        </p>
      </div>
    </div>
  );
}