---
title: Backend API Contracts — Inventory Service
inclusion: always
---

# Inventory Service — API Contracts

## Service Info

- **Base URL:** `http://localhost:8083`
- **Env var:** `NEXT_PUBLIC_INVENTORY_SERVICE_URL`
- **Language/Framework:** Java / Spring Boot 3 (Spring Security, JPA)
- **All request bodies:** `Content-Type: application/json`
- **All response bodies:** `application/json`

---

## Authentication

### Public endpoints (no token required)
- `GET /categories`
- `GET /products`
- `GET /products/{id}`
- `GET /jastipers/{username}/products`

### JWT-protected endpoints
All other endpoints require:
```
Authorization: Bearer <access_token>
```
The token is the same JWT issued by the Auth Service. The inventory service reads the `role` claim to set Spring Security authorities, and extracts the user UUID from `sub`.

**Important:** The JWT filter sets two request attributes used by controllers — **do not try to pass these in the request body:**
- `jastiperId` — set when `role == JASTIPER` (UUID from `sub` claim)
- `adminId` — set when `role == ADMIN` (UUID from `sub` claim)

### Internal endpoints
All routes under `/internal/products` bypass JWT and require:
```
X-Service-Key: <INTERNAL_SERVICE_KEY>
```
Invalid or missing key returns `401` with a raw JSON body (not the standard `ApiResponse` envelope).

---

## Roles

| Role       | Access                                                         |
|------------|----------------------------------------------------------------|
| `JASTIPER` | Create/edit/delete their own products; view their own catalog  |
| `ADMIN`    | Moderate any product; manage categories; view all products     |
| `TITIPERS` | Read-only via public endpoints; no write access                |

---

## Product Statuses

| Status             | Description                                              |
|--------------------|----------------------------------------------------------|
| `ACTIVE`           | Visible and purchasable                                  |
| `OUT_OF_STOCK`     | Stock reached 0; auto-set by reserve logic               |
| `HIDDEN`           | Hidden by admin (HIDE action) or jastiper                |
| `REMOVED_BY_ADMIN` | Removed by admin (REMOVE action); soft-deleted           |

---

## Moderation Actions

| Action     | Effect on product                                         |
|------------|-----------------------------------------------------------|
| `HIDE`     | Sets status to `HIDDEN`                                   |
| `REMOVE`   | Sets status to `HIDDEN` and sets `deleted_at` timestamp   |
| `RESTORE`  | Sets status to `ACTIVE`, clears `deleted_at`              |
| `ACTIVATE` | Sets status to `ACTIVE`, clears `deleted_at`              |

---

## Reservation Statuses

| Status      | Description                                           |
|-------------|-------------------------------------------------------|
| `PENDING`   | Stock held, awaiting payment confirmation             |
| `CONFIRMED` | Order confirmed; stock permanently deducted           |
| `RELEASED`  | Reservation cancelled; stock returned (if applicable)|

Reservations expire after **15 minutes** if not confirmed. A scheduled job runs every 60 seconds to release expired `PENDING` reservations and return stock.

---

## Universal Response Envelope

Standard success/error shape for all non-internal endpoints:

```json
{
  "success": true,
  "message": "Human-readable message",
  "data": { "...payload..." }
}
```

Error responses follow the same shape with `success: false` and `data: null`:
```json
{
  "success": false,
  "message": "Product not found with ID: ...",
  "data": null
}
```

Validation errors (`400`) include an `errors` array:
```json
{
  "success": false,
  "message": "Validation Failed",
  "errors": [
    { "field": "name", "message": "Product name is required" },
    { "field": "price", "message": "Price must be positive" }
  ]
}
```

Special conflict errors include additional context fields (see per-endpoint notes).

**Internal endpoints** (`/internal/*`) return raw JSON — **not** wrapped in `ApiResponse`.

---

## Paginated Response Shape

All list endpoints return data in this structure inside `data`:

```json
{
  "data": [ "...array of ProductResponse objects..." ],
  "pagination": {
    "page": 1,
    "limit": 20,
    "total": 84,
    "total_pages": 5
  }
}
```

---

## Endpoints

---

### GET /categories
**List all product categories**

- **Auth:** None (public)

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Categories fetched successfully",
  "data": [
    {
      "category_id": 1,
      "name": "Electronics",
      "slug": "electronics",
      "description": "string | null",
      "product_count": 42
    }
  ]
}
```

**Note:** Uses `@JsonNaming(SnakeCaseStrategy)` — all fields are snake_case in the JSON output.

---

### POST /admin/categories
**Create a new category**

- **Auth:** JWT required
- **Required role:** `ADMIN`

**Request Body:**
```json
{
  "name": "string (required, max 100 chars)",
  "description": "string (optional, max 500 chars)",
  "slug": "string (optional, auto-generated from name if omitted)"
}
```

**Validation:**
- `name`: required, not blank, max 100 characters

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Category created successfully.",
  "data": {
    "category_id": 5,
    "name": "Cosmetics",
    "slug": "cosmetics",
    "description": "string | null",
    "product_count": 0
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `409`  | Category name already exists |

---

### PATCH /admin/categories/{id}
**Update an existing category**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `id` — integer (category ID)

**Request Body:** same as `POST /admin/categories`

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Category updated successfully.",
  "data": {
    "category_id": 5,
    "name": "Updated Name",
    "slug": "updated-name",
    "description": "string | null",
    "product_count": 12
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | Category not found |
| `409`  | New name conflicts with an existing category |

---

### DELETE /admin/categories/{id}
**Delete a category**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `id` — integer (category ID)

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Category successfully deleted.",
  "data": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | Category not found |
| `409`  | Category still has products assigned (`CategoryInUseException`). Response includes extra field: `"product_count": 7` |

---

### GET /products
**Public product search with filtering and pagination**

- **Auth:** None (public)

**Query Parameters:**
| Param                | Type        | Default     | Description                                              |
|----------------------|-------------|-------------|----------------------------------------------------------|
| `q`                  | `string`    | —           | Keyword search (name, description, tags)                 |
| `jastiperId`         | `UUID`      | —           | Filter by jastiper UUID                                  |
| `minPrice`           | `long`      | —           | Minimum price (IDR integer)                              |
| `maxPrice`           | `long`      | —           | Maximum price (IDR integer)                              |
| `categoryId`         | `integer`   | —           | Filter by category ID                                    |
| `origin_country`     | `string`    | —           | Filter by country of origin                              |
| `purchase_date_from` | `date`      | —           | ISO 8601 date `YYYY-MM-DD` — lower bound of purchase date|
| `purchase_date_to`   | `date`      | —           | ISO 8601 date `YYYY-MM-DD` — upper bound of purchase date|
| `page`               | `integer`   | `1`         | Page number (1-based)                                    |
| `limit`              | `integer`   | `20`        | Items per page                                           |
| `sortBy`             | `string`    | `created_at`| Sort field: `created_at`, `purchase_date`, or `rating`   |
| `order`              | `string`    | `desc`      | Sort direction: `asc` or `desc`                          |

Only `ACTIVE` products are returned. Public search never includes `HIDDEN` or `REMOVED_BY_ADMIN` products.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Search results fetched.",
  "data": {
    "data": [ "...array of ProductResponse..." ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 84,
      "total_pages": 5
    }
  }
}
```

---

### GET /products/{id}
**Get a single product's public detail**

- **Auth:** None (public)
- **URL param:** `id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Successfully fetched product details.",
  "data": {
    "productId": "uuid",
    "name": "string",
    "description": "string",
    "price": 150000,
    "stock": 5,
    "status": "ACTIVE",
    "originCountry": "Japan",
    "purchaseDate": "2025-12-01",
    "weightGram": 200,
    "serviceFee": 15000,
    "images": ["url1", "url2"],
    "tags": ["tag1", "tag2"],
    "category": {
      "id": 3,
      "name": "Cosmetics"
    },
    "jastiper": {
      "userId": "uuid",
      "username": "string | null",
      "fullName": "string | null",
      "profilePictureUrl": "string | null",
      "avgRating": 4.7,
      "totalOrders": 120
    },
    "stats": {
      "totalOrders": 42,
      "totalReviews": 38,
      "avgRating": 4.5
    }
  }
}
```

**Note:** `ProductResponse` fields use **camelCase** (no `@JsonNaming` snake_case strategy). This is different from `CategoryResponse`.

**Error responses:**
| Status | When |
|--------|------|
| `404`  | Product not found |

---

### POST /products
**Create a new product listing**

- **Auth:** JWT required
- **Required role:** `JASTIPER`

**Request Body:**
```json
{
  "name": "string (required, max 255 chars)",
  "description": "string (required, max 5000 chars)",
  "price": 150000,
  "stock": 10,
  "origin_country": "Japan",
  "purchase_date": "2025-12-01",
  "category_id": 3,
  "weight_gram": 200,
  "service_fee": 15000,
  "images": ["url1", "url2"],
  "tags": ["tag1", "tag2"]
}
```

**Validation:**
- `name`: required, not blank, max 255 chars
- `description`: required, not blank, max 5000 chars
- `price`: required, must be positive (> 0)
- `stock`: required, must be ≥ 0
- `origin_country`: required, not blank
- `purchase_date`: required (`YYYY-MM-DD`)
- `service_fee`: optional, must be ≥ 0 if provided
- `images`: optional, max 5 items
- `category_id`, `weight_gram`, `tags`: all optional

**Response `201 Created`:**
```json
{
  "success": true,
  "message": "Product created successfully.",
  "data": { "...ProductResponse object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `JASTIPER` |

---

### PATCH /products/{id}
**Update an existing product (owner only)**

- **Auth:** JWT required
- **Required role:** `JASTIPER` (must own the product)
- **URL param:** `id` — UUID

**Request Body:** (all fields optional — only provided fields are updated)
```json
{
  "name": "string (max 255)",
  "description": "string (max 5000)",
  "price": 160000,
  "stock": 8,
  "status": "ACTIVE | OUT_OF_STOCK | HIDDEN",
  "categoryId": 4,
  "originCountry": "Korea",
  "purchaseDate": "2026-01-15",
  "serviceFee": 20000,
  "weightGram": 250,
  "images": ["url1"],
  "tags": ["newtag"]
}
```

**Note:** `status` can be set by the jastiper to `HIDDEN` (to deactivate a listing) but not to `REMOVED_BY_ADMIN`. Admin-only statuses are set via the moderation endpoint.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Product updated successfully.",
  "data": { "...ProductResponse object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Validation failure |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `JASTIPER` |
| `404`  | Product not found or does not belong to this jastiper |

---

### DELETE /products/{id}
**Soft-delete a product (owner only)**

- **Auth:** JWT required
- **Required role:** `JASTIPER` (must own the product)
- **URL param:** `id` — UUID

Sets `deleted_at` on the product (soft delete). Product is no longer visible in public searches.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Product deleted successfully.",
  "data": null
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `JASTIPER` |
| `404`  | Product not found or does not belong to this jastiper |
| `409`  | Product has active orders (`ActiveOrderException`). Response includes: `"active_orders": [...]` |

---

### GET /products/my
**Get the authenticated jastiper's own product catalog**

- **Auth:** JWT required
- **Required role:** `JASTIPER`

**Query Parameters:**
| Param    | Type      | Default | Description                                                       |
|----------|-----------|---------|-------------------------------------------------------------------|
| `search` | `string`  | —       | Keyword search                                                    |
| `status` | `string`  | —       | Filter by `ACTIVE`, `OUT_OF_STOCK`, `HIDDEN`, `REMOVED_BY_ADMIN`  |
| `page`   | `integer` | —       | Spring Pageable — page number (0-based internally, pass 0 or use default) |
| `size`   | `integer` | —       | Spring Pageable — page size                                       |
| `sort`   | `string`  | —       | Spring Pageable — e.g. `createdAt,desc`                           |

Returns all products owned by the authenticated jastiper, including `HIDDEN` and `REMOVED_BY_ADMIN` ones.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "My catalog fetched successfully.",
  "data": {
    "data": [ "...array of ProductResponse..." ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 15,
      "total_pages": 1
    }
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `JASTIPER` |

---

### GET /products/my/{id}
**Get detail of one of the jastiper's own products**

- **Auth:** JWT required
- **Required role:** `JASTIPER` (must own the product)
- **URL param:** `id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "My product detail fetched.",
  "data": { "...ProductResponse object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `JASTIPER` |
| `404`  | Product not found or does not belong to this jastiper |

---

### GET /jastipers/{username}/products
**Get a jastiper's public product catalog by their username**

- **Auth:** None (public)
- **URL param:** `username` — string (the jastiper's username from Auth Service)

**Query Parameters:**
| Param            | Type      | Description                  |
|------------------|-----------|------------------------------|
| `q`              | `string`  | Keyword search               |
| `min_price`      | `long`    | Minimum price                |
| `max_price`      | `long`    | Maximum price                |
| `category_id`    | `integer` | Filter by category           |
| `origin_country` | `string`  | Filter by country of origin  |
| `page`           | `integer` | Spring Pageable page         |
| `size`           | `integer` | Spring Pageable size         |
| `sort`           | `string`  | Spring Pageable sort         |

Only returns `ACTIVE` products. Internally resolves the `username` → `jastiperId` UUID by calling the Auth Service.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Fetched jastiper catalog successfully.",
  "data": {
    "data": [ "...array of ProductResponse..." ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 8,
      "total_pages": 1
    }
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `404`  | Username not found in Auth Service |

---

### GET /admin/products
**List all products (admin view, all statuses)**

- **Auth:** JWT required
- **Required role:** `ADMIN`

**Query Parameters:**
| Param        | Type      | Description                                          |
|--------------|-----------|------------------------------------------------------|
| `q`          | `string`  | Keyword search                                       |
| `jastiperId` | `UUID`    | Filter by jastiper UUID                              |
| `status`     | `string`  | Filter by status (case-insensitive): `ACTIVE`, `OUT_OF_STOCK`, `HIDDEN`, `REMOVED_BY_ADMIN` |
| `categoryId` | `integer` | Filter by category ID                                |
| `page`       | `integer` | Spring Pageable page                                 |
| `size`       | `integer` | Spring Pageable size                                 |
| `sort`       | `string`  | Spring Pageable sort (e.g. `createdAt,desc`)         |

Returns products of all statuses including `HIDDEN` and `REMOVED_BY_ADMIN`.

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Product list successfully retrieved by Admin.",
  "data": {
    "data": [ "...array of ProductResponse..." ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 300,
      "total_pages": 15
    }
  }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |

---

### GET /admin/products/{id}
**Get full product detail (admin view)**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `id` — UUID

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Admin product details successfully retrieved.",
  "data": { "...ProductResponse object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | Product not found |

---

### PATCH /admin/products/{id}/moderate
**Moderate a product (hide, remove, restore, activate)**

- **Auth:** JWT required
- **Required role:** `ADMIN`
- **URL param:** `id` — UUID

**Request Body:**
```json
{
  "action": "HIDE | REMOVE | RESTORE | ACTIVATE",
  "reason": "string (required — logged in moderation log)"
}
```

**Action effects:**
- `HIDE` → status becomes `HIDDEN`
- `REMOVE` → status becomes `HIDDEN`, `deleted_at` is set (soft delete)
- `RESTORE` → status becomes `ACTIVE`, `deleted_at` cleared
- `ACTIVATE` → status becomes `ACTIVE`, `deleted_at` cleared

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Moderation successfully recorded.",
  "data": { "...ProductResponse object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Invalid `action` value (must be one of `REMOVE`, `RESTORE`, `HIDE`, `ACTIVATE`) |
| `401`  | Missing or invalid JWT |
| `403`  | Role is not `ADMIN` |
| `404`  | Product not found |

---

## Internal Endpoints

> Called **only** by other microservices (primarily the Order Service). Never called from the frontend. Authentication is via `X-Service-Key` header, not JWT. Response bodies are **not** wrapped in the standard `ApiResponse` envelope for reserve; release and post-order use it.

---

### POST /internal/products/{id}/stock/reserve
**Reserve stock for a new order**

- **Auth:** `X-Service-Key` header
- **URL param:** `id` — UUID (product ID)

**Request Body:**
```json
{
  "order_id": "uuid",
  "quantity": 2
}
```

**Validation:**
- `quantity`: must be > 0

**Business logic:**
- If a non-released reservation for this `order_id` + product already exists, returns the existing reservation (idempotent)
- If product is not `ACTIVE` or has insufficient stock → fails
- Deducts `quantity` from `stock`; if stock reaches 0, sets product status to `OUT_OF_STOCK`
- Creates a `PENDING` reservation expiring in **15 minutes**

**Response `200 OK`** (raw, not wrapped):
```json
{
  "productId": "uuid",
  "reservedQuantity": 2,
  "remainingStock": 3,
  "reservationId": "uuid",
  "status": "RESERVED"
}
```

**Error responses:**
| Status | Raw body |
|--------|----------|
| `400`  | `{ "success": false, "message": "Reservation failed. Product not found, inactive, or insufficient stock." }` |
| `401`  | `{ "success": false, "message": "Unauthorized: Invalid or missing Internal API Key" }` |

---

### POST /internal/products/{id}/stock/release
**Release a stock reservation (on order cancel/refund)**

- **Auth:** `X-Service-Key` header
- **URL param:** `id` — UUID (product ID)

**Request Body:**
```json
{
  "order_id": "uuid",
  "quantity": 2,
  "reason": "string (optional — pass 'OUT_OF_STOCK' to skip returning stock)"
}
```

**Validation:**
- `quantity`: must be > 0

**Business logic:**
- Finds the reservation by `order_id` + product ID
- If `reason` is `"OUT_OF_STOCK"` (case-insensitive): sets stock to 0, keeps `OUT_OF_STOCK` status — physical stock was actually unavailable
- Otherwise: returns `quantity` to stock; if product was `OUT_OF_STOCK` and stock > 0, sets back to `ACTIVE`
- Marks reservation as `RELEASED`

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Stock released successfully.",
  "data": { "...ProductResponse object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `401`  | Invalid or missing `X-Service-Key` |
| `404`  | Reservation not found or already released |

---

### POST /internal/products/{id}/post-order
**Process post-order state (confirm sale or cancel)**

- **Auth:** `X-Service-Key` header
- **URL param:** `id` — UUID (product ID)

Called when an order reaches a terminal state. Updates product stats and reservation status.

**Request Body:**
```json
{
  "order_id": "uuid",
  "action": "CONFIRM | CANCEL",
  "rating": 4.5,
  "review_text": "string (optional)",
  "reason": "string (optional — pass 'OUT_OF_STOCK' on cancel to suppress stock return)"
}
```

**`CONFIRM` action:**
- Marks the `PENDING` reservation as `CONFIRMED`
- Increments `total_orders` on the product
- If `rating` is provided (1.0–5.0): recalculates `avg_rating` and increments `total_reviews`

**`CANCEL` action:**
- If `reason` is `"OUT_OF_STOCK"`: sets product stock to 0, status to `OUT_OF_STOCK`
- Otherwise: returns reservation quantity to stock; if stock > 0 and was `OUT_OF_STOCK`, sets back to `ACTIVE`
- Marks reservation as `RELEASED`

**Response `200 OK`:**
```json
{
  "success": true,
  "message": "Post-order processed successfully.",
  "data": { "...ProductResponse object..." }
}
```

**Error responses:**
| Status | When |
|--------|------|
| `400`  | Invalid `action` value (must be `CONFIRM` or `CANCEL`) |
| `401`  | Invalid or missing `X-Service-Key` |
| `404`  | Product or pending reservation not found |

---

## Shared Object Shape

### ProductResponse (camelCase — no snake_case strategy)
```json
{
  "productId": "uuid",
  "name": "string",
  "description": "string",
  "price": 150000,
  "stock": 5,
  "status": "ACTIVE | OUT_OF_STOCK | HIDDEN | REMOVED_BY_ADMIN",
  "originCountry": "Japan",
  "purchaseDate": "2025-12-01",
  "weightGram": 200,
  "serviceFee": 15000,
  "images": ["url1", "url2"],
  "tags": ["tag1"],
  "category": {
    "id": 3,
    "name": "Cosmetics"
  },
  "jastiper": {
    "userId": "uuid",
    "username": "string | null",
    "fullName": "string | null",
    "profilePictureUrl": "string | null",
    "avgRating": 4.7,
    "totalOrders": 120
  },
  "stats": {
    "totalOrders": 42,
    "totalReviews": 38,
    "avgRating": 4.5
  }
}
```

### CategoryResponse (snake_case via `@JsonNaming(SnakeCaseStrategy)`)
```json
{
  "category_id": 1,
  "name": "Electronics",
  "slug": "electronics",
  "description": "string | null",
  "product_count": 42
}
```

---

## Common Mistakes to Avoid

- **`ProductResponse` is camelCase, `CategoryResponse` is snake_case.** These two DTO classes use different naming strategies — don't assume consistency across endpoints.
- **Category ID is an `integer`, not a UUID.** It is an auto-incremented integer primary key, not a UUID.
- **`price` and `serviceFee` are integers in IDR** (no decimals). Format for display in the UI accordingly.
- **`purchaseDate` is `YYYY-MM-DD` (LocalDate), not a full ISO8601 datetime.** Do not append time or timezone.
- **Public search only returns `ACTIVE` products.** Do not attempt to filter by `HIDDEN` or `REMOVED_BY_ADMIN` on the public `/products` endpoint — those are filtered server-side.
- **`/products/my` must come before `/products/{id}` in route matching** — `my` is a literal path segment, not a UUID. Ensure your Next.js route file doesn't resolve it as a dynamic segment.
- **`jastiperId` is injected by the JWT filter as a request attribute** — never pass it in the request body for `POST /products`, `PATCH /products/{id}`, etc.
- **`/internal/*` endpoints never return the `ApiResponse` wrapper for the reserve endpoint** — parse the raw `StockOperationResponse` JSON directly.
- **Reservation expiry is 15 minutes.** If a user takes more than 15 minutes from adding to cart to completing checkout, the stock reservation may have been released. Handle this gracefully on the frontend by re-checking availability.
- **Do not call `/internal/*` from the frontend** — these are service-to-service only and guarded by `X-Service-Key`.
- Use `NEXT_PUBLIC_INVENTORY_SERVICE_URL` env var for the base URL — never hardcode `http://localhost:8083`.
