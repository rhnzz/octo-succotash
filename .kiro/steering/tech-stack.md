---
inclusion: always
---

# Tech Stack & Architecture Rules

## Framework
- **Next.js 16** (currently `16.1.6`), App Router, TypeScript strict mode
- **React 19** (`19.2.3`) / **React DOM 19**
- All pages are Server Components by default; add `'use client'` only when needed (interactivity, hooks, browser APIs)

## Styling
- **Tailwind CSS v4** (`^4`) via `@tailwindcss/postcss`
- Use CSS custom properties from `globals.css` for brand colors (`--color-primary`, `--color-primary-dark`, `--color-secondary`)
- Tailwind v4 syntax: use `bg-linear-to-br` (not `bg-gradient-to-br`), `from-(--color-primary)` (not `from-[color:var(...)]`)

## Server State / Data Fetching
- **TanStack Query v5** (`@tanstack/react-query ^5.100`, `@tanstack/react-query-devtools ^5.100`) for all API calls in client components — no raw `fetch` inside components
- Wrap the app in `<QueryClientProvider>` in the root layout (client boundary)
- Server Components may call service functions directly (no React Query needed)
- Query keys follow the pattern: `[service, resource, ...params]` e.g. `['inventory', 'products', { page: 1 }]`

## Auth
- JWT stored in `httpOnly` cookie (`refresh_token`); access token held in React context (`AuthProvider`) — never in localStorage or sessionStorage
- Token refresh handled via `/api/auth/refresh-token` BFF route
- `useAuthorizedFetch` hook handles attaching `Authorization: Bearer` and transparent 401 retry
- Note: the Auth Service returns the access token in a field named `refresh_token` (backend naming quirk — do not rename it)

## Installed Packages
| Package | Version | Purpose |
|---|---|---|
| `next` | `16.1.6` | Framework, routing, API routes, middleware |
| `react` / `react-dom` | `19.2.3` | UI |
| `@tanstack/react-query` | `^5.100` | Server state, data fetching in client components |
| `@tanstack/react-query-devtools` | `^5.100` | Dev-only query inspector |
| `jose` | `^5.4.1` | JWT verification (server-side / middleware only) |
| `tailwindcss` | `^4` | Utility-first CSS |
| `@tailwindcss/postcss` | `^4` | PostCSS integration for Tailwind v4 |
| `eslint` + `eslint-config-next` | `^9` / `16.1.6` | Linting |

## API Service Layer
All backend calls go through typed service functions in `src/services/` — **never call fetch directly in components or pages**.

| File | Backend service | Base URL env var |
|---|---|---|
| `src/services/auth.service.ts` | Auth Service (Spring Boot, :8082) | `NEXT_PUBLIC_AUTH_SERVICE_URL` |
| `src/services/inventory.service.ts` | Inventory Service (Spring Boot, :8083) | `NEXT_PUBLIC_INVENTORY_SERVICE_URL` |
| `src/services/order.service.ts` | Order Service (Rust/Axum, :8084) | `NEXT_PUBLIC_ORDER_SERVICE_URL` |
| `src/services/payment.service.ts` | Payment Service (Spring Boot, :8081) | `NEXT_PUBLIC_PAYMENT_SERVICE_URL` |
| `src/services/api-client.ts` | Base fetch wrapper + error normalization | — |

## Error Handling — CRITICAL DIFFERENCE
The four backend services use **two different error shapes**:

### Auth, Inventory, Order services — `{ success, message }` envelope
```json
{ "success": false, "message": "...", "data": null, "errors": [...] }
```
Parse `message` (and `errors` array for validation failures).

### Payment service — RFC 9457 Problem Details
```json
{ "type": "...", "title": "...", "status": 400, "detail": "...", "instance": "..." }
```
Parse `detail` (not `message`) and `status`. Extra fields (e.g. `balance`, `required`) may be present.

All service files must normalize errors into a single `ApiError` shape:
```ts
{ status: number; message: string; field?: string; extra?: Record<string, unknown> }
```

## Environment Variables
```
NEXT_PUBLIC_AUTH_SERVICE_URL        # http://localhost:8082
NEXT_PUBLIC_INVENTORY_SERVICE_URL   # http://localhost:8083
NEXT_PUBLIC_ORDER_SERVICE_URL       # http://localhost:8084
NEXT_PUBLIC_PAYMENT_SERVICE_URL     # http://localhost:8081
```
**Never hardcode localhost URLs or port numbers.** Always use the env var.

## Internal Endpoints — FORBIDDEN from frontend
Endpoints under `/internal/*` on any service use `X-Service-Key` auth and are **service-to-service only**. Never call them from the frontend.

## Request Body Conventions
- **Payment service:** all request body fields must be `snake_case` (global `SNAKE_CASE` Jackson strategy)
- **Auth / Inventory / Order services:** follow per-endpoint contract (mostly `snake_case` for auth/order, mixed for inventory — see backend contracts)
- Always check the contract before sending a request body

## Roles
| Value | Description |
|---|---|
| `TITIPERS` | Buyer — places orders |
| `JASTIPER` | Personal shopper — lists products, fulfills orders |
| `ADMIN` | Platform admin — moderation, KYC review, wallet ops |

Admin pages/components must always have a role guard checking `role === 'ADMIN'` before rendering.
