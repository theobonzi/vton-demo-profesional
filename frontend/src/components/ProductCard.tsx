import { Check } from "lucide-react";

import { cn } from "@/lib/utils";

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
    <button
      type="button"
      onClick={() => onSelect(product.id)}
      className={cn(
        "group relative flex w-full flex-col overflow-hidden rounded-[24px] border border-white/35 bg-white/60 text-left transition-all duration-500 ease-out hover:-translate-y-1 hover:shadow-[0_35px_90px_-45px_rgba(58,43,28,0.55)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        isSelected && "border-primary/40 shadow-[0_45px_110px_-60px_rgba(58,43,28,0.7)]"
      )}
      aria-pressed={isSelected}
    >
      <span
        className="pointer-events-none absolute inset-0 bg-gradient-to-br from-white/70 via-transparent to-transparent opacity-0 transition-opacity duration-500 group-hover:opacity-80"
        aria-hidden
      />

      {isSelected && (
        <span className="absolute right-5 top-5 z-10 inline-flex items-center gap-2 rounded-full bg-primary/90 px-3 py-1 text-[10px] font-medium uppercase tracking-[0.4em] text-primary-foreground shadow-lg">
          <Check className="h-3.5 w-3.5" />
          Sélection
        </span>
      )}

      <div className="relative aspect-[3/4] overflow-hidden">
        <img
          src={product.image}
          alt={product.name}
          className="h-full w-full object-cover transition-transform duration-700 ease-out group-hover:scale-105"
        />
        <div
          className={cn(
            "pointer-events-none absolute inset-0 bg-gradient-to-t from-black/35 via-transparent to-transparent opacity-0 transition-opacity duration-500",
            isSelected && "opacity-70",
            !isSelected && "group-hover:opacity-70"
          )}
          aria-hidden
        />
      </div>

      <div className="relative px-6 py-6">
        <p className="text-[10px] uppercase tracking-[0.45em] text-foreground/50">Lookbook</p>
        <h3 className="mt-3 text-lg font-serif leading-tight text-foreground text-balance">
          {product.name}
        </h3>
        <p className="mt-2 text-sm text-foreground/70">{product.price}</p>
      </div>
    </button>
  );
}
