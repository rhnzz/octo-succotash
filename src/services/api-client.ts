/**
 * Base API client with error normalization.
 *
 * Two error shapes exist across the four backend services:
 *  - Auth / Inventory / Order: { success, message, data, errors }
 *  - Payment: RFC 9457 Problem Details { type, title, status, detail, instance, ...extra }
 *
 * This client detects which shape to use based on the `errorShape` parameter and
 * normalizes all errors into a single `ApiError` before throwing.
 */

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ApiErrorShape = 'envelope' | 'problem-details';

/** Normalized error thrown by all service functions. */
export class ApiError extends Error {
  readonly status: number;
  readonly field?: string;
  readonly extra?: Record<string, unknown>;

  constructor(
      status: number,
      message: string,
      field?: string,
      extra?: Record<string, unknown>
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.field = field;
    this.extra = extra;
  }
}

export function isApiError(error: unknown): error is ApiError {
  return error instanceof ApiError;
}

// ---------------------------------------------------------------------------
// Internal response shapes
// ---------------------------------------------------------------------------

type EnvelopeError = {
  success: false;
  message?: string;
  errors?: Array<{ field?: string; error?: string; message?: string }>;
};

type ProblemDetailsError = {
  status?: number;
  detail?: string;
  title?: string;
  [key: string]: unknown;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function tryReadJson(res: Response): Promise<unknown> {
  const ct = res.headers.get('content-type') ?? '';
  if (!ct.toLowerCase().includes('application/json')) return null;
  try {
    return await res.json();
  } catch {
    return null;
  }
}

function normalizeEnvelopeError(status: number, body: unknown): ApiError {
  const b = body as EnvelopeError | null;
  const firstError = b?.errors?.[0];
  const field = firstError?.field ?? undefined;
  const message =
      firstError?.message ??
      firstError?.error ??
      b?.message ??
      `Request failed (HTTP ${status}).`;
  return new ApiError(status, message, field);
}

function normalizeProblemDetailsError(status: number, body: unknown): ApiError {
  const b = body as ProblemDetailsError | null;
  const httpStatus = b?.status ?? status;
  const message = b?.detail ?? b?.title ?? `Request failed (HTTP ${httpStatus}).`;

  // Collect extra fields (everything except the standard Problem Details keys)
  const standardKeys = new Set(['type', 'title', 'status', 'detail', 'instance']);
  const extra: Record<string, unknown> = {};
  if (b) {
    for (const [k, v] of Object.entries(b)) {
      if (!standardKeys.has(k)) extra[k] = v;
    }
  }

  return new ApiError(httpStatus, message, undefined, Object.keys(extra).length ? extra : undefined);
}

// ---------------------------------------------------------------------------
// Core fetch function
// ---------------------------------------------------------------------------

export type ApiRequestOptions = {
  /** Base URL for the target service (from env var). */
  baseUrl: string;
  /** Endpoint path, e.g. '/auth/login'. */
  path: string;
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** JWT access token — adds Authorization: Bearer header when provided. */
  token?: string;
  /** Additional headers to merge in. */
  headers?: Record<string, string>;
  /**
   * Which error shape the target service uses.
   * - 'envelope'         → { success, message, data } (Auth, Inventory, Order)
   * - 'problem-details'  → RFC 9457 (Payment)
   */
  errorShape: ApiErrorShape;
};

export async function apiRequest<T>(options: ApiRequestOptions): Promise<T> {
  const {
    baseUrl,
    path,
    method = 'GET',
    body,
    token,
    headers: extraHeaders = {},
    errorShape,
  } = options;

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...extraHeaders,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${baseUrl}${path}`, {
    method,
    headers,
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });

  const responseBody = await tryReadJson(res);

  if (!res.ok) {
    if (errorShape === 'problem-details') {
      throw normalizeProblemDetailsError(res.status, responseBody);
    } else {
      throw normalizeEnvelopeError(res.status, responseBody);
    }
  }

  // For envelope responses, unwrap the `data` field if present
  if (errorShape === 'envelope' && responseBody !== null && typeof responseBody === 'object') {
    const env = responseBody as { data?: T };
    if ('data' in env) return env.data as T;
  }

  return responseBody as T;
}

// ---------------------------------------------------------------------------
// Per-service convenience factories
// ---------------------------------------------------------------------------

type ServiceRequestOptions = Omit<ApiRequestOptions, 'baseUrl' | 'errorShape' | 'path'>;

export function authRequest<T>(path: string, options: ServiceRequestOptions): Promise<T> {
  const isClient = typeof window !== 'undefined';
  const baseUrl = isClient ? '/api/auth' : process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
  if (!baseUrl) throw new Error('AUTH_SERVICE_URL is not set.');

  return apiRequest<T>({ ...options, baseUrl, path, errorShape: 'envelope' });
}

export function inventoryRequest<T>(path: string, options: ServiceRequestOptions): Promise<T> {
  const isClient = typeof window !== 'undefined';
  const baseUrl = isClient ? '/api/inventory' : process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL;
  if (!baseUrl) throw new Error('INVENTORY_SERVICE_URL is not set.');

  return apiRequest<T>({ ...options, baseUrl, path, errorShape: 'envelope' });
}

export function orderRequest<T>(path: string, options: ServiceRequestOptions): Promise<T> {
  const isClient = typeof window !== 'undefined';
  const baseUrl = isClient ? '/api/order' : process.env.NEXT_PUBLIC_ORDER_SERVICE_URL;
  if (!baseUrl) throw new Error('ORDER_SERVICE_URL is not set.');

  return apiRequest<T>({ ...options, baseUrl, path, errorShape: 'envelope' });
}

export function paymentRequest<T>(path: string, options: ServiceRequestOptions): Promise<T> {
  const isClient = typeof window !== 'undefined';
  const baseUrl = isClient ? '/api/payment' : process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL;
  if (!baseUrl) throw new Error('PAYMENT_SERVICE_URL is not set.');

  return apiRequest<T>({ ...options, baseUrl, path, errorShape: 'problem-details' });
}

// ---------------------------------------------------------------------------
// Spec-required aliases
// ---------------------------------------------------------------------------

export type ApiService = 'auth' | 'payment' | 'inventory' | 'orders';

/**
 * Base fetch helper — selects the correct base URL and error shape by service name.
 * Matches the `apiFetchFrom(service, path, options)` contract from the spec.
 */
export function apiFetchFrom<T>(
    service: ApiService,
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      token?: string;
      headers?: Record<string, string>;
    }
): Promise<T> {
  let baseUrl: string | undefined;
  let errorShape: ApiErrorShape;

  const isClient = typeof window !== 'undefined';

  switch (service) {
    case 'auth':
      baseUrl = isClient ? '/api/auth' : process.env.NEXT_PUBLIC_AUTH_SERVICE_URL;
      errorShape = 'envelope';
      break;
    case 'payment':
      baseUrl = isClient ? '/api/payment' : process.env.NEXT_PUBLIC_PAYMENT_SERVICE_URL;
      errorShape = 'problem-details';
      break;
    case 'inventory':
      baseUrl = isClient ? '/api/inventory' : process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL;
      errorShape = 'envelope';
      break;
    case 'orders':
      // Mengarah ke rewrite /api/order yang sudah lu setup
      baseUrl = isClient ? '/api/order' : process.env.NEXT_PUBLIC_ORDER_SERVICE_URL;
      errorShape = 'envelope';
      break;
    default:
      throw new Error(`Unknown service: ${service}`);
  }

  if (!baseUrl) {
    throw new Error(`Environment variable for service ${service} is not set.`);
  }

  return apiRequest<T>({
    baseUrl,
    path,
    method: (options?.method as ApiRequestOptions['method']) ?? 'GET',
    body: options?.body,
    token: options?.token,
    headers: options?.headers,
    errorShape,
  });
}

/**
 * Fetch helper for internal Next.js BFF routes.
 * Uses `credentials: 'include'` so the browser sends the HttpOnly refresh_token cookie.
 * Does NOT prepend a service base URL — `path` must be an absolute path like `/api/auth/login`.
 */
export async function appFetch<T>(
    path: string,
    options?: {
      method?: string;
      body?: unknown;
      headers?: Record<string, string>;
    }
): Promise<T> {
  const res = await fetch(path, {
    method: options?.method ?? 'GET',
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers ?? {}),
    },
    ...(options?.body !== undefined ? { body: JSON.stringify(options.body) } : {}),
  });

  const responseBody = await res.json().catch(() => null);

  if (!res.ok) {
    const b = responseBody as { message?: string } | null;
    throw new ApiError(res.status, b?.message ?? `Request failed (HTTP ${res.status}).`);
  }

  return responseBody as T;
}

/** Convenience wrapper — Auth service */
export const authFetch = <T>(
    path: string,
    opts?: Parameters<typeof apiFetchFrom>[2]
): Promise<T> => apiFetchFrom<T>('auth', path, opts);

/** Convenience wrapper — Payment service */
export const paymentFetch = <T>(
    path: string,
    opts?: Parameters<typeof apiFetchFrom>[2]
): Promise<T> => apiFetchFrom<T>('payment', path, opts);

/** Convenience wrapper — Inventory service */
export const inventoryFetch = <T>(
    path: string,
    opts?: Parameters<typeof apiFetchFrom>[2]
): Promise<T> => apiFetchFrom<T>('inventory', path, opts);

/** Convenience wrapper — Orders service */
export const ordersFetch = <T>(
    path: string,
    opts?: Parameters<typeof apiFetchFrom>[2]
): Promise<T> => apiFetchFrom<T>('orders', path, opts);