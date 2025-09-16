import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Upload } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ExperienceLayout } from "@/components/ExperienceLayout";
import { Button } from "@/components/ui/button";
import { EXPERIENCE_STEPS } from "@/constants/experience";
import { cn } from "@/lib/utils";
import type { ExperienceState } from "@/types";

export default function SelfieCapture() {
  const [capturedImage, setCapturedImage] = useState<string | null>(null);
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ExperienceState | undefined;

  const selectedProductIds = state?.selectedProducts ?? [];
  const productConfigs = state?.productConfigs ?? [];

  const brandName = import.meta.env.VITE_DEFAULT_BRAND?.trim() || "Maison Virtuelle";
  const selectionHighlight = selectedProductIds.length > 0
    ? `${selectedProductIds.length} pièce${selectedProductIds.length > 1 ? "s" : ""} sélectionnée${selectedProductIds.length > 1 ? "s" : ""}`
    : "Sélection en cours";
  const locationLabel = "Studio portrait — En boutique";

  const stopStream = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }, []);

  const hasSelection = selectedProductIds.length > 0 && productConfigs.length > 0;

  useEffect(() => {
    if (!hasSelection) {
      navigate("/", { replace: true });
    }
  }, [hasSelection, navigate]);

  useEffect(() => {
    let isMounted = true;

    const enableCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError("La capture vidéo n'est pas supportée sur cet appareil.");
        return;
      }

      try {
        stopStream();
        setCameraError(null);
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { width: 1080, facingMode: "user" },
        });

        if (!isMounted) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          streamRef.current = stream;
          setCameraReady(true);
        }
      } catch (error) {
        console.error("Erreur caméra:", error);
        if (isMounted) {
          setCameraError(
            "Impossible d'accéder à la caméra. Autorisez l'accès ou importez une image."
          );
          setCameraReady(false);
        }
      }
    };

    if (!capturedImage) {
      enableCamera();
    } else {
      stopStream();
    }

    return () => {
      isMounted = false;
      stopStream();
    };
  }, [capturedImage, stopStream]);

  useEffect(() => {
    if (!capturedImage) {
      setIsSubmitting(false);
    }
  }, [capturedImage]);

  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (e) => {
      setCapturedImage(e.target?.result as string);
      setCameraError(null);
    };
    reader.readAsDataURL(file);
  };

  const handleCapture = () => {
    if (!cameraReady || !videoRef.current || !canvasRef.current) {
      return;
    }

    const canvas = canvasRef.current;
    const video = videoRef.current;
    const context = canvas.getContext("2d");

    if (!context) {
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    context.drawImage(video, 0, 0);
    const imageData = canvas.toDataURL("image/jpeg");
    setCapturedImage(imageData);
  };

  const handleContinue = () => {
    if (!capturedImage || isSubmitting) {
      return;
    }

    setIsSubmitting(true);
    stopStream();

    navigate("/loading", {
      state: {
        selectedProducts: selectedProductIds,
        productConfigs,
        personImage: capturedImage,
      },
    });
  };

  const handleBack = () => {
    stopStream();
    navigate("/");
  };

  const cameraStatusLabel = capturedImage
    ? "Portrait validé"
    : cameraReady
    ? "Caméra active"
    : cameraError
    ? "Caméra indisponible"
    : "En attente";

  return (
    <ExperienceLayout
      currentStep={1}
      steps={EXPERIENCE_STEPS}
      showBack
      onBack={handleBack}
      brandName={brandName}
      tagline="Virtual Atelier"
      highlight={selectionHighlight}
      location={locationLabel}
      headerRight={
        <div className="hidden flex-col items-end text-right md:flex">
          <span className="text-[10px] uppercase tracking-[0.45em] text-foreground/50">
            Portrait
          </span>
          <span className="text-xs text-foreground/60">{cameraStatusLabel}</span>
        </div>
      }
    >
      <section className="space-y-12">
        <div className="mx-auto max-w-3xl space-y-4 text-center md:text-left">
          <p className="luxury-section-title">Étape 02 · Portrait immersif</p>
          <h1 className="text-4xl font-serif leading-tight text-foreground text-balance md:text-5xl">
            Capturez la cliente dans son meilleur angle
          </h1>
          <p className="text-base text-foreground/65">
            Positionnez-vous à hauteur des yeux, privilégiez une lumière douce et invitez la cliente à adopter une posture naturelle. Ce portrait sera la base du rendu virtuel.
          </p>
        </div>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
          <div className="space-y-8">
            <div className="luxury-card p-8 space-y-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1 text-left">
                  <p className="luxury-section-title">Studio instantané</p>
                  <p className="text-sm text-foreground/60">
                    Cadrez la cliente en pied, visage bien éclairé et regard caméra.
                  </p>
                </div>
                <span
                  className={cn(
                    "inline-flex items-center rounded-full border px-4 py-1 text-[10px] uppercase tracking-[0.45em]",
                    capturedImage
                      ? "border-primary/40 bg-primary/15 text-primary"
                      : cameraReady
                      ? "border-emerald-200 bg-emerald-50/80 text-emerald-700"
                      : "border-amber-200 bg-amber-50/80 text-amber-700"
                  )}
                >
                  {cameraStatusLabel}
                </span>
              </div>

              <div className="relative">
                <div className="aspect-[3/4] overflow-hidden rounded-[24px] border border-white/40 bg-surface-elevated">
                  {!capturedImage && !cameraError ? (
                    <video
                      ref={videoRef}
                      className="h-full w-full object-cover"
                      autoPlay
                      muted
                      playsInline
                    />
                  ) : null}

                  {capturedImage ? (
                    <img
                      src={capturedImage}
                      alt="Portrait capturé"
                      className="h-full w-full object-cover"
                    />
                  ) : null}

                  {cameraError ? (
                    <div className="flex h-full items-center justify-center px-6 text-center text-sm text-foreground/60">
                      {cameraError}
                    </div>
                  ) : null}
                </div>

                <canvas ref={canvasRef} className="hidden" />
              </div>

              <div className="space-y-4">
                <div className="text-sm text-foreground/60">
                  Une lumière douce et un fond uni garantissent le meilleur rendu. Évitez les contre-jours et vérifiez que les épaules sont bien visibles.
                </div>

                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div className="text-xs text-foreground/50">
                    {capturedImage
                      ? "Si nécessaire, reprenez la photo avant de lancer l'essayage."
                      : "Vous pouvez importer une photo existante si la caméra est indisponible."}
                  </div>

                  <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                    {!capturedImage ? (
                      <>
                        <Button
                          onClick={handleCapture}
                          disabled={!cameraReady}
                          className={cn(
                            "flex items-center gap-2 rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]",
                            cameraReady
                              ? "bg-gradient-to-r from-primary via-foreground to-black text-primary-foreground shadow-[0_30px_80px_-55px_rgba(58,43,28,0.65)] hover:opacity-95"
                              : "cursor-not-allowed bg-foreground/15 text-foreground/40"
                          )}
                        >
                          <Camera className="h-4 w-4" />
                          Capturer
                        </Button>

                        <Button
                          variant="outline"
                          onClick={() => fileInputRef.current?.click()}
                          className="flex items-center gap-2 rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]"
                        >
                          <Upload className="h-4 w-4" />
                          Importer
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          onClick={() => setCapturedImage(null)}
                          className="rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]"
                        >
                          Reprendre
                        </Button>

                        <Button
                          onClick={handleContinue}
                          disabled={!capturedImage || isSubmitting}
                          className={cn(
                            "rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]",
                            isSubmitting
                              ? "cursor-wait bg-foreground/15 text-foreground/40"
                              : "bg-gradient-to-r from-primary via-foreground to-black text-primary-foreground shadow-[0_30px_80px_-55px_rgba(58,43,28,0.65)] hover:opacity-95"
                          )}
                        >
                          {isSubmitting ? "Envoi..." : "Lancer l'essayage"}
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            <div className="luxury-card p-6 space-y-4">
              <p className="luxury-section-title">Conseils de posture</p>
              <ul className="space-y-3 text-sm text-foreground/70">
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  <span>Invitez la cliente à relâcher les épaules et à se tenir droite.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  <span>Vérifiez que les pieds restent visibles pour faciliter l&apos;intégration.</span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  <span>Demandez un regard franc vers l&apos;objectif pour un rendu immersif.</span>
                </li>
              </ul>
            </div>
          </div>

          <aside className="space-y-6">
            <div className="luxury-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="luxury-section-title">Pièces sélectionnées</p>
                <span className="text-xs text-foreground/60">
                  {selectedProductIds.length} look{selectedProductIds.length > 1 ? "s" : ""}
                </span>
              </div>

              {productConfigs.length > 0 ? (
                <div className="space-y-4">
                  {productConfigs.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 rounded-[18px] border border-white/40 bg-white/55 p-4"
                    >
                      <div className="h-24 w-20 overflow-hidden rounded-[16px] bg-surface-elevated">
                        <img
                          src={product.displayImage}
                          alt={product.name}
                          className="h-full w-full object-cover"
                        />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground text-balance">{product.name}</p>
                        <p className="text-xs text-foreground/60">{product.price}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="rounded-[18px] border border-white/40 bg-white/55 p-6 text-center text-sm text-foreground/60">
                  Aucune sélection active. Revenez au vestiaire pour choisir des pièces.
                  <Button
                    variant="outline"
                    onClick={handleBack}
                    className="mt-4 rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]"
                  >
                    Retour aux pièces
                  </Button>
                </div>
              )}
            </div>

            <div className="luxury-card p-6 space-y-4">
              <p className="luxury-section-title">Brief styliste</p>
              <p className="text-sm text-foreground/60 text-balance">
                Prenez le temps de rassurer la cliente sur le rendu final et montrez un exemple d&apos;essayage virtuel réussi pour instaurer la confiance avant la prise de vue.
              </p>
            </div>
          </aside>
        </div>
      </section>
    </ExperienceLayout>
  );
}
