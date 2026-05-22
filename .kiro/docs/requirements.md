# JaStip Online Nasional (JSON) — Requirements Document

## 1.1 Functional Requirements

---

### Module: AUTH — Auth & Profile

- **FR-AUTH-1**: Guest users can register a new account using email and password; the default role is TITIPERS.
  - Acceptance Criteria: A POST to /auth/register with a valid email, password (min 8 chars, at least one letter and one number), password_confirmation, and role=TITIPERS returns HTTP 200 with a user_id, email, role=TITIPERS, and created_at. The account status is ACTIVE immediately.
  - Priority: MUST

- **FR-AUTH-2**: Guest users can register as a JASTIPER; the account starts with PENDING_VERIFICATION status and cannot operate until KYC is approved.
  - Acceptance Criteria: A POST to /auth/register with role=JASTIPER returns HTTP 200 with status=PENDING_VERIFICATION. The user can log in but cannot use protected JASTIPER features until an admin approves their KYC (login only fails for BANNED accounts, not PENDING_VERIFICATION). Attempting to register with role=ADMIN returns HTTP 400 with message "Cannot request admin role".
  - Priority: MUST

- **FR-AUTH-3**: If a username is not provided during registration, the system auto-generates one from the email prefix (the part before the @ symbol).
  - Acceptance Criteria: A user registered with email "john.doe@example.com" and no explicit username field has a username derived from "john.doe" (or a sanitized/unique variant). The username is visible in GET /profile/me.
  - Priority: SHOULD

- **FR-AUTH-4**: Authenticated users can update their own profile, including username, full_name, phone_number, and profile_picture_url.
  - Acceptance Criteria: A PATCH to /profile/me with a valid username (max 30 chars, alphanumeric + underscore only) returns HTTP 200 with the updated profile. Attempting to set a username longer than 30 chars or containing invalid characters returns HTTP 400. Attempting to set a username already taken by another user returns HTTP 400.
  - Priority: MUST

- **FR-AUTH-5**: TITIPERS can submit a KYC application to become a JASTIPER by providing full_name_ktp, ktp_number (exactly 16 digits), ktp_photo_url, selfie_with_ktp_url, at least one social_media_links entry, and an optional bio.
  - Acceptance Criteria: A POST to /profile/me/kyc with all required fields returns HTTP 200 and sets kyc_status to PENDING_VERIFICATION. Submitting with a ktp_number that is not exactly 16 digits returns HTTP 400. Submitting with an empty social_media_links array returns HTTP 400. Only users with role=TITIPERS can submit; JASTIPER or ADMIN roles receive HTTP 403.
  - Priority: MUST

- **FR-AUTH-6**: ADMIN can approve or reject a KYC submission. Rejection requires a rejection-reason (hyphen, not underscore).
  - Acceptance Criteria: A PATCH to /admin/kyc/{kycId}/review with action=APPROVE returns HTTP 200 and sets the KYC status to APPROVED. A PATCH with action=REJECT and a non-empty rejection-reason field returns HTTP 200 and sets the KYC status to REJECTED. A PATCH with action=REJECT and no rejection-reason returns HTTP 400. The field name in the request body must be "rejection-reason" (with a hyphen) — using "rejection_reason" (underscore) will silently fail validation.
  - Priority: MUST

- **FR-AUTH-7**: An approved JASTIPER retains all TITIPERS buying privileges but cannot purchase from their own product listings.
  - Acceptance Criteria: After KYC approval, the user's role is updated to JASTIPER. The user can still browse and place orders on other jastipers' products. Attempting to place an order on a product owned by the same user returns an error. The frontend must check jastiper_id on the product against the authenticated user's user_id before showing the checkout button.
  - Priority: MUST

- **FR-AUTH-8**: Public JASTIPER profiles display stats (total_orders, success_rate, avg_rating), rating, and badges.
  - Acceptance Criteria: A GET to /profile/{username} for a JASTIPER account returns a data object that includes stats.total_orders, stats.success_rate, stats.avg_rating, rating, and badges. These fields are omitted (not null) for TITIPERS accounts due to @JsonInclude(NON_NULL).
  - Priority: MUST

- **FR-AUTH-9**: ADMIN can list all users with filters for status, role, and a search term, with pagination.
  - Acceptance Criteria: A GET to /admin/users with optional query params status, role, search, page, and limit returns a paginated list of users. Invalid status or role enum values return HTTP 400. Non-ADMIN tokens receive HTTP 403.
  - Priority: MUST

- **FR-AUTH-10**: ADMIN can view the full detail of any user, including KYC information and stats.
  - Acceptance Criteria: A GET to /admin/users/{userId} returns the user's full profile including kyc_id, kyc_status, kyc_submitted_at, kyc_reviewed_at, kyc_rejection_reason, and stats. A non-existent userId returns HTTP 404.
  - Priority: MUST

- **FR-AUTH-11**: ADMIN can ban or unban any user account.
  - Acceptance Criteria: After an admin bans a user, the user's status becomes BANNED. A subsequent login attempt by the banned user returns HTTP 403 with message "Account is banned". After an admin unbans the user, the user can log in again normally.
  - Priority: MUST

- **FR-AUTH-12**: Access tokens expire in 15 minutes. The frontend auto-refreshes the token via the BFF route /api/auth/refresh-token before or upon receiving a 401 response.
  - Acceptance Criteria: The useAuthorizedFetch hook transparently retries a failed 401 request after calling /api/auth/refresh-token. The new token is stored in AuthProvider context (never in localStorage or sessionStorage). If the refresh also fails (e.g., token revoked), the user is redirected to /login.
  - Priority: MUST

---

### Module: INV — Inventory & Catalog

- **FR-INV-1**: JASTIPER can create a new product listing with name, description, price, stock, origin_country, and purchase_date as required fields; category_id, weight_gram, service_fee, images (max 5), and tags are optional.
  - Acceptance Criteria: A POST to /products with all required fields and a valid JASTIPER JWT returns HTTP 201 with a ProductResponse. Omitting any required field returns HTTP 400 with a validation errors array. Providing more than 5 images returns HTTP 400. A non-JASTIPER token returns HTTP 403.
  - Priority: MUST

- **FR-INV-2**: JASTIPER can update their own product listing. They can set status to HIDDEN but not to REMOVED_BY_ADMIN.
  - Acceptance Criteria: A PATCH to /products/{id} by the owning JASTIPER returns HTTP 200 with the updated ProductResponse. Setting status=HIDDEN is accepted. Setting status=REMOVED_BY_ADMIN is rejected. Attempting to update a product owned by a different JASTIPER returns HTTP 404.
  - Priority: MUST

- **FR-INV-3**: JASTIPER can soft-delete their own product. Deletion is blocked if the product has active orders.
  - Acceptance Criteria: A DELETE to /products/{id} by the owning JASTIPER returns HTTP 200 and sets deleted_at. If the product has active orders, the response is HTTP 409 with an active_orders array. The product no longer appears in public search after deletion.
  - Priority: MUST

- **FR-INV-4**: JASTIPER can view their own catalog including HIDDEN and REMOVED_BY_ADMIN products.
  - Acceptance Criteria: A GET to /products/my with a valid JASTIPER JWT returns all products owned by that jastiper, including those with status HIDDEN and REMOVED_BY_ADMIN. A non-JASTIPER token returns HTTP 403.
  - Priority: MUST

- **FR-INV-5**: Public users can search products by keyword, jastiperId, minPrice, maxPrice, categoryId, origin_country, purchase_date range, with pagination and sorting. Only ACTIVE products are returned.
  - Acceptance Criteria: A GET to /products with any combination of query params returns a paginated list of ProductResponse objects. All returned products have status=ACTIVE. HIDDEN and REMOVED_BY_ADMIN products never appear in public search results.
  - Priority: MUST

- **FR-INV-6**: Public users can view the full detail of a single product.
  - Acceptance Criteria: A GET to /products/{id} for an existing ACTIVE product returns HTTP 200 with the full ProductResponse including jastiper info and stats. A non-existent product ID returns HTTP 404.
  - Priority: MUST

- **FR-INV-7**: Public users can view a JASTIPER's catalog by their username.
  - Acceptance Criteria: A GET to /jastipers/{username}/products returns a paginated list of ACTIVE products owned by the jastiper with that username. If the username does not exist in the Auth Service, the response is HTTP 404.
  - Priority: MUST

- **FR-INV-8**: Stock reservation during checkout is atomic — overselling is strictly forbidden.
  - Acceptance Criteria: When two concurrent checkout requests are made for the last unit of a product, exactly one succeeds and the other receives an error indicating insufficient stock. The product's stock count never goes below zero. The reservation is created with PENDING status and expires after 15 minutes.
  - Priority: MUST

- **FR-INV-9**: Stock reservations expire after 15 minutes if not confirmed. A scheduled job runs every 60 seconds to release expired PENDING reservations and return stock.
  - Acceptance Criteria: A reservation created at time T is automatically released at T+15 minutes if it remains in PENDING status. The product's stock is restored. The cleanup job runs at most 60 seconds after expiry. The frontend shows a countdown or warning when the reservation is close to expiry.
  - Priority: MUST

- **FR-INV-10**: ADMIN can view all products regardless of status.
  - Acceptance Criteria: A GET to /admin/products with a valid ADMIN JWT returns products of all statuses including HIDDEN and REMOVED_BY_ADMIN. Filtering by status, jastiperId, categoryId, and keyword is supported.
  - Priority: MUST

- **FR-INV-11**: ADMIN can moderate any product using actions HIDE, REMOVE, RESTORE, or ACTIVATE, with a required reason.
  - Acceptance Criteria: A PATCH to /admin/products/{id}/moderate with action=HIDE sets status to HIDDEN. action=REMOVE sets status to HIDDEN and sets deleted_at. action=RESTORE and action=ACTIVATE both set status to ACTIVE and clear deleted_at. The reason field is required and logged. An invalid action value returns HTTP 400.
  - Priority: MUST

- **FR-INV-12**: ADMIN can manage categories: create, update, and delete. A category cannot be deleted if products are assigned to it.
  - Acceptance Criteria: POST /admin/categories creates a new category and returns HTTP 201. PATCH /admin/categories/{id} updates an existing category. DELETE /admin/categories/{id} returns HTTP 200 if no products are assigned. If products are assigned, DELETE returns HTTP 409 with a product_count field. Duplicate category names return HTTP 409.
  - Priority: MUST

---

### Module: ORD — Order Management

- **FR-ORD-1**: TITIPERS can checkout a product by providing product_id, quantity (min 1), a shipping_address with postal_code (exactly 5 digits), and an optional note_to_jastiper (max 500 chars).
  - Acceptance Criteria: A POST to /orders with valid fields and a TITIPERS JWT returns HTTP 201 with the full Order object in PENDING status. quantity < 1 returns HTTP 400. postal_code not exactly 5 digits returns HTTP 400. note_to_jastiper exceeding 500 chars returns HTTP 400.
  - Priority: MUST

- **FR-ORD-2**: The system verifies stock availability and wallet balance at checkout before creating the order.
  - Acceptance Criteria: If the product has insufficient stock, the checkout fails with an appropriate error. If the TITIPERS wallet balance is less than total_price, the checkout fails with an insufficient balance error. Both checks happen before the order is persisted.
  - Priority: MUST

- **FR-ORD-3**: TITIPERS can pay for a PENDING order from their wallet, transitioning the order to PAID status.
  - Acceptance Criteria: A PATCH to /orders/{order_id}/payment by the order's titipers returns HTTP 200 with the order in PAID status. The wallet balance is deducted and the amount is moved to escrow_balance. Attempting to pay an order not in PENDING status returns HTTP 422.
  - Priority: MUST

- **FR-ORD-4**: JASTIPER can mark a PAID order as PURCHASED, indicating they have physically bought the product.
  - Acceptance Criteria: A PATCH to /orders/{order_id}/purchased by the assigned JASTIPER or ADMIN returns HTTP 200 with the order in PURCHASED status. Attempting this on an order not in PAID status returns HTTP 422.
  - Priority: MUST

- **FR-ORD-5**: JASTIPER can mark a PURCHASED order as SHIPPED by providing tracking_number and courier.
  - Acceptance Criteria: A PATCH to /orders/{order_id}/shipped by the assigned JASTIPER or ADMIN returns HTTP 200 with the order in SHIPPED status, including tracking_number and courier. Attempting this on an order not in PURCHASED status returns HTTP 422.
  - Priority: MUST

- **FR-ORD-6**: TITIPERS can confirm receipt of a SHIPPED order, transitioning it to COMPLETED.
  - Acceptance Criteria: A PATCH to /orders/{order_id}/confirm by the order's TITIPERS or ADMIN returns HTTP 200 with the order in COMPLETED status and completed_at set. Attempting this on an order not in SHIPPED status returns HTTP 422. On COMPLETED, the escrowed funds are released to the JASTIPER's wallet as an EARNING transaction.
  - Priority: MUST

- **FR-ORD-7**: JASTIPER or ADMIN can cancel a PENDING order with a required cancellation_reason (max 500 chars). JASTIPER or ADMIN can cancel PAID or PURCHASED orders (triggering REFUNDING). ADMIN only can cancel SHIPPED orders (triggering REFUNDING).
  - Acceptance Criteria: A POST to /orders/{order_id}/cancel with a valid cancellation_reason by an authorized role returns HTTP 200. PENDING → CANCELLED directly. PAID/PURCHASED → REFUNDING (triggers refund flow). SHIPPED → REFUNDING (ADMIN only). Missing or too-long cancellation_reason returns HTTP 400. Unauthorized role for the current status returns HTTP 403.
  - Priority: MUST

- **FR-ORD-8**: Cancellation of a PAID, PURCHASED, or SHIPPED order triggers an automatic refund to the TITIPERS wallet.
  - Acceptance Criteria: When an order transitions to REFUNDING, the Order Service calls the Payment Service to initiate a refund. On successful refund, the order transitions to CANCELLED and the TITIPERS wallet balance is restored. On failed refund, the order transitions to REFUND_FAILED. ADMIN can manually move REFUND_FAILED → CANCELLED.
  - Priority: MUST

- **FR-ORD-9**: Order status transitions are strictly validated — no skipping steps is allowed.
  - Acceptance Criteria: Attempting any transition not in the defined state machine (e.g., PENDING → COMPLETED, PAID → SHIPPED) returns HTTP 422 with current_status, requested_status, and valid_transitions in the error body. Terminal states COMPLETED and CANCELLED cannot be transitioned further.
  - Priority: MUST

- **FR-ORD-10**: TITIPERS can view their purchase history with pagination.
  - Acceptance Criteria: A GET to /orders/my/purchases returns a paginated list of orders where the authenticated user is the titipers. Supports page, limit, sort_by, and order query params. limit > 1000 returns HTTP 400.
  - Priority: MUST

- **FR-ORD-11**: JASTIPER can view their incoming sales orders with pagination.
  - Acceptance Criteria: A GET to /orders/my/sales returns a paginated list of orders where the authenticated user is the jastiper. Supports the same pagination params as purchases.
  - Priority: MUST

- **FR-ORD-12**: TITIPERS can rate the JASTIPER's service (1.0–5.0, review max 1000 chars) after an order reaches COMPLETED status.
  - Acceptance Criteria: A POST to /orders/{order_id}/rating/jastiper with jastiper_rating in [1.0, 5.0] and optional jastiper_review (max 1000 chars) returns HTTP 201. Rating out of range returns HTTP 400. Rating a non-COMPLETED order returns HTTP 422. Duplicate rating returns HTTP 409.
  - Priority: MUST

- **FR-ORD-13**: TITIPERS can rate the product quality (1.0–5.0, review max 1000 chars, images max 3) after an order reaches COMPLETED status.
  - Acceptance Criteria: A POST to /orders/{order_id}/rating/product with product_rating in [1.0, 5.0], optional product_review (max 1000 chars), and optional product_images (max 3 URLs) returns HTTP 201. More than 3 images returns HTTP 400. Rating a non-COMPLETED order returns HTTP 422. Duplicate rating returns HTTP 409.
  - Priority: MUST

- **FR-ORD-14**: ADMIN can monitor all orders across all users.
  - Acceptance Criteria: ADMIN has access to all order data. The admin orders page displays orders from all users with filtering and pagination capabilities.
  - Priority: MUST

---

### Module: WAL — Wallet & Transactions

- **FR-WAL-1**: Every registered user has a digital wallet automatically associated with their account.
  - Acceptance Criteria: After registration, a wallet exists for the user (or is created on first access). GET /wallets/me returns the wallet with wallet_id, user_id, and balance. A missing wallet returns HTTP 404.
  - Priority: MUST

- **FR-WAL-2**: TITIPERS can request a top-up by providing amount, payment_method, bank_code, and a unique idempotency_key.
  - Acceptance Criteria: A POST to /topups with all four required fields returns HTTP 201 with a PENDING transaction. All four fields are required; missing any returns HTTP 400. A duplicate idempotency_key returns HTTP 409. The top-up does not immediately credit the balance — it requires admin approval.
  - Priority: MUST

- **FR-WAL-3**: Top-up requests start in PENDING status. An ADMIN must approve the top-up to credit the balance.
  - Acceptance Criteria: After admin approval via PATCH /admin/topups/{transaction_id} with action=APPROVE, the user's wallet balance increases by the top-up amount and the transaction status becomes SUCCESS. Rejecting with action=REJECT and a rejection_reason sets the transaction to FAILED/CANCELLED without crediting the balance.
  - Priority: MUST

- **FR-WAL-4**: JASTIPER can request a withdrawal by providing amount, bank_account_id, idempotency_key, and notes (all required).
  - Acceptance Criteria: A POST to /withdrawals with all four required fields returns HTTP 200 with a PENDING transaction. The amount is immediately deducted from the wallet balance. Insufficient balance returns HTTP 422 with balance and required fields. A duplicate idempotency_key returns HTTP 409.
  - Priority: MUST

- **FR-WAL-5**: Withdrawal requests start in PENDING status. An ADMIN must process the withdrawal.
  - Acceptance Criteria: After admin processing via PATCH /admin/withdrawals/{transaction_id} with action=APPROVE, the withdrawal is marked as processed. Rejecting with action=REJECT and a rejection_reason cancels the withdrawal. The balance is not restored on rejection (it was deducted at submission time — this is a business rule to confirm).
  - Priority: MUST

- **FR-WAL-6**: Wallet balance is automatically deducted at checkout. The balance cannot go negative.
  - Acceptance Criteria: When a TITIPERS places an order, the total_price is deducted from their wallet balance and added to escrow_balance atomically. If balance < total_price, the checkout fails with HTTP 422 and the order is not created. The wallet balance never goes below zero.
  - Priority: MUST

- **FR-WAL-7**: Wallet balance is automatically refunded when an order is cancelled.
  - Acceptance Criteria: When an order transitions to CANCELLED (from REFUNDING), the escrowed amount is returned from escrow_balance to the TITIPERS wallet balance as a REFUND transaction. The TITIPERS wallet balance is restored to its pre-checkout value.
  - Priority: MUST

- **FR-WAL-8**: Users can view their full transaction history including type, direction, status, description, and created_at.
  - Acceptance Criteria: A GET to /transactions returns an array of all transactions for the authenticated user. Each transaction includes transaction_id, type, amount, direction, status, description, and created_at.
  - Priority: MUST

- **FR-WAL-9**: Users can view the detail of a specific transaction including reference_id, reference_type, payment_method, and other fields.
  - Acceptance Criteria: A GET to /transactions/{transactionId} returns the full transaction detail. Accessing a transaction belonging to another user returns HTTP 403. A non-existent transaction returns HTTP 404.
  - Priority: MUST

- **FR-WAL-10**: ADMIN can approve or reject top-up requests.
  - Acceptance Criteria: A PATCH to /admin/topups/{transaction_id} with action=APPROVE credits the user's balance and returns the new_balance. action=REJECT with a rejection_reason rejects the top-up. An already-processed transaction returns HTTP 409.
  - Priority: MUST

- **FR-WAL-11**: ADMIN can approve or reject withdrawal requests.
  - Acceptance Criteria: A PATCH to /admin/withdrawals/{transaction_id} with action=APPROVE or action=REJECT processes the withdrawal. Returns the updated transaction with processed_at and optional transfer_reference.
  - Priority: MUST

- **FR-WAL-12**: ADMIN can view all transactions across all users with filtering by user_id, type, status, date range, and min_amount, with pagination.
  - Acceptance Criteria: A GET to /admin/transactions with optional filters returns a paginated list of transactions with a summary object including total_topup, total_withdrawal, total_payment, total_refund, total_earning, and platform_escrow_balance.
  - Priority: MUST

- **FR-WAL-13**: ADMIN can view and create a wallet for any user.
  - Acceptance Criteria: A GET to /admin/wallets/{userQueryId} returns the full wallet object including escrow_balance and lifetime totals. A POST to /admin/wallets/{userId} creates a wallet for a user who doesn't have one, returning HTTP 201.
  - Priority: MUST

- **FR-WAL-14**: ADMIN can manually adjust a user's wallet balance (CREDIT or DEBIT) with a required reason.
  - Acceptance Criteria: A POST to /admin/wallets/{user_id}/adjust with direction=CREDIT or DEBIT, a positive amount, and a reason (max 500 chars) returns HTTP 200 with the new_balance. A DEBIT that would result in a negative balance returns HTTP 422 with current_balance and debit_amount. The adjustment creates an ADJUSTMENT type transaction.
  - Priority: MUST

- **FR-WAL-15**: The idempotency_key must be unique per top-up and withdrawal request. The frontend generates a UUID or timestamp-based key before submitting.
  - Acceptance Criteria: Submitting a top-up or withdrawal with an idempotency_key already used by a previous request returns HTTP 409 with the duplicate key in the response. The frontend generates a new UUID (e.g., crypto.randomUUID()) for each new submission attempt.
  - Priority: MUST

---

## 1.2 Non-Functional Requirements

### Concurrency & Race Conditions

- **NFR-CONC-1**: Stock reservation during checkout must be atomic. Overselling is strictly forbidden.
  - The inventory service uses database-level locking (pessimistic or optimistic) when decrementing stock and creating a reservation. Two concurrent requests for the last unit of stock must result in exactly one success and one failure. The stock count must never go below zero.

- **NFR-CONC-2**: Wallet balance deduction during checkout must be atomic. The balance cannot go negative.
  - The payment service uses database-level locking when deducting the order amount from the wallet balance. Two concurrent checkout requests that together exceed the available balance must result in exactly one success and one failure. The balance must never go below zero.

- **NFR-CONC-3**: Both stock reservation and wallet deduction use database-level locking (row-level SELECT FOR UPDATE or equivalent) to prevent race conditions under concurrent load.

- **NFR-CONC-4**: idempotency_key enforcement for top-up and withdrawal requests prevents duplicate financial operations. The database enforces a unique constraint on idempotency_key per transaction type.

### Security

- **NFR-SEC-1**: JWT tokens use HS256 algorithm, signed with the JWT_SECRET environment variable. Tokens expire in 15 minutes.
- **NFR-SEC-2**: The refresh token (which is actually the access token due to the backend naming quirk) is stored as an HttpOnly cookie named refresh_token. It is never accessible via JavaScript.
- **NFR-SEC-3**: The access token is held in React context (AuthProvider) in memory only. It is never persisted to localStorage, sessionStorage, or any other browser storage.
- **NFR-SEC-4**: Role-Based Access Control (RBAC) is enforced on both the backend (Spring Security @PreAuthorize) and the frontend (route guards in middleware.ts and component-level role checks).
- **NFR-SEC-5**: KYC data (ktp_number, ktp_photo_url, selfie_with_ktp_url) is sensitive PII. It must only be accessible to the submitting user and ADMIN. It must never be exposed in public API responses.
- **NFR-SEC-6**: The ADMIN role cannot be self-registered. Admin accounts must be seeded directly in the database.
- **NFR-SEC-7**: Internal service endpoints (/internal/*) use X-Service-Key authentication and must never be called from the frontend.
- **NFR-SEC-8**: All environment variables containing service URLs use the NEXT_PUBLIC_ prefix for client-side access. JWT_SECRET is server-side only and never exposed to the client.

### Data Integrity

- **NFR-INT-1**: All financial operations (wallet deduction, escrow transfer, refund, earnings release) are wrapped in ACID transactions. Partial updates are not permitted.
- **NFR-INT-2**: Order status transitions are validated against the defined state machine before any database write. Invalid transitions are rejected with HTTP 422.
- **NFR-INT-3**: Wallet transactions are immutable once created. No transaction record is deleted or modified after creation.
- **NFR-INT-4**: Product stock counts are always non-negative integers. The system enforces this at the database level.

### Performance

- **NFR-PERF-1**: Stock reservation operations must complete in under 500ms under normal load conditions.
- **NFR-PERF-2**: The reservation expiry cleanup job runs every 60 seconds, releasing expired PENDING reservations and restoring stock.
- **NFR-PERF-3**: Public product search (GET /products) must return results within 1 second for typical query parameters.
- **NFR-PERF-4**: TanStack Query v5 is used for all client-side data fetching to enable caching, background refetching, and stale-while-revalidate behavior.

### Scalability

- **NFR-SCALE-1**: The Next.js frontend is stateless. No session state is stored on the server. All state is either in the JWT (server-validated) or in React context (client-side).
- **NFR-SCALE-2**: The service layer in src/services/ is stateless. Each function call is independent and does not rely on shared mutable state.
- **NFR-SCALE-3**: The four backend microservices are independently deployable and scalable.

### Auditability

- **NFR-AUDIT-1**: Every order status change is logged in the order history with the actor's user ID, actor role, timestamp, and optional notes. This history is accessible via GET /orders/{order_id}/history.
- **NFR-AUDIT-2**: All wallet transactions are immutable records. Each transaction captures type, direction, status, amount, reference_id, reference_type, and confirmed_by (for admin-approved transactions).
- **NFR-AUDIT-3**: Product moderation actions (HIDE, REMOVE, RESTORE, ACTIVATE) are logged with the admin's ID and the required reason field.

---

## 1.3 Constraints

- **CON-1**: Jastipers cannot purchase from their own listings. The frontend must check the product's jastiper_id against the authenticated user's user_id and hide/disable the checkout button accordingly. The backend also enforces this rule.

- **CON-2**: Wallet balance cannot go negative. This is enforced at the database level in the Payment Service using row-level locking. The frontend should pre-check balance before showing the pay button, but the backend is the authoritative source.

- **CON-3**: Order status cannot skip steps. The valid transitions are strictly: PENDING → PAID → PURCHASED → SHIPPED → COMPLETED. Cancellation paths are: PENDING → CANCELLED, PAID/PURCHASED → REFUNDING, SHIPPED → REFUNDING (ADMIN only), REFUNDING → CANCELLED or REFUND_FAILED (SYSTEM only), REFUND_FAILED → CANCELLED (ADMIN only). Any other transition is rejected with HTTP 422.

- **CON-4**: KYC submissions can only be approved or rejected by users with the ADMIN role. No other role can change KYC status.

- **CON-5**: The ADMIN role cannot be self-registered via POST /auth/register. Sending role=ADMIN returns HTTP 400. Admin accounts must be created by direct database seeding.

- **CON-6**: The rejection-reason field in the KYC review endpoint (PATCH /admin/kyc/{kycId}/review) uses a hyphen, not an underscore. This is a backend quirk in the Java DTO. The frontend must send the field name as "rejection-reason" exactly. Using "rejection_reason" will result in the field being silently ignored, causing a validation failure.

- **CON-7**: All monetary amounts are integers in IDR (Indonesian Rupiah). There are no decimal values. The frontend must treat all amounts as plain integers (TypeScript number type). Never use parseFloat on monetary values.

- **CON-8**: ProductResponse from the Inventory Service uses camelCase field names (e.g., productId, originCountry, purchaseDate). CategoryResponse uses snake_case field names (e.g., category_id, product_count). This inconsistency exists in the backend and cannot be changed. The frontend TypeScript types must reflect this difference.

- **CON-9**: The Auth Service login response returns the access token in a field named refresh_token (data.refresh_token). This is a backend naming quirk and cannot be changed. The frontend must read the token from this field and use it as the access token for all subsequent requests.

- **CON-10**: The Payment Service uses RFC 9457 Problem Details format for all error responses (type, title, status, detail, instance). All other services use the { success, message, data, errors } envelope. The api-client.ts error normalization layer must handle both formats and normalize them into the internal ApiError shape.

- **CON-11**: Internal endpoints (/internal/* on all services) are service-to-service only and must never be called from the frontend. They use X-Service-Key authentication, not JWT.

- **CON-12**: The escrow_balance field in the wallet is not spendable by anyone. The user's spendable balance is the balance field only. The frontend must never display balance + escrow_balance as the available amount.
