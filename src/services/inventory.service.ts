/**
 * Inventory Service — src/services/inventory.service.ts
 *
 * Base URL: NEXT_PUBLIC_INVENTORY_SERVICE_URL (Spring Boot, :8083)
 * Error shape: { success, message, data, errors } envelope
 */

import { inventoryRequest } from './api-client';

export { isApiError } from './api-client';

// ---------------------------------------------------------------------------
// Pagination shapes
// ---------------------------------------------------------------------------

export type InventoryPagination = {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
};

export type OrderPagination = {
  total_items: number;
  page: number;
  limit: number;
  total_pages: number;
};

// ---------------------------------------------------------------------------
// CategoryResponse
// ---------------------------------------------------------------------------

export type CategoryResponse = {
  category_id: number;
  name: string;
  slug: string;
  description: string | null;
  product_count: number;
};

// ---------------------------------------------------------------------------
// ProductResponse
// ---------------------------------------------------------------------------

export type ProductStatus = 'ACTIVE' | 'OUT_OF_STOCK' | 'HIDDEN' | 'REMOVED_BY_ADMIN';
export type ShoppingMode = 'LIVE' | 'PRE_ORDER' | 'FLASH_SALE';

export type ProductJastiper = {
  userId: string;
  username: string | null;
  fullName: string | null;
  profilePictureUrl: string | null;
  avgRating: number;
  totalOrders: number;
};

export type ProductStats = {
  totalOrders: number;
  totalReviews: number;
  avgRating: number;
};

export type ProductResponse = {
  productId: string;
  name: string;
  description: string;
  price: number;
  stock: number;
  status: ProductStatus;
  mode: ShoppingMode;
  flashSaleStart: string | null;
  flashSaleEnd: string | null;
  originCountry: string;
  purchaseDate: string;
  weightGram: number;
  serviceFee: number;
  images: string[];
  tags: string[];
  category: { id: number; name: string } | null;
  jastiper: ProductJastiper;
  stats: ProductStats;
};

// ---------------------------------------------------------------------------
// Paginated response wrappers
// ---------------------------------------------------------------------------

export type PaginatedProductResponse = {
  data: ProductResponse[];
  pagination: InventoryPagination;
};

export type PaginatedProducts = PaginatedProductResponse;

// ---------------------------------------------------------------------------
// StockReservationResponse
// ---------------------------------------------------------------------------

export type StockReservationStatus = 'PENDING' | 'CONFIRMED' | 'RELEASED';

export type StockReservationResponse = {
  reservationId: string;
  productId: string;
  orderId: string;
  quantity: number;
  status: StockReservationStatus;
  createdAt: string;
  expiresAt: string | null;
};

// ---------------------------------------------------------------------------
// Admin types
// ---------------------------------------------------------------------------

export type ModerationAction = 'HIDE' | 'REMOVE' | 'RESTORE' | 'ACTIVATE';

export type ModerationLogResponse = {
  log_id: string;
  product_id: string;
  admin_id: string;
  action: ModerationAction;
  reason: string;
  created_at: string;
};

// ---------------------------------------------------------------------------
// TASK-203: getCategories
// ---------------------------------------------------------------------------

export async function getCategories(): Promise<CategoryResponse[]> {
  return inventoryRequest<CategoryResponse[]>('/categories', { method: 'GET' });
}

// ---------------------------------------------------------------------------
// TASK-204: searchProducts
// ---------------------------------------------------------------------------

export type SearchProductsParams = {
  q?: string;
  jastiperId?: string;
  minPrice?: number;
  maxPrice?: number;
  categoryId?: number;
  origin_country?: string;
  purchase_date_from?: string;
  purchase_date_to?: string;
  page?: number;
  limit?: number;
  sortBy?: 'created_at' | 'purchase_date' | 'rating';
  order?: 'asc' | 'desc';
};

export async function searchProducts(
    params?: SearchProductsParams
): Promise<PaginatedProductResponse> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) query.set(k, String(v));
    }
  }
  const qs = query.toString();
  return inventoryRequest<PaginatedProductResponse>(`/products${qs ? `?${qs}` : ''}`, {
    method: 'GET',
  });
}

// ---------------------------------------------------------------------------
// TASK-205: getProduct
// ---------------------------------------------------------------------------

export async function getProduct(productId: string): Promise<ProductResponse> {
  return inventoryRequest<ProductResponse>(
      `/products/${encodeURIComponent(productId)}`,
      { method: 'GET' }
  );
}

// ---------------------------------------------------------------------------
// TASK-206: getJastiperCatalog
// ---------------------------------------------------------------------------

export type JastiperCatalogParams = {
  q?: string;
  min_price?: number;
  max_price?: number;
  category_id?: number;
  origin_country?: string;
  page?: number;
  size?: number;
  sort?: string;
};

export async function getJastiperCatalog(
    username: string,
    params?: JastiperCatalogParams
): Promise<PaginatedProductResponse> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) query.set(k, String(v));
    }
  }
  const qs = query.toString();
  return inventoryRequest<PaginatedProductResponse>(
      `/jastipers/${encodeURIComponent(username)}/products${qs ? `?${qs}` : ''}`,
      { method: 'GET' }
  );
}

// ---------------------------------------------------------------------------
// TASK-207: createProduct
// ---------------------------------------------------------------------------

export type CreateProductInput = {
  name: string;
  description: string;
  price: number;
  stock: number;
  mode?: ShoppingMode;
  flash_sale_start?: string | null;
  flash_sale_end?: string | null;
  origin_country: string;
  purchase_date: string;
  category_id?: number | null;
  weight_gram?: number | null;
  service_fee?: number;
  images?: string[];
  tags?: string[];
};

export async function createProduct(
    token: string,
    input: CreateProductInput
): Promise<ProductResponse> {
  return inventoryRequest<ProductResponse>('/products', {
    method: 'POST',
    token,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// TASK-208: updateProduct 
// ---------------------------------------------------------------------------

export type UpdateProductInput = Partial<{
  name: string;
  description: string;
  price: number;
  stock: number;
  status: ProductStatus;
  mode: ShoppingMode;
  flash_sale_start: string | null;
  flash_sale_end: string | null;
  category_id: number | null;
  origin_country: string;
  purchase_date: string;
  service_fee: number;
  weight_gram: number | null;
  images: string[];
  tags: string[];
}>;

export async function updateProduct(
    token: string,
    productId: string,
    input: UpdateProductInput
): Promise<ProductResponse> {
  return inventoryRequest<ProductResponse>(
      `/products/${encodeURIComponent(productId)}`,
      { method: 'PATCH', token, body: input }
  );
}

// ---------------------------------------------------------------------------
// TASK-209: deleteProduct
// ---------------------------------------------------------------------------

export async function deleteProduct(token: string, productId: string): Promise<void> {
  return inventoryRequest<void>(
      `/products/${encodeURIComponent(productId)}`,
      { method: 'DELETE', token }
  );
}

// ---------------------------------------------------------------------------
// TASK-210: getMyProducts
// ---------------------------------------------------------------------------

export type MyCatalogParams = {
  search?: string;
  status?: ProductStatus;
  page?: number;
  size?: number;
  sort?: string;
};

export async function getMyProducts(
    token: string,
    params?: MyCatalogParams
): Promise<PaginatedProductResponse> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) query.set(k, String(v));
    }
  }
  const qs = query.toString();
  return inventoryRequest<PaginatedProductResponse>(`/products/my${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  });
}

export const getMyCatalog = getMyProducts;

// ---------------------------------------------------------------------------
// TASK-211: getMyProduct
// ---------------------------------------------------------------------------

export async function getMyProduct(
    token: string,
    productId: string
): Promise<ProductResponse> {
  return inventoryRequest<ProductResponse>(
      `/products/my/${encodeURIComponent(productId)}`,
      { method: 'GET', token }
  );
}

// ---------------------------------------------------------------------------
// TASK-212: adminGetAllProducts
// ---------------------------------------------------------------------------

export type AdminGetProductsParams = {
  q?: string;
  jastiperId?: string;
  status?: ProductStatus;
  categoryId?: number;
  page?: number;
  size?: number;
  sort?: string;
};

export async function adminGetAllProducts(
    token: string,
    params?: AdminGetProductsParams
): Promise<PaginatedProductResponse> {
  const query = new URLSearchParams();
  if (params) {
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined) query.set(k, String(v));
    }
  }
  const qs = query.toString();
  return inventoryRequest<PaginatedProductResponse>(`/admin/products${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// TASK-213: adminModerateProduct 
// ---------------------------------------------------------------------------

export async function adminModerateProduct(
  token: string,
  productId: string,
  action: ModerationAction,
  reason: string
) {
  return inventoryRequest<ProductResponse>(`/admin/products/${productId}/moderate`, {
    method: 'PATCH', 
    token,
    body: { action, reason }, 
  });
}

// ---------------------------------------------------------------------------
// TASK-214: adminCreateCategory
// ---------------------------------------------------------------------------

export type CreateCategoryInput = {
  name: string;
  description?: string;
  slug?: string;
};

export async function adminCreateCategory(
    token: string,
    input: CreateCategoryInput
): Promise<CategoryResponse> {
  return inventoryRequest<CategoryResponse>('/admin/categories', {
    method: 'POST',
    token,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// TASK-215: adminUpdateCategory
// ---------------------------------------------------------------------------

export async function adminUpdateCategory(
    token: string,
    categoryId: number,
    input: CreateCategoryInput
): Promise<CategoryResponse> {
  return inventoryRequest<CategoryResponse>(`/admin/categories/${categoryId}`, {
    method: 'PATCH', 
    token,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// TASK-216: adminDeleteCategory
// ---------------------------------------------------------------------------

export async function adminDeleteCategory(
    token: string,
    categoryId: number
): Promise<void> {
  return inventoryRequest<void>(`/admin/categories/${categoryId}`, {
    method: 'DELETE',
    token,
  });
}

export async function uploadImageS3(token: string, file: File): Promise<string> {
  const formData = new FormData();
  formData.append('file', file);

  const baseUrl = process.env.NEXT_PUBLIC_INVENTORY_SERVICE_URL || 'http://localhost:8083';

  const res = await fetch(`${baseUrl}/api/products/images/upload`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${token}`
    },
    body: formData,
  });

  const json = await res.json();
  if (!res.ok || !json.success) {
    throw new Error(json.message || 'Gagal upload gambar ke S3');
  }

  return json.data.image_url;
}

export async function reserveStock(
    token: string,
    productId: string,
    orderId: string,
    quantity: number
): Promise<StockReservationResponse> {
  return inventoryRequest<StockReservationResponse>(
      `/products/${encodeURIComponent(productId)}/stock/reserve`,
      {
        method: 'POST',
        token,
        body: { order_id: orderId, quantity }
      }
  );
}

export async function getModerationLogs(
    token: string,
    productId: string
): Promise<ModerationLogResponse[]> {
  return inventoryRequest<ModerationLogResponse[]>(
      `/admin/products/${encodeURIComponent(productId)}/moderation-logs`,
      { method: 'GET', token }
  );
}