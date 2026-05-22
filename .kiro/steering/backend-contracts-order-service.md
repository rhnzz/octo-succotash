---
title: Backend API Contracts — Order Service
inclusion: always
---

# Order Service — API Contracts

## Service Info

- **Base URL:** `http://localhost:8084`
- **Env var:** `NEXT_PUBLIC_ORDER_SERVICE_URL`
- **Language/Framework:** Rust / Axum
- **All request bodies:** `Content-Type: application/json`
- **All response bodies:** `application/json`

---

## Authentication

### User Endpoints
All endpoints under `/orders` (except internal) require a JWT Bearer token.

```
Authorization: Bearer <token>
```

JWT claims contain:
- `sub` — user UUID (used as the acting user ID)
- `role` — one of `TITIPERS` | `JASTIPER` | `ADMIN` | `SYSTEM`
- `exp` — expiry timestamp

Missing or invalid token → `401`.

### Internal Endpoints
All endpoints under `/internal/orders` use a shared service key instead of JWT:

```
X-Service-Key: <INTERNAL_SERVICE_KEY>
```

Invalid or missing key → `401`.

---

## Roles

| Role       | Description                                      |
|------------|--------------------------------------------------|
| `TITIPERS` | Buyer / the user who places the order            |
| `JASTIPER` | The personal shopper fulfilling the order        |
| `ADMIN`    | Platform admin, can act on behalf of any party   |
| `SYSTEM`   | Internal service-to-service, never a real user   |

---

## Order Status State Machine

Valid statuses (serialized as `SCREAMING_SNAKE_CASE`):

`PENDING` → `PAID` → `PURCHASED` → `SHIPPED` → `COMPLETED`

Cancellation paths:
- `PENDING` → `CANCELLED` (by `JASTIPER` or `ADMIN`)
- `PAID` → `REFUNDING` (by `JASTIPER` or `ADMIN`)
- `PURCHASED` → `REFUNDING` (by `JASTIPER` or `ADMIN`)
- `SHIPPED` → `REFUNDING` (by `ADMIN` only)
- `REFUNDING` → `CANCELLED` or `REFUND_FAILED` (by `SYSTEM` only, via internal endpoint)
- `REFUND_FAILED` → `CANCELLED` (by `ADMIN` only)

Terminal states (cannot be changed): `COMPLETED`, `CANCELLED`.

---

## Common Error Response Shape

All errors follow this shape:

```json
{
  "success": false,
  "message": "Human-readable error description"
}
```

Validation errors (`400`) include additional fields:

```json
{
  "success": false,
  "message": "Validation error: ...",
  "errors": [
    { "field": "unknown", "message": "..." }
  ]
}
```

Invalid status transition (`422`):

```json
{
  "success": false,
  "message": "Invalid status transition",
  "current_status": "PAID",
  "requested_status": "COMPLETED",
  "valid_transitions": ["PURCHASED"]
}
```

---

## Endpoints

---

### POST /orders
**Create a new order (checkout)**

- **Auth:** JWT required
- **Required role:** any authenticated user (acts as the `TITIPERS`)

**Request Body:**
```json
{
  "product_id": "uuid",
  "quantity": 1,
  "shipping_address": {
    "recipient_name": "string",
    "phone_number": "string",
    "street": "string",
    "kelurahan": "string",
    "kecamatan": "string",
    "city": "string",
    "province": "string",
    "postal_code": "string (exactly 5 digits)",
    "notes": "string | null"
  },
  "note_to_jastiper": "string | null (max 500 chars)"
}
```

**Validation:**
- `quantity` min: 1
- `postal_code` must be exactly 5 characters
- `note_to_jastiper` max 500 characters

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Pesanan berhasil dibuat",
  "data": {
    "order_id": "uuid",
    "titipers_id": "uuid",
    "jastiper_id": "uuid",
    "product_id": "uuid",
    "product_snapshot": { "...ProductSnapshot object..." },
    "quantity": 1,
    "unit_price": 150000,
    "service_fee": 15000,
    "total_price": 165000,
    "status": "PENDING",
    "shipping_address": { "...ShippingAddress object..." },
    "note_to_jastiper": "string | null",
    "tracking_number": null,
    "courier": null,
    "cancellation_reason": null,
    "cancelled_by": null,
    "completed_at": null,
    "created_at": "ISO8601 datetime",
    "updated_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (quantity < 1, postal_code ≠ 5 chars, etc.) |
| `401`  | Missing or invalid JWT |
| `500`  | Database or internal error |

---

### GET /orders/:order_id
**Get a single order by ID**

- **Auth:** JWT required
- **Required role:** any; service validates ownership or admin access internally
- **URL param:** `order_id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "OK",
  "data": { "...full Order object (same shape as POST /orders 201 response data)..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Authenticated user is not the buyer, jastiper, or admin of this order |
| `404`  | Order not found |

---

### PATCH /orders/:order_id/payment
**Titipers initiates payment from wallet**

- **Auth:** JWT required
- **Required role:** `TITIPERS` (acting user must be the buyer of the order)
- **URL param:** `order_id` — UUID
- **Request body:** none

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Pembayaran berhasil dilakukan",
  "data": { "...full Order object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | User is not the titipers of this order |
| `404`  | Order not found |
| `422`  | Order status is not `PENDING` (cannot pay) |
| `500`  | Wallet service call failed |

---

### PATCH /orders/:order_id/confirm
**Titipers confirms order is completed (received)**

- **Auth:** JWT required
- **Required role:** `TITIPERS` or `ADMIN`
- **URL param:** `order_id` — UUID
- **Request body:** none

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Pesanan berhasil dikonfirmasi selesai",
  "data": {
    "order_id": "uuid",
    "status": "COMPLETED",
    "completed_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `TITIPERS` or `ADMIN`; or user is not the buyer |
| `404`  | Order not found |
| `422`  | Order is not in `SHIPPED` status |

---

### PATCH /orders/:order_id/purchased
**Jastiper marks that they have physically purchased the product**

- **Auth:** JWT required
- **Required role:** `JASTIPER` or `ADMIN`
- **URL param:** `order_id` — UUID
- **Request body:** none

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Pesanan berhasil dibeli jastiper",
  "data": {
    "order_id": "uuid",
    "status": "PURCHASED",
    "completed_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `JASTIPER` or `ADMIN`; or user is not the assigned jastiper |
| `404`  | Order not found |
| `422`  | Order is not in `PAID` status |

---

### PATCH /orders/:order_id/shipped
**Jastiper marks item as shipped and provides tracking info**

- **Auth:** JWT required
- **Required role:** `JASTIPER` or `ADMIN`
- **URL param:** `order_id` — UUID

**Request Body:**
```json
{
  "tracking_number": "string | null",
  "courier": "string | null"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Pesanan berhasil dikirim jastiper",
  "data": {
    "order_id": "uuid",
    "status": "SHIPPED",
    "tracking_number": "string | null",
    "courier": "string | null",
    "updated_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `JASTIPER` or `ADMIN` |
| `404`  | Order not found |
| `422`  | Order is not in `PURCHASED` status |

---

### POST /orders/:order_id/cancel
**Cancel an order**

- **Auth:** JWT required
- **Required role:** `JASTIPER`, `ADMIN` (role-based; cancellation triggers refund flow for `PAID`/`PURCHASED`/`SHIPPED`)
- **URL param:** `order_id` — UUID

**Request Body:**
```json
{
  "cancellation_reason": "string (max 500 chars, required)"
}
```

**Validation:**
- `cancellation_reason` is required and max 500 characters

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Pesanan berhasil dibatalkan",
  "data": { "...full Order object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (missing or too-long cancellation_reason) |
| `401`  | Missing or invalid JWT |
| `403`  | User's role is not allowed to cancel at the current order status |
| `404`  | Order not found |
| `422`  | Order is in a terminal or non-cancellable state (`COMPLETED`, `CANCELLED`, `REFUNDING`, `REFUND_FAILED`) |

---

### GET /orders/:order_id/history
**Get the full status change history for an order**

- **Auth:** JWT required
- **Required role:** any; internally validates access
- **URL param:** `order_id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Riwayat ditemukan",
  "data": [
    {
      "status_his_id": "uuid",
      "order_id": "uuid",
      "status": "PENDING",
      "changed_by": "uuid string of the actor",
      "actor_role": "TITIPERS | JASTIPER | ADMIN | SYSTEM",
      "notes": "string | null",
      "timestamp": "ISO8601 datetime"
    }
  ]
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | User is not a party to this order |
| `404`  | Order not found |

---

### GET /orders/my/purchases
**Get the authenticated user's purchase history (as Titipers)**

- **Auth:** JWT required
- **Required role:** any authenticated user

**Query Parameters:**
| Param     | Type             | Default | Description              |
|-----------|------------------|---------|--------------------------|
| `page`    | `integer`        | `1`     | Page number              |
| `limit`   | `integer`        | `20`    | Items per page (max 1000)|
| `sort_by` | `string`         | —       | Field to sort by         |
| `order`   | `Asc` \| `Desc`  | `Asc`   | Sort direction           |

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Riwayat belanja ditemukan",
  "data": [ "...array of Order objects..." ],
  "pagination": {
    "total_items": 42,
    "page": 1,
    "limit": 20,
    "total_pages": 3
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | `limit` exceeds 1000 |
| `401`  | Missing or invalid JWT |

---

### GET /orders/my/sales
**Get the authenticated user's incoming orders (as Jastiper)**

- **Auth:** JWT required
- **Required role:** any authenticated user (typically `JASTIPER`)

**Query Parameters:** same as `GET /orders/my/purchases`

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Daftar pesanan masuk ditemukan",
  "data": [ "...array of Order objects..." ],
  "pagination": {
    "total_items": 10,
    "page": 1,
    "limit": 20,
    "total_pages": 1
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | `limit` exceeds 1000 |
| `401`  | Missing or invalid JWT |

---

### GET /orders/:order_id/rating/jastiper
**Get the jastiper rating for an order**

- **Auth:** JWT required
- **URL param:** `order_id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Rating ditemukan",
  "data": {
    "rating_jastiper_id": "uuid",
    "order_id": "uuid",
    "titipers_id": "uuid",
    "jastiper_rating": 4.5,
    "jastiper_review": "string | null",
    "created_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `404`  | No rating exists for this order |

---

### POST /orders/:order_id/rating/jastiper
**Submit a rating for the jastiper**

- **Auth:** JWT required
- **Required role:** `TITIPERS` (must be the buyer of this order)
- **URL param:** `order_id` — UUID

**Request Body:**
```json
{
  "jastiper_rating": 4.5,
  "jastiper_review": "string | null (max 1000 chars)"
}
```

**Validation:**
- `jastiper_rating`: float, range 1.0–5.0 (required)
- `jastiper_review`: max 1000 characters

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Rating berhasil dikirim",
  "data": {
    "rating_id": "uuid",
    "order_id": "uuid",
    "jastiper_rating": 4.5,
    "created_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (rating out of range, review too long) |
| `401`  | Missing or invalid JWT |
| `403`  | User is not the titipers of this order |
| `404`  | Order not found |
| `409`  | Rating for this order already exists |
| `422`  | Order is not in `COMPLETED` status |

---

### GET /orders/:order_id/rating/product
**Get the product rating for an order**

- **Auth:** JWT required
- **URL param:** `order_id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Rating ditemukan",
  "data": {
    "rating_product_id": "uuid",
    "order_id": "uuid",
    "titipers_id": "uuid",
    "product_rating": 4.0,
    "product_review": "string | null",
    "product_images": ["url1", "url2"],
    "created_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `404`  | No rating exists for this order |

---

### POST /orders/:order_id/rating/product
**Submit a rating for the product**

- **Auth:** JWT required
- **Required role:** `TITIPERS` (must be the buyer of this order)
- **URL param:** `order_id` — UUID

**Request Body:**
```json
{
  "product_rating": 4.0,
  "product_review": "string | null (max 1000 chars)",
  "product_images": ["url1", "url2"] 
}
```

**Validation:**
- `product_rating`: float, range 1.0–5.0 (required)
- `product_review`: max 1000 characters
- `product_images`: max 3 items

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Rating berhasil dikirim",
  "data": {
    "rating_id": "uuid",
    "order_id": "uuid",
    "product_rating": 4.0,
    "created_at": "ISO8601 datetime"
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure (rating out of range, review too long, more than 3 images) |
| `401`  | Missing or invalid JWT |
| `403`  | User is not the titipers of this order |
| `404`  | Order not found |
| `409`  | Rating for this order already exists |
| `422`  | Order is not in `COMPLETED` status |

---

## Internal Endpoints
> These are **not** called from the frontend. They are service-to-service only, authenticated with `X-Service-Key`.

---

### GET /internal/orders/:order_id/payment-info
**Fetch order payment details for the wallet/payment service**

- **Auth:** `X-Service-Key` header
- **URL param:** `order_id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "OK",
  "data": {
    "order_id": "uuid",
    "titipers_user_id": "uuid",
    "jastiper_user_id": "uuid",
    "total_price": 165000,
    "status": "PENDING",
    "product_snapshot": { "...ProductSnapshot object..." }
  }
}
```

---

### POST /internal/orders/:order_id/payment-confirmed
**Wallet service notifies order service that payment succeeded**

- **Auth:** `X-Service-Key` header
- **URL param:** `order_id` — UUID

**Request Body:**
```json
{
  "wallet_transaction_id": "uuid",
  "amount_deducted": 165000
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Status order diperbarui ke PAID",
  "data": {
    "order_id": "uuid",
    "status": "PAID"
  }
}
```

---

### POST /internal/orders/:order_id/refund-confirmed
**Wallet service notifies order service of refund outcome**

- **Auth:** `X-Service-Key` header
- **URL param:** `order_id` — UUID

**Request Body:**
```json
{
  "success": true,
  "wallet_transaction_id": "uuid",
  "amount_refunded": 165000,
  "notes": "string | null"
}
```

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Refund terkonfirmasi",
  "data": {
    "order_id": "uuid",
    "status": "CANCELLED",
    "refund_confirmed": true
  }
}
```

---

## Shared Object Shapes

### Order (full)
```json
{
  "order_id": "uuid",
  "titipers_id": "uuid",
  "jastiper_id": "uuid",
  "product_id": "uuid",
  "product_snapshot": { "...ProductSnapshot..." },
  "quantity": 1,
  "unit_price": 150000,
  "service_fee": 15000,
  "total_price": 165000,
  "status": "PENDING | PAID | PURCHASED | SHIPPED | COMPLETED | REFUNDING | REFUND_FAILED | CANCELLED",
  "shipping_address": { "...ShippingAddress..." },
  "note_to_jastiper": "string | null",
  "tracking_number": "string | null",
  "courier": "string | null",
  "cancellation_reason": "string | null",
  "cancelled_by": "TITIPERS | JASTIPER | ADMIN | SYSTEM | null",
  "completed_at": "ISO8601 datetime | null",
  "created_at": "ISO8601 datetime",
  "updated_at": "ISO8601 datetime"
}
```

### ProductSnapshot
```json
{
  "product_id": "uuid",
  "name": "string",
  "description": "string",
  "image_url": "string",
  "origin_country": "string",
  "purchase_date": "ISO8601 datetime",
  "unit_price": 150000,
  "service_fee": 15000
}
```

### ShippingAddress
```json
{
  "recipient_name": "string",
  "phone_number": "string",
  "street": "string",
  "kelurahan": "string",
  "kecamatan": "string",
  "city": "string",
  "province": "string",
  "postal_code": "string (5 chars)",
  "notes": "string | null"
}
```

---

## Common Mistakes to Avoid

- Do **not** call `/internal/*` endpoints from the frontend — these use service key auth, not JWT.
- `order_id` is always a UUID string, not an integer.
- Status values are `SCREAMING_SNAKE_CASE` strings (e.g. `"REFUND_FAILED"`, not `"refund_failed"`).
- `unit_price`, `service_fee`, and `total_price` are integers in the smallest currency unit (IDR, no decimals).
- `jastiper_rating` and `product_rating` are floats, not integers.
- Use `NEXT_PUBLIC_ORDER_SERVICE_URL` env var for the base URL — never hardcode `http://localhost:8084`.
- Always include `Authorization: Bearer <token>` header — missing it returns `401`, not `403`.
- The `GET /orders/my/purchases` and `GET /orders/my/sales` routes must come **before** `GET /orders/:order_id` in any client-side route matching to avoid `my` being treated as a UUID.
