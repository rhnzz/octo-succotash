---
title: Backend API Contracts — Wallet / Payment Service
inclusion: always
---

# Wallet / Payment Service — API Contracts

## Service Info

- **Base URL:** `http://localhost:8081`
- **Env var:** `NEXT_PUBLIC_PAYMENT_SERVICE_URL`
- **Language/Framework:** Java / Spring Boot 3 (Spring Security, JPA)
- **All request bodies:** `Content-Type: application/json`
- **All response bodies:** `application/json`
- **JSON naming strategy:** `SNAKE_CASE` globally (`spring.jackson.property-naming-strategy=SNAKE_CASE`) — all request and response fields use `snake_case` unless noted otherwise

---

## Authentication

### JWT-protected endpoints (all user and admin routes)
All endpoints outside `/internal/**` require:
```
Authorization: Bearer <access_token>
```
The token is the same JWT issued by the Auth Service. The filter extracts three claims and sets them as request attributes consumed by controllers:

| Attribute    | Source claim | Description          |
|--------------|--------------|----------------------|
| `X-User-Id`  | `sub`        | User UUID string     |
| `X-Email`    | `email`      | User's email address |
| `X-Role`     | `role`       | `TITIPERS` / `JASTIPER` / `ADMIN` |

**These are server-side attributes — never pass them in the request body or as headers from the frontend.**

### Internal endpoints
All routes under `/internal/wallets` bypass JWT and use:
```
X-Service-Key: <INTERNAL_SERVICE_KEY>
```
Invalid or missing key does **not** immediately reject the request (the filter is permissive) — but the endpoint will fail with `403` because the INTERNAL role will not be set. Effectively: always include the key for internal calls.

---

## Critical: Global SNAKE_CASE Serialization

`spring.jackson.property-naming-strategy=SNAKE_CASE` is set globally. This means:
- **All JSON request body fields must be `snake_case`** (e.g. `payment_method`, `bank_account_id`, `idempotency_key`)
- **All JSON response fields are `snake_case`** (e.g. `transaction_id`, `new_balance`, `created_at`)
- Java camelCase DTO field names are automatically converted — do not send camelCase keys

---

## Critical: Error Response Format (RFC 9457 Problem Details)

This service uses `spring.mvc.problemdetails.enabled=true`. **All errors use the RFC 9457 Problem Details format**, not the `{ success, message, data }` envelope used by other services.

```json
{
  "type": "about:blank",
  "title": "Bad Request",
  "status": 400,
  "detail": "Human-readable error description",
  "instance": "/topups"
}
```

Additional error-specific properties are appended as extra fields:

```json
{
  "type": "about:blank",
  "title": "Unprocessable Entity",
  "status": 422,
  "detail": "Insufficient balance",
  "instance": "/internal/wallets/deduct",
  "balance": 50000,
  "required": 150000
}
```

**This is fundamentally different from every other service.** Parse errors using `status` and `detail`, not `success` and `message`.

---

## Transaction Enums

### Type
| Value        | Description                                    |
|--------------|------------------------------------------------|
| `TOPUP`      | Balance added from external payment            |
| `PAYMENT`    | Balance deducted for an order (buyer)          |
| `REFUND`     | Balance returned to buyer after cancellation   |
| `EARNING`    | Balance credited to jastiper after completion  |
| `WITHDRAWAL` | Balance withdrawn to bank account              |
| `ADJUSTMENT` | Manual balance change by admin                 |

### Direction
| Value    | Description                          |
|----------|--------------------------------------|
| `CREDIT` | Money flowing into the wallet        |
| `DEBIT`  | Money flowing out of the wallet      |

### Status
| Value       | Description                          |
|-------------|--------------------------------------|
| `PENDING`   | Awaiting admin approval              |
| `SUCCESS`   | Transaction completed                |
| `FAILED`    | Transaction failed                   |
| `CANCELLED` | Transaction cancelled                |

### ApprovalStatus (used in admin action requests)
| Value    | Description              |
|----------|--------------------------|
| `APPROVE`| Approve the transaction  |
| `REJECT` | Reject the transaction   |

### ReferenceType
| Value        | Description                              |
|--------------|------------------------------------------|
| `ORDER`      | Transaction linked to an order           |
| `TOPUP`      | Transaction linked to a top-up request   |
| `WITHDRAWAL` | Transaction linked to a withdrawal       |

---

## Wallet Object

The raw `Wallet` entity is returned directly from some admin endpoints (not a DTO):

```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "balance": 250000,
  "escrow_balance": 50000,
  "total_topup_lifetime": 1000000,
  "total_withdrawal_lifetime": 500000,
  "created_at": "ISO8601 datetime",
  "updated_at": "ISO8601 datetime"
}
```

`escrow_balance` is the amount currently held for pending order payments — it is deducted from the user's spendable balance during checkout and released on order completion or cancellation.

---

## Endpoints

---

### GET /wallets/me
**Get the authenticated user's wallet**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Response `200 OK`:**
```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "balance": 250000
}
```

**Note:** This endpoint only returns `wallet_id`, `user_id`, and `balance` — not escrow or lifetime totals. Use the admin endpoint for the full wallet object.

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |
| `404`  | Wallet not found for this user (wallet hasn't been created yet) |

---

### GET /transactions
**Get all transactions for the authenticated user**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Response `200 OK`** — array of brief transaction objects:
```json
[
  {
    "transaction_id": "uuid",
    "type": "TOPUP",
    "amount": 100000,
    "direction": "CREDIT",
    "status": "SUCCESS",
    "description": "string",
    "created_at": "ISO8601 datetime"
  }
]
```

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |

---

### GET /transactions/{transactionId}
**Get detail of a specific transaction**

- **Auth:** JWT required
- **Required role:** Any authenticated user (only their own transactions)
- **URL param:** `transactionId` — string UUID

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "type": "PAYMENT",
  "amount": 165000,
  "direction": "DEBIT",
  "status": "SUCCESS",
  "description": "string",
  "reference_id": "order-uuid",
  "reference_type": "ORDER",
  "payment_method": "string | null",
  "payment_reference": "string | null",
  "confirmed_by": "admin-uuid | null",
  "created_at": "ISO8601 datetime",
  "updated_at": "ISO8601 datetime"
}
```

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |
| `403`  | Transaction does not belong to this user |
| `404`  | Transaction not found |

---

### GET /topups
**Get all top-up transactions for the authenticated user**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Response `200 OK`** — array of top-up response objects:
```json
[
  {
    "transaction_id": "uuid",
    "type": "TOPUP",
    "amount": 100000,
    "status": "PENDING",
    "created_at": "ISO8601 datetime"
  }
]
```

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |

---

### POST /topups
**Submit a top-up request**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Request Body:**
```json
{
  "amount": 100000,
  "payment_method": "BANK_TRANSFER",
  "bank_code": "BCA",
  "idempotency_key": "unique-string-per-request"
}
```

**Validation:**
- `amount`: required, not null
- `payment_method`: required, not blank
- `bank_code`: required, not blank
- `idempotency_key`: required, not blank — must be unique per request (duplicate returns `409`)

**Business rules:**
- Top-up starts with `PENDING` status; an admin must approve it
- Minimum top-up amount is enforced server-side (see `TransactionException.MinimumTopUp`)

**Response `201 Created`:**
```json
{
  "transaction_id": "uuid",
  "type": "TOPUP",
  "amount": 100000,
  "status": "PENDING",
  "created_at": "ISO8601 datetime"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure — `detail` contains field message; `error_field` added |
| `400`  | Amount below minimum — `detail`: `"Minimum top-up amount is ..."` |
| `400`  | Top-up already confirmed — `detail`: `"Transaction has already been confirmed"` |
| `401`  | Missing or invalid JWT |
| `409`  | Duplicate `idempotency_key` — extra field: `"idempotency_key": "..."` |

---

### GET /withdrawals
**Get all withdrawal transactions for the authenticated user**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Response `200 OK`** — array of withdrawal response objects:
```json
[
  {
    "transaction_id": "uuid",
    "type": "WITHDRAWAL",
    "amount": 50000,
    "status": "PENDING",
    "created_at": "ISO8601 datetime"
  }
]
```

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |

---

### POST /withdrawals
**Submit a withdrawal request**

- **Auth:** JWT required
- **Required role:** Any authenticated user

**Request Body:**
```json
{
  "amount": 50000,
  "bank_account_id": "uuid-string",
  "idempotency_key": "unique-string-per-request",
  "notes": "Withdrawal to BCA account"
}
```

**Validation:**
- `amount`: required, not null
- `bank_account_id`: required, not blank
- `idempotency_key`: required, not blank
- `notes`: required, not blank

**Business rules:**
- Withdrawal starts with `PENDING` status; an admin must approve and process it
- Deducts `amount` from wallet balance immediately on submission
- If balance is insufficient → `422`

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "type": "WITHDRAWAL",
  "amount": 50000,
  "status": "PENDING",
  "created_at": "ISO8601 datetime"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure |
| `401`  | Missing or invalid JWT |
| `409`  | Duplicate `idempotency_key` — extra field: `"idempotency_key": "..."` |
| `422`  | Insufficient balance — extra fields: `"balance": 30000, "required": 50000` |

---

## Admin Endpoints

All admin endpoints require `ADMIN` role. Spring Security enforces this via `@PreAuthorize("hasRole('ADMIN')")`. Non-admin tokens receive `403`.

---

### GET /admin/topups
**List top-up requests with optional status filter**

- **Auth:** JWT required
- **Required role:** `ADMIN`

**Query Parameters:**

| Param    | Type     | Description                                          |
|----------|----------|------------------------------------------------------|
| `status` | `string` | Optional filter: `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED` |

**Response `200 OK`** — array of top-up response objects (same shape as `GET /topups`):
```json
[
  {
    "transaction_id": "uuid",
    "type": "TOPUP",
    "amount": 100000,
    "status": "PENDING",
    "created_at": "ISO8601 datetime"
  }
]
```

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |

---

### PATCH /admin/topups/{transaction_id}
**Approve or reject a top-up request**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `transaction_id` — string UUID

**Request Body:**
```json
{
  "action": "APPROVE",
  "rejection_reason": "string (required only when action is REJECT)"
}
```

**Validation:**
- `action`: required, must be `APPROVE` or `REJECT`

**Business rules (on APPROVE):**
- Credits `amount` to the user's wallet balance
- Marks transaction as `SUCCESS`
- Records `confirmed_by` as the admin's user ID

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "approval_status": "APPROVE",
  "amount": 100000,
  "new_balance": 350000,
  "confirmed_at": "ISO8601 datetime"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure or transaction already processed |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | Transaction not found |
| `409`  | Transaction has already been confirmed — extra field: `"transaction_id": "..."` |

---

### GET /admin/withdrawals
**List withdrawal requests with optional status filter**

- **Auth:** JWT required
- **Required role:** `ADMIN`

**Query Parameters:**

| Param    | Type     | Description                                                  |
|----------|----------|--------------------------------------------------------------|
| `status` | `string` | Optional filter: `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED` |

**Response `200 OK`** — array of withdrawal response objects:
```json
[
  {
    "transaction_id": "uuid",
    "type": "WITHDRAWAL",
    "amount": 50000,
    "status": "PENDING",
    "created_at": "ISO8601 datetime"
  }
]
```

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |

---

### PATCH /admin/withdrawals/{transaction_id}
**Process (approve or reject) a withdrawal request**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `transaction_id` — string UUID

**Request Body:**
```json
{
  "action": "APPROVE",
  "rejection_reason": "string (required only when action is REJECT)"
}
```

**Validation:**
- `action`: required, must be `APPROVE` or `REJECT`

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "status": "APPROVE",
  "amount": 50000,
  "transfer_reference": "string | null",
  "processed_at": "ISO8601 datetime string | null",
  "rejection_reason": "string | null"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | Transaction not found |
| `409`  | Transaction already processed — extra field: `"transaction_id": "..."` |

---

### GET /admin/transactions
**List all transactions across all users with filtering and pagination**

- **Auth:** JWT required
- **Required role:** `ADMIN`

**Query Parameters:**

| Param        | Type      | Default | Description                                                       |
|--------------|-----------|---------|-------------------------------------------------------------------|
| `user_id`    | `string`  | —       | Filter by user UUID                                               |
| `type`       | `string`  | —       | Filter by type: `TOPUP`, `PAYMENT`, `REFUND`, `EARNING`, `WITHDRAWAL`, `ADJUSTMENT` |
| `status`     | `string`  | —       | Filter by status: `PENDING`, `SUCCESS`, `FAILED`, `CANCELLED`     |
| `date_from`  | `date`    | —       | ISO 8601 `YYYY-MM-DD` — lower bound of `created_at`              |
| `date_to`    | `date`    | —       | ISO 8601 `YYYY-MM-DD` — upper bound of `created_at`              |
| `min_amount` | `long`    | —       | Minimum transaction amount                                        |
| `page`       | `integer` | `1`     | Page number (1-based)                                             |
| `limit`      | `integer` | `20`    | Items per page                                                    |

**Response `200 OK`:**
```json
{
  "data": [
    {
      "transaction_id": "uuid",
      "type": "PAYMENT",
      "amount": 165000,
      "direction": "DEBIT",
      "status": "SUCCESS",
      "user": {
        "user_id": "uuid",
        "username": null,
        "role": null
      },
      "description": "string",
      "reference_id": "order-uuid | null",
      "created_at": "ISO8601 datetime"
    }
  ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total_items": 342,
    "total_pages": 18
  },
  "summary": {
    "total_topup": 5000000,
    "total_withdrawal": 2000000,
    "total_payment": 3000000,
    "total_refund": 500000,
    "total_earning": 2700000,
    "platform_escrow_balance": 300000
  }
}
```

**Note:** `user.username` and `user.role` are always `null` in the current implementation — only `user_id` is populated from the transaction record.

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |

---

### GET /admin/wallets/{userQueryId}
**Get a user's wallet by their user ID (admin view)**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `userQueryId` — user UUID string

**Response `200 OK`** — raw `Wallet` entity:
```json
{
  "wallet_id": "uuid",
  "user_id": "uuid",
  "balance": 250000,
  "escrow_balance": 50000,
  "total_topup_lifetime": 1000000,
  "total_withdrawal_lifetime": 500000,
  "created_at": "ISO8601 datetime",
  "updated_at": "ISO8601 datetime"
}
```

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | No wallet found for this user ID |

---

### POST /admin/wallets/{userId}
**Create a wallet for a user**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `userId` — user UUID string
- **Request body:** none

**Response `201 Created`** — raw `Wallet` entity (same shape as GET above).

**Error responses:**

| Status | Detail |
|--------|--------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |

---

### POST /admin/wallets/{user_id}/adjust
**Manually adjust a user's wallet balance**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `user_id` — user UUID string

**Request Body:**
```json
{
  "direction": "CREDIT",
  "amount": 50000,
  "reason": "Compensation for service disruption (max 500 chars)",
  "reference_id": "optional-uuid-string (max 36 chars)"
}
```

**Validation:**
- `direction`: required, must be `CREDIT` or `DEBIT`
- `amount`: required, must be positive (> 0)
- `reason`: required, not blank, max 500 characters
- `reference_id`: optional, max 36 characters

**Business rules:**
- `DEBIT` direction subtracts from balance; if the result would be negative → `422`
- Creates an `ADJUSTMENT` type transaction
- `confirmed_by` is set to the admin's user ID

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "type": "ADJUSTMENT",
  "user_id": "uuid",
  "direction": "CREDIT",
  "amount": 50000,
  "new_balance": 300000,
  "reason": "Compensation for service disruption",
  "adjusted_by": "admin-uuid",
  "created_at": "ISO8601 datetime"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | Wallet not found for this user |
| `422`  | DEBIT would result in negative balance — extra fields: `"current_balance": 30000, "debit_amount": 50000` |

---

## Internal Endpoints

> Called only by other microservices (primarily the Order Service). Never called from the frontend. Authentication uses `X-Service-Key` header.

---

### POST /internal/wallets/deduct
**Deduct balance from a user's wallet (payment for an order)**

- **Auth:** `X-Service-Key` header

**Request Body:**
```json
{
  "user_id": "uuid",
  "order_id": "uuid",
  "amount": 165000,
  "description": "Payment for order #..."
}
```

**Validation:** all four fields required and not blank/null.

**Business rules:**
- Deducts `amount` from the user's `balance` and adds to `escrow_balance`
- The funds sit in escrow until the order completes (earnings) or is cancelled (refund)
- Creates a `PAYMENT` type, `DEBIT` direction, `SUCCESS` status transaction

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "type": "PAYMENT",
  "user_id": "uuid",
  "amount": 165000,
  "new_balance": 85000,
  "escrow_balance": 165000,
  "status": "SUCCESS"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure |
| `401`  | Invalid or missing `X-Service-Key` |
| `404`  | Wallet not found for `user_id` |
| `422`  | Insufficient balance — extra fields: `"balance": 50000, "required": 165000` |

---

### POST /internal/wallets/refund
**Refund a deducted payment back to the user (on order cancellation)**

- **Auth:** `X-Service-Key` header

**Request Body:**
```json
{
  "user_id": "uuid",
  "order_id": "uuid",
  "description": "Refund for cancelled order #..."
}
```

**Note:** Amount is not passed — the service looks up the original `PAYMENT` transaction for this `order_id` and refunds that exact amount.

**Business rules:**
- Returns the escrowed amount from `escrow_balance` back to `balance`
- Creates a `REFUND` type, `CREDIT` direction, `SUCCESS` status transaction

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "type": "REFUND",
  "amount": 165000,
  "new_balance": 250000,
  "status": "SUCCESS"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure or insufficient escrow balance |
| `401`  | Invalid or missing `X-Service-Key` |
| `404`  | Wallet or original payment transaction not found |

---

### POST /internal/wallets/earnings
**Credit earnings to a jastiper's wallet (on order completion)**

- **Auth:** `X-Service-Key` header

**Request Body:**
```json
{
  "jastiper_id": "uuid",
  "order_id": "uuid",
  "description": "Earnings for completed order #..."
}
```

**Note:** Amount is not passed — the service determines the payout from the original escrow for this `order_id`.

**Business rules:**
- Releases the escrowed amount and credits it to the jastiper's wallet `balance`
- Creates an `EARNING` type, `CREDIT` direction, `SUCCESS` status transaction

**Response `200 OK`:**
```json
{
  "transaction_id": "uuid",
  "type": "EARNING",
  "jastiper_id": "uuid",
  "amount": 165000,
  "new_balance": 415000,
  "status": "SUCCESS"
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure |
| `401`  | Invalid or missing `X-Service-Key` |
| `404`  | Wallet not found for `jastiper_id` |

---

### GET /internal/wallets/balance-check
**Check if a user has sufficient balance before placing an order**

- **Auth:** `X-Service-Key` header

**Request Body** (sent with GET — unusual but this is how the controller is coded):
```json
{
  "user_id": "uuid",
  "required_amount": 165000
}
```

**Response `200 OK`:**
```json
{
  "user_id": "uuid",
  "balance": 250000,
  "is_sufficient": true,
  "required_amount": 165000
}
```

**Error responses:**

| Status | Problem Detail |
|--------|----------------|
| `400`  | Validation failure |
| `401`  | Invalid or missing `X-Service-Key` |
| `404`  | Wallet not found |

---

## Common Mistakes to Avoid

- **This service uses Problem Details (RFC 9457) for errors**, not `{ success, message }`. Parse `status` and `detail`, not `success` and `message`. Every other service uses the custom envelope — only this one is different.
- **Global `SNAKE_CASE` serialization** — all request body keys must be `snake_case` (`payment_method`, `bank_account_id`, `idempotency_key`, `rejection_reason`). Sending camelCase keys silently results in null values server-side, causing validation failures.
- **`/internal/wallets/balance-check` uses `GET` with a request body** — some HTTP clients (browsers, fetch) strip GET request bodies. This is internal-only and should never be called from the frontend.
- **Amounts are integers in IDR** (no decimals). Always treat as `Long` / `number` in TypeScript. Do not use `parseFloat`.
- **`idempotency_key` must be unique per top-up and withdrawal request** — generate a UUID or timestamp-based key on the client before submitting. Reusing a key returns `409`.
- **Top-ups and withdrawals are not instant** — both start as `PENDING` and require admin approval. Show "awaiting review" UI states; do not update the displayed balance optimistically.
- **`escrow_balance` is not spendable** — the user's spendable amount is `balance` only. Never show `balance + escrow_balance` as the available amount.
- **`GET /wallets/me` does not return `escrow_balance`** — only `wallet_id`, `user_id`, and `balance`. Use the admin endpoint if the full wallet is needed.
- **Admin `GET /admin/transactions` `user.username` and `user.role` are always `null`** — cross-reference with Auth Service using `user.user_id` if user details are needed alongside transactions.
- **Do not call `/internal/**` from the frontend** — service-to-service only.
- Use `NEXT_PUBLIC_PAYMENT_SERVICE_URL` env var for the base URL — never hardcode `http://localhost:8081`.
