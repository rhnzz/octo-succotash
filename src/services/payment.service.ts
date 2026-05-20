/**
 * Payment Service
 * Base URL: NEXT_PUBLIC_PAYMENT_SERVICE_URL (Spring Boot, :8081)
 * Error shape: RFC 9457 Problem Details — parse 'detail', NOT 'message'
 *
 * CRITICAL: All request body fields must be snake_case (global SNAKE_CASE Jackson strategy).
 * CRITICAL: Amounts are integers in IDR — never use parseFloat.
 * CRITICAL: idempotency_key must be unique per request — generate a UUID before submitting.
 * CRITICAL: escrow_balance is NOT spendable — only show `balance` to users.
 * CRITICAL: GET /wallets/me only returns wallet_id, user_id, balance (no escrow).
 *
 * Contracts: .kiro/steering/backend-contracts-payment-service.md
 */

import { paymentRequest } from './api-client';

// ---------------------------------------------------------------------------
// TASK-418: Idempotency key generation
// Use crypto.randomUUID() to generate a unique key before each top-up or
// withdrawal submission. Call this once per form submission — never reuse keys.
// Duplicate keys return 409 from the Payment Service.
// ---------------------------------------------------------------------------

/**
 * Generates a unique idempotency key for top-up and withdrawal requests.
 * Must be called once per submission attempt — never reuse across requests.
 */
export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type TransactionType =
  | 'TOPUP'
  | 'PAYMENT'
  | 'REFUND'
  | 'EARNING'
  | 'WITHDRAWAL'
  | 'ADJUSTMENT';

export type TransactionDirection = 'CREDIT' | 'DEBIT';
export type TransactionStatus = 'PENDING' | 'SUCCESS' | 'FAILED' | 'CANCELLED';
export type TopUpPaymentMethod = 'BANK_TRANSFER' | 'VIRTUAL_ACCOUNT' | 'QRIS' | 'EWALLET';

// ---------------------------------------------------------------------------
// getWallet
// GET /wallets/me
// Protected — JWT required
// Returns wallet_id, user_id, balance ONLY (no escrow_balance here)
// ---------------------------------------------------------------------------

export type WalletResponse = {
  wallet_id: string;
  user_id: string;
  balance: number;
};

export async function getWallet(token: string): Promise<WalletResponse> {
  return paymentRequest<WalletResponse>('/wallets/me', {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// getTransactions
// GET /transactions
// Protected — JWT required
// ---------------------------------------------------------------------------

export type TransactionSummary = {
  transaction_id: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  description: string;
  created_at: string;
};

export async function getTransactions(token: string): Promise<TransactionSummary[]> {
  return paymentRequest<TransactionSummary[]>('/transactions', {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// getTransaction
// GET /transactions/:transactionId
// Protected — JWT required (own transactions only)
// ---------------------------------------------------------------------------

export type TransactionDetail = {
  transaction_id: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  description: string;
  reference_id: string | null;
  reference_type: 'ORDER' | 'TOPUP' | 'WITHDRAWAL' | null;
  payment_method: string | null;
  payment_reference: string | null;
  confirmed_by: string | null;
  created_at: string;
  updated_at: string;
};

export async function getTransaction(
  token: string,
  transactionId: string
): Promise<TransactionDetail> {
  return paymentRequest<TransactionDetail>(
    `/transactions/${encodeURIComponent(transactionId)}`,
    { method: 'GET', token }
  );
}

// ---------------------------------------------------------------------------
// getTopUps
// GET /topups
// Protected — JWT required
// ---------------------------------------------------------------------------

export type TopUpSummary = {
  transaction_id: string;
  type: 'TOPUP';
  amount: number;
  status: TransactionStatus;
  created_at: string;
};

export async function getTopUps(token: string): Promise<TopUpSummary[]> {
  return paymentRequest<TopUpSummary[]>('/topups', {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// requestTopUp
// POST /topups
// Protected — JWT required
// IMPORTANT: bank_code is required for BANK_TRANSFER and VIRTUAL_ACCOUNT
// IMPORTANT: idempotency_key must be unique per request (generate UUID client-side)
// IMPORTANT: top-up starts PENDING — admin must approve before balance updates
// ---------------------------------------------------------------------------

export type RequestTopUpInput = {
  amount: number;
  payment_method: TopUpPaymentMethod;
  bank_code: string;
  idempotency_key: string;
};

export type RequestTopUpResponse = {
  transaction_id: string;
  type: 'TOPUP';
  amount: number;
  status: 'PENDING';
  created_at: string;
};

export async function requestTopUp(
  token: string,
  input: RequestTopUpInput
): Promise<RequestTopUpResponse> {
  return paymentRequest<RequestTopUpResponse>('/topups', {
    method: 'POST',
    token,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// getWithdrawals
// GET /withdrawals
// Protected — JWT required
// ---------------------------------------------------------------------------

export type WithdrawalSummary = {
  transaction_id: string;
  type: 'WITHDRAWAL';
  amount: number;
  status: TransactionStatus;
  created_at: string;
};

export async function getWithdrawals(token: string): Promise<WithdrawalSummary[]> {
  return paymentRequest<WithdrawalSummary[]>('/withdrawals', {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// requestWithdrawal
// POST /withdrawals
// Protected — JWT required
// IMPORTANT: notes is required (not optional)
// IMPORTANT: deducts balance immediately on submission
// IMPORTANT: idempotency_key must be unique per request
// ---------------------------------------------------------------------------

export type RequestWithdrawalInput = {
  amount: number;
  bank_account_id: string;
  idempotency_key: string;
  notes: string;
};

export type RequestWithdrawalResponse = {
  transaction_id: string;
  type: 'WITHDRAWAL';
  amount: number;
  status: 'PENDING';
  created_at: string;
};

export async function requestWithdrawal(
  token: string,
  input: RequestWithdrawalInput
): Promise<RequestWithdrawalResponse> {
  return paymentRequest<RequestWithdrawalResponse>('/withdrawals', {
    method: 'POST',
    token,
    body: input,
  });
}

// ---------------------------------------------------------------------------
// Admin — getAdminTopUps
// GET /admin/topups
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export type AdminTopUpListParams = {
  status?: TransactionStatus;
};

export async function getAdminTopUps(
  token: string,
  params?: AdminTopUpListParams
): Promise<TopUpSummary[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return paymentRequest<TopUpSummary[]>(`/admin/topups${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// Admin — processAdminTopUp
// PATCH /admin/topups/:transaction_id
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export type AdminProcessTopUpInput =
  | { action: 'APPROVE' }
  | { action: 'REJECT'; rejection_reason: string };

export type AdminProcessTopUpResponse = {
  transaction_id: string;
  approval_status: 'APPROVE' | 'REJECT';
  amount: number;
  new_balance: number;
  confirmed_at: string;
};

export async function processAdminTopUp(
  token: string,
  transactionId: string,
  input: AdminProcessTopUpInput
): Promise<AdminProcessTopUpResponse> {
  return paymentRequest<AdminProcessTopUpResponse>(
    `/admin/topups/${encodeURIComponent(transactionId)}`,
    { method: 'PATCH', token, body: input }
  );
}

// ---------------------------------------------------------------------------
// Admin — getAdminWithdrawals
// GET /admin/withdrawals
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export type AdminWithdrawalListParams = {
  status?: TransactionStatus;
};

export async function getAdminWithdrawals(
  token: string,
  params?: AdminWithdrawalListParams
): Promise<WithdrawalSummary[]> {
  const query = new URLSearchParams();
  if (params?.status) query.set('status', params.status);
  const qs = query.toString();
  return paymentRequest<WithdrawalSummary[]>(`/admin/withdrawals${qs ? `?${qs}` : ''}`, {
    method: 'GET',
    token,
  });
}

// ---------------------------------------------------------------------------
// Admin — processAdminWithdrawal
// PATCH /admin/withdrawals/:transaction_id
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export type AdminProcessWithdrawalInput =
  | { action: 'APPROVE' }
  | { action: 'REJECT'; rejection_reason: string };

export type AdminProcessWithdrawalResponse = {
  transaction_id: string;
  status: 'APPROVE' | 'REJECT';
  amount: number;
  transfer_reference: string | null;
  processed_at: string | null;
  rejection_reason: string | null;
};

export async function processAdminWithdrawal(
  token: string,
  transactionId: string,
  input: AdminProcessWithdrawalInput
): Promise<AdminProcessWithdrawalResponse> {
  return paymentRequest<AdminProcessWithdrawalResponse>(
    `/admin/withdrawals/${encodeURIComponent(transactionId)}`,
    { method: 'PATCH', token, body: input }
  );
}

// ---------------------------------------------------------------------------
// Admin — getAdminTransactions
// GET /admin/transactions
// Protected — ADMIN role only
// NOTE: user.username and user.role are always null in current backend impl
// ---------------------------------------------------------------------------

export type AdminTransactionUser = {
  user_id: string;
  username: null;
  role: null;
};

export type AdminTransactionItem = {
  transaction_id: string;
  type: TransactionType;
  amount: number;
  direction: TransactionDirection;
  status: TransactionStatus;
  user: AdminTransactionUser;
  description: string;
  reference_id: string | null;
  created_at: string;
};

export type AdminTransactionSummary = {
  total_topup: number;
  total_withdrawal: number;
  total_payment: number;
  total_refund: number;
  total_earning: number;
  platform_escrow_balance: number;
};

export type AdminTransactionListParams = {
  user_id?: string;
  type?: TransactionType;
  status?: TransactionStatus;
  date_from?: string;
  date_to?: string;
  min_amount?: number;
  page?: number;
  limit?: number;
};

export type AdminTransactionListResponse = {
  data: AdminTransactionItem[];
  pagination: {
    page: number;
    limit: number;
    total_items: number;
    total_pages: number;
  };
  summary: AdminTransactionSummary;
};

export async function getAdminTransactions(
  token: string,
  params?: AdminTransactionListParams
): Promise<AdminTransactionListResponse> {
  const query = new URLSearchParams();
  if (params) {
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined) query.set(k, String(v));
    });
  }
  const qs = query.toString();
  return paymentRequest<AdminTransactionListResponse>(
    `/admin/transactions${qs ? `?${qs}` : ''}`,
    { method: 'GET', token }
  );
}

// ---------------------------------------------------------------------------
// Admin — getAdminWallet
// GET /admin/wallets/:userQueryId
// Protected — ADMIN role only
// Returns full wallet entity including escrow_balance and lifetime totals
// ---------------------------------------------------------------------------

export type AdminWalletResponse = {
  wallet_id: string;
  user_id: string;
  balance: number;
  escrow_balance: number;
  total_topup_lifetime: number;
  total_withdrawal_lifetime: number;
  created_at: string;
  updated_at: string;
};

export async function getAdminWallet(
  token: string,
  userId: string
): Promise<AdminWalletResponse> {
  return paymentRequest<AdminWalletResponse>(
    `/admin/wallets/${encodeURIComponent(userId)}`,
    { method: 'GET', token }
  );
}

// ---------------------------------------------------------------------------
// Admin — createAdminWallet
// POST /admin/wallets/:userId
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export async function createAdminWallet(
  token: string,
  userId: string
): Promise<AdminWalletResponse> {
  return paymentRequest<AdminWalletResponse>(
    `/admin/wallets/${encodeURIComponent(userId)}`,
    { method: 'POST', token }
  );
}

// ---------------------------------------------------------------------------
// Admin — adjustWallet
// POST /admin/wallets/:user_id/adjust
// Protected — ADMIN role only
// ---------------------------------------------------------------------------

export type AdjustWalletInput = {
  direction: TransactionDirection;
  amount: number;
  reason: string;
  reference_id?: string;
};

export type AdjustWalletResponse = {
  transaction_id: string;
  type: 'ADJUSTMENT';
  user_id: string;
  direction: TransactionDirection;
  amount: number;
  new_balance: number;
  reason: string;
  adjusted_by: string;
  created_at: string;
};

export async function adjustWallet(
  token: string,
  userId: string,
  input: AdjustWalletInput
): Promise<AdjustWalletResponse> {
  return paymentRequest<AdjustWalletResponse>(
    `/admin/wallets/${encodeURIComponent(userId)}/adjust`,
    { method: 'POST', token, body: input }
  );
}

// ---------------------------------------------------------------------------
// TASK-419: Wallet balance pre-check
// Used on the order detail page (/orders/[orderId]) to determine whether the
// "Bayar Sekarang" (Pay Now) button should be enabled.
//
// Flow:
//   1. Fetch GET /wallets/me to get the user's current spendable balance.
//   2. Compare balance against the order's total_price.
//   3. Disable the pay button if balance < total_price.
//
// NOTE: escrow_balance is NOT spendable — only `balance` is checked here.
// NOTE: This check is advisory only — the Payment Service enforces the real
//       constraint server-side and will return 422 if balance is insufficient.
// ---------------------------------------------------------------------------

export type WalletBalanceCheckResult = {
  /** The user's current spendable balance in IDR. */
  balance: number;
  /** Whether the balance covers the required amount. */
  isSufficient: boolean;
};

/**
 * Fetches the user's wallet and checks whether their balance covers
 * `requiredAmount`. Use this to gate the "Bayar Sekarang" button on the
 * order detail page before calling payOrder().
 *
 * @param token       - JWT access token
 * @param requiredAmount - The order's total_price (integer IDR)
 */
export async function checkWalletBalance(
  token: string,
  requiredAmount: number
): Promise<WalletBalanceCheckResult> {
  const wallet = await getWallet(token);
  return {
    balance: wallet.balance,
    isSufficient: wallet.balance >= requiredAmount,
  };
}
