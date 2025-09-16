import { LuxuryBackground } from "@/components/LuxuryBackground";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";

export default function NotFound() {
  const navigate = useNavigate();

  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <LuxuryBackground />
      <div className="relative flex min-h-screen items-center justify-center px-6 py-24">
        <div className="luxury-card max-w-md space-y-6 p-12 text-center">
          <p className="luxury-section-title">Expérience virtuelle</p>
          <h1 className="text-6xl font-serif text-foreground">404</h1>
          <p className="text-sm text-foreground/60">
            La page que vous recherchez n&apos;existe pas ou a été déplacée.
          </p>
          <Button
            onClick={() => navigate("/")}
            className="rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]"
          >
            Retour à l&apos;accueil
          </Button>
        </div>
      </div>
    </div>
  );
}
