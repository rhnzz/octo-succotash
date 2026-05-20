// API layer index.
// Auth and payment modules have been migrated to src/services/.
// Import directly from there:
//   import { login, register, ... } from '@/services/auth.service'
//   import { getWallet, requestTopUp, ... } from '@/services/payment.service'
//   import { searchProducts, getProduct, ... } from '@/services/inventory.service'
//   import { createOrder, getOrder, ... } from '@/services/order.service'

export * from './client';
export * from './inventory';
export * from './orders';
