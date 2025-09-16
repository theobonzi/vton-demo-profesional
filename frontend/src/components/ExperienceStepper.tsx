import { cn } from "@/lib/utils";

export interface ExperienceStep {
  title: string;
  description: string;
}

interface ExperienceStepperProps {
  steps: ExperienceStep[];
  currentStep: number;
}

export function ExperienceStepper({ steps, currentStep }: ExperienceStepperProps) {
  return (
    <ol className="grid gap-4 md:grid-cols-3">
      {steps.map((step, index) => {
        const isActive = index === currentStep;
        const isPast = index < currentStep;

        return (
          <li
            key={step.title}
            className={cn(
              "relative overflow-hidden rounded-[24px] border border-white/35 bg-white/40 px-5 py-4 backdrop-blur-xl transition-all duration-300",
              isActive &&
                "border-white/60 bg-white/75 shadow-[0_32px_90px_-45px_rgba(58,43,28,0.55)]",
              isPast && !isActive && "opacity-80"
            )}
          >
            <div
              className={cn(
                "absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent opacity-0 transition-opacity duration-500",
                isActive && "opacity-100"
              )}
              aria-hidden
            />
            <div className="flex items-start gap-4">
              <span
                className={cn(
                  "mt-0.5 text-xs font-medium uppercase tracking-[0.6em] text-foreground/50",
                  isActive && "text-foreground",
                  isPast && "text-foreground/60"
                )}
              >
                {String(index + 1).padStart(2, "0")}
              </span>
              <div className="space-y-1 text-left">
                <p
                  className={cn(
                    "text-xs uppercase tracking-[0.4em] text-foreground/60",
                    isActive && "text-foreground"
                  )}
                >
                  {step.title}
                </p>
                <p className="text-sm text-foreground/60 text-balance">{step.description}</p>
              </div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}
