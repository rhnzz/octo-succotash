export type ApiErrorBody = {
  message?: string;
  errors?: Array<{ field?: string; message?: string }>;
};

export type ApiService = 'auth' | 'payment' | 'inventory' | 'orders';

export class ApiError extends Error {
  status: number;
  body: unknown;

  constructor(status: number, message: string, body: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.body = body;
  }
}

function getBaseUrlFor(service: ApiService): string {
  const envKeyByService: Record<ApiService, string> = {
    auth: 'NEXT_PUBLIC_AUTH_SERVICE_URL',
    payment: 'NEXT_PUBLIC_PAYMENT_SERVICE_URL',
    inventory: 'NEXT_PUBLIC_INVENTORY_SERVICE_URL',
    orders: 'NEXT_PUBLIC_ORDER_SERVICE_URL',
  };

  const envKey = envKeyByService[service];
  const baseUrl = process.env[envKey];
  if (!baseUrl) {
    throw new Error(`Konfigurasi API ${service} belum tersedia (butuh ${envKey}).`);
  }

  return String(baseUrl);
}

async function tryReadJson(response: Response): Promise<unknown | null> {
  const contentType = response.headers.get('content-type') ?? '';
  if (!contentType.toLowerCase().includes('application/json')) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

export async function apiFetchFrom<T>(
  service: ApiService,
  endpoint: string,
  options?: RequestInit
): Promise<T> {
  const baseUrl = getBaseUrlFor(service);
  const res = await fetch(`${baseUrl}${endpoint}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await tryReadJson(res);
    const maybeBody = body as ApiErrorBody | null;
    const message = maybeBody?.message ?? `Request gagal (HTTP ${res.status}).`;
    throw new ApiError(res.status, message, body);
  }

  const body = await tryReadJson(res);
  return body as T;
}

export async function appFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  const res = await fetch(endpoint, {
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...options,
  });

  if (!res.ok) {
    const body = await tryReadJson(res);
    const maybeBody = body as ApiErrorBody | null;
    const message = maybeBody?.message ?? `Request gagal (HTTP ${res.status}).`;
    throw new ApiError(res.status, message, body);
  }

  const body = await tryReadJson(res);
  return body as T;
}

// Backward-compatible default: auth service
export async function apiFetch<T>(endpoint: string, options?: RequestInit): Promise<T> {
  return apiFetchFrom<T>('auth', endpoint, options);
}

// Convenience helpers for pages
export const authFetch = <T>(endpoint: string, options?: RequestInit) => apiFetchFrom<T>('auth', endpoint, options);
export const paymentFetch = <T>(endpoint: string, options?: RequestInit) =>
  apiFetchFrom<T>('payment', endpoint, options);
export const inventoryFetch = <T>(endpoint: string, options?: RequestInit) =>
  apiFetchFrom<T>('inventory', endpoint, options);
export const ordersFetch = <T>(endpoint: string, options?: RequestInit) => apiFetchFrom<T>('orders', endpoint, options);
