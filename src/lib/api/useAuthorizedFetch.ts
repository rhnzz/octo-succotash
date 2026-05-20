'use client';

/**
 * useAuthorizedFetch — TASK-115
 *
 * A hook that wraps service requests with automatic Bearer token attachment
 * and transparent 401 retry with token refresh.
 *
 * Behaviour:
 * 1. Attaches `Authorization: Bearer <accessToken>` to every request.
 * 2. On 401 response, calls POST /api/auth/refresh-token (BFF) once.
 * 3. If refresh succeeds, stores the new token in AuthProvider context and
 *    retries the original request with the new token.
 * 4. If refresh fails (token revoked / expired), clears auth state and
 *    redirects the user to /login.
 * 5. Concurrent 401s share a single in-flight refresh promise to avoid
 *    multiple simultaneous refresh calls.
 */

import { useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/lib/auth/AuthProvider';
import { refreshToken } from '@/services/auth.service';
import { isApiError, authRequest, inventoryRequest, orderRequest, paymentRequest } from '@/services/api-client';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AuthorizedService = 'auth' | 'inventory' | 'orders' | 'payment';

type ServiceRequestOptions = {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
};

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuthorizedFetch() {
  const { accessToken, setAccessToken, clearAuth } = useAuth();
  const router = useRouter();

  /**
   * Shared in-flight refresh promise.
   * Prevents multiple concurrent 401s from each triggering their own refresh.
   */
  const refreshInFlight = useRef<Promise<string | null> | null>(null);

  /**
   * Attempt to refresh the access token via the BFF.
   * Returns the new token on success, or null on failure (also clears auth
   * and redirects to /login).
   */
  const refreshAccessToken = useCallback(async (): Promise<string | null> => {
    if (!refreshInFlight.current) {
      refreshInFlight.current = (async () => {
        try {
          const data = await refreshToken();
          const newToken = data.access_token;
          setAccessToken(newToken);
          return newToken;
        } catch {
          // Refresh failed — token is revoked or expired.
          // Clear in-memory auth state and redirect to login.
          clearAuth();
          router.push('/login');
          return null;
        } finally {
          refreshInFlight.current = null;
        }
      })();
    }
    return refreshInFlight.current;
  }, [clearAuth, router, setAccessToken]);

  /**
   * Make an authenticated request to a backend service.
   *
   * @param service  - Which backend service to call ('auth' | 'inventory' | 'orders' | 'payment')
   * @param path     - Endpoint path, e.g. '/profile/me'
   * @param options  - Optional method, body, and extra headers
   *
   * Automatically attaches `Authorization: Bearer <token>` and retries once
   * on 401 after refreshing the token.
   */
  const authorizedFetch = useCallback(
    async <T,>(
      service: AuthorizedService,
      path: string,
      options: ServiceRequestOptions = {}
    ): Promise<T> => {
      // Map service name to the correct request function
      const requestFnMap = {
        auth: authRequest,
        inventory: inventoryRequest,
        orders: orderRequest,
        payment: paymentRequest,
      } as const;

      const requestFn = requestFnMap[service] as typeof authRequest;

      const doRequest = (token: string | null) =>
        requestFn<T>(path, { ...options, token: token ?? undefined });

      try {
        return await doRequest(accessToken);
      } catch (error) {
        if (isApiError(error) && error.status === 401) {
          const nextToken = await refreshAccessToken();
          if (!nextToken) {
            // Refresh failed — re-throw the original 401 so callers can handle it
            throw error;
          }
          return doRequest(nextToken);
        }
        throw error;
      }
    },
    [accessToken, refreshAccessToken]
  );

  return { authorizedFetch, accessToken };
}
