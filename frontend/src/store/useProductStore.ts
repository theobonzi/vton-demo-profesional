import { create } from 'zustand';
import { Product, ProductFilters } from '@/types';
import { getProducts, getBrands } from '@/services/productService';

interface ProductState {
  products: Product[];
  brands: { id: string; name: string }[];
  filters: ProductFilters;
  loading: boolean;
  error: string | null;
}

interface ProductActions {
  fetchProducts: () => Promise<void>;
  fetchBrands: () => Promise<void>;
  setFilters: (filters: Partial<ProductFilters>) => void;
}

type ProductStore = ProductState & ProductActions;

export const useProductStore = create<ProductStore>((set, get) => ({
  // État initial
  products: [],
  brands: [],
  filters: {},
  loading: false,
  error: null,

  // Actions
  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const currentFilters = get().filters;
      const products = await getProducts(currentFilters);
      set({
        products,
        loading: false,
      });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Erreur lors du chargement des produits',
        loading: false,
      });
    }
  },

  fetchBrands: async () => {
    try {
      const brands = await getBrands();
      // Convertir les strings en objets avec id et name
      const brandObjects = brands.map((name, index) => ({ id: `brand-${index}`, name }));
      set({ brands: brandObjects });
    } catch (error) {
      console.error('Erreur lors du chargement des marques:', error);
      set({ brands: [] });
    }
  },

  setFilters: (filters: Partial<ProductFilters>) => {
    set({ filters: { ...get().filters, ...filters } });
  },
}));
