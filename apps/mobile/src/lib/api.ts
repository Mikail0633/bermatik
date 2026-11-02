import Constants from 'expo-constants';

// Uygulama yalnızca sitenin /api uç noktalarıyla konuşur (HTTPS). Veritabanına doğrudan erişim YOKTUR.
export const API_URL: string = String(Constants.expoConfig?.extra?.apiUrl ?? '').replace(/\/$/, '');

/** Sitedeki fotoğraf yolu (veritabanında "foto/abc.webp", sitede "/uploads/foto/abc.webp") → tam adres */
export const imageUrl = (p: string | null | undefined) =>
  p ? (/^https?:/.test(p) ? p : p.startsWith('/') ? `${API_URL}${p}` : `${API_URL}/uploads/${p}`) : null;

export class ApiError extends Error {
  constructor(message: string, public status: number) {
    super(message);
  }
}

let token: string | null = null;
let onUnauthorized: (() => void) | null = null;
export const setApiToken = (t: string | null) => { token = t; };
export const setUnauthorizedHandler = (fn: (() => void) | null) => { onUnauthorized = fn; };

type Opts = { method?: 'GET' | 'POST' | 'DELETE'; body?: unknown; auth?: boolean; timeoutMs?: number };

export async function api<T>(path: string, { method = 'GET', body, auth = true, timeoutMs = 20_000 }: Opts = {}): Promise<T> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}),
        ...(auth && token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: body !== undefined ? JSON.stringify(body) : undefined,
      signal: ctrl.signal,
    });
  } catch {
    throw new ApiError('Bermatik\'e ulaşılamadı. İnternet bağlantınızı kontrol edin.', 0);
  } finally {
    clearTimeout(timer);
  }
  const data = await res.json().catch(() => null);
  if (!res.ok) {
    if (res.status === 401 && auth && token) onUnauthorized?.();
    throw new ApiError((data && typeof data.error === 'string' && data.error) || 'Bir sorun oluştu. Lütfen tekrar deneyin.', res.status);
  }
  return data as T;
}

export const errorText = (e: unknown) => (e instanceof Error ? e.message : 'Bir sorun oluştu.');
