import { useEffect, useRef, useState } from "react";
import { ProductCard } from "@/components/ProductCard";
import { Button } from "@/components/ui/button";
import { ArrowRight, Loader2 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { useProductStore } from "@/store/useProductStore";
import { useAuthStore } from "@/store/useAuthStore";
import { Link } from "react-router-dom";

export default function ProductSelection() {
  const [selectedProducts, setSelectedProducts] = useState<number[]>([]);
  const navigate = useNavigate();
  const hasLoadedBrands = useRef(false);
  const hasAppliedDefaultBrand = useRef(false);
  const lastFetchSignature = useRef<string | null>(null);
  
  // Récupérer la marque par défaut depuis les variables d'environnement
  const defaultBrand = import.meta.env.VITE_DEFAULT_BRAND || '';
  
  const { 
    products, 
    brands, 
    loading, 
    error, 
    fetchProducts, 
    fetchBrands,
    filters,
    setFilters 
  } = useProductStore();

  // Charger les données au montage du composant
  useEffect(() => {
    if (hasLoadedBrands.current) {
      return;
    }

    hasLoadedBrands.current = true;

    const loadBrands = async () => {
      try {
        await fetchBrands();
      } catch (err) {
        console.error('Erreur lors du chargement des marques:', err);
      }
    };

    loadBrands();
  }, [fetchBrands]);

  // Appliquer la marque par défaut si elle est définie
  useEffect(() => {
    if (!defaultBrand || brands.length === 0 || hasAppliedDefaultBrand.current) {
      return;
    }

    const brandExists = brands.some(brand => brand.name === defaultBrand);
    if (brandExists) {
      lastFetchSignature.current = null;
      setFilters({ brand: defaultBrand });
    } else {
      console.warn(`Marque "${defaultBrand}" non trouvée dans la liste des marques disponibles`);
    }

    hasAppliedDefaultBrand.current = true;
  }, [defaultBrand, brands, setFilters]);

  // Recharger les produits quand les filtres changent
  useEffect(() => {
    if (brands.length === 0) {
      return;
    }

    const defaultBrandExists = defaultBrand
      ? brands.some(brand => brand.name === defaultBrand)
      : false;

    if (defaultBrandExists && !filters.brand) {
      return;
    }

    const signature = JSON.stringify({
      brand: filters.brand ?? null,
      category: filters.category ?? null,
      limit: filters.limit ?? null,
      skip: filters.skip ?? null,
    });

    if (lastFetchSignature.current === signature) {
      return;
    }

    lastFetchSignature.current = signature;

    fetchProducts().catch((err) => {
      console.error('Erreur lors du chargement des produits:', err);
    });
  }, [brands, defaultBrand, filters.brand, filters.category, filters.limit, filters.skip, fetchProducts]);

  const handleProductSelect = (productId: number) => {
    setSelectedProducts(prev =>
      prev.includes(productId)
        ? prev.filter(id => id !== productId)
        : [...prev, productId]
    );
  };

  const handleContinue = async () => {
    if (selectedProducts.length > 0) {
      const picked = products.filter(p => selectedProducts.includes(p.id));

      // Préparer les configurations des produits
      const productConfigs = picked.map((p) => ({
        id: p.id,
        name: p.name,
        brand: p.brand,
        price: `${p.price.toFixed(2)} €`,
        displayImage: p.image_url,
        apiImage: p.api_image_url || p.image_url,
      }));

      navigate("/selfie-capture", {
        state: { 
          selectedProducts,
          productConfigs,
        }
      });
    }
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border">
        <div className="max-w-7xl mx-auto px-6 py-6">
          {/* Top row with title */}
          <div className="flex items-center justify-between gap-4 mb-4">
            <div>
              <h1 className="text-2xl font-light tracking-wider text-foreground">
                démo
              </h1>
              <p className="text-text-subtle text-sm mt-1 font-light">
                Essayage Virtuel
                {defaultBrand && (
                  <span className="ml-2 text-primary">• {defaultBrand}</span>
                )}
              </p>
            </div>
          </div>

          {/* Second row with filters */}
          <div className="flex items-center justify-between gap-4">
            {/* Brand tabs - seulement affichés si aucune marque spécifique n'est choisie */}
            {!defaultBrand && (
              <Tabs
                value={filters.brand || "all"}
                onValueChange={(v) => {
                  lastFetchSignature.current = null;
                  setFilters({ brand: v === "all" ? undefined : v });
                }}
              >
                <TabsList>
                  <TabsTrigger value="all">Toutes</TabsTrigger>
                  {brands.map(brand => (
                    <TabsTrigger key={brand.id} value={brand.name}>
                      {brand.name}
                    </TabsTrigger>
                  ))}
                </TabsList>
              </Tabs>
            )}

            {/* Si une marque spécifique est choisie, afficher juste le nom de la marque */}
            {defaultBrand && (
              <div className="flex items-center gap-2 px-3 py-2 bg-primary/10 rounded-md">
                <span className="text-sm font-medium text-primary">{defaultBrand}</span>
              </div>
            )}

            {/* Gender toggle group */}
            <ToggleGroup 
              type="single" 
              value={filters.gender || "all"} 
              onValueChange={(v) => setFilters({ gender: v === "all" ? undefined : v as 'men' | 'women' | 'unisex' })}
            >
              <ToggleGroupItem value="all" aria-label="Tous">Tous</ToggleGroupItem>
              <ToggleGroupItem value="women" aria-label="Femme">Femme</ToggleGroupItem>
              <ToggleGroupItem value="men" aria-label="Homme">Homme</ToggleGroupItem>
            </ToggleGroup>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-12">
        {/* Instructions */}
        <div className="mb-12 text-center">
          <h2 className="text-3xl font-light text-foreground mb-4 tracking-wide">
            Sélectionnez vos pièces
          </h2>
          <p className="text-text-subtle font-light max-w-lg mx-auto">
            {defaultBrand ? (
              <>Choisissez les vêtements <strong>{defaultBrand}</strong> que vous souhaitez essayer.</>
            ) : (
              <>Choisissez les vêtements que vous souhaitez essayer.</>
            )}
            <br />
            Vous pouvez sélectionner plusieurs pièces.
          </p>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="flex justify-center items-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
            <span className="ml-2 text-muted-foreground">Chargement du catalogue...</span>
          </div>
        )}

        {/* Error state */}
        {error && !loading && (
          <div className="text-center py-12">
            <p className="text-red-500 mb-4">{error}</p>
            <Button 
              onClick={() => window.location.reload()} 
              variant="outline"
            >
              Réessayer
            </Button>
          </div>
        )}

        {/* Products grid */}
        {!loading && !error && (
          <>
            {products.length === 0 ? (
              <div className="text-center py-12">
                <p className="text-muted-foreground">
                  {defaultBrand 
                    ? `Aucun produit trouvé pour la marque ${defaultBrand}.`
                    : "Aucun produit trouvé pour cette sélection."
                  }
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6 mb-12">
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
                    onSelect={(id) => handleProductSelect(parseInt(id))}
                  />
                ))}
              </div>
            )}
          </>
        )}

        {/* Continue button */}
        <div className="flex justify-center">
          <Button
            onClick={handleContinue}
            disabled={selectedProducts.length === 0}
            size="lg"
            className={cn(
              "px-8 py-3 font-light tracking-wider",
              "transition-all duration-300",
              selectedProducts.length > 0
                ? "opacity-100 scale-100"
                : "opacity-50 scale-95 cursor-not-allowed"
            )}
          >
            Continuer ({selectedProducts.length})
            <ArrowRight className="ml-2 w-4 h-4" />
          </Button>
        </div>

        {/* Auth CTA */}
        {!useAuthStore.getState().isAuthenticated && (
          <div className="mt-10 text-center text-sm text-muted-foreground">
            Vous avez un compte ?
            <Link to="/login" className="ml-1 underline">Se connecter</Link>
            {' '}•{' '}
            <Link to="/register" className="underline">Créer un compte</Link>
          </div>
        )}
      </main>
    </div>
  );
}
