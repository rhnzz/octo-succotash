import { ordersFetch } from './client';

/**
 * Order Status Enum
 * Represents all possible order statuses in the system.
 * Values are SCREAMING_SNAKE_CASE as per backend contract.
 */
export enum OrderStatus {
  PENDING = 'PENDING',
  PAID = 'PAID',
  PURCHASED = 'PURCHASED',
  SHIPPED = 'SHIPPED',
  COMPLETED = 'COMPLETED',
  REFUNDING = 'REFUNDING',
  REFUND_FAILED = 'REFUND_FAILED',
  CANCELLED = 'CANCELLED',
}

/**
 * Actor Role in Order History
 * Represents who performed the status change.
 */
export enum ActorRole {
  TITIPERS = 'TITIPERS',
  JASTIPER = 'JASTIPER',
  ADMIN = 'ADMIN',
  SYSTEM = 'SYSTEM',
}

/**
 * Cancelled By Role
 * Represents which role cancelled the order.
 * Can be null if order was not cancelled.
 */
export type CancelledByRole = 'TITIPERS' | 'JASTIPER' | 'ADMIN' | 'SYSTEM' | null;

/**
 * Valid Order Status Transitions
 * Maps each status to the list of statuses it can transition to.
 * Used for frontend validation before making API calls.
 */
export const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING]: [OrderStatus.PAID, OrderStatus.CANCELLED],
  [OrderStatus.PAID]: [OrderStatus.PURCHASED, OrderStatus.REFUNDING],
  [OrderStatus.PURCHASED]: [OrderStatus.SHIPPED, OrderStatus.REFUNDING],
  [OrderStatus.SHIPPED]: [OrderStatus.COMPLETED, OrderStatus.REFUNDING],
  [OrderStatus.COMPLETED]: [],
  [OrderStatus.REFUNDING]: [OrderStatus.CANCELLED, OrderStatus.REFUND_FAILED],
  [OrderStatus.REFUND_FAILED]: [OrderStatus.CANCELLED],
  [OrderStatus.CANCELLED]: [],
};

/**
 * Shipping Address
 * Complete address information for order delivery.
 */
export interface ShippingAddress {
  recipient_name: string;
  phone_number: string;
  street: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  province: string;
  postal_code: string; // Exactly 5 digits
  notes: string | null;
}

/**
 * Product Snapshot
 * Immutable snapshot of product details at the time of order creation.
 * Captured to preserve pricing and product info even if the product is later modified.
 */
export interface ProductSnapshot {
  product_id: string;
  name: string;
  description: string;
  image_url: string;
  origin_country: string;
  purchase_date: string; // ISO8601 date (YYYY-MM-DD)
  unit_price: number; // IDR, integer
  service_fee: number; // IDR, integer
}

/**
 * Order
 * Complete order object returned by the Order Service.
 * Represents a single order from creation through completion or cancellation.
 */
export interface Order {
  order_id: string;
  titipers_id: string;
  jastiper_id: string;
  product_id: string;
  product_snapshot: ProductSnapshot;
  quantity: number;
  unit_price: number; // IDR, integer
  service_fee: number; // IDR, integer
  total_price: number; // IDR, integer (unit_price * quantity + service_fee)
  status: OrderStatus;
  shipping_address: ShippingAddress;
  note_to_jastiper: string | null;
  tracking_number: string | null;
  courier: string | null;
  cancellation_reason: string | null;
  cancelled_by: CancelledByRole; // Role string, not user ID
  completed_at: string | null; // ISO8601 datetime
  created_at: string; // ISO8601 datetime
  updated_at: string; // ISO8601 datetime
}

/**
 * Order History Entry
 * Represents a single status change event in the order's lifecycle.
 * Immutable audit trail of all status transitions.
 */
export interface OrderHistory {
  status_his_id: string;
  order_id: string;
  status: OrderStatus;
  changed_by: string; // Actor's user UUID
  actor_role: ActorRole;
  notes: string | null;
  timestamp: string; // ISO8601 datetime
}

/**
 * Jastiper Rating
 * Rating and review of the jastiper's service for a completed order.
 */
export interface JastiperRating {
  rating_jastiper_id: string;
  order_id: string;
  titipers_id: string;
  jastiper_rating: number; // 1.0 - 5.0
  jastiper_review: string | null; // Max 1000 chars
  created_at: string; // ISO8601 datetime
}

/**
 * Product Rating
 * Rating and review of the product quality for a completed order.
 */
export interface ProductRating {
  rating_product_id: string;
  order_id: string;
  titipers_id: string;
  product_rating: number; // 1.0 - 5.0
  product_review: string | null; // Max 1000 chars
  product_images: string[]; // Array of image URLs, max 3
  created_at: string; // ISO8601 datetime
}

/**
 * Paginated Order Response
 * Standard pagination wrapper for order list endpoints.
 * NOTE: Order Service uses { total_items, page, limit, total_pages } shape.
 * This is different from Inventory Service which uses { total, page, limit, total_pages }.
 */
export interface PaginatedOrderResponse {
  data: Order[];
  pagination: {
    total_items: number;
    page: number;
    limit: number;
    total_pages: number;
  };
}

/**
 * Create Order Request
 * Payload for POST /orders endpoint.
 */
export interface CreateOrderRequest {
  product_id: string;
  quantity: number; // Min 1
  shipping_address: ShippingAddress;
  note_to_jastiper?: string | null; // Max 500 chars
}

/**
 * Create Order Response
 * Response from POST /orders endpoint.
 */
export interface CreateOrderResponse {
  success: boolean;
  message: string;
  data: Order;
}

/**
 * Get Order Response
 * Response from GET /orders/{order_id} endpoint.
 */
export interface GetOrderResponse {
  success: boolean;
  message: string;
  data: Order;
}

/**
 * Pay Order Response
 * Response from PATCH /orders/{order_id}/payment endpoint.
 */
export interface PayOrderResponse {
  success: boolean;
  message: string;
  data: Order;
}

/**
 * Confirm Order Response
 * Response from PATCH /orders/{order_id}/confirm endpoint.
 */
export interface ConfirmOrderResponse {
  success: boolean;
  message: string;
  data: {
    order_id: string;
    status: OrderStatus;
    completed_at: string; // ISO8601 datetime
  };
}

/**
 * Mark Purchased Response
 * Response from PATCH /orders/{order_id}/purchased endpoint.
 */
export interface MarkPurchasedResponse {
  success: boolean;
  message: string;
  data: {
    order_id: string;
    status: OrderStatus;
    completed_at: string; // ISO8601 datetime
  };
}

/**
 * Mark Shipped Response
 * Response from PATCH /orders/{order_id}/shipped endpoint.
 */
export interface MarkShippedResponse {
  success: boolean;
  message: string;
  data: {
    order_id: string;
    status: OrderStatus;
    tracking_number: string | null;
    courier: string | null;
    updated_at: string; // ISO8601 datetime
  };
}

/**
 * Cancel Order Response
 * Response from POST /orders/{order_id}/cancel endpoint.
 */
export interface CancelOrderResponse {
  success: boolean;
  message: string;
  data: Order;
}

/**
 * Get Order History Response
 * Response from GET /orders/{order_id}/history endpoint.
 */
export interface GetOrderHistoryResponse {
  success: boolean;
  message: string;
  data: OrderHistory[];
}

/**
 * Get My Purchases Response
 * Response from GET /orders/my/purchases endpoint.
 */
export interface GetMyPurchasesResponse {
  success: boolean;
  message: string;
  data: PaginatedOrderResponse;
}

/**
 * Get My Sales Response
 * Response from GET /orders/my/sales endpoint.
 */
export interface GetMySalesResponse {
  success: boolean;
  message: string;
  data: PaginatedOrderResponse;
}

/**
 * Rate Jastiper Request
 * Payload for POST /orders/{order_id}/rating/jastiper endpoint.
 */
export interface RateJastiperRequest {
  jastiper_rating: number; // 1.0 - 5.0
  jastiper_review?: string | null; // Max 1000 chars
}

/**
 * Rate Jastiper Response
 * Response from POST /orders/{order_id}/rating/jastiper endpoint.
 */
export interface RateJastiperResponse {
  success: boolean;
  message: string;
  data: {
    rating_id: string;
    order_id: string;
    jastiper_rating: number;
    created_at: string; // ISO8601 datetime
  };
}

/**
 * Get Jastiper Rating Response
 * Response from GET /orders/{order_id}/rating/jastiper endpoint.
 */
export interface GetJastiperRatingResponse {
  success: boolean;
  message: string;
  data: JastiperRating;
}

/**
 * Rate Product Request
 * Payload for POST /orders/{order_id}/rating/product endpoint.
 */
export interface RateProductRequest {
  product_rating: number; // 1.0 - 5.0
  product_review?: string | null; // Max 1000 chars
  product_images?: string[]; // Max 3 URLs
}

/**
 * Rate Product Response
 * Response from POST /orders/{order_id}/rating/product endpoint.
 */
export interface RateProductResponse {
  success: boolean;
  message: string;
  data: {
    rating_id: string;
    order_id: string;
    product_rating: number;
    created_at: string; // ISO8601 datetime
  };
}

/**
 * Get Product Rating Response
 * Response from GET /orders/{order_id}/rating/product endpoint.
 */
export interface GetProductRatingResponse {
  success: boolean;
  message: string;
  data: ProductRating;
}

/**
 * Invalid Status Transition Error
 * Error response when attempting an invalid status transition.
 * Returned as HTTP 422 with additional context fields.
 */
export interface InvalidStatusTransitionError {
  success: false;
  message: string;
  data: null;
  errors: Array<{
    field: null;
    error: string;
  }>;
  current_status?: OrderStatus;
  requested_status?: OrderStatus;
  valid_transitions?: OrderStatus[];
}

/**
 * Admin List Orders Response
 * Response from GET /admin/orders endpoint.
 */
export interface GetAdminOrdersResponse {
  success: boolean;
  message: string;
  data: PaginatedOrderResponse;
}

/**
 * Admin Force Cancel Response
 * Response from POST /admin/orders/{order_id}/force-cancel endpoint.
 */
export interface AdminForceCancelResponse {
  success: boolean;
  message: string;
  data: Order;
}

/**
 * Generic Orders API client.
 * Add domain-specific functions here as endpoints get defined.
 */
export const ordersApi = {
  fetch: ordersFetch,
};
