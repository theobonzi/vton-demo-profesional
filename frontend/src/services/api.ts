import axios, { AxiosInstance, AxiosResponse } from 'axios';
import { toast } from 'sonner';

// Configuration de base d'Axios
const api: AxiosInstance = axios.create({
  baseURL: '/api/v1',
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Intercepteur pour ajouter le token d'authentification
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Intercepteur pour gérer les réponses et erreurs
api.interceptors.response.use(
  (response: AxiosResponse) => {
    return response;
  },
  (error) => {
    if (error.response?.status === 401) {
      // Token expiré ou invalide
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.location.href = '/login';
    } else if (error.response?.status >= 500) {
      toast.error('Erreur serveur. Veuillez réessayer plus tard.');
    } else if (error.response?.data?.detail) {
      toast.error(error.response.data.detail);
    } else {
      toast.error('Une erreur est survenue');
    }
    return Promise.reject(error);
  }
);

export default api;
