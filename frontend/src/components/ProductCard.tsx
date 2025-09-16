import { Check } from "lucide-react";

interface Product {
  id: string;
  name: string;
  price: string;
  image: string;
}

interface ProductCardProps {
  product: Product;
  isSelected: boolean;
  onSelect: (productId: string) => void;
}

export function ProductCard({ product, isSelected, onSelect }: ProductCardProps) {
  return (
    <div
      onClick={() => onSelect(product.id)}
      className="relative cursor-pointer group transition-all duration-300"
    >
      {/* Selection indicator */}
      {isSelected && (
        <div className="absolute top-3 right-3 z-10">
          <Check className="w-5 h-5 text-foreground" />
        </div>
      )}

      {/* Product image */}
      <div className="aspect-[3/4] bg-surface-elevated overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />
      </div>

      {/* Product info */}
      <div className="bg-background p-4 space-y-1">
        <h3 className="font-medium text-foreground text-sm tracking-wide uppercase">
          {product.name}
        </h3>
        <p className="text-text-subtle text-sm font-light">{product.price}</p>
      </div>
    </div>
  );
}
