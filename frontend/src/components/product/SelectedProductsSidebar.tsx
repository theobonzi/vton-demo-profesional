import { Button } from "@/components/ui/button";

interface ProductConfig {
  id: number;
  name: string;
  price: string;
  displayImage: string;
}

interface SelectedProductsSidebarProps {
  productConfigs: ProductConfig[];
  onBack: () => void;
}

export function SelectedProductsSidebar({ productConfigs, onBack }: SelectedProductsSidebarProps) {
  return (
    <div className="bg-card rounded-lg p-6">
      <h3 className="text-xl font-medium text-foreground mb-6 text-center">
        Produits sélectionnés ({productConfigs?.length || 0})
      </h3>
      
      {productConfigs && productConfigs.length > 0 ? (
        <div className="space-y-4">
          {productConfigs.map((product) => (
            <div key={product.id} className="flex items-center gap-4 p-4 bg-surface-elevated rounded-lg">
              <div className="w-20 h-24 bg-surface-elevated rounded-lg overflow-hidden flex-shrink-0">
                <img
                  src={product.displayImage}
                  alt={product.name}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {product.name}
                </p>
                <p className="text-xs text-text-subtle">
                  {product.price}
                </p>
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="text-center py-12">
          <p className="text-muted-foreground mb-4">
            Aucun produit sélectionné
          </p>
          <Button
            variant="outline"
            onClick={onBack}
            className="mt-4"
          >
            Retourner aux produits
          </Button>
        </div>
      )}
    </div>
  );
}