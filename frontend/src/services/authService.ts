import api from './api';
import { User, UserCreate, UserLogin, Token } from '@/types';

// Inscription
export async function register(userData: UserCreate): Promise<User> {
  const response = await api.post('/auth/register', userData);
  return response.data;
}

// Connexion
export async function login(credentials: UserLogin): Promise<Token> {
  const formData = new FormData();
  formData.append('username', credentials.email);
  formData.append('password', credentials.password);

  const response = await api.post('/auth/login', formData, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });
  return response.data;
}

// Récupérer les informations de l'utilisateur connecté
export async function getCurrentUser(): Promise<User> {
  const response = await api.get('/auth/me');
  return response.data;
}

// Déconnexion (côté client)
export function logout(): void {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

// Vérifier si l'utilisateur est connecté
export function isAuthenticated(): boolean {
  return !!localStorage.getItem('token');
}

// Obtenir le token
export function getToken(): string | null {
  return localStorage.getItem('token');
}

// Sauvegarder le token et les données utilisateur
export function saveAuthData(token: string, user: User): void {
  localStorage.setItem('token', token);
  localStorage.setItem('user', JSON.stringify(user));
}

// Récupérer les données utilisateur sauvegardées
export function getSavedUser(): User | null {
  const userData = localStorage.getItem('user');
  return userData ? JSON.parse(userData) : null;
}

// Service par défaut pour la compatibilité
export const authService = {
  register,
  login,
  getCurrentUser,
  logout,
  isAuthenticated,
  getToken,
  saveAuthData,
  getSavedUser,
};
