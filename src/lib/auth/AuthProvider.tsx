'use client';

/**
 * AuthProvider — TASK-116
 *
 * Provides in-memory access token state and user info to the entire app.
 *
 * Security model:
 * - The access token is held in React context (in-memory) only.
 *   It is NEVER written to localStorage, sessionStorage, or any other
 *   browser storage.
 * - The refresh_token is stored as an HttpOnly cookie managed by the BFF.
 *   JavaScript cannot read it directly.
 *
 * Auto-refresh on mount:
 * - On first render, AuthProvider calls POST /api/auth/refresh-token.
 * - If the HttpOnly refresh_token cookie is present and valid, the BFF
 *   returns a new access token which is stored in context — restoring the
 *   session transparently after a page reload.
 * - If the cookie is absent or expired, the call fails silently and the
 *   user remains unauthenticated.
 * - `isLoading` is true until this initial check completes, allowing pages
 *   to avoid flashing unauthenticated UI.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { AccountResponse } from '@/services/auth.service';

// ---------------------------------------------------------------------------
// Context shape
// ---------------------------------------------------------------------------

type AuthContextValue = {
  /** In-memory access token. null when unauthenticated. */
  accessToken: string | null;

  /**
   * Basic user info from the last successful login or token refresh.
   * null when unauthenticated.
   */
  user: AccountResponse | null;

  /**
   * True while the initial auto-refresh check on mount is in progress.
   * Use this to show a loading state instead of flashing unauthenticated UI.
   */
  isLoading: boolean;

  /** Store a new access token (called after login or token refresh). */
  setAccessToken: (token: string, user?: AccountResponse) => void;

  /** Clear auth state (called after logout or when refresh fails). */
  clearAuth: () => void;
};

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const AuthContext = createContext<AuthContextValue | null>(null);

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [accessToken, setAccessTokenState] = useState<string | null>(null);
  const [user, setUser] = useState<AccountResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  // -------------------------------------------------------------------------
  // setAccessToken — stores token and optionally user info
  // -------------------------------------------------------------------------
  const setAccessToken = useCallback(
    (token: string, newUser?: AccountResponse) => {
      setAccessTokenState(token);
      if (newUser) setUser(newUser);
    },
    []
  );

  // -------------------------------------------------------------------------
  // clearAuth — wipes all auth state (logout / refresh failure)
  // -------------------------------------------------------------------------
  const clearAuth = useCallback(() => {
    setAccessTokenState(null);
    setUser(null);
  }, []);

  // -------------------------------------------------------------------------
  // Auto-refresh on mount
  //
  // Attempts to restore the session by calling the BFF refresh-token route.
  // The BFF reads the HttpOnly refresh_token cookie and returns a new access
  // token if the cookie is valid.
  //
  // Runs once on mount. isLoading stays true until the attempt completes
  // (success or failure) so child components don't flash unauthenticated UI.
  // -------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;

    async function tryRestoreSession() {
      try {
        const res = await fetch('/api/auth/refresh-token', {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
        });

        if (!res.ok) {
          // No valid cookie — user is unauthenticated. Fail silently.
          return;
        }

        const body = await res.json().catch(() => null) as {
          access_token?: string;
          expires_in?: number;
        } | null;

        if (!cancelled && body?.access_token) {
          setAccessTokenState(body.access_token);
          // Note: the refresh-token BFF does not return user info.
          // User info will be populated on the next login or via getMyProfile.
        }
      } catch {
        // Network error or BFF unavailable — fail silently.
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    }

    tryRestoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  // -------------------------------------------------------------------------
  // Context value — memoised to avoid unnecessary re-renders
  // -------------------------------------------------------------------------
  const value = useMemo<AuthContextValue>(
    () => ({ accessToken, user, isLoading, setAccessToken, clearAuth }),
    [accessToken, user, isLoading, setAccessToken, clearAuth]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// ---------------------------------------------------------------------------
// useAuth hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within <AuthProvider>');
  }
  return ctx;
}
