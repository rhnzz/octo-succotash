# JaStip Online Nasional (JSON) — UI/UX Design Specification

This document defines the complete UI/UX design for every page and shared component in the JSON platform. Each page entry covers layout, components, API calls, user interactions, and edge cases.

---

## Public / Guest Pages
## Page: Landing Page
- **URL:** /
- **Access:** Public (all users including guests)
- **Purpose:** Introduce the JSON platform, showcase featured products, and direct users to register or browse.

### Layout and Components
The landing page uses a full-width layout with a sticky Navbar at the top. Sections:
1. Hero Section: Full-width banner with JSON logo, tagline "Jastip Online Nasional, Mudah dan Terpercaya", and two CTA buttons: "Mulai Belanja" (links to /catalog) and "Daftar Sebagai Jastiper" (links to /register). Background uses a gradient from --color-primary-dark to --color-primary.
2. Featured Products Section: Horizontally scrollable row of up to 8 ProductCard components showing ACTIVE products sorted by rating descending. Fetched from GET /products with limit=8&sortBy=rating&order=desc.
3. How It Works Section: Three-column icon grid explaining the jastip flow: (1) Pilih Produk — browse and select items from jastipers, (2) Bayar via Dompet — pay securely from your JSON wallet, (3) Terima Barang — receive your item delivered to your door.
4. Top Jastipers Section: Row of up to 6 jastiper profile mini-cards showing avatar, username, avg_rating (RatingStars), and total_orders. Clicking navigates to /jastiper/[username]. NOTE: No dedicated "top jastipers" endpoint exists in any service contract. This section uses GET /products?limit=8&sortBy=rating&order=desc and extracts unique jastiper info from the product results (jastiper.userId, jastiper.username, jastiper.avgRating, jastiper.totalOrders from ProductResponse.jastiper).
5. Category Quick Links: Grid of category chips/pills fetched from GET /categories. Clicking a category navigates to /catalog?categoryId=[id].
6. Footer: Links to About, FAQ, Contact, Terms of Service, Privacy Policy, and social media icons.

### Reusable Components Used
- Navbar
- ProductCard
- RatingStars
- LoadingSpinner / SkeletonLoader
- EmptyState

### API / Service Calls
- GET /products?limit=8&sortBy=rating&order=desc — fetches featured products
- GET /categories — fetches category list for quick links

### User Interactions
- Clicking "Mulai Belanja" navigates to /catalog
- Clicking "Daftar Sebagai Jastiper" navigates to /register
- Clicking a ProductCard navigates to /catalog/[productId]
- Clicking a jastiper mini-card navigates to /jastiper/[username]
- Clicking a category chip navigates to /catalog?categoryId=[id]
- Navbar shows Login and Register buttons for unauthenticated users
- Navbar shows user avatar and wallet balance for authenticated users

### Edge Cases and States
- Loading state: 8 ProductCard skeletons shown while featured products load; category chips show placeholder pills
- Empty state: If no products available, featured section shows EmptyState with message "Belum ada produk tersedia"
- Error state: If API call fails, a subtle inline error is shown below the section header; the rest of the page still renders normally

---

## Page: Login Page
- **URL:** /login
- **Access:** Public (redirects to /dashboard if already authenticated)
- **Purpose:** Allow existing users to authenticate and receive an access token.

### Layout and Components
Centered card layout on a light background. The card contains:
- JSON logo at the top
- Page title: "Masuk ke Akun Anda"
- Email input field with label "Email"
- Password input field with label "Kata Sandi" and a show/hide toggle
- Submit button: "Masuk" (full width, --color-primary background)
- Link below the form: "Belum punya akun? Daftar sekarang" linking to /register
- Inline error alert (role="alert") shown below the form on failure

### Reusable Components Used
- Navbar (minimal, no auth links)
- Toast / Notification

### API / Service Calls
- POST /api/auth/login (BFF route) — proxies to Auth Service, sets refresh_token HttpOnly cookie, returns access_token in body

### User Interactions
- User fills email and password fields
- Submitting the form calls the BFF login route using React 19 form action pattern
- On success: access token stored in AuthProvider context; user redirected to /dashboard (TITIPERS), /jastiper/dashboard (JASTIPER), or /admin/dashboard (ADMIN) based on role
- On failure: inline error message shown (e.g., "Email atau kata sandi salah", "Akun Anda telah diblokir")
- Loading state: submit button shows spinner and is disabled during request

### Edge Cases and States
- Loading state: Button text changes to "Memuat..." with a spinner; form fields are disabled
- Error state: Inline alert with role="alert" shows the error message from the API response
- Banned account: Shows specific message "Akun Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut."
- Already authenticated: Middleware redirects to appropriate dashboard before the page renders

---

## Page: Register Page
- **URL:** /register
- **Access:** Public (redirects to /dashboard if already authenticated)
- **Purpose:** Allow new users to create a TITIPERS or JASTIPER account.

### Layout and Components
Centered card layout matching the login page style. The card contains:
- JSON logo at the top
- Page title: "Buat Akun Baru"
- Role selector: Two toggle buttons "Pembeli (Titipers)" and "Jastiper". Selecting JASTIPER shows an informational banner: "Akun Jastiper memerlukan verifikasi KYC sebelum dapat beroperasi."
- Email input field
- Password input field with strength indicator
- Password confirmation input field
- Submit button: "Daftar" (full width)
- Link: "Sudah punya akun? Masuk" linking to /login
- Inline validation errors shown per field

### Reusable Components Used
- Navbar (minimal)
- KYCStatusBanner (for JASTIPER info notice)
- Toast / Notification

### API / Service Calls
- POST /auth/register — creates the account via Auth Service

### User Interactions
- User selects role (TITIPERS default), fills email, password, password_confirmation
- On submit: calls auth.service.ts register function
- On success (TITIPERS): redirects to /login with success toast "Akun berhasil dibuat. Silakan masuk."
- On success (JASTIPER): redirects to /login with info toast "Akun Jastiper dibuat. Tunggu verifikasi KYC dari admin."
- On failure: per-field validation errors shown inline

### Edge Cases and States
- Loading state: Submit button disabled with spinner
- Email already in use: Inline error "Email sudah terdaftar"
- Password mismatch: Inline error "Kata sandi tidak cocok"
- Password too weak: Inline error "Kata sandi minimal 8 karakter dan harus mengandung huruf dan angka"

---

## Page: Browse All Products (Catalog)
- **URL:** /catalog
- **Access:** Public
- **Purpose:** Allow users to search and browse all available ACTIVE products with filtering and pagination.

### Layout and Components
Two-column layout: a narrow left sidebar for filters and a main content area for product results.
Left Sidebar:
- SearchBar component at the top
- Category filter: dropdown or checkbox list from GET /categories
- Price range filter: two number inputs (Min Price, Max Price)
- Origin country filter: text input or dropdown
- Purchase date range: two date pickers (from, to)
- Sort options: dropdown with options Created At (Terbaru), Rating (Tertinggi), Price (Termurah/Termahal)
- Apply Filters button and Reset Filters link
Main Content Area:
- Results count: "Menampilkan X produk"
- Product grid: responsive 2-4 column grid of ProductCard components
- Pagination component at the bottom

### Reusable Components Used
- Navbar
- SearchBar
- ProductCard
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState

### API / Service Calls
- GET /products?q=&categoryId=&minPrice=&maxPrice=&origin_country=&purchase_date_from=&purchase_date_to=&page=&limit=&sortBy=&order= — fetches filtered products
- GET /categories — fetches category list for filter dropdown

### User Interactions
- Typing in SearchBar updates the q query param (debounced 300ms)
- Selecting a category updates categoryId param
- Changing price range updates minPrice/maxPrice params
- Clicking Apply Filters triggers a new API call with all current filter values
- Clicking Reset Filters clears all params and reloads
- Clicking a ProductCard navigates to /catalog/[productId]
- Pagination controls update the page param
- URL query params are kept in sync so the page is shareable/bookmarkable

### Edge Cases and States
- Loading state: Product grid replaced with 12 ProductCard skeletons
- Empty state: EmptyState component with message "Tidak ada produk yang sesuai dengan filter Anda" and a Reset Filters button
- Error state: Error message with retry button
- No filters applied: Shows all ACTIVE products sorted by newest

---

## Page: Product Detail Page
- **URL:** /catalog/[productId]
- **Access:** Public (checkout button only shown to authenticated TITIPERS who do not own the product)
- **Purpose:** Display full product information and allow TITIPERS to initiate checkout.

### Layout and Components
Two-column layout on desktop, single column on mobile:
Left Column (60%):
- Product image gallery: main image with thumbnail strip below (up to 5 images). Clicking a thumbnail updates the main image.
- Product tags: displayed as chips below the gallery
Right Column (40%):
- Product name (h1)
- StatusBadge showing product status (ACTIVE, OUT_OF_STOCK)
- Price: formatted as "Rp X.XXX.XXX" in large bold text
- Service fee: "Biaya Jasa: Rp X.XXX" in smaller text
- Total: "Total: Rp X.XXX.XXX" (price + service_fee)
- Stock indicator: "Stok: X tersisa" (red if stock <= 3)
- Origin country and purchase date
- Jastiper info card: avatar, username (links to /jastiper/[username]), RatingStars, total_orders
- Checkout button: "Beli Sekarang" (disabled if OUT_OF_STOCK, hidden if user is the jastiper, hidden if not authenticated)
- Login prompt for guests: "Masuk untuk membeli produk ini"
Below the columns:
- Product description (full text, collapsible if > 500 chars)
- Product stats: total orders, total reviews, avg rating with RatingStars
- Reviews section: list of recent product reviews with rating, review text, and reviewer username

### Reusable Components Used
- Navbar
- StatusBadge
- RatingStars
- LoadingSpinner / SkeletonLoader
- Toast / Notification

### API / Service Calls
- GET /products/{id} — fetches full product detail including jastiper info and stats

### User Interactions
- Clicking "Beli Sekarang" navigates to /checkout/[productId]
- Clicking jastiper username navigates to /jastiper/[username]
- Clicking thumbnail updates main image
- Authenticated TITIPERS who own the product see a disabled button with tooltip "Anda tidak dapat membeli produk sendiri"
- Guest users see a "Masuk untuk membeli" link instead of the checkout button

### Edge Cases and States
- Loading state: Full page skeleton with image placeholder, text placeholders
- Product not found: 404 page with "Produk tidak ditemukan" message and link back to /catalog
- OUT_OF_STOCK: Checkout button is disabled and shows "Stok Habis" label
- HIDDEN/REMOVED_BY_ADMIN: Returns 404 for public users
- Jastiper viewing own product: Checkout button hidden; shows "Edit Produk" link to /jastiper/catalog/[productId]/edit

---

## Page: Public Jastiper Profile
- **URL:** /jastiper/[username]
- **Access:** Public
- **Purpose:** Display a jastiper public profile with stats, ratings, badges, and their active product catalog.

### Layout and Components
Full-width layout with a profile header section and a product catalog section below:
Profile Header:
- Profile picture (large avatar, 96x96px)
- Username (h1) and full_name
- Member since date
- StatusBadge (ACTIVE, BANNED, PENDING_VERIFICATION)
- Stats row: total_orders, success_rate (formatted as percentage), avg_rating with RatingStars
- Badges: displayed as colored chips (e.g., "Top Seller", "Verified")
- Bio text if available
Product Catalog Section:
- Section title: "Produk dari [username]"
- SearchBar for filtering within this jastiper catalog
- Product grid: responsive grid of ProductCard components
- Pagination

### Reusable Components Used
- Navbar
- StatusBadge
- RatingStars
- ProductCard
- SearchBar
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState

### API / Service Calls
- GET /profile/{username} — fetches jastiper public profile with stats, rating, badges
- GET /jastipers/{username}/products?q=&page=&size= — fetches jastiper product catalog

### User Interactions
- SearchBar filters products within this jastiper catalog
- Clicking a ProductCard navigates to /catalog/[productId]
- Pagination controls update the page param

### Edge Cases and States
- Loading state: Profile header skeleton and product grid skeletons
- Jastiper not found: 404 page with "Profil tidak ditemukan"
- No products: EmptyState with "Jastiper ini belum memiliki produk aktif"
- PENDING_VERIFICATION jastiper: Profile shown with a notice banner "Akun ini sedang dalam proses verifikasi"
- BANNED jastiper: Profile shown with a notice banner "Akun ini telah dinonaktifkan"

---

## Titiper Pages

## Page: Titiper Dashboard
- **URL:** /dashboard
- **Access:** TITIPERS (redirects to /login if unauthenticated)
- **Purpose:** Provide a personalized overview of the titiper account including recent orders, wallet balance, and KYC status.

### Layout and Components
Dashboard layout with Navbar at top and a main content area:
- Welcome banner: "Selamat datang, [username]!"
- KYCStatusBanner: shown if kyc_status is PENDING_VERIFICATION or REJECTED, with a link to /profile/kyc
- Stats row (3 cards): Total Pesanan, Pesanan Aktif, Total Pengeluaran
- WalletSummary card: shows current balance with a "Top Up" button linking to /wallet
- Recent Orders section: last 5 orders as OrderCard components with a "Lihat Semua" link to /orders
- Quick Actions: buttons for "Belanja Sekarang" (/catalog), "Riwayat Pesanan" (/orders), "Dompet Saya" (/wallet)

### Reusable Components Used
- Navbar
- KYCStatusBanner
- WalletSummary
- OrderCard
- StatusBadge
- LoadingSpinner / SkeletonLoader

### API / Service Calls
- GET /profile/me — fetches user profile and kyc_status
- GET /wallets/me — fetches wallet balance
- GET /orders/my/purchases?page=1&limit=5 — fetches recent orders

### User Interactions
- Clicking "Top Up" navigates to /wallet
- Clicking an OrderCard navigates to /orders/[orderId]
- Clicking "Lihat Semua" navigates to /orders
- KYCStatusBanner CTA navigates to /profile/kyc

### Edge Cases and States
- Loading state: Stats cards and OrderCard skeletons
- No orders yet: Recent orders section shows EmptyState "Belum ada pesanan"
- Wallet not found: WalletSummary shows "Dompet belum tersedia" with a contact admin link
- KYC rejected: KYCStatusBanner shows rejection reason and a re-submit link

---

## Page: Order History
- **URL:** /orders
- **Access:** TITIPERS
- **Purpose:** Display the full paginated purchase history for the authenticated titiper.

### Layout and Components
Full-width layout with Navbar:
- Page title: "Riwayat Pesanan"
- Status filter tabs: All, PENDING, PAID, PURCHASED, SHIPPED, COMPLETED, CANCELLED
- List of OrderCard components, one per order, sorted by created_at descending
- Each OrderCard shows: product snapshot image, product name, jastiper username, total_price, status badge, created_at, and a "Lihat Detail" button
- Pagination at the bottom

### Reusable Components Used
- Navbar
- OrderCard
- StatusBadge
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState

### API / Service Calls
- GET /orders/my/purchases?page=&limit=20&sort_by=created_at&order=Desc — fetches paginated purchase history

### User Interactions
- Clicking a status tab filters orders by that status (client-side filter or new API call)
- Clicking "Lihat Detail" on an OrderCard navigates to /orders/[orderId]
- Pagination controls update the page param

### Edge Cases and States
- Loading state: List of OrderCard skeletons (5 items)
- Empty state: EmptyState with "Belum ada pesanan" and a "Mulai Belanja" button linking to /catalog
- Error state: Error message with retry button

---

## Page: Order Detail (Titiper View)
- **URL:** /orders/[orderId]
- **Access:** TITIPERS (owner of the order)
- **Purpose:** Show full order details and allow the titiper to take actions (pay, confirm receipt, rate).

### Layout and Components
Single-column layout with Navbar:
- Order ID and created_at at the top
- StatusBadge showing current order status
- Order status timeline: visual stepper showing PENDING, PAID, PURCHASED, SHIPPED, COMPLETED with timestamps from order history
- Product snapshot card: image, name, quantity, unit_price, service_fee, total_price
- Jastiper info: avatar, username, link to /jastiper/[username]
- Shipping address details
- Note to jastiper (if any)
- Tracking info section (shown when status is SHIPPED or later): tracking_number, courier
- Cancellation info (shown when CANCELLED): cancellation_reason, cancelled_by (role: TITIPERS/JASTIPER/ADMIN/SYSTEM — not a username)
- Action buttons based on status:
  - PENDING: "Bayar Sekarang" button (triggers payment from wallet)
  - SHIPPED: "Konfirmasi Penerimaan" button
  - COMPLETED: "Beri Rating Jastiper" and "Beri Rating Produk" buttons (if not yet rated)
- Rating section (shown after COMPLETED): displays submitted ratings or rating forms

### Reusable Components Used
- Navbar
- StatusBadge
- RatingStars
- ConfirmModal
- Toast / Notification
- LoadingSpinner / SkeletonLoader

### API / Service Calls
- GET /orders/{order_id} — fetches full order detail
- GET /orders/{order_id}/history — fetches status change history for timeline
- PATCH /orders/{order_id}/payment — initiates wallet payment (PENDING to PAID)
- PATCH /orders/{order_id}/confirm — confirms receipt (SHIPPED to COMPLETED)
- GET /orders/{order_id}/rating/jastiper — checks if jastiper rating exists
- POST /orders/{order_id}/rating/jastiper — submits jastiper rating
- GET /orders/{order_id}/rating/product — checks if product rating exists
- POST /orders/{order_id}/rating/product — submits product rating

### User Interactions
- Clicking "Bayar Sekarang" opens a ConfirmModal showing wallet balance and order total; confirming calls PATCH /payment
- Clicking "Konfirmasi Penerimaan" opens a ConfirmModal; confirming calls PATCH /confirm
- Rating forms appear inline after COMPLETED; submitting calls POST rating endpoints
- Rating stars are interactive (click to set value)

### Edge Cases and States
- Loading state: Full page skeleton
- Order not found: 404 page
- Insufficient wallet balance: ConfirmModal shows error "Saldo tidak mencukupi. Silakan top up terlebih dahulu."
- Already rated: Rating section shows submitted rating (read-only RatingStars)
- REFUNDING status: Shows "Pesanan sedang dalam proses refund" banner
- REFUND_FAILED: Shows "Refund gagal. Hubungi admin." banner

---

## Page: Checkout Page
- **URL:** /checkout/[productId]
- **Access:** TITIPERS (authenticated, cannot be the product owner)
- **Purpose:** Allow a titiper to review the product, enter shipping details, and place an order.

### Layout and Components
Two-column layout on desktop:
Left Column (Order Summary):
- Product image, name, jastiper username
- Quantity selector (min 1, max = available stock)
- Price breakdown: product.price x quantity, product.serviceFee, total (NOTE: reads camelCase fields from ProductResponse — `price` and `serviceFee` — since this is pre-order and product data comes from GET /products/{id})
- Stock reservation warning: "Stok akan direservasi selama 15 menit setelah pesanan dibuat"
Right Column (Shipping Form):
- Form fields: recipient_name, phone_number, street, kelurahan, kecamatan, city, province, postal_code (5 digits), notes (optional)
- Note to jastiper textarea (max 500 chars, character counter shown)
- Wallet balance display: "Saldo Dompet: Rp X.XXX.XXX"
- Insufficient balance warning if total > balance
- Submit button: "Buat Pesanan" (disabled if balance insufficient or stock = 0)

### Reusable Components Used
- Navbar
- WalletSummary
- Toast / Notification
- LoadingSpinner

### API / Service Calls
- GET /products/{id} — fetches product detail for order summary
- GET /wallets/me — fetches wallet balance for balance check
- POST /orders — creates the order (stock reservation happens server-side)

### User Interactions
- Quantity selector updates the price breakdown in real time
- Submitting the form calls POST /orders
- On success: redirects to /orders/[orderId] with success toast "Pesanan berhasil dibuat"
- On failure (insufficient stock): shows error "Stok tidak mencukupi"
- On failure (insufficient balance): shows error "Saldo tidak mencukupi. Silakan top up terlebih dahulu."
- postal_code field validates exactly 5 digits on blur

### Edge Cases and States
- Loading state: Product summary skeleton while fetching product and wallet
- Product OUT_OF_STOCK: Redirects back to /catalog/[productId] with error toast
- Product not found: 404 page
- Jastiper viewing own product: Redirects to /catalog/[productId] (cannot checkout own product)
- Reservation expiry: If the user takes > 15 minutes, the order creation may fail with stock error; show a clear message to retry

---

## Page: Wallet Page (Titiper)
- **URL:** /wallet
- **Access:** TITIPERS
- **Purpose:** Display wallet balance, transaction history, and allow top-up requests.

### Layout and Components
Full-width layout with Navbar:
- WalletSummary card at the top: balance (large), "Top Up" button. NOTE: GET /wallets/me only returns wallet_id, user_id, and balance — escrow_balance is NOT available from this endpoint. Do not show an escrow note on this page.
- Top Up form (collapsible or modal): amount input, payment_method dropdown, bank_code input, idempotency_key (auto-generated UUID, hidden from user)
- Transaction history section:
  - Filter tabs: All, TOPUP, PAYMENT, REFUND
  - List of TransactionRow components
  - Pagination

### Reusable Components Used
- Navbar
- WalletSummary
- TransactionRow
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /wallets/me — fetches wallet balance
- GET /transactions — fetches all transactions
- GET /topups — fetches top-up history
- POST /topups — submits a top-up request

### User Interactions
- Clicking "Top Up" expands the top-up form or opens a modal
- Submitting the top-up form calls POST /topups with auto-generated idempotency_key
- On success: shows toast "Permintaan top up berhasil dikirim. Menunggu konfirmasi admin."
- Clicking a TransactionRow navigates to transaction detail (or expands inline)
- Filter tabs update the displayed transaction list

### Edge Cases and States
- Loading state: WalletSummary skeleton and TransactionRow skeletons
- No transactions: EmptyState "Belum ada transaksi"
- Top-up pending: Shows a pending badge on the top-up transaction row
- Duplicate idempotency_key: Shows error "Permintaan duplikat terdeteksi"

---

## Page: My Profile
- **URL:** /profile
- **Access:** Any authenticated user
- **Purpose:** Allow users to view and update their profile information.

### Layout and Components
Centered card layout:
- Profile picture with upload button
- Username field (editable, max 30 chars, alphanumeric + underscore)
- Full name field
- Phone number field
- Email field (read-only)
- Role badge
- Account status badge
- KYC status section: shows current kyc_status with a link to /profile/kyc if TITIPERS
- Save button

### Reusable Components Used
- Navbar
- StatusBadge
- KYCStatusBanner
- Toast / Notification

### API / Service Calls
- GET /profile/me — fetches current profile
- PATCH /profile/me — updates profile fields

### User Interactions
- Editing fields and clicking Save calls PATCH /profile/me
- On success: toast "Profil berhasil diperbarui"
- On username conflict: inline error "Username sudah digunakan"
- KYC status link navigates to /profile/kyc

### Edge Cases and States
- Loading state: Form skeleton
- Username validation: real-time pattern check (alphanumeric + underscore only)
- Unsaved changes: browser beforeunload warning if form is dirty

---

## Page: KYC Submission
- **URL:** /profile/kyc
- **Access:** TITIPERS
- **Purpose:** Allow a titiper to submit KYC documents to apply for JASTIPER status.

### Layout and Components
Centered card layout:
- Page title: "Verifikasi Identitas (KYC)"
- KYC status banner at top (if already submitted)
- Form fields:
  - full_name_ktp: text input
  - ktp_number: text input (16 digits, numeric only)
  - ktp_photo_url: URL input or file upload placeholder
  - selfie_with_ktp_url: URL input or file upload placeholder
  - social_media_links: dynamic list (add/remove entries), each with platform and url fields; minimum 1 required
  - bio: textarea (optional)
- Submit button: "Kirim KYC"

### Reusable Components Used
- Navbar
- KYCStatusBanner
- Toast / Notification

### API / Service Calls
- GET /profile/me/kyc — fetches current KYC status (to show if already submitted)
- POST /profile/me/kyc — submits KYC documents

### User Interactions
- Adding social media links: clicking "Tambah Link" adds a new platform+url row
- Removing a social media link: clicking the X button removes that row (minimum 1 must remain)
- Submitting the form calls POST /profile/me/kyc
- On success: shows KYCStatusBanner with PENDING_VERIFICATION status and message "KYC Anda sedang ditinjau oleh admin"
- On failure: per-field validation errors shown inline

### Edge Cases and States
- Already submitted (PENDING_VERIFICATION): Form is read-only; shows status banner
- Already approved (APPROVED): Shows success banner "KYC Anda telah disetujui"; form hidden
- Rejected (REJECTED): Shows rejection reason and allows re-submission
- ktp_number validation: real-time check for exactly 16 digits

---

## Jastiper Pages

## Page: Jastiper Dashboard
- **URL:** /jastiper/dashboard
- **Access:** JASTIPER
- **Purpose:** Provide a jastiper-specific overview including sales stats, incoming orders, and wallet earnings.

### Layout and Components
Dashboard layout with Navbar and optional Sidebar:
- Welcome banner: "Selamat datang, [username]! Kelola toko Anda."
- Stats row (4 cards): Total Penjualan, Pesanan Aktif, Total Pendapatan, Rating Rata-rata
- WalletSummary card: shows current balance with a "Tarik Dana" button linking to /jastiper/wallet
- Incoming Orders section: last 5 orders as OrderCard components with a "Lihat Semua" link to /jastiper/orders
- Quick Actions: "Tambah Produk" (/jastiper/catalog/new), "Katalog Saya" (/jastiper/catalog), "Pesanan Masuk" (/jastiper/orders)

### Reusable Components Used
- Navbar
- Sidebar
- WalletSummary
- OrderCard
- StatusBadge
- RatingStars
- LoadingSpinner / SkeletonLoader

### API / Service Calls
- GET /profile/me — fetches jastiper profile
- GET /wallets/me — fetches wallet balance
- GET /orders/my/sales?page=1&limit=5 — fetches recent incoming orders

### User Interactions
- Clicking "Tarik Dana" navigates to /jastiper/wallet
- Clicking an OrderCard navigates to /jastiper/orders/[orderId]
- Clicking "Tambah Produk" navigates to /jastiper/catalog/new

### Edge Cases and States
- Loading state: Stats cards and OrderCard skeletons
- No orders: EmptyState "Belum ada pesanan masuk"
- PENDING_VERIFICATION jastiper: Shows a prominent banner "Akun Anda sedang dalam proses verifikasi KYC. Anda belum dapat menerima pesanan."

---

## Page: My Catalog (Jastiper)
- **URL:** /jastiper/catalog
- **Access:** JASTIPER
- **Purpose:** Allow a jastiper to view and manage all their product listings including hidden and removed ones.

### Layout and Components
Full-width layout with Navbar and Sidebar:
- Page title: "Katalog Saya"
- "Tambah Produk" button (top right) linking to /jastiper/catalog/new
- Status filter tabs: All, ACTIVE, OUT_OF_STOCK, HIDDEN, REMOVED_BY_ADMIN
- SearchBar for keyword filtering
- Product table or grid: each item shows product image, name, price, stock, status badge, created_at, and action buttons (Edit, Hide/Show, Delete)
- Pagination

### Reusable Components Used
- Navbar
- Sidebar
- StatusBadge
- SearchBar
- Pagination
- ConfirmModal (for delete confirmation)
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /products/my?search=&status=&page=&size= — fetches own catalog
- PATCH /products/{id} — updates product status (hide/show)
- DELETE /products/{id} — soft-deletes a product

### User Interactions
- Clicking "Edit" navigates to /jastiper/catalog/[productId]/edit
- Clicking "Sembunyikan" calls PATCH /products/{id} with status=HIDDEN
- Clicking "Tampilkan" calls PATCH /products/{id} with status=ACTIVE
- Clicking "Hapus" opens ConfirmModal; confirming calls DELETE /products/{id}
- Status filter tabs update the status query param

### Edge Cases and States
- Loading state: Product table/grid skeletons
- Empty catalog: EmptyState with "Belum ada produk. Tambah produk pertama Anda!" and a link to /jastiper/catalog/new
- Delete blocked (active orders): Error toast "Produk tidak dapat dihapus karena memiliki pesanan aktif"
- REMOVED_BY_ADMIN products: Show a warning badge; Edit button disabled; shows reason if available

---

## Page: Create Product
- **URL:** /jastiper/catalog/new
- **Access:** JASTIPER
- **Purpose:** Allow a jastiper to create a new product listing.

### Layout and Components
Centered form layout with Navbar:
- Page title: "Tambah Produk Baru"
- Form sections:
  - Basic Info: name (required), description (required, textarea), price (required, number), stock (required, number)
  - Origin: origin_country (required), purchase_date (required, date picker)
  - Category and Details: category_id (dropdown from GET /categories), weight_gram (optional), service_fee (optional)
  - Images: up to 5 URL inputs with add/remove buttons
  - Tags: tag input with add/remove chips
- Submit button: "Simpan Produk"
- Cancel button: navigates back to /jastiper/catalog

### Reusable Components Used
- Navbar
- Toast / Notification
- LoadingSpinner

### API / Service Calls
- GET /categories — fetches category list for dropdown
- POST /products — creates the product

### User Interactions
- All required fields validated on submit
- Image URL inputs: clicking "Tambah Gambar" adds a new URL input (max 5)
- Tag input: pressing Enter or comma adds a tag chip
- On success: redirects to /jastiper/catalog with toast "Produk berhasil ditambahkan"
- On failure: per-field validation errors shown inline

### Edge Cases and States
- Loading state: Submit button disabled with spinner during submission
- More than 5 images: "Tambah Gambar" button disabled after 5 images
- price or stock negative: inline validation error

---

## Page: Edit Product
- **URL:** /jastiper/catalog/[productId]/edit
- **Access:** JASTIPER (owner only)
- **Purpose:** Allow a jastiper to update an existing product listing.

### Layout and Components
Same form layout as Create Product, pre-populated with existing product data:
- All fields from Create Product form, pre-filled
- Status field: dropdown with ACTIVE, HIDDEN (REMOVED_BY_ADMIN not selectable)
- "Simpan Perubahan" submit button
- "Batal" cancel button

### Reusable Components Used
- Navbar
- StatusBadge
- Toast / Notification
- LoadingSpinner / SkeletonLoader

### API / Service Calls
- GET /products/my/{id} — fetches current product data to pre-fill form
- GET /categories — fetches category list
- PATCH /products/{id} — updates the product

### User Interactions
- Form pre-filled with current product data on load
- Submitting calls PATCH /products/{id} with only changed fields
- On success: redirects to /jastiper/catalog with toast "Produk berhasil diperbarui"

### Edge Cases and States
- Loading state: Form skeleton while fetching product data
- Product not found or not owned: 404 page
- REMOVED_BY_ADMIN product: Form shown as read-only with a warning banner

---

## Page: Order Management (Jastiper)
- **URL:** /jastiper/orders
- **Access:** JASTIPER
- **Purpose:** Allow a jastiper to view and manage all incoming orders.

### Layout and Components
Full-width layout with Navbar and Sidebar:
- Page title: "Pesanan Masuk"
- Status filter tabs: All, PENDING, PAID, PURCHASED, SHIPPED, COMPLETED, CANCELLED
- List of OrderCard components showing: product snapshot, titiper username, total_price, status badge, created_at, action buttons
- Action buttons per status: PAID shows "Tandai Dibeli", PURCHASED shows "Tandai Dikirim", any cancellable status shows "Batalkan"
- Pagination

### Reusable Components Used
- Navbar
- Sidebar
- OrderCard
- StatusBadge
- ConfirmModal
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /orders/my/sales?page=&limit=20 — fetches incoming orders
- PATCH /orders/{order_id}/purchased — marks order as purchased
- PATCH /orders/{order_id}/shipped — marks order as shipped
- POST /orders/{order_id}/cancel — cancels an order

### User Interactions
- Clicking "Tandai Dibeli" calls PATCH /purchased
- Clicking "Tandai Dikirim" opens a modal to enter tracking_number and courier, then calls PATCH /shipped
- Clicking "Batalkan" opens ConfirmModal with a cancellation_reason textarea; confirming calls POST /cancel
- Clicking an OrderCard navigates to /jastiper/orders/[orderId]

### Edge Cases and States
- Loading state: OrderCard skeletons
- No orders: EmptyState "Belum ada pesanan masuk"
- Cancellation reason required: ConfirmModal submit disabled until reason is entered

---

## Page: Order Detail (Jastiper View)
- **URL:** /jastiper/orders/[orderId]
- **Access:** JASTIPER (assigned jastiper)
- **Purpose:** Show full order details from the jastiper perspective with action buttons.

### Layout and Components
Same layout as Titiper Order Detail but with jastiper-specific actions:
- Order ID, status badge, timeline
- Product snapshot, quantity, pricing
- Titiper info: username, shipping address
- Note from titiper
- Action buttons based on status:
  - PAID: "Tandai Sudah Dibeli" button
  - PURCHASED: "Tandai Sudah Dikirim" button (opens tracking form)
  - PAID or PURCHASED: "Batalkan Pesanan" button
- Tracking form (shown when clicking Tandai Dikirim): tracking_number input, courier input
- Cancellation section (shown when CANCELLED): reason and cancelled_by (role: TITIPERS/JASTIPER/ADMIN/SYSTEM — not a username)

### Reusable Components Used
- Navbar
- Sidebar
- StatusBadge
- ConfirmModal
- Toast / Notification
- LoadingSpinner / SkeletonLoader

### API / Service Calls
- GET /orders/{order_id} — fetches order detail
- GET /orders/{order_id}/history — fetches status history
- PATCH /orders/{order_id}/purchased — marks as purchased
- PATCH /orders/{order_id}/shipped — marks as shipped with tracking info
- POST /orders/{order_id}/cancel — cancels the order

### User Interactions
- "Tandai Sudah Dibeli" opens ConfirmModal; confirming calls PATCH /purchased
- "Tandai Sudah Dikirim" opens a form modal for tracking_number and courier; submitting calls PATCH /shipped
- "Batalkan Pesanan" opens ConfirmModal with cancellation_reason textarea

### Edge Cases and States
- Loading state: Full page skeleton
- Order not found or not assigned to this jastiper: 403/404 page
- SHIPPED order: Cancel button hidden (only ADMIN can cancel SHIPPED orders)

---

## Page: Jastiper Wallet
- **URL:** /jastiper/wallet
- **Access:** JASTIPER
- **Purpose:** Display jastiper wallet balance, earnings history, and allow withdrawal requests.

### Layout and Components
Full-width layout with Navbar and Sidebar:
- WalletSummary card: balance (large), "Tarik Dana" button. NOTE: GET /wallets/me only returns wallet_id, user_id, and balance — escrow_balance is NOT available from this endpoint. Do not show an escrow note on this page.
- Withdrawal form (collapsible or modal): amount input, bank_account_id input, notes textarea, idempotency_key (auto-generated UUID)
- Transaction history section:
  - Filter tabs: All, EARNING, WITHDRAWAL, PAYMENT
  - List of TransactionRow components
  - Pagination

### Reusable Components Used
- Navbar
- Sidebar
- WalletSummary
- TransactionRow
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /wallets/me — fetches wallet balance
- GET /transactions — fetches all transactions
- GET /withdrawals — fetches withdrawal history
- POST /withdrawals — submits a withdrawal request

### User Interactions
- Clicking "Tarik Dana" expands the withdrawal form or opens a modal
- Submitting the withdrawal form calls POST /withdrawals with auto-generated idempotency_key
- On success: toast "Permintaan penarikan berhasil dikirim. Menunggu proses admin."
- Balance is immediately deducted on withdrawal submission

### Edge Cases and States
- Loading state: WalletSummary skeleton and TransactionRow skeletons
- Insufficient balance: Error "Saldo tidak mencukupi untuk penarikan ini"
- Duplicate idempotency_key: Error "Permintaan duplikat terdeteksi"
- Withdrawal pending: Shows pending badge on withdrawal transaction row

---

## Admin Pages

## Page: Admin Dashboard
- **URL:** /admin/dashboard
- **Access:** ADMIN
- **Purpose:** Provide a platform-wide overview for admins including pending actions, financial summary, and system health.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Platform stats row (6 cards): Total Users, Active Jastipers, Total Orders, Pending KYC, Pending Top-ups, Pending Withdrawals
- Financial summary: total_topup, total_withdrawal, total_payment, total_refund, total_earning, platform_escrow_balance (from GET /admin/transactions summary)
- Pending Actions section: quick links to /admin/kyc (pending count), /admin/wallet (pending top-ups and withdrawals count)
- Recent Orders section: last 10 orders across all users

### Reusable Components Used
- Navbar
- Sidebar
- StatusBadge
- LoadingSpinner / SkeletonLoader

### API / Service Calls
- GET /admin/users?page=1&limit=1 — to get total user count
- GET /admin/kyc?status=PENDING_VERIFICATION — to get pending KYC count
- GET /admin/topups?status=PENDING — to get pending top-up count
- GET /admin/withdrawals?status=PENDING — to get pending withdrawal count
- GET /admin/transactions?page=1&limit=10 — to get financial summary and recent transactions

### User Interactions
- Clicking pending KYC count navigates to /admin/kyc
- Clicking pending top-ups navigates to /admin/wallet
- Clicking a recent order navigates to /admin/orders/[orderId]

### Edge Cases and States
- Loading state: Stats card skeletons
- All pending counts at zero: Shows green checkmarks on pending action cards

---

## Page: User Management (Admin)
- **URL:** /admin/users
- **Access:** ADMIN
- **Purpose:** Allow admin to list, search, filter, and manage all user accounts.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Page title: "Manajemen Pengguna"
- Filter row: SearchBar, role dropdown (All/TITIPERS/JASTIPER/ADMIN), status dropdown (All/ACTIVE/BANNED/PENDING_VERIFICATION)
- User table: columns for username, email, role badge, status badge, created_at, actions (View, Ban/Unban)
- Pagination

### Reusable Components Used
- Navbar
- Sidebar
- SearchBar
- StatusBadge
- Pagination
- ConfirmModal
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /admin/users?status=&role=&search=&page=&limit= — fetches filtered user list
- NOTE: Ban/unban endpoint not documented in backend contracts. Endpoint TBD — likely PATCH /admin/users/{userId}/status or similar. Do not implement until the contract is confirmed.

### User Interactions
- Clicking "Lihat" navigates to /admin/users/[userId]
- Clicking "Blokir" opens ConfirmModal; confirming bans the user
- Clicking "Aktifkan" unbans the user
- Filter changes trigger new API calls

### Edge Cases and States
- Loading state: Table row skeletons
- No users matching filter: EmptyState "Tidak ada pengguna ditemukan"
- Cannot ban ADMIN accounts: Ban button hidden for ADMIN role users

---

## Page: User Detail (Admin)
- **URL:** /admin/users/[userId]
- **Access:** ADMIN
- **Purpose:** Show full user detail including KYC info, stats, and allow admin actions.

### Layout and Components
Admin layout with Navbar and Sidebar:
- User profile card: avatar, username, email, role, status, created_at
- KYC section: kyc_status, submitted_at, reviewed_at, rejection_reason, link to /admin/kyc if pending
- Stats section: totalOrders, completedOrders, successRate, avgRating, totalReviews
- Wallet section: link to view wallet (GET /admin/wallets/{userId})
- Action buttons: Ban/Unban, View Orders, View Wallet

### Reusable Components Used
- Navbar
- Sidebar
- StatusBadge
- KYCStatusBanner
- RatingStars
- ConfirmModal
- Toast / Notification

### API / Service Calls
- GET /admin/users/{userId} — fetches full user detail
- GET /admin/wallets/{userId} — fetches user wallet

### User Interactions
- Clicking Ban/Unban opens ConfirmModal
- Clicking "Lihat Pesanan" navigates to /admin/orders?userId=[userId]
- Clicking "Lihat Dompet" shows wallet info inline or navigates to /admin/wallet?userId=[userId]

### Edge Cases and States
- Loading state: Profile card skeleton
- User not found: 404 page
- No KYC submitted: KYC section shows "Belum ada pengajuan KYC"

---

## Page: KYC Queue (Admin)
- **URL:** /admin/kyc
- **Access:** ADMIN
- **Purpose:** Allow admin to review and approve or reject KYC submissions.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Page title: "Antrian KYC"
- Status filter tabs: All, PENDING_VERIFICATION, APPROVED, REJECTED
- KYC submission table: columns for username, full_name_ktp, submitted_at, status badge, actions (Review)
- Pagination
- Review modal (opens on clicking Review): shows full KYC data (full_name_ktp, ktp_number, ktp_photo_url, selfie_with_ktp_url, social_media_links, bio), Approve button, Reject button with rejection-reason textarea

### Reusable Components Used
- Navbar
- Sidebar
- StatusBadge
- ConfirmModal
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /admin/kyc?status=&page=&limit= — fetches KYC submissions
- PATCH /admin/kyc/{kycId}/review — approves or rejects KYC

### User Interactions
- Clicking "Review" opens the review modal with full KYC data
- Clicking "Setujui" in the modal calls PATCH /review with action=APPROVE
- Clicking "Tolak" requires entering a rejection-reason (hyphen field name); calls PATCH /review with action=REJECT
- On success: toast and table row status updated

### Edge Cases and States
- Loading state: Table row skeletons
- Empty queue: EmptyState "Tidak ada pengajuan KYC yang perlu ditinjau"
- Rejection without reason: Submit button disabled until rejection-reason is filled
- CRITICAL: The request body field must be "rejection-reason" (with hyphen), not "rejection_reason" (underscore)

---

## Page: All Products (Admin)
- **URL:** /admin/catalog
- **Access:** ADMIN
- **Purpose:** Allow admin to view and moderate all product listings across all jastipers.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Page title: "Semua Produk"
- Filter row: SearchBar, status dropdown (All/ACTIVE/OUT_OF_STOCK/HIDDEN/REMOVED_BY_ADMIN), jastiperId filter
- Product table: columns for product name, jastiper username, price, stock, status badge, created_at, actions (View, Moderate)
- Pagination
- Moderation modal: action dropdown (HIDE/REMOVE/RESTORE/ACTIVATE), reason textarea (required)

### Reusable Components Used
- Navbar
- Sidebar
- SearchBar
- StatusBadge
- Pagination
- ConfirmModal
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /admin/products?q=&status=&jastiperId=&page=&size= — fetches all products
- PATCH /admin/products/{id}/moderate — moderates a product

### User Interactions
- Clicking "Moderate" opens the moderation modal
- Selecting action and entering reason, then confirming calls PATCH /moderate
- Clicking product name navigates to /catalog/[productId] (public view)

### Edge Cases and States
- Loading state: Table row skeletons
- Reason required: Submit disabled until reason is entered
- Invalid action: Error from backend

---

## Page: All Orders (Admin)
- **URL:** /admin/orders
- **Access:** ADMIN
- **Purpose:** Allow admin to monitor all orders across the platform and take actions.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Page title: "Semua Pesanan"
- Filter row: status dropdown, userId filter input, date range pickers
- Orders table: columns for order_id, titiper username, jastiper username, product name, total_price, status badge, created_at, actions (View, Cancel)
- Pagination

### Reusable Components Used
- Navbar
- Sidebar
- StatusBadge
- Pagination
- ConfirmModal
- LoadingSpinner / SkeletonLoader
- EmptyState

### API / Service Calls
- GET /orders/my/purchases and GET /orders/my/sales with ADMIN JWT — admin can view all orders via these same endpoints (no dedicated admin-only orders endpoint exists in the contracts)
- POST /orders/{order_id}/cancel — cancels an order (ADMIN can cancel SHIPPED orders)

### User Interactions
- Clicking "Lihat" navigates to order detail page
- Clicking "Batalkan" opens ConfirmModal with cancellation_reason textarea
- Filter changes trigger new API calls

### Edge Cases and States
- Loading state: Table row skeletons
- No orders: EmptyState
- REFUND_FAILED orders: Highlighted in red with a "Selesaikan Refund" action button

---

## Page: Financial Summary (Admin)
- **URL:** /admin/wallet/summary
- **Access:** ADMIN
- **Purpose:** Show a high-level overview of platform financial health.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Six summary cards: total_topup, total_withdrawal, total_payment, total_refund, total_earning, platform_escrow_balance
- Quick-link buttons to /admin/wallet/requests and /admin/wallet/transactions

### Reusable Components Used
- Navbar
- Sidebar
- LoadingSpinner / SkeletonLoader
- EmptyState

### API / Service Calls
- GET /admin/transactions?page=1&limit=1 — used only to read the `summary` field from the response; no transaction rows are displayed on this page

### User Interactions
- Cards are read-only; clicking "Lihat Permintaan" navigates to /admin/wallet/requests
- Clicking "Lihat Transaksi" navigates to /admin/wallet/transactions

### Edge Cases and States
- Loading state: Skeleton cards while fetching
- Fetch error: Inline error with retry button

---

## Page: Top-Up & Withdrawal Requests (Admin)
- **URL:** /admin/wallet/requests
- **Access:** ADMIN
- **Purpose:** Allow admin to review and act on pending top-up and withdrawal requests.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Two tabs: "Top-Up" and "Penarikan"
- Top-Up tab: list of PENDING top-up requests — transaction_id, amount, created_at, Approve button, Reject button
- Withdrawal tab: list of PENDING withdrawal requests — transaction_id, amount, created_at, Approve button, Reject button
- Reject action opens a modal with a rejection_reason textarea before submitting

### Reusable Components Used
- Navbar
- Sidebar
- ConfirmModal (for reject reason)
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /admin/topups?status=PENDING — fetches pending top-ups
- PATCH /admin/topups/{transaction_id} { action: "APPROVE" | "REJECT", rejection_reason? } — processes a top-up
- GET /admin/withdrawals?status=PENDING — fetches pending withdrawals
- PATCH /admin/withdrawals/{transaction_id} { action: "APPROVE" | "REJECT", rejection_reason? } — processes a withdrawal

### User Interactions
- Clicking Approve immediately calls PATCH with action=APPROVE; row updates in-place on success
- Clicking Reject opens a modal for rejection_reason (required), then calls PATCH with action=REJECT
- Same flow for both top-ups and withdrawals

### Edge Cases and States
- Loading state: Row skeletons
- No pending items: EmptyState per tab
- Already processed (409): Error toast "Transaksi sudah diproses"
- Fetch error: Inline error with retry

---

## Page: All Transactions & Manual Adjustment (Admin)
- **URL:** /admin/wallet/transactions
- **Access:** ADMIN
- **Purpose:** Monitor all platform transactions with filtering/pagination, and perform manual wallet adjustments.

### Layout and Components
Admin layout with Navbar and Sidebar:
- Filter row: type (dropdown), status (dropdown), user_id (text), date_from (date), date_to (date), min_amount (number)
- Transaction table: transaction_id, user_id, type, direction, amount, status, description, created_at
- Pagination controls
- Manual Adjustment section (collapsible panel or separate card below the table):
  - Fields: user_id (UUID), direction (CREDIT/DEBIT radio), amount, reason (max 500 chars), reference_id (optional, max 36 chars)
  - Submit calls POST /admin/wallets/{user_id}/adjust

### Reusable Components Used
- Navbar
- Sidebar
- TransactionRow
- Pagination
- LoadingSpinner / SkeletonLoader
- EmptyState
- Toast / Notification

### API / Service Calls
- GET /admin/transactions?type=&status=&user_id=&date_from=&date_to=&min_amount=&page=&limit= — fetches all transactions with summary
- POST /admin/wallets/{user_id}/adjust { direction, amount, reason, reference_id? } — manual wallet adjustment

### User Interactions
- Filter changes reset page to 1 and trigger a new fetch
- Pagination navigates through results
- Adjustment form: fills fields and submits; success toast shows new_balance; form resets

### Edge Cases and States
- Loading state: Transaction table skeletons
- No results: EmptyState
- DEBIT adjustment would cause negative balance: Error from backend with current_balance and debit_amount shown inline
- Wallet not found (404): Error toast "Dompet pengguna tidak ditemukan"

---

## Shared Component Library

### Component: Navbar
- **File:** src/components/Navbar.tsx
- **Used on:** All pages
- **Props:** none (reads from AuthProvider context)
- **Description:** Top navigation bar. Shows JSON logo (links to /), navigation links based on role (Catalog, Dashboard, Orders, Wallet), user avatar dropdown (Profile, Logout), and wallet balance for authenticated users. Shows Login and Register buttons for guests. Sticky positioned. Uses --color-primary-dark background.

### Component: Sidebar
- **File:** src/components/Sidebar.tsx
- **Used on:** /jastiper/*, /admin/*
- **Props:** role: string; currentPath: string
- **Description:** Left sidebar navigation for jastiper and admin sections. Shows role-appropriate navigation links with active state highlighting. Collapsible on mobile. Uses --color-primary background with white text.

### Component: ProductCard
- **File:** src/components/ProductCard.tsx
- **Used on:** /, /catalog, /jastiper/[username], /jastiper/catalog
- **Props:** product: ProductResponse; showActions?: boolean
- **Description:** Displays a product in card format. Shows product image (first image or placeholder), name, price (formatted as Rp X.XXX.XXX), service_fee, jastiper username, RatingStars (avg_rating), stock indicator, and StatusBadge. Clicking the card navigates to /catalog/[productId]. showActions prop shows Edit/Delete buttons for jastiper catalog view. Handles camelCase ProductResponse fields (productId, originCountry, etc.).

### Component: OrderCard
- **File:** src/components/OrderCard.tsx
- **Used on:** /dashboard, /orders, /jastiper/dashboard, /jastiper/orders, /admin/orders
- **Props:** order: Order; viewAs: TITIPERS | JASTIPER | ADMIN; onAction?: (action: string, orderId: string) => void
- **Description:** Displays an order summary. Shows product snapshot image, product name, counterparty username (jastiper for titiper view, titiper for jastiper view), total_price, StatusBadge, created_at, and a Lihat Detail button. viewAs prop determines which action buttons to show (pay, confirm, mark purchased, mark shipped, cancel).

### Component: StatusBadge
- **File:** src/components/StatusBadge.tsx
- **Used on:** All pages with status indicators
- **Props:** status: string; type?: order | product | user | kyc | transaction
- **Description:** Renders a colored pill badge for any status value. Color mapping: ACTIVE/COMPLETED/APPROVED/SUCCESS = green, PENDING/PENDING_VERIFICATION = yellow, HIDDEN/CANCELLED/REJECTED/FAILED = red, SHIPPED/PURCHASED = blue, REFUNDING = orange, REMOVED_BY_ADMIN = dark red, BANNED = dark red, OUT_OF_STOCK = gray.

### Component: WalletSummary
- **File:** src/components/WalletSummary.tsx
- **Used on:** /dashboard, /wallet, /jastiper/dashboard, /jastiper/wallet, /admin/wallet
- **Props:** balance: number; escrowBalance?: number; showTopUp?: boolean; showWithdraw?: boolean; onTopUp?: () => void; onWithdraw?: () => void
- **Description:** Displays wallet balance as "Rp X.XXX.XXX" in large text. Optionally shows escrow_balance as a note ("Rp X dalam escrow") only when escrowBalance prop is provided — this data is only available from GET /admin/wallets/{id}, NOT from GET /wallets/me (which only returns wallet_id, user_id, balance). Regular user wallet pages must not pass escrowBalance. Shows Top Up button if showTopUp=true, Withdraw button if showWithdraw=true. Never shows balance + escrowBalance as the available amount.

### Component: RatingStars
- **File:** src/components/RatingStars.tsx
- **Used on:** /catalog/[productId], /jastiper/[username], /orders/[orderId], /jastiper/orders/[orderId], /admin/users/[userId]
- **Props:** rating: number; maxRating?: number (default 5); interactive?: boolean; onRate?: (rating: number) => void; size?: sm | md | lg
- **Description:** Renders star icons representing a rating value. Non-interactive mode shows filled/half/empty stars based on the rating value. Interactive mode allows clicking to set a rating (used in rating forms). Displays the numeric rating value next to the stars.

### Component: KYCStatusBanner
- **File:** src/components/KYCStatusBanner.tsx
- **Used on:** /dashboard, /profile, /profile/kyc, /jastiper/dashboard
- **Props:** status: PENDING_VERIFICATION | APPROVED | REJECTED | null; rejectionReason?: string; ctaLink?: string; ctaText?: string
- **Description:** Displays a contextual banner based on KYC status. PENDING_VERIFICATION: yellow banner with clock icon and message "KYC Anda sedang ditinjau". APPROVED: green banner with checkmark. REJECTED: red banner with rejection reason and a re-submit CTA link. null: renders nothing.

### Component: TransactionRow
- **File:** src/components/TransactionRow.tsx
- **Used on:** /wallet, /jastiper/wallet, /admin/wallet
- **Props:** transaction: Transaction; onClick?: () => void
- **Description:** Renders a single transaction as a table row or list item. Shows transaction_id (truncated), type badge, amount (formatted as Rp X.XXX.XXX with + or - prefix based on direction), status badge, description, and created_at. CREDIT direction shows green amount, DEBIT shows red amount.

### Component: SearchBar
- **File:** src/components/SearchBar.tsx
- **Used on:** /catalog, /jastiper/[username], /jastiper/catalog, /admin/users, /admin/catalog, /admin/orders
- **Props:** value: string; onChange: (value: string) => void; placeholder?: string; debounceMs?: number (default 300)
- **Description:** A search input with a magnifying glass icon. Debounces the onChange callback to avoid excessive API calls. Clears the input when the X button is clicked. Accessible with proper aria-label.

### Component: EmptyState
- **File:** src/components/EmptyState.tsx
- **Used on:** All list/grid pages
- **Props:** title: string; description?: string; icon?: ReactNode; action?: { label: string; href?: string; onClick?: () => void }
- **Description:** Displays a centered empty state with an icon, title, optional description, and optional action button. Used when a list or grid has no items to display. The icon defaults to a box/package icon.

### Component: LoadingSpinner / SkeletonLoader
- **File:** src/components/LoadingSpinner.tsx, src/components/SkeletonLoader.tsx
- **Used on:** All pages during data loading
- **Props (LoadingSpinner):** size?: sm | md | lg; color?: string
- **Props (SkeletonLoader):** variant: card | row | text | avatar; count?: number
- **Description:** LoadingSpinner renders an animated circular spinner. SkeletonLoader renders animated gray placeholder blocks matching the shape of the content being loaded (card for ProductCard/OrderCard, row for table rows, text for paragraphs, avatar for profile pictures).

### Component: ConfirmModal
- **File:** src/components/ConfirmModal.tsx
- **Used on:** All pages with destructive or important actions
- **Props:** isOpen: boolean; onClose: () => void; onConfirm: () => void; title: string; message: string; confirmLabel?: string; cancelLabel?: string; isLoading?: boolean; children?: ReactNode
- **Description:** A modal dialog for confirming important actions. Shows a title, message, and optional children (e.g., a textarea for cancellation reason). Confirm button is disabled while isLoading=true. Pressing Escape or clicking the backdrop closes the modal. Uses role="dialog" and aria-modal="true" for accessibility.

### Component: Pagination
- **File:** src/components/Pagination.tsx
- **Used on:** All paginated list pages
- **Props:** currentPage: number; totalPages: number; onPageChange: (page: number) => void; totalItems?: number; itemsPerPage?: number
- **Description:** Renders page navigation controls: Previous button, page number buttons (with ellipsis for large page counts), Next button. Shows "Menampilkan X-Y dari Z item" if totalItems and itemsPerPage are provided. Disabled state for Previous on page 1 and Next on last page.

### Component: Toast / Notification
- **File:** src/components/Toast.tsx
- **Used on:** All pages with user actions
- **Props:** message: string; type: success | error | info | warning; duration?: number (default 3000ms); onClose?: () => void
- **Description:** A toast notification that appears at the top-right corner of the screen. Auto-dismisses after duration ms. Color-coded by type: success=green, error=red, info=blue, warning=yellow. Stacks multiple toasts vertically. Accessible with role="alert" and aria-live="polite".

