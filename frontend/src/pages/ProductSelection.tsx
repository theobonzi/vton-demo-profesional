import { useEffect, useState } from "react";
import { ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";

import { ProductCard } from "@/components/ProductCard";
import { ExperienceLayout } from "@/components/ExperienceLayout";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { EXPERIENCE_STEPS } from "@/constants/experience";
import { cn } from "@/lib/utils";
import { useProductStore } from "@/store/useProductStore";
import type { ProductConfiguration } from "@/types";

export default function ProductSelection() {
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const navigate = useNavigate();

  const rawBrand = import.meta.env.VITE_DEFAULT_BRAND;
  const defaultBrand = rawBrand && rawBrand.trim().length > 0 ? rawBrand.trim() : undefined;
  const brandName = defaultBrand ?? "Maison Virtuelle";
  const highlight = defaultBrand
    ? `Sélection capsule ${defaultBrand}`
    : "Parcours multi-marques haute couture";
  const locationLabel = "Salon phygital — Mode & Innovation";

  const {
    products,
    brands,
    loading,
    error,
    fetchProducts,
    fetchBrands,
    filters,
    setFilters,
  } = useProductStore();

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([fetchBrands(), fetchProducts()]);
      } catch (err) {
        console.error("Erreur lors du chargement:", err);
      }
    };

    loadData();
  }, [fetchBrands, fetchProducts]);

  useEffect(() => {
    if (defaultBrand && brands.length > 0) {
      const brandExists = brands.some((brand) => brand.name === defaultBrand);
      if (brandExists) {
        setFilters({ brand: defaultBrand });
      } else {
        console.warn(
          `Marque "${defaultBrand}" non trouvée dans la liste des marques disponibles`
        );
      }
    }
  }, [defaultBrand, brands, setFilters]);

  useEffect(() => {
    if (brands.length > 0) {
      fetchProducts();
    }
  }, [brands.length, fetchProducts, filters.brand, filters.gender]);

  const handleProductSelect = (productId: number) => {
    setSelectedProducts((prev) =>
      prev.includes(productId)
        ? prev.filter((id) => id !== productId)
        : [...prev, productId]
    );
  };

  const selectedCount = selectedProducts.length;

  const handleContinue = () => {
    if (selectedCount === 0) {
      return;
    }

    const picked = products.filter((product) =>
      selectedProducts.includes(product.id)
    );

    const productConfigs: ProductConfiguration[] = picked.map((product) => ({
      id: product.id,
      name: product.name,
      price: `${product.price.toFixed(2)} €`,
      displayImage: product.image_url,
      apiImage: product.api_image_url || product.image_url,
    }));

    navigate("/selfie-capture", {
      state: {
        selectedProducts,
        productConfigs,
      },
    });
  };

  const genderValue = filters.gender ?? "all";
  const brandValue = filters.brand ?? "all";

  return (
    <ExperienceLayout
      currentStep={0}
      steps={EXPERIENCE_STEPS}
      brandName={brandName}
      tagline="Virtual Atelier"
      highlight={highlight}
      location={locationLabel}
      headerRight={
        <div className="hidden flex-col items-end text-right md:flex">
          <span className="text-[10px] uppercase tracking-[0.45em] text-foreground/50">
            Sélection
          </span>
          <span className="text-3xl font-serif leading-none text-foreground">
            {String(selectedCount).padStart(2, "0")}
          </span>
          <span className="text-xs text-foreground/60">
            pièce{selectedCount > 1 ? "s" : ""} choisie{selectedCount > 1 ? "s" : ""}
          </span>
        </div>
      }
    >
      <section className="space-y-12">
        <div className="mx-auto max-w-3xl space-y-4 text-center md:text-left">
          <p className="luxury-section-title">Étape 01 · Vestiaire</p>
          <h1 className="text-4xl font-serif leading-tight text-foreground text-balance md:text-5xl">
            Composez une silhouette à l&apos;image de votre cliente
          </h1>
          <p className="text-base text-foreground/65">
            Sélectionnez les pièces signatures qui reflètent son univers. Vous pouvez en
            choisir plusieurs pour créer une capsule personnalisée et scénariser la
            séance d&apos;essayage virtuel.
          </p>
        </div>

        <div className="grid gap-10 lg:grid-cols-[320px_minmax(0,1fr)]">
          <aside className="space-y-6">
            <div className="luxury-card p-6 space-y-4">
              <p className="luxury-section-title">Rituel styliste</p>
              <h2 className="text-2xl font-serif leading-tight text-foreground text-balance">
                Orientez votre cliente grâce à un vestiaire éditorialisé
              </h2>
              <p className="text-sm text-foreground/65">
                Ouvrez la discussion autour de ses envies, captez ses références et
                proposez une sélection resserrée qui illustre votre œil de styliste.
              </p>
            </div>

            <div className="luxury-card p-6 space-y-4">
              <p className="luxury-section-title">Conseils d&apos;usage</p>
              <ul className="space-y-3 text-sm text-foreground/70">
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  <span>
                    Présentez la tablette à votre cliente et parcourez ensemble les collections.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  <span>
                    Validez trois silhouettes maximum pour garder un récit clair et percutant.
                  </span>
                </li>
                <li className="flex gap-3">
                  <span className="mt-1 h-1.5 w-1.5 rounded-full bg-foreground/60" />
                  <span>
                    Notez ses réactions pour orienter le shooting virtuel et anticiper la suite du parcours.
                  </span>
                </li>
              </ul>
            </div>
          </aside>

          <div className="space-y-8">
            <div className="luxury-card p-6 space-y-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div className="space-y-1 text-left">
                  <p className="luxury-section-title">Filtres</p>
                  <p className="text-sm text-foreground/60">
                    Affinez la sélection selon l&apos;univers recherché par votre cliente.
                  </p>
                </div>

                {!defaultBrand ? (
                  <Tabs
                    value={brandValue}
                    onValueChange={(value) =>
                      setFilters({ brand: value === "all" ? undefined : value })
                    }
                    className="w-full xl:w-auto"
                  >
                    <TabsList className="flex w-full flex-wrap justify-end gap-2 bg-transparent p-0">
                      <TabsTrigger
                        value="all"
                        className="rounded-full border border-white/40 bg-white/60 px-4 py-2 text-[11px] uppercase tracking-[0.45em] text-foreground/60 transition data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                      >
                        Toutes
                      </TabsTrigger>
                      {brands.map((brand) => (
                        <TabsTrigger
                          key={brand.id}
                          value={brand.name}
                          className="rounded-full border border-white/40 bg-white/60 px-4 py-2 text-[11px] uppercase tracking-[0.45em] text-foreground/60 transition data-[state=active]:border-primary/40 data-[state=active]:bg-primary data-[state=active]:text-primary-foreground"
                        >
                          {brand.name}
                        </TabsTrigger>
                      ))}
                    </TabsList>
                  </Tabs>
                ) : (
                  <span className="luxury-pill">Collection {defaultBrand}</span>
                )}
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <ToggleGroup
                  type="single"
                  value={genderValue}
                  onValueChange={(value) =>
                    setFilters({
                      gender:
                        value === "all" ? undefined : (value as "men" | "women" | "unisex"),
                    })
                  }
                  className="flex flex-wrap gap-2"
                >
                  <ToggleGroupItem
                    value="all"
                    className="rounded-full border border-white/40 bg-white/55 px-5 py-2 text-[11px] uppercase tracking-[0.45em] text-foreground/60 transition data-[state=on]:border-primary/40 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    Tous
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="women"
                    className="rounded-full border border-white/40 bg-white/55 px-5 py-2 text-[11px] uppercase tracking-[0.45em] text-foreground/60 transition data-[state=on]:border-primary/40 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    Femme
                  </ToggleGroupItem>
                  <ToggleGroupItem
                    value="men"
                    className="rounded-full border border-white/40 bg-white/55 px-5 py-2 text-[11px] uppercase tracking-[0.45em] text-foreground/60 transition data-[state=on]:border-primary/40 data-[state=on]:bg-primary data-[state=on]:text-primary-foreground"
                  >
                    Homme
                  </ToggleGroupItem>
                </ToggleGroup>
              </div>
            </div>

            {loading ? (
              <div className="luxury-card flex flex-col items-center justify-center gap-4 p-10 text-center">
                <Loader2 className="h-6 w-6 animate-spin text-primary" />
                <p className="text-sm text-foreground/60">Chargement du vestiaire...</p>
              </div>
            ) : error ? (
              <div className="luxury-card space-y-4 p-10 text-center">
                <p className="text-sm text-red-500">{error}</p>
                <Button
                  variant="outline"
                  onClick={() => fetchProducts()}
                  className="rounded-full px-6 py-3 text-xs uppercase tracking-[0.45em]"
                >
                  Réessayer
                </Button>
              </div>
            ) : products.length === 0 ? (
              <div className="luxury-card p-10 text-center text-sm text-foreground/60">
                <p>
                  {defaultBrand
                    ? `Aucun produit trouvé pour la maison ${defaultBrand}.`
                    : "Aucun produit ne correspond à votre sélection actuelle."}
                </p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
                {products.map((product) => (
                  <ProductCard
                    key={product.id}
                    product={{
                      id: product.id.toString(),
                      name: product.name,
                      price: `${product.price.toFixed(2)} €`,
                      image: product.image_url,
                    }}
                    isSelected={selectedProducts.includes(product.id)}
                    onSelect={(id) => handleProductSelect(Number(id))}
                  />
                ))}
              </div>
            )}

            <div className="luxury-card flex flex-col gap-4 p-6 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-left">
                <p className="luxury-section-title">Sélection en cours</p>
                <p className="text-sm text-foreground/60">
                  {selectedCount > 0
                    ? `Prêt à lancer l'essayage pour ${selectedCount} pièce${
                        selectedCount > 1 ? "s" : ""
                      } sélectionnée${selectedCount > 1 ? "s" : ""}.`
                    : "Sélectionnez au moins une pièce pour continuer vers la prise de vue."}
                </p>
              </div>
              <Button
                onClick={handleContinue}
                disabled={selectedCount === 0}
                size="lg"
                className={cn(
                  "rounded-full px-8 py-4 text-xs uppercase tracking-[0.45em]",
                  selectedCount === 0
                    ? "cursor-not-allowed bg-foreground/15 text-foreground/40"
                    : "bg-gradient-to-r from-primary via-foreground to-black text-primary-foreground shadow-[0_30px_80px_-55px_rgba(58,43,28,0.65)] transition hover:opacity-95"
                )}
              >
                Lancer la prise de vue
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>
      </section>
    </ExperienceLayout>
  );
}
