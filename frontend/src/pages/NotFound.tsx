import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center max-w-md mx-auto px-6">
        <h1 className="text-6xl font-light text-foreground mb-4">404</h1>
        <h2 className="text-2xl font-light text-foreground mb-4">
          Page non trouvée
        </h2>
        <p className="text-text-subtle font-light mb-8">
          La page que vous recherchez n'existe pas ou a été déplacée.
        </p>
        <Button
          onClick={() => navigate("/")}
          className="flex items-center gap-2"
        >
          <ArrowLeft className="w-4 h-4" />
          Retour à l'accueil
        </Button>
      </div>
    </div>
  );
}
