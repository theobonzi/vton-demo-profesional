// Types pour les produits
export interface Product {
  id: number;
  name: string;
  brand: string;
  category: string;
  price: number;
  description?: string;
  image_url: string;
  api_image_url: string;
  gender: string;
  is_active: boolean;
  created_at: string;
}

// Types pour les utilisateurs
export interface User {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  created_at: string;
}

export interface UserCreate {
  email: string;
  username: string;
  password: string;
}

export interface UserLogin {
  email: string;
  password: string;
}

export interface Token {
  access_token: string;
  token_type: string;
}

export interface ProductInfoSummary {
  id: number;
  name: string;
  price: string;
  image_url: string;
  description?: string;
}

// Types pour les essayages virtuels
export interface TryOnRequest {
  person_image_url: string;
  product_ids: number[];
  session_id?: string;
  products_info?: ProductInfoSummary[];
  email?: string;
}

export interface TryOnResult {
  product_id: number;
  product_name: string;
  product_description?: string;
  product_price?: string;
  result_image?: string;
  error?: string;
  status: 'success' | 'failed';
}

export interface TryOnResponse {
  session_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: Record<string, TryOnResult>;
  error_message?: string;
}

export interface TryOnSession {
  id: number;
  session_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: Record<string, TryOnResult>;
  error_message?: string;
  created_at: string;
  updated_at?: string;
}

// Types pour les filtres
export interface ProductFilters {
  brand?: string;
  category?: string;
  gender?: string;
  limit?: number;
  skip?: number;
}

// Types pour l'état de l'application
export interface AppState {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  error: string | null;
}

// Types pour les produits sélectionnés
export interface SelectedProduct {
  id: number;
  name: string;
  brand: string;
  image_url: string;
  api_image_url: string;
}
