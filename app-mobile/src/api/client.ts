import { API_CONFIG } from '@/utils/constants';
import { authStore } from '@/stores/authStore';

export class ApiError extends Error {
  public status: number;
  public data: unknown;

  constructor(status: number, message: string, data?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }

  /** Serveur injoignable ou délai dépassé : seul cas où le mode hors-ligne prend le relais */
  get isNetworkError(): boolean {
    return this.status === 0 || this.status === 408;
  }

  get isDeviceBlocked(): boolean {
    const details = (this.data as { details?: { code?: string } } | null)?.details;
    return this.status === 403 && details?.code === 'DEVICE_BLOCKED';
  }
}

interface ApiOptions extends RequestInit {
  /** false pour les endpoints publics (login, refresh, activation) */
  auth?: boolean;
}

async function rawRequest<T>(endpoint: string, options: ApiOptions, token: string | null): Promise<T> {
  const { deviceKey } = authStore.getState();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...(deviceKey ? { 'x-device-key': deviceKey } : {}),
    ...(options.headers as Record<string, string>),
  };

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), API_CONFIG.TIMEOUT_MS);

  const url = endpoint.startsWith('http') ? endpoint : `${API_CONFIG.BASE_URL}${endpoint}`;

  try {
    const res = await fetch(url, { ...options, headers, signal: controller.signal });
    const data = await res.json().catch(() => null);

    if (!res.ok) {
      throw new ApiError(
        res.status,
        (data && (data.message || data.error)) || `Erreur HTTP ${res.status}`,
        data
      );
    }

    return data as T;
  } catch (err: unknown) {
    if (err instanceof ApiError) throw err;
    const isAbort = (err as Error)?.name === 'AbortError';
    throw new ApiError(
      isAbort ? 408 : 0,
      isAbort ? 'Délai d’attente dépassé (timeout).' : 'Impossible de contacter le serveur.'
    );
  } finally {
    clearTimeout(timeoutId);
  }
}

// Un seul rafraîchissement à la fois, partagé par toutes les requêtes en 401
let refreshInFlight: Promise<boolean> | null = null;

async function refreshSession(): Promise<boolean> {
  const { refreshToken } = authStore.getState();
  if (!refreshToken) return false;

  if (!refreshInFlight) {
    refreshInFlight = (async () => {
      try {
        const tokens = await rawRequest<{ accessToken: string; refreshToken: string }>(
          '/auth/refresh',
          { method: 'POST', body: JSON.stringify({ refreshToken }) },
          null
        );
        await authStore.getState().setTokens(tokens.accessToken, tokens.refreshToken);
        return true;
      } catch (err) {
        // Refresh refusé par le serveur : la session est terminée.
        // Sur simple coupure réseau, on garde la session pour continuer hors-ligne.
        if (err instanceof ApiError && !err.isNetworkError) {
          await authStore.getState().logout();
        }
        return false;
      } finally {
        refreshInFlight = null;
      }
    })();
  }

  return refreshInFlight;
}

export async function apiClient<T>(endpoint: string, options: ApiOptions = {}): Promise<T> {
  const { auth = true, ...requestOptions } = options;

  if (!auth) {
    return rawRequest<T>(endpoint, requestOptions, null);
  }

  try {
    return await rawRequest<T>(endpoint, requestOptions, authStore.getState().accessToken);
  } catch (err) {
    if (!(err instanceof ApiError) || err.status !== 401) throw err;

    // Token d'accès expiré : on le renouvelle une fois puis on rejoue la requête
    const refreshed = await refreshSession();
    if (!refreshed) throw err;

    return rawRequest<T>(endpoint, requestOptions, authStore.getState().accessToken);
  }
}
