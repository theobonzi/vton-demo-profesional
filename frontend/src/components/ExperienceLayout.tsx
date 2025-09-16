import { type ReactNode } from "react";
import { ArrowLeft } from "lucide-react";

import { ExperienceStepper, type ExperienceStep } from "./ExperienceStepper";
import { LuxuryBackground } from "./LuxuryBackground";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ExperienceLayoutProps {
  currentStep: number;
  steps: ExperienceStep[];
  children: ReactNode;
  showBack?: boolean;
  onBack?: () => void;
  brandName?: string;
  tagline?: string;
  metaLabel?: string;
  highlight?: string;
  location?: string;
  headerRight?: ReactNode;
  contentClassName?: string;
}

export function ExperienceLayout({
  currentStep,
  steps,
  children,
  showBack = false,
  onBack,
  brandName = "Maison Virtuelle",
  tagline = "Atelier d'Essayage",
  metaLabel = "Expérience immersive",
  highlight = "Session privée dédiée à votre cliente",
  location = "Boutique éphémère",
  headerRight,
  contentClassName,
}: ExperienceLayoutProps) {
  return (
    <div className="relative min-h-screen overflow-hidden text-foreground">
      <LuxuryBackground />

      <div className="relative">
        <header className="border-b border-white/40 bg-white/65 backdrop-blur-xl">
          <div className="mx-auto flex max-w-6xl flex-col gap-8 px-6 py-8">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div className="space-y-3">
                <p className="luxury-section-title text-xs uppercase tracking-[0.6em] text-foreground/50">
                  {metaLabel}
                </p>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-baseline sm:gap-4">
                  <span className="text-3xl font-serif uppercase tracking-[0.45em] text-foreground">
                    {brandName}
                  </span>
                  <span className="text-sm uppercase tracking-[0.45em] text-foreground/55">
                    {tagline}
                  </span>
                </div>
                <div className="flex flex-col gap-1 text-sm text-foreground/60">
                  <span>{highlight}</span>
                  <span className="text-xs uppercase tracking-[0.35em] text-foreground/50">{location}</span>
                </div>
              </div>

              <div className="flex items-center gap-4">
                {headerRight}
                {showBack && onBack ? (
                  <Button
                    variant="ghost"
                    onClick={onBack}
                    className="group inline-flex items-center gap-2 rounded-full border border-transparent px-4 py-2 text-xs uppercase tracking-[0.35em] text-foreground/70 transition hover:border-foreground/10 hover:bg-white/60"
                  >
                    <ArrowLeft className="h-4 w-4 transition-transform group-hover:-translate-x-1" />
                    Retour
                  </Button>
                ) : null}
              </div>
            </div>

            <ExperienceStepper steps={steps} currentStep={currentStep} />
          </div>
        </header>

        <main className={cn("mx-auto max-w-6xl px-6 py-12", contentClassName)}>
          {children}
        </main>
      </div>
    </div>
  );
}
