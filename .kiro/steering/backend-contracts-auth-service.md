---
title: Backend API Contracts — Auth Service
inclusion: always
---

# Auth Service — API Contracts

## Service Info

- **Base URL:** `http://localhost:8082`
- **Env var:** `NEXT_PUBLIC_AUTH_SERVICE_URL`
- **Language/Framework:** Java / Spring Boot 3 (Spring Security, JWT via jjwt)
- **All request bodies:** `Content-Type: application/json`
- **All response bodies:** `application/json`

---

## Authentication

### Public endpoints (no token required)
- `POST /auth/register`
- `POST /auth/login`
- `POST /auth/refresh-token`
- `GET /profile/{username}` (public profile)

### Protected endpoints (JWT Bearer token required)
All other endpoints require:
```
Authorization: Bearer <access_token>
```

The JWT is signed with HS256. Claims:
- `sub` — user UUID string
- `email` — user's email
- `role` — one of `TITIPERS` | `JASTIPER` | `ADMIN`
- `iat` — issued-at timestamp
- `exp` — expiry timestamp

Default token expiry: **15 minutes** (`app.jwt.expiration-ms=900000`).

Missing/invalid/expired token on a protected route → `401` (handled by Spring Security filter, not the global exception handler — response shape may differ slightly, returning Spring's default error JSON).

### Note on token usage in other services
The JWT issued by this service is the **same token** consumed by the Order Service. The `sub` claim is the user UUID and `role` is validated there too. Always store and forward the token from this service.

---

## Roles

| Role       | Description                                     |
|------------|-------------------------------------------------|
| `TITIPERS` | Regular buyer; `ACTIVE` status on registration  |
| `JASTIPER` | Personal shopper; starts as `PENDING_VERIFICATION` until KYC approved |
| `ADMIN`    | Platform admin; cannot self-register (must be seeded) |

---

## Account Statuses

| Status                 | Description                                      |
|------------------------|--------------------------------------------------|
| `ACTIVE`               | Account is in good standing                      |
| `BANNED`               | Blocked — login is rejected with `403`           |
| `PENDING_VERIFICATION` | Default for new `JASTIPER` accounts, awaiting KYC|

---

## KYC Statuses

| Status                 | Description                          |
|------------------------|--------------------------------------|
| `PENDING_VERIFICATION` | Submitted, awaiting admin review     |
| `APPROVED`             | KYC approved by admin                |
| `REJECTED`             | KYC rejected by admin (reason given) |

---

## Universal Response Envelope

Every response is wrapped in `ApiResponse<T>`:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { "...payload..." },
  "errors": null
}
```

On error, `data` is `null` and `errors` is populated:

```json
{
  "success": false,
  "message": "Validation failed",
  "data": null,
  "errors": [
    { "field": "email", "error": "must not be blank" },
    { "field": "password", "error": "size must be between 8 and 2147483647" }
  ]
}
```

For non-validation errors, `errors` contains a single object with `field: null`:
```json
{
  "success": false,
  "message": "Invalid email or password",
  "data": null,
  "errors": [{ "field": null, "error": "Invalid email or password" }]
}
```

---

## Endpoints

---

### POST /auth/register
**Register a new user account**

- **Auth:** None
- **Required role:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123",
  "password_confirmation": "password123",
  "role": "TITIPERS"
}
```

**Validation:**
- `email`: required, valid email format
- `password`: required, min 8 characters, must contain at least one letter and one number
- `password_confirmation`: required, must match `password`
- `role`: must be `TITIPERS` or `JASTIPER` — sending `ADMIN` is rejected

**Business rules:**
- `TITIPERS` accounts are created with `ACTIVE` status immediately
- `JASTIPER` accounts are created with `PENDING_VERIFICATION` status (requires KYC approval before they can operate)

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Registration successful",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "role": "TITIPERS",
    "created_at": "ISO8601 datetime with offset"
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (invalid email, password too short, password mismatch, passwords don't contain letters+numbers) |
| `400`  | Email already in use (`"Email already in use"`) |
| `400`  | Role is `ADMIN` (`"Cannot request admin role"`) |

---

### POST /auth/login
**Authenticate and receive tokens**

- **Auth:** None
- **Required role:** None

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "password123"
}
```

**Validation:**
- `email`: required, valid email format
- `password`: required, not blank

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Login successful",
  "data": {
    "refresh_token": "jwt-string",
    "expires_in": 900000,
    "token_type": "Bearer",
    "user": {
      "user_id": "uuid",
      "email": "user@example.com",
      "role": "TITIPERS",
      "username": "string | null",
      "status": "ACTIVE"
    }
  },
  "errors": null
}
```

**Note:** Despite the field name `refresh_token`, this is actually the access token used for all subsequent authenticated requests. The service uses a single-token architecture — the same token is used as both access and refresh token.

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (blank email or password) |
| `401`  | Wrong email or password (`"Invalid email or password"`) |
| `403`  | Account is banned (`"Account is banned"`) |

---

### POST /auth/refresh-token
**Refresh an expiring or expired token**

- **Auth:** None
- **Required role:** None

**Request Body:**
```json
{
  "refresh_token": "existing-jwt-string"
}
```

**Validation:**
- `refresh_token`: required, not blank

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Token refreshed",
  "data": {
    "refresh_token": "new-jwt-string",
    "expires_in": 900000
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (blank token) |
| `401`  | Token has been revoked (logged out) or is invalid/malformed |

---

### POST /auth/logout
**Revoke the current token**

- **Auth:** JWT required (token in `Authorization` header)
- **Required role:** Any authenticated user

**Request Body:**
```json
{
  "refresh_token": "current-jwt-string"
}
```

**Note:** The token to revoke is passed in the body (same token as in the `Authorization` header). After logout, the token is added to an in-memory revoked token store — subsequent refresh attempts with it return `401`.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Logged out successfully",
  "data": null,
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (blank token in body) |
| `401`  | Missing or invalid `Authorization` header |

---

### GET /profile/me
**Get the authenticated user's own profile**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "username": "string | null",
    "full_name": "string | null",
    "role": "TITIPERS",
    "status": "ACTIVE",
    "profile_picture_url": "string | null",
    "phone_number": "string | null",
    "created_at": "ISO8601 datetime with offset",
    "kyc_status": "PENDING_VERIFICATION | APPROVED | REJECTED | null"
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |

---

### PATCH /profile/me
**Update the authenticated user's own profile**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Request Body:** (all fields optional — only provided fields are updated)
```json
{
  "username": "string (max 30 chars, letters/numbers/underscore only)",
  "full_name": "string",
  "phone_number": "string",
  "profile_picture_url": "string"
}
```

**Validation:**
- `username`: max 30 chars, pattern `^[A-Za-z0-9_]*$`

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Profile updated",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "username": "string | null",
    "full_name": "string | null",
    "role": "TITIPERS",
    "status": "ACTIVE",
    "profile_picture_url": "string | null",
    "phone_number": "string | null",
    "created_at": "ISO8601 datetime with offset",
    "kyc_status": "PENDING_VERIFICATION | APPROVED | REJECTED | null"
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (username too long, invalid characters) |
| `401`  | Missing or invalid JWT |

---

### GET /profile/{username}
**Get a user's public profile by username**

- **Auth:** None (fully public)
- **URL param:** `username` — string

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Profile fetched",
  "data": {
    "user_id": "uuid",
    "username": "string",
    "full_name": "string | null",
    "profile_picture_url": "string | null",
    "role": "TITIPERS | JASTIPER | ADMIN",
    "member_since": "ISO8601 datetime with offset",
    "status": "ACTIVE | BANNED | PENDING_VERIFICATION",
    "stats": {
      "total_orders": 42,
      "success_rate": 0.97,
      "avg_rating": 4.8
    },
    "rating": 4.8,
    "badges": ["string"]
  },
  "errors": null
}
```

**Note:** `stats`, `rating`, and `badges` are only present for `JASTIPER` accounts. The response uses `@JsonInclude(NON_NULL)` so absent fields are omitted entirely rather than sent as `null`.

**Error responses:**
| Status | When |
|--------|------|
| `404`  | No account found with that username |

---

### POST /profile/me/kyc
**Submit KYC documents (Titipers only)**

- **Auth:** JWT required
- **Required role:** `TITIPERS` only

**Request Body:**
```json
{
  "full_name_ktp": "string (required)",
  "ktp_number": "string (required, exactly 16 digits)",
  "ktp_photo_url": "string (required)",
  "selfie_with_ktp_url": "string (required)",
  "social_media_links": [
    {
      "platform": "string (required)",
      "url": "string (required)"
    }
  ],
  "bio": "string (optional)"
}
```

**Validation:**
- `full_name_ktp`: required, not blank
- `ktp_number`: required, exactly 16 digits (`^\d{16}$`)
- `ktp_photo_url`: required, not blank
- `selfie_with_ktp_url`: required, not blank
- `social_media_links`: required, must have at least one entry; each entry requires `platform` and `url`
- `bio`: optional

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "KYC submitted",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "username": "string | null",
    "full_name": "string | null",
    "role": "TITIPERS",
    "status": "ACTIVE",
    "profile_picture_url": "string | null",
    "phone_number": "string | null",
    "created_at": "ISO8601 datetime with offset",
    "kyc_status": "PENDING_VERIFICATION"
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (missing required fields, invalid KTP number format) |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `TITIPERS` |

---

### GET /profile/me/kyc
**Get the authenticated user's KYC submission status**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "KYC status fetched",
  "data": {
    "kyc_id": "uuid",
    "status": "PENDING_VERIFICATION | APPROVED | REJECTED",
    "submitted_at": "ISO8601 datetime with offset",
    "reviewed_at": "ISO8601 datetime with offset | null",
    "rejection_reason": "string | null"
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `404`  | User has not submitted KYC yet |

---

### GET /admin/users
**List all users with filtering and pagination**

- **Auth:** JWT required
- **Required role:** `ADMIN` only

**Query Parameters:**
| Param     | Type     | Default | Description                                         |
|-----------|----------|---------|-----------------------------------------------------|
| `status`  | `string` | —       | Filter by `ACTIVE`, `BANNED`, or `PENDING_VERIFICATION` (case-insensitive) |
| `role`    | `string` | —       | Filter by `TITIPERS`, `JASTIPER`, or `ADMIN` (case-insensitive) |
| `search`  | `string` | —       | Search by name, email, or username                  |
| `page`    | `int`    | `1`     | Page number                                         |
| `limit`   | `int`    | `10`    | Items per page                                      |
| `sort_by` | `string` | —       | Field to sort by                                    |
| `order`   | `string` | `desc`  | Sort direction: `asc` or `desc`                     |

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Users fetched",
  "data": {
    "data": [
      {
        "user_id": "uuid",
        "email": "user@example.com",
        "username": "string | null",
        "full_name": "string | null",
        "role": "TITIPERS",
        "status": "ACTIVE",
        "created_at": "ISO8601 datetime with offset"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 42
    }
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Invalid `status` or `role` enum value (e.g. `status=UNKNOWN`) |
| `401`  | Missing or invalid JWT |
| `403`  | Authenticated user is not `ADMIN` |

---

### GET /admin/users/{userId}
**Get a single user's full detail (admin view)**

- **Auth:** JWT required
- **Required role:** `ADMIN` only
- **URL param:** `userId` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "User detail fetched",
  "data": {
    "user_id": "uuid",
    "email": "user@example.com",
    "username": "string | null",
    "full_name": "string | null",
    "role": "JASTIPER",
    "status": "PENDING_VERIFICATION",
    "profile_picture_url": "string | null",
    "phone_number": "string | null",
    "created_at": "ISO8601 datetime with offset",
    "kyc_id": "uuid | null",
    "kyc_status": "PENDING_VERIFICATION | APPROVED | REJECTED | null",
    "kyc_submitted_at": "ISO8601 datetime with offset | null",
    "kyc_reviewed_at": "ISO8601 datetime with offset | null",
    "kyc_rejection_reason": "string | null",
    "stats": {
      "totalOrders": 10,
      "completedOrders": 9,
      "successRate": 0.9,
      "avgRating": 4.7,
      "totalReviews": 8
    }
  },
  "errors": null
}
```

**Note:** `stats` and KYC fields are only populated if relevant (uses `@JsonInclude(NON_NULL)` — absent fields are omitted).

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Authenticated user is not `ADMIN` |
| `404`  | No account found with that UUID |

---

### GET /admin/kyc
**List KYC submissions with filtering and pagination**

- **Auth:** JWT required
- **Required role:** `ADMIN` only

**Query Parameters:**
| Param    | Type     | Default | Description                                                    |
|----------|----------|---------|----------------------------------------------------------------|
| `status` | `string` | —       | Filter by `PENDING_VERIFICATION`, `APPROVED`, or `REJECTED` (case-insensitive) |
| `page`   | `int`    | `1`     | Page number                                                    |
| `limit`  | `int`    | `10`    | Items per page                                                 |

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "KYC submissions fetched",
  "data": {
    "data": [
      {
        "kyc_id": "uuid",
        "user_id": "uuid",
        "username": "string | null",
        "full_name_ktp": "string",
        "status": "PENDING_VERIFICATION",
        "submitted_at": "ISO8601 datetime with offset"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 5
    }
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Invalid `status` enum value |
| `401`  | Missing or invalid JWT |
| `403`  | Authenticated user is not `ADMIN` |

---

### PATCH /admin/kyc/{kycId}/review
**Approve or reject a KYC submission**

- **Auth:** JWT required
- **Required role:** `ADMIN` only
- **URL param:** `kycId` — UUID

**Request Body:**
```json
{
  "action": "APPROVE",
  "rejection-reason": "string (required only when action is REJECT)"
}
```

**Validation:**
- `action`: required, must be `APPROVE` or `REJECT`
- `rejection-reason`: required when `action` is `REJECT`; ignored when `APPROVE`

**Note:** The field name is `rejection-reason` (with a hyphen), not `rejection_reason`. This is a quirk of the Java DTO — use the hyphen exactly.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "KYC reviewed",
  "data": {
    "kyc_id": "uuid",
    "status": "APPROVED | REJECTED",
    "submitted_at": "ISO8601 datetime with offset",
    "reviewed_at": "ISO8601 datetime with offset",
    "rejection_reason": "string | null"
  },
  "errors": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | `action` is null or invalid |
| `401`  | Missing or invalid JWT |
| `403`  | Authenticated user is not `ADMIN` |
| `404`  | KYC submission not found |

---

## Shared Object Shapes

### AccountResponseDTO (embedded in login response)
```json
{
  "user_id": "uuid",
  "email": "string",
  "role": "TITIPERS | JASTIPER | ADMIN",
  "username": "string | null",
  "status": "ACTIVE | BANNED | PENDING_VERIFICATION"
}
```

### ProfileResponseDTO (returned by /profile/me endpoints)
```json
{
  "user_id": "uuid",
  "email": "string",
  "username": "string | null",
  "full_name": "string | null",
  "role": "TITIPERS | JASTIPER | ADMIN",
  "status": "ACTIVE | BANNED | PENDING_VERIFICATION",
  "profile_picture_url": "string | null",
  "phone_number": "string | null",
  "created_at": "ISO8601 datetime with offset",
  "kyc_status": "PENDING_VERIFICATION | APPROVED | REJECTED | null"
}
```

---

## Common Mistakes to Avoid

- **Token storage:** Store the token from `data.refresh_token` in the login response — despite the field name, this is the access token used for all requests. Send it as `Authorization: Bearer <token>`.
- **Token expiry:** Tokens expire in **15 minutes**. Implement auto-refresh using `POST /auth/refresh-token` before or on receiving a `401` from any protected endpoint.
- **JASTIPER accounts start as `PENDING_VERIFICATION`** — they cannot log in and use the platform until an admin approves their KYC. Display appropriate messaging on the frontend.
- **`/admin/**` routes require `ADMIN` role** — never show admin UI to non-admin users; the backend will return `403` but the frontend should never reach that state.
- **`POST /profile/me/kyc` is `TITIPERS` only** — the route is for buyers wanting to become verified, not jastipers submitting their own KYC. Jastipers are verified through the admin review flow.
- **`rejection-reason` uses a hyphen**, not an underscore. This is intentional in the backend DTO and must match exactly.
- **Enum values are `SCREAMING_SNAKE_CASE`** — `PENDING_VERIFICATION`, `TITIPERS`, `JASTIPER`, `ADMIN`, `ACTIVE`, `BANNED` etc. Do not use lowercase.
- **`/profile/{username}` is public** — no token needed. Use this for public jastiper profile pages.
- **`stats`, `badges`, and `rating`** in `PublicProfileResponseDTO` are omitted (not sent as null) when the user is not a `JASTIPER`.
- Use `NEXT_PUBLIC_AUTH_SERVICE_URL` env var for the base URL — never hardcode `http://localhost:8082`.
