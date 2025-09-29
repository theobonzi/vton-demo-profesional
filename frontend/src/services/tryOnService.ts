import api from './api';

export interface ProductInfo {
  id: number;
  name: string;
  price: string;
  image_url: string;
}

export interface TryOnRequest {
  person_image_url: string;
  product_ids: number[];
  products_info?: ProductInfo[];
  session_id?: string;
}

export interface TryOnResult {
  product_id: number;
  product_name: string;
  result_image?: string;
  error?: string;
  status: 'success' | 'failed';
}

export interface TryOnResponse {
  session_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  message: string;
  results?: Record<string, TryOnResult>;
  error_message?: string;
}

export interface TryOnSessionResponse {
  session_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  results?: Record<string, TryOnResult>;
  message: string;
  error_message?: string;
}

export async function createTryOn(request: TryOnRequest): Promise<TryOnResponse> {
  const response = await api.post('/tryon/', request);
  return response.data;
}

export async function getTryOnStatus(sessionId: string): Promise<TryOnSessionResponse> {
  const response = await api.get(`/tryon/${sessionId}/status/`);
  return response.data;
}

export async function waitForTryOnCompletion(
  sessionId: string, 
  maxAttempts: number = 30, 
  delayMs: number = 3000
): Promise<TryOnSessionResponse> {
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const status = await getTryOnStatus(sessionId);
    
    if (status.status === 'completed' || status.status === 'failed') {
      return status;
    }
    
    await new Promise(resolve => setTimeout(resolve, delayMs));
  }
  
  throw new Error('Timeout: Essayage virtuel non terminé dans le délai imparti');
}

export interface SummaryItemPayload {
  product_id: number;
  name: string;
  price?: string;
  brand?: string;
  image_url?: string;
  result_image_url?: string;
}

export async function sendSummaryEmail(email: string, sessionId: string | undefined, items: SummaryItemPayload[]) {
  const response = await api.post('/tryon/send-summary', {
    email,
    session_id: sessionId,
    items,
  });
  return response.data as { status: string; message: string };
}
