import api from './api';
import { Product, ProductFilters } from '@/types';

// Images par défaut depuis save_images2
const getDefaultProducts = (): Product[] => {
  const products: Product[] = [];
  for (let i = 0; i <= 100; i++) {
    const imageUrl = `/src/save_images2/img_${i.toString().padStart(3, '0')}_0568.png`;
    const tryOnUrl = `/src/save_images2/img_${i.toString().padStart(3, '0')}_1024_out.png`;
    
    products.push({
      id: i + 1000, // Éviter les conflits avec Supabase
      name: `Produit ${i + 1}`,
      brand: 'Demo',
      category: 'tops',
      price: 49.99 + (i % 10) * 10,
      description: `Vêtement de démonstration ${i + 1}`,
      image_url: imageUrl,
      api_image_url: tryOnUrl,
      gender: i % 3 === 0 ? 'women' : i % 3 === 1 ? 'men' : 'unisex',
      is_active: true,
      created_at: new Date().toISOString()
    });
  }
  return products;
};

// Récupérer la liste des produits avec filtres
export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  try {
    // const response = await api.get('/products/', { params: filters });
    // return response.data;
    return getDefaultProducts();
  } catch (error) {
    console.warn('Supabase échoué, utilisation des images par défaut:', error);
    return getDefaultProducts();
  }
}

// Récupérer un produit par ID
export async function getProduct(id: number): Promise<Product> {
  const response = await api.get(`/products/${id}`);
  return response.data;
}

// Récupérer la liste des marques
export async function getBrands(): Promise<string[]> {
  const response = await api.get('/products/brands/');
  return response.data;
}

// Récupérer la liste des catégories
export async function getCategories(): Promise<string[]> {
  const response = await api.get('/products/categories/');
  return response.data;
}

// Créer un nouveau produit (admin)
export async function createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  const response = await api.post('/products/', product);
  return response.data;
}

// Service par défaut pour la compatibilité
export const productService = {
  getProducts,
  getProduct,
  getBrands,
  getCategories,
  createProduct,
};
