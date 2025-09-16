import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "react";

interface LuxuryBackgroundProps extends HTMLAttributes<HTMLDivElement> {}

export function LuxuryBackground({ className, ...props }: LuxuryBackgroundProps) {
  return (
    <div
      className={cn(
        "pointer-events-none absolute inset-0 -z-10 overflow-hidden",
        className
      )}
      aria-hidden
      {...props}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,_rgba(255,255,255,0.85),_transparent_60%)]" />
      <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(229,218,200,0.45),rgba(247,242,235,0.85))]" />
      <div className="absolute -left-[18%] top-[12%] h-[280px] w-[280px] rounded-full bg-[radial-gradient(circle,_rgba(209,178,121,0.35),_transparent_70%)] blur-3xl" />
      <div className="absolute bottom-[-25%] right-[-12%] h-[420px] w-[420px] rounded-full bg-[radial-gradient(circle,_rgba(162,136,94,0.25),_transparent_75%)] blur-3xl" />
      <div className="absolute inset-0 bg-white/35" />
    </div>
  );
}
