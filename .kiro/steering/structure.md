# Project Structure

```
src/
├── app/                        # Next.js App Router
│   ├── api/                    # BFF route handlers (server-side only)
│   │   └── auth/
│   │       ├── login/          # POST /api/auth/login — proxies to Auth Service, sets refresh_token HttpOnly cookie
│   │       ├── logout/         # POST /api/auth/logout — clears refresh_token cookie
│   │       └── refresh-token/  # POST /api/auth/refresh-token — reads cookie, rotates token
│   ├── admin/                  # Admin-only pages (guarded by middleware + role check)
│   │   ├── catalog/            # /admin/catalog — product moderation
│   │   ├── kyc/                # /admin/kyc — KYC review queue
│   │   ├── orders/             # /admin/orders — all orders
│   │   ├── users/              # /admin/users — user management
│   │   └── wallet/
│   │       ├── summary/        # /admin/wallet/summary — platform financial summary
│   │       ├── requests/       # /admin/wallet/requests — pending top-up & withdrawal approvals
│   │       └── transactions/   # /admin/wallet/transactions — all transactions + manual adjustments
│   ├── catalog/                # /catalog — public product search
│   │   └── [productId]/        # /catalog/[productId] — product detail
│   ├── checkout/
│   │   └── [productId]/        # /checkout/[productId] — order creation form
│   ├── jastiper/
│   │   ├── catalog/            # /jastiper/catalog — own product catalog management
│   │   │   ├── new/            # /jastiper/catalog/new — create product
│   │   │   └── [productId]/edit/ # /jastiper/catalog/[productId]/edit — edit product
│   │   ├── orders/             # /jastiper/orders — incoming sales orders
│   │   ├── wallet/             # /jastiper/wallet — earnings & withdrawals
│   │   └── [username]/         # /jastiper/[username] — public jastiper profile
│   ├── login/                  # /login
│   ├── orders/                 # /orders — purchase history (titipers)
│   │   └── [orderId]/          # /orders/[orderId] — order detail
│   ├── profile/                # /profile — edit own profile
│   │   └── kyc/                # /profile/kyc — KYC submission form
│   ├── register/               # /register
│   ├── wallet/                 # /wallet — balance, top-up, transaction history
│   ├── layout.tsx              # Root layout — mounts <QueryClientProvider> + <AuthProvider>
│   ├── page.tsx                # / — landing page
│   ├── providers.tsx           # Client boundary wrapping TanStack Query + AuthProvider
│   └── globals.css             # Tailwind import + CSS custom properties
│
├── lib/
│   ├── auth.ts                 # Server-side JWT helpers: verifyJwt, isAdmin, isJastiper, isTitipers (jose)
│   ├── auth/
│   │   └── AuthProvider.tsx    # Client context: accessToken, user, setAccessToken, clearAuth, isLoading
│   └── api/
│       ├── useAuthorizedFetch.ts  # Hook: attaches Bearer token, retries once on 401 with refresh
│       ├── client.ts           # (legacy) re-exports from src/services/api-client
│       ├── index.ts            # Re-exports from src/services/* for backward compat
│       ├── inventory.ts        # (legacy) inventory helpers
│       └── orders.ts           # (legacy) order helpers
│
└── services/                   # Primary API service layer — all backend calls go here
    ├── api-client.ts           # Core: apiRequest, ApiError, isApiError, per-service factories
    ├── auth.service.ts         # Auth Service calls + BFF login/logout/refresh
    ├── inventory.service.ts    # Inventory Service calls
    ├── order.service.ts        # Order Service calls
    └── payment.service.ts      # Payment Service calls
```

## Key Conventions

### API Service Layer (`src/services/`)

This is the **primary and authoritative** API layer. All backend calls go through typed functions here — never call `fetch` directly in pages or components.

| File | Backend | Base URL env var | Error shape |
|---|---|---|---|
| `auth.service.ts` | Auth Service (:8082) | `NEXT_PUBLIC_AUTH_SERVICE_URL` | `{ success, message, data }` envelope |
| `inventory.service.ts` | Inventory Service (:8083) | `NEXT_PUBLIC_INVENTORY_SERVICE_URL` | `{ success, message, data }` envelope |
| `order.service.ts` | Order Service (:8084) | `NEXT_PUBLIC_ORDER_SERVICE_URL` | `{ success, message, data }` envelope |
| `payment.service.ts` | Payment Service (:8081) | `NEXT_PUBLIC_PAYMENT_SERVICE_URL` | RFC 9457 Problem Details |

**`src/services/api-client.ts`** provides the low-level primitives:
- `apiRequest(options)` — core fetch with error normalization; selects envelope vs. problem-details parsing via `errorShape`
- Per-service factories: `authRequest`, `inventoryRequest`, `orderRequest`, `paymentRequest` — pre-configured with the correct base URL and error shape
- `apiFetchFrom(service, path, options)` — generic helper keyed by service name string
- `appFetch(path, options)` — for BFF routes (`/api/auth/*`); uses `credentials: 'include'`, no service base URL
- `ApiError` class with `.status`, `.message`, `.field?`, `.extra?`
- `isApiError(error)` — type guard for caught errors

**Service function signature pattern:**
```ts
// Protected endpoints — token passed explicitly
export async function getMyProfile(token: string): Promise<ProfileResponse>

// Admin endpoints — token + params
export async function adminListUsers(token: string, params?: AdminUserListParams): Promise<AdminUserListResponse>

// Public endpoints — no token
export async function getPublicProfile(username: string): Promise<PublicProfileResponse>
```

### `useAuthorizedFetch` Hook (`src/lib/api/useAuthorizedFetch.ts`)

Used in client components to make authenticated requests without manually passing the token:

```ts
const { authorizedFetch } = useAuthorizedFetch();

// Usage: authorizedFetch<ReturnType>(service, path, options?)
const data = await authorizedFetch<ProfileResponse>('auth', '/profile/me');
const wallet = await authorizedFetch<WalletResponse>('payment', '/wallets/me');
```

- Automatically attaches `Authorization: Bearer <accessToken>` from `AuthProvider` context
- On 401, calls `POST /api/auth/refresh-token` once, stores the new token, and retries
- If refresh fails, calls `clearAuth()` and redirects to `/login`
- Concurrent 401s share a single in-flight refresh promise (no duplicate refresh calls)
- Service names: `'auth' | 'inventory' | 'orders' | 'payment'`

**When to use which approach:**

| Scenario | Use |
|---|---|
| Client component needs authenticated data | `useAuthorizedFetch` → `authorizedFetch(service, path)` |
| Service function called directly with a known token | `authRequest / paymentRequest / etc.` from `api-client.ts` |
| Login / logout / refresh (BFF routes) | Direct `fetch('/api/auth/...')` with `credentials: 'include'` (already in `auth.service.ts`) |

### Auth Flow

1. Login → `POST /api/auth/login` (BFF) → sets `refresh_token` HttpOnly cookie, returns token in body
2. Frontend reads `data.refresh_token` field (backend naming quirk — this IS the access token)
3. Token stored in `AuthProvider` React context (`accessToken` state) — never in localStorage/sessionStorage
4. All authenticated requests attach `Authorization: Bearer <accessToken>`
5. On 401: `useAuthorizedFetch` calls `POST /api/auth/refresh-token` (BFF reads cookie), stores new token, retries
6. Middleware (`middleware.ts`) guards `/admin/*` using `verifyJwt` + `isAdmin` (server-side, jose)

### Pages & Components

- All pages under `src/app/` are client components (`'use client'`) when they need hooks or interactivity
- Auth guard pattern at the top of every protected page:
  ```ts
  const { accessToken, user, isLoading: authLoading } = useAuth();
  useEffect(() => {
    if (!authLoading) {
      if (!accessToken) { router.replace('/login'); return; }
      if (user?.role !== 'ADMIN') { router.replace('/'); }
    }
  }, [authLoading, accessToken, user, router]);
  ```
- Data fetching uses `useAuthorizedFetch` + `useState` / `useEffect` (not TanStack Query directly in most pages)
- Loading state: `useState<boolean>` tracked manually; skeleton UIs shown during load
- Error state: `useState<string>` displayed inline with `role="alert"` on the container
- Forms: `useState` for field values + async submit handler (not React 19 form actions in most pages)
- Monetary amounts: always plain `number` (IDR integers) — never `parseFloat`, never format with decimals

### Naming & Types

- All types are co-located with their service function in `src/services/*.service.ts`
- Response types named after the resource: `WalletResponse`, `ProfileResponse`, `AdminUserListResponse`
- Input types named with `Input` suffix: `LoginInput`, `SubmitKycInput`, `AdjustWalletInput`
- `isApiError(err)` from `src/services/api-client.ts` used to narrow errors in catch blocks
- Re-export `isApiError` from service files for convenience: `export { isApiError } from './api-client'`
