/**
 * Order Service
 * Base URL: NEXT_PUBLIC_ORDER_SERVICE_URL (Rust/Axum, :8084)
 * Error shape: { success, message, data, errors } envelope
 *
 * All endpoints documented in backend-contracts-order-service.md
 */

import { orderRequest } from './api-client';
import {
  Order,
  OrderStatus,
  ActorRole,
  ShippingAddress,
  ProductSnapshot,
  PaginatedOrderResponse,
  OrderHistory,
  JastiperRating,
  ProductRating,
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderResponse,
  PayOrderResponse,
  ConfirmOrderResponse,
  MarkPurchasedResponse,
  MarkShippedResponse,
  CancelOrderResponse,
  GetOrderHistoryResponse,
  GetMyPurchasesResponse,
  GetMySalesResponse,
  RateJastiperRequest,
  RateJastiperResponse,
  GetJastiperRatingResponse,
  RateProductRequest,
  RateProductResponse,
  GetProductRatingResponse,
} from '@/lib/api/orders';

// Re-export types for backward compatibility
export type {
  Order,
  OrderStatus,
  ActorRole,
  ShippingAddress,
  ProductSnapshot,
  PaginatedOrderResponse,
  OrderHistory,
  CreateOrderRequest,
  CreateOrderResponse,
  GetOrderResponse,
  PayOrderResponse,
  ConfirmOrderResponse,
  MarkPurchasedResponse,
  MarkShippedResponse,
  CancelOrderResponse,
  GetOrderHistoryResponse,
  GetMyPurchasesResponse,
  GetMySalesResponse,
  RateJastiperRequest,
  RateJastiperResponse,
  GetJastiperRatingResponse,
  RateProductRequest,
  RateProductResponse,
  GetProductRatingResponse,
};

// Aliases for backward compatibility
export type PaginatedOrders = PaginatedOrderResponse;
export type OrderHistoryEntry = OrderHistory;

// ---------------------------------------------------------------------------
// createOrder
// POST /orders
// Protected — any authenticated user (acts as TITIPERS)
// ---------------------------------------------------------------------------

/**
 * Create a new order (checkout).
 * Verifies stock availability and wallet balance before creating the order.
 *
 * @param token - JWT access token
 * @param input - Order creation data with product_id, quantity, shipping_address, and optional note_to_jastiper
 * @returns The created Order object in PENDING status
 * @throws ApiError on validation failure, insufficient stock, or insufficient balance
 */
export async function createOrder(token: string, input: CreateOrderRequest): Promise<Order> {
  const response = await orderRequest<CreateOrderResponse>('/orders', {
    method: 'POST',
    token,
    body: input,
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// getOrder
// GET /orders/:order_id
// Protected — buyer, jastiper, or admin of the order
// ---------------------------------------------------------------------------

/**
 * Get a single order by ID.
 * Only the buyer, assigned jastiper, or admin can view the order.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @returns The full Order object
 * @throws ApiError if order not found or user lacks access
 */
export async function getOrder(token: string, orderId: string): Promise<Order> {
  const response = await orderRequest<GetOrderResponse>(`/orders/${encodeURIComponent(orderId)}`, {
    method: 'GET',
    token,
  });
  return response.data;
}

// ---------------------------------------------------------------------------
// payOrder
// PATCH /orders/:order_id/payment
// Protected — TITIPERS (must be the buyer)
// ---------------------------------------------------------------------------

/**
 * Pay for a PENDING order from the user's wallet.
 * Transitions the order to PAID status and deducts the amount from wallet balance.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @returns The updated Order object in PAID status
 * @throws ApiError if order is not PENDING, user is not the buyer, or wallet balance is insufficient
 */
export async function payOrder(token: string, orderId: string): Promise<Order> {
  const response = await orderRequest<PayOrderResponse>(
    `/orders/${encodeURIComponent(orderId)}/payment`,
    {
      method: 'PATCH',
      token,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// confirmOrder
// PATCH /orders/:order_id/confirm
// Protected — TITIPERS or ADMIN
// ---------------------------------------------------------------------------

/**
 * Confirm receipt of a SHIPPED order, transitioning it to COMPLETED.
 * On completion, escrowed funds are released to the jastiper's wallet as earnings.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @returns Confirmation response with order_id, status, and completed_at
 * @throws ApiError if order is not SHIPPED or user lacks access
 */
export async function confirmOrder(
  token: string,
  orderId: string
): Promise<ConfirmOrderResponse['data']> {
  const response = await orderRequest<ConfirmOrderResponse>(
    `/orders/${encodeURIComponent(orderId)}/confirm`,
    {
      method: 'PATCH',
      token,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// markPurchased
// PATCH /orders/:order_id/purchased
// Protected — JASTIPER or ADMIN
// ---------------------------------------------------------------------------

/**
 * Mark a PAID order as PURCHASED (jastiper has physically bought the product).
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @returns Response with order_id, status, and completed_at
 * @throws ApiError if order is not PAID or user is not the assigned jastiper
 */
export async function markPurchased(
  token: string,
  orderId: string
): Promise<MarkPurchasedResponse['data']> {
  const response = await orderRequest<MarkPurchasedResponse>(
    `/orders/${encodeURIComponent(orderId)}/purchased`,
    {
      method: 'PATCH',
      token,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// markShipped
// PATCH /orders/:order_id/shipped
// Protected — JASTIPER or ADMIN
// ---------------------------------------------------------------------------

/**
 * Mark a PURCHASED order as SHIPPED with tracking information.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @param trackingNumber - Optional tracking number
 * @param courier - Optional courier name
 * @returns Response with order_id, status, tracking_number, courier, and updated_at
 * @throws ApiError if order is not PURCHASED or user is not the assigned jastiper
 */
export async function markShipped(
  token: string,
  orderId: string,
  trackingNumber?: string | null,
  courier?: string | null
): Promise<MarkShippedResponse['data']> {
  const response = await orderRequest<MarkShippedResponse>(
    `/orders/${encodeURIComponent(orderId)}/shipped`,
    {
      method: 'PATCH',
      token,
      body: {
        tracking_number: trackingNumber ?? null,
        courier: courier ?? null,
      },
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// cancelOrder
// POST /orders/:order_id/cancel
// Protected — JASTIPER or ADMIN (role-based; cancellation triggers refund flow)
// ---------------------------------------------------------------------------

/**
 * Cancel an order with a required cancellation reason.
 * - PENDING → CANCELLED directly
 * - PAID/PURCHASED → REFUNDING (triggers refund flow)
 * - SHIPPED → REFUNDING (ADMIN only)
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @param cancellationReason - Required reason for cancellation (max 500 chars)
 * @returns The updated Order object
 * @throws ApiError if order is in terminal state, user lacks permission, or reason is invalid
 */
export async function cancelOrder(
  token: string,
  orderId: string,
  cancellationReason: string
): Promise<Order> {
  const response = await orderRequest<CancelOrderResponse>(
    `/orders/${encodeURIComponent(orderId)}/cancel`,
    {
      method: 'POST',
      token,
      body: {
        cancellation_reason: cancellationReason,
      },
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// getOrderHistory
// GET /orders/:order_id/history
// Protected — any party to the order
// ---------------------------------------------------------------------------

/**
 * Get the full status change history for an order.
 * Immutable audit trail of all status transitions.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @returns Array of OrderHistory entries
 * @throws ApiError if order not found or user lacks access
 */
export async function getOrderHistory(token: string, orderId: string): Promise<OrderHistory[]> {
  const response = await orderRequest<GetOrderHistoryResponse>(
    `/orders/${encodeURIComponent(orderId)}/history`,
    {
      method: 'GET',
      token,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// getMyPurchases
// GET /orders/my/purchases
// Protected — any authenticated user
// NOTE: This route must be resolved before /orders/:order_id in any client routing
// ---------------------------------------------------------------------------

export type OrderListParams = {
  page?: number;
  limit?: number;
  sort_by?: string;
  order?: 'Asc' | 'Desc';
};

/**
 * Get the authenticated user's purchase history (as TITIPERS).
 * Supports pagination and sorting.
 *
 * @param token - JWT access token
 * @param params - Optional pagination and sorting parameters
 * @returns Paginated list of orders where the user is the buyer
 * @throws ApiError if limit exceeds 1000
 */
export async function getMyPurchases(
  token: string,
  params?: OrderListParams
): Promise<PaginatedOrderResponse> {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v));
    });
  }
  const qs = query.toString();
  const response = await orderRequest<GetMyPurchasesResponse>(
    `/orders/my/purchases${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// getMySales
// GET /orders/my/sales
// Protected — any authenticated user (typically JASTIPER)
// NOTE: This route must be resolved before /orders/:order_id in any client routing
// ---------------------------------------------------------------------------

/**
 * Get the authenticated user's incoming orders (as JASTIPER).
 * Supports pagination and sorting.
 *
 * @param token - JWT access token
 * @param params - Optional pagination and sorting parameters
 * @returns Paginated list of orders where the user is the assigned jastiper
 * @throws ApiError if limit exceeds 1000
 */
export async function getMySales(
  token: string,
  params?: OrderListParams
): Promise<PaginatedOrderResponse> {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v));
    });
  }
  const qs = query.toString();
  const response = await orderRequest<GetMySalesResponse>(
    `/orders/my/sales${qs ? `?${qs}` : ''}`,
    {
      method: 'GET',
      token,
    }
  );
  return response.data;
}


// ---------------------------------------------------------------------------
// rateJastiper
// POST /orders/:order_id/rating/jastiper
// Protected — TITIPERS (must be the buyer)
// ---------------------------------------------------------------------------

/**
 * Submit a rating for the jastiper's service.
 * Can only be done after the order reaches COMPLETED status.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @param input - Rating data with jastiper_rating (1.0-5.0) and optional review
 * @returns Response with rating_id, order_id, jastiper_rating, and created_at
 * @throws ApiError if order is not COMPLETED, user is not the buyer, or rating already exists
 */
export async function rateJastiper(
  token: string,
  orderId: string,
  input: RateJastiperRequest
): Promise<RateJastiperResponse['data']> {
  const response = await orderRequest<RateJastiperResponse>(
    `/orders/${encodeURIComponent(orderId)}/rating/jastiper`,
    {
      method: 'POST',
      token,
      body: input,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// getJastiperRating
// GET /orders/:order_id/rating/jastiper
// Protected — any authenticated user
// ---------------------------------------------------------------------------

/**
 * Get the jastiper rating for an order.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @returns The JastiperRating object
 * @throws ApiError if no rating exists for this order
 */
export async function getJastiperRating(
  token: string,
  orderId: string
): Promise<JastiperRating> {
  const response = await orderRequest<GetJastiperRatingResponse>(
    `/orders/${encodeURIComponent(orderId)}/rating/jastiper`,
    {
      method: 'GET',
      token,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// rateProduct
// POST /orders/:order_id/rating/product
// Protected — TITIPERS (must be the buyer)
// ---------------------------------------------------------------------------

/**
 * Submit a rating for the product quality.
 * Can only be done after the order reaches COMPLETED status.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @param input - Rating data with product_rating (1.0-5.0), optional review, and optional images (max 3)
 * @returns Response with rating_id, order_id, product_rating, and created_at
 * @throws ApiError if order is not COMPLETED, user is not the buyer, or rating already exists
 */
export async function rateProduct(
  token: string,
  orderId: string,
  input: RateProductRequest
): Promise<RateProductResponse['data']> {
  const response = await orderRequest<RateProductResponse>(
    `/orders/${encodeURIComponent(orderId)}/rating/product`,
    {
      method: 'POST',
      token,
      body: input,
    }
  );
  return response.data;
}

// ---------------------------------------------------------------------------
// getProductRating
// GET /orders/:order_id/rating/product
// Protected — any authenticated user
// ---------------------------------------------------------------------------

/**
 * Get the product rating for an order.
 *
 * @param token - JWT access token
 * @param orderId - Order UUID
 * @returns The ProductRating object
 * @throws ApiError if no rating exists for this order
 */
export async function getProductRating(
  token: string,
  orderId: string
): Promise<ProductRating> {
  const response = await orderRequest<GetProductRatingResponse>(
    `/orders/${encodeURIComponent(orderId)}/rating/product`,
    {
      method: 'GET',
      token,
    }
  );
  return response.data;
}
