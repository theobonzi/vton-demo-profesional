import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Heart, Share2, X } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { ExperienceLayout } from "@/components/ExperienceLayout";
import { Button } from "@/components/ui/button";
import { EXPERIENCE_STEPS } from "@/constants/experience";
import { cn } from "@/lib/utils";
import type { ExperienceState } from "@/types";

export default function VirtualFitting() {
  const [likedItems, setLikedItems] = useState<Set<number>>(new Set());
  const [fullscreenImage, setFullscreenImage] = useState<string | null>(null);
  const hasLoggedRef = useRef(false);

  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as ExperienceState | undefined;

  const productConfigs = state?.productConfigs ?? [];
  const personImage = state?.personImage;
  const sessionId = state?.sessionId;
  const results = state?.results ?? [];

  const resultsList = useMemo(() => (Array.isArray(results) ? results : []), [results]);

  useEffect(() => {
    if (!resultsList.length) {
      navigate("/", { replace: true });
    }
  }, [resultsList.length, navigate]);

  useEffect(() => {
    if (!hasLoggedRef.current) {
      hasLoggedRef.current = true;
    }
  }, []);

  const brandName = import.meta.env.VITE_DEFAULT_BRAND?.trim() || "Maison Virtuelle";
  const highlight = resultsList.length > 0
    ? `${resultsList.length} look${resultsList.length > 1 ? "s" : ""} finalisé${resultsList.length > 1 ? "s" : ""}`
    : "Essayages virtuels";
  const locationLabel = "Salon digital — Présentation";

  const handleBack = () => {
    navigate("/");
  };

  const handleLike = (productId: number) => {
    setLikedItems((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(productId)) {
        newSet.delete(productId);
      } else {
        newSet.add(productId);
      }
      return newSet;
    });
  };

  const handleDownload = (imageUrl: string, productName: string) => {
    const link = document.createElement("a");
    link.href = imageUrl;
    link.download = `essayage-${productName.replace(/\s+/g, "-").toLowerCase()}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleShare = async (imageUrl: string) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: "Mon essayage virtuel",
          text: "Découvrez ce look digital !",
          url: imageUrl,
        });
      } catch (error) {
        console.log("Erreur lors du partage:", error);
      }
    } else {
      try {
        await navigator.clipboard.writeText(imageUrl);
        alert("Lien copié dans le presse-papiers !");
      } catch (error) {
        alert("Impossible de copier le lien. Veuillez essayer manuellement.");
      }
    }
  };

  const likesCount = likedItems.size;

  return (
    <ExperienceLayout
      currentStep={2}
      steps={EXPERIENCE_STEPS}
      showBack
      onBack={handleBack}
      brandName={brandName}
      tagline="Virtual Atelier"
      highlight={highlight}
      location={locationLabel}
      headerRight={
        <div className="hidden flex-col items-end text-right md:flex">
          <span className="text-[10px] uppercase tracking-[0.45em] text-foreground/50">
            Coups de cœur
          </span>
          <span className="text-3xl font-serif leading-none text-foreground">
            {String(likesCount).padStart(2, "0")}
          </span>
          <span className="text-xs text-foreground/60">
            favori{likesCount > 1 ? "s" : ""}
          </span>
        </div>
      }
    >
      <section className="space-y-12">
        <div className="luxury-card space-y-4 p-8 text-center md:text-left">
          <p className="luxury-section-title">Étape finale</p>
          <h1 className="text-4xl font-serif leading-tight text-foreground md:text-5xl">
            Présentez les silhouettes augmentées à votre cliente
          </h1>
          <p className="text-sm text-foreground/60">
            Faites défiler les différents looks, recueillez ses réactions et gardez une trace des coups de cœur pour préparer la suite du parcours client.
          </p>
        </div>

        <div className="grid gap-10 xl:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="space-y-8">
            {resultsList.length > 0 ? (
              <div className="grid gap-6 sm:grid-cols-2">
                {resultsList.map((result: any, index: number) => {
                  const productId = result.product_id ?? index;
                  const matchedProduct = productConfigs.find((product) => product.id === productId);
                  const isLiked = likedItems.has(productId);
                  const isFailed = result.status === "failed";
                  const displayImage = result.result_image || personImage;

                  return (
                    <div key={`${productId}-${index}`} className="luxury-card overflow-hidden p-4">
                      <div className="relative aspect-[3/4] overflow-hidden rounded-[20px]">
                        {displayImage ? (
                          <img
                            src={displayImage}
                            alt={`Essayage ${result.product_name}`}
                            className="h-full w-full cursor-pointer object-cover transition-transform duration-500 hover:scale-[1.02]"
                            onClick={() => setFullscreenImage(displayImage)}
                          />
                        ) : (
                          <div className="flex h-full items-center justify-center bg-surface-elevated text-sm text-foreground/60">
                            Aucun visuel disponible
                          </div>
                        )}
                        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent" />
                      </div>

                      <div className="mt-4 space-y-3">
                        <div className="space-y-1 text-left">
                          <p className="luxury-section-title">Look {index + 1}</p>
                          <h3 className="text-lg font-serif leading-tight text-foreground text-balance">
                            {result.product_name || "Création"}
                          </h3>
                          {matchedProduct?.price ? (
                            <p className="text-xs text-foreground/60">{matchedProduct.price}</p>
                          ) : null}
                          {isFailed ? (
                            <p className="text-xs text-red-500">Ce look n&apos;a pas pu être généré.</p>
                          ) : null}
                        </div>

                        <div className="flex items-center gap-3">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleLike(productId)}
                            className={cn(
                              "flex items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3 py-2 text-xs uppercase tracking-[0.35em] transition",
                              isLiked && "border-primary/40 bg-primary text-primary-foreground"
                            )}
                            title={isLiked ? "Retirer des favoris" : "Ajouter aux favoris"}
                          >
                            <Heart
                              className={cn(
                                "h-4 w-4",
                                isLiked && "fill-current"
                              )}
                            />
                            Favori
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDownload(displayImage, result.product_name || "look")}
                            className="flex items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3 py-2 text-xs uppercase tracking-[0.35em]"
                            title="Télécharger l'image"
                            disabled={!displayImage}
                          >
                            <Download className="h-4 w-4" />
                            Télécharger
                          </Button>

                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleShare(displayImage)}
                            className="flex items-center gap-2 rounded-full border border-white/40 bg-white/60 px-3 py-2 text-xs uppercase tracking-[0.35em]"
                            title="Partager l'image"
                            disabled={!displayImage}
                          >
                            <Share2 className="h-4 w-4" />
                            Partager
                          </Button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="luxury-card p-10 text-center text-sm text-foreground/60">
                Aucun résultat disponible pour le moment.
              </div>
            )}

            <div className="luxury-card flex flex-col gap-4 p-6 md:flex-row md:items-center md:justify-between">
              <div className="text-left">
                <p className="luxury-section-title">Résumé de session</p>
                <p className="text-sm text-foreground/60">
                  Vous avez présenté {resultsList.length} look{resultsList.length > 1 ? "s" : ""}. {likesCount > 0 ? `${likesCount} coup${likesCount > 1 ? "s" : ""} de cœur enregistrés.` : "Ajoutez des favoris pour préparer un mémo personnalisé."}
                </p>
              </div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <Button
                  variant="outline"
                  onClick={handleBack}
                  className="rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]"
                >
                  Nouvel essayage
                </Button>
                <Button
                  onClick={() => {
                    if (likesCount === 0) {
                      alert("Ajoutez des coups de cœur pour préparer un mémo client.");
                    } else {
                      alert(`Vous avez sélectionné ${likesCount} coup${likesCount > 1 ? "s" : ""} de cœur.`);
                    }
                  }}
                  className="rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em] bg-gradient-to-r from-primary via-foreground to-black text-primary-foreground shadow-[0_30px_80px_-55px_rgba(58,43,28,0.65)] hover:opacity-95"
                >
                  Résumé des favoris ({likesCount})
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-6">
            {personImage ? (
              <div className="luxury-card p-6 space-y-4">
                <p className="luxury-section-title">Portrait de référence</p>
                <div className="aspect-[3/4] overflow-hidden rounded-[24px] border border-white/40 bg-surface-elevated">
                  <img
                    src={personImage}
                    alt="Portrait utilisé"
                    className="h-full w-full object-cover"
                  />
                </div>
              </div>
            ) : null}

            <div className="luxury-card p-6 space-y-5">
              <div className="flex items-center justify-between">
                <p className="luxury-section-title">Pièces essayées</p>
                <span className="text-xs text-foreground/60">
                  {productConfigs.length} sélection{productConfigs.length > 1 ? "s" : ""}
                </span>
              </div>

              {productConfigs.length > 0 ? (
                <div className="space-y-4">
                  {productConfigs.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center gap-4 rounded-[18px] border border-white/40 bg-white/55 p-4"
                    >
                      <div className="h-20 w-16 overflow-hidden rounded-[14px] bg-surface-elevated">
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
                <p className="text-sm text-foreground/60">Sélection introuvable.</p>
              )}
            </div>

            {sessionId ? (
              <div className="luxury-card p-6 text-left">
                <p className="luxury-section-title">Session</p>
                <p className="mt-2 font-mono text-xs text-foreground/70 break-all">{sessionId}</p>
              </div>
            ) : null}
          </aside>
        </div>
      </section>

      {fullscreenImage ? (
        <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-sm">
          <button
            type="button"
            onClick={() => setFullscreenImage(null)}
            className="absolute right-6 top-6 rounded-full border border-white/30 bg-white/10 p-2 text-white transition hover:bg-white/20"
          >
            <X className="h-5 w-5" />
          </button>
          <div className="flex h-full items-center justify-center p-6">
            <img
              src={fullscreenImage}
              alt="Essayage virtuel en plein écran"
              className="max-h-full max-w-full rounded-[24px] object-contain"
            />
          </div>
        </div>
      ) : null}
    </ExperienceLayout>
  );
}
