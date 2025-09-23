import { create } from 'zustand';
import { Product, ProductFilters } from '@/types';
import { getProducts, getBrands } from '@/services/productService';

interface ProductState {
  allProducts: Product[];
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

const DEFAULT_LIMIT = 200;

const applyFilters = (products: Product[], filters: ProductFilters): Product[] => {
  const { gender } = filters;

  if (!gender || gender === 'all') {
    return products;
  }

  const normalizedGender = gender.toLowerCase();

  return products.filter((product) => {
    const productGender = (product.gender || '').toLowerCase();

    if (normalizedGender === 'women') {
      return productGender === 'women' || productGender === 'unisex';
    }

    if (normalizedGender === 'men') {
      return productGender === 'men' || productGender === 'unisex';
    }

    return true;
  });
};

export const useProductStore = create<ProductStore>((set, get) => ({
  // État initial
  allProducts: [],
  products: [],
  brands: [],
  filters: { limit: DEFAULT_LIMIT },
  loading: false,
  error: null,

  // Actions
  fetchProducts: async () => {
    set({ loading: true, error: null });
    try {
      const currentFilters = get().filters;
      const { gender: _ignoredGender, ...apiFilters } = currentFilters;
      const filtersPayload: ProductFilters = {
        ...apiFilters,
        limit: apiFilters.limit ?? DEFAULT_LIMIT,
      };

      const products = await getProducts(filtersPayload);
      set((state) => ({
        allProducts: products,
        products: applyFilters(products, state.filters),
        loading: false,
      }));
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
    set((state) => {
      const updatedFilters: ProductFilters = { ...state.filters, ...filters };

      const brandChanged = filters.brand !== undefined && filters.brand !== state.filters.brand;

      if (brandChanged) {
        return {
          filters: updatedFilters,
          allProducts: [],
          products: [],
          loading: true,
          error: null,
        };
      }

      return {
        filters: updatedFilters,
        products: applyFilters(state.allProducts, updatedFilters),
      };
    });
  },
}));
