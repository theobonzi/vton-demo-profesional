import { useEffect, useRef, useState } from "react";
import { Loader2 } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ExperienceLayout } from "@/components/ExperienceLayout";
import { EXPERIENCE_STEPS } from "@/constants/experience";
import { cn } from "@/lib/utils";
import type { ExperienceState } from "@/types";
import { createTryOn, waitForTryOnCompletion } from "@/services/tryOnService";

const PROCESS_STEPS = [
  {
    label: "Préparation",
    description: "Analyse du portrait et des pièces sélectionnées",
    threshold: 15,
  },
  {
    label: "Stylisation",
    description: "Harmonisation de la silhouette et des volumes",
    threshold: 45,
  },
  {
    label: "Fusion",
    description: "Suppression de l'arrière-plan et intégration",
    threshold: 70,
  },
  {
    label: "Finalisation",
    description: "Génération des essayages augmentés",
    threshold: 90,
  },
];

export default function LoadingScreen() {
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Initialisation...");
  const [isProcessing, setIsProcessing] = useState(false);
  const hasStartedRef = useRef(false);

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ExperienceState | undefined;

  const selectedProducts = state?.selectedProducts ?? [];
  const productConfigs = state?.productConfigs ?? [];
  const personImage = state?.personImage;

  const brandName = import.meta.env.VITE_DEFAULT_BRAND?.trim() || "Maison Virtuelle";
  const highlight = selectedProducts.length > 0
    ? `${selectedProducts.length} look${selectedProducts.length > 1 ? "s" : ""} en génération`
    : "Traitement de votre sélection";
  const locationLabel = "Atelier numérique — Synthèse";

  useEffect(() => {
    if (!personImage || selectedProducts.length === 0 || productConfigs.length === 0) {
      navigate("/", { replace: true });
    }
  }, [navigate, personImage, productConfigs.length, selectedProducts.length]);

  useEffect(() => {
    if (hasStartedRef.current || isProcessing) {
      return;
    }

    const startTryOn = async () => {
      try {
        hasStartedRef.current = true;
        setIsProcessing(true);

        if (!personImage || selectedProducts.length === 0) {
          navigate("/", { replace: true });
          return;
        }

        setProgress(12);
        setStatus("Initialisation de l'essayage virtuel...");
        await new Promise((resolve) => setTimeout(resolve, 800));

        setProgress(25);
        setStatus("Préparation des données et du portrait...");

        const products_info = productConfigs.map((config) => ({
          id: config.id,
          name: config.name,
          price: config.price,
          image_url: config.displayImage,
        }));

        const tryOnRequest = {
          person_image_url: personImage,
          product_ids: selectedProducts,
          products_info,
          session_id: `session_${Date.now()}`,
        };

        setProgress(40);
        setStatus(`Lancement de l'essayage pour ${selectedProducts.length} pièce${
          selectedProducts.length > 1 ? "s" : ""
        }...`);

        const tryOnResponse = await createTryOn(tryOnRequest);

        setProgress(55);
        setStatus("Traitement de l'image et ajustement des volumes...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setProgress(75);
        setStatus("Fusion des textures et suppression de l'arrière-plan...");
        await new Promise((resolve) => setTimeout(resolve, 1000));

        setProgress(92);
        setStatus("Finalisation des essayages en haute définition...");

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
              sessionId: tryOnResponse.session_id,
            },
          });
        }, 1000);
      } catch (error) {
        console.error("Erreur lors du traitement:", error);
        setStatus("Une erreur est survenue pendant la génération");
        setTimeout(() => {
          navigate("/", { replace: true });
        }, 2000);
      } finally {
        setIsProcessing(false);
      }
    };

    startTryOn();
  }, [isProcessing, navigate, personImage, productConfigs, selectedProducts]);

  return (
    <ExperienceLayout
      currentStep={2}
      steps={EXPERIENCE_STEPS}
      brandName={brandName}
      tagline="Virtual Atelier"
      highlight={highlight}
      location={locationLabel}
      headerRight={
        <div className="hidden flex-col items-end text-right md:flex">
          <span className="text-[10px] uppercase tracking-[0.45em] text-foreground/50">
            Progression
          </span>
          <span className="text-3xl font-serif leading-none text-foreground">{progress}%</span>
          <span className="text-xs text-foreground/60">{status}</span>
        </div>
      }
      contentClassName="py-20"
    >
      <div className="mx-auto max-w-2xl">
        <div className="luxury-card space-y-8 p-10 text-center">
          <div className="space-y-3">
            <p className="luxury-section-title">Génération en cours</p>
            <h1 className="text-3xl font-serif leading-tight text-foreground md:text-4xl">
              Nous sculptons votre look digital
            </h1>
            <p className="text-sm text-foreground/60">
              Nos algorithmes combinent le portrait capturé et les pièces sélectionnées afin de proposer un rendu fidèle et inspirant.
            </p>
          </div>

          <div className="relative mx-auto h-44 w-44">
            <svg className="h-44 w-44 -rotate-90" viewBox="0 0 36 36">
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="text-border"
              />
              <path
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeDasharray={`${progress}, 100`}
                className="text-primary transition-all duration-500 ease-in-out"
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-3xl font-serif text-foreground">{progress}%</span>
              <span className="text-[10px] uppercase tracking-[0.45em] text-foreground/50">complet</span>
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-center gap-2 text-sm text-foreground">
              <Loader2 className="h-4 w-4 animate-spin text-primary" />
              <span>{status}</span>
            </div>
            <p className="text-xs text-foreground/60">
              Cette étape dure généralement moins d&apos;une minute. Restez auprès de la cliente pour maintenir l&apos;engagement.
            </p>
          </div>

          <div className="grid gap-3 text-left sm:grid-cols-2">
            {PROCESS_STEPS.map((step) => {
              const isActive = progress >= step.threshold;
              return (
                <div
                  key={step.label}
                  className={cn(
                    "rounded-[18px] border border-white/40 bg-white/55 p-4 transition",
                    isActive && "border-primary/30 bg-primary/15 text-primary"
                  )}
                >
                  <p className="text-[10px] uppercase tracking-[0.45em]">{step.label}</p>
                  <p className="mt-2 text-xs text-foreground/60">{step.description}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </ExperienceLayout>
  );
}
