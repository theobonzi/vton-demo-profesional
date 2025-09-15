import api from './api';
import { Product, ProductFilters } from '@/types';

// Récupérer la liste des produits avec filtres
export async function getProducts(filters: ProductFilters = {}): Promise<Product[]> {
  const response = await api.get('/products', { params: filters });
  return response.data;
}

// Récupérer un produit par ID
export async function getProduct(id: number): Promise<Product> {
  const response = await api.get(`/products/${id}`);
  return response.data;
}

// Récupérer la liste des marques
export async function getBrands(): Promise<string[]> {
  const response = await api.get('/products/brands');
  return response.data;
}

// Récupérer la liste des catégories
export async function getCategories(): Promise<string[]> {
  const response = await api.get('/products/categories');
  return response.data;
}

// Créer un nouveau produit (admin)
export async function createProduct(product: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
  const response = await api.post('/products', product);
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
