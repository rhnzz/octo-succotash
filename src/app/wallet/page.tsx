'use client';

/**
 * TASK-420: /wallet — Titiper Wallet Page
 *
 * Features:
 * - Wallet balance card
 * - Top-up form (amount, payment method, bank code) with idempotency key
 * - Transaction history with filter tabs (All, Top-Up, Payment, Refund)
 *
 * Auth: JWT required — redirects to /login if unauthenticated.
 *
 * Payment Service uses RFC 9457 Problem Details errors — parse `detail`, not `message`.
 * All request body fields are snake_case.
 * Top-ups start PENDING — balance does NOT update immediately.
 * idempotency_key is generated fresh per submission via crypto.randomUUID().
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import { isApiError } from '@/services/api-client';
import {
  generateIdempotencyKey,
  type WalletResponse,
  type TransactionSummary,
  type TransactionType,
  type TransactionDirection,
  type TransactionStatus,
  type TopUpPaymentMethod,
} from '@/services/payment.service';

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PAYMENT_METHODS: { value: TopUpPaymentMethod; label: string }[] = [
  { value: 'BANK_TRANSFER', label: 'Transfer Bank' },
  { value: 'VIRTUAL_ACCOUNT', label: 'Virtual Account' },
  { value: 'QRIS', label: 'QRIS' },
  { value: 'EWALLET', label: 'E-Wallet' },
];

const BANK_CODES = ['BCA', 'BNI', 'BRI', 'MANDIRI', 'BSI', 'CIMB', 'PERMATA'];

type TabFilter = 'ALL' | 'TOPUP' | 'PAYMENT' | 'REFUND' | 'EARNING' | 'WITHDRAWAL';

const TABS: { value: TabFilter; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'TOPUP', label: 'Top-Up' },
  { value: 'PAYMENT', label: 'Pembayaran' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'EARNING', label: 'Penghasilan' },
  { value: 'WITHDRAWAL', label: 'Penarikan' },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function txTypeLabel(type: TransactionType): string {
  const map: Record<TransactionType, string> = {
    TOPUP: 'Top-Up',
    PAYMENT: 'Pembayaran',
    REFUND: 'Refund',
    EARNING: 'Penghasilan',
    WITHDRAWAL: 'Penarikan',
    ADJUSTMENT: 'Penyesuaian',
  };
  return map[type] ?? type;
}

function statusLabel(status: TransactionStatus): string {
  const map: Record<TransactionStatus, string> = {
    PENDING: 'Menunggu',
    SUCCESS: 'Berhasil',
    FAILED: 'Gagal',
    CANCELLED: 'Dibatalkan',
  };
  return map[status] ?? status;
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusPill({ status }: { status: TransactionStatus }) {
  const cls: Record<TransactionStatus, string> = {
    PENDING: 'bg-yellow-100 text-yellow-700',
    SUCCESS: 'bg-green-100 text-green-700',
    FAILED: 'bg-red-100 text-red-700',
    CANCELLED: 'bg-gray-100 text-gray-600',
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls[status] ?? 'bg-gray-100 text-gray-600'}`}>
      {statusLabel(status)}
    </span>
  );
}

function DirectionIcon({ direction }: { direction: TransactionDirection }) {
  if (direction === 'CREDIT') {
    return (
      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-green-100 text-green-600" aria-hidden="true">
        ↓
      </span>
    );
  }
  return (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-500" aria-hidden="true">
      ↑
    </span>
  );
}

// ---------------------------------------------------------------------------
// Top-Up Modal
// ---------------------------------------------------------------------------

type TopUpModalProps = {
  onClose: () => void;
  onSuccess: (message: string) => void;
  authorizedFetch: ReturnType<typeof useAuthorizedFetch>['authorizedFetch'];
};

function TopUpModal({ onClose, onSuccess, authorizedFetch }: TopUpModalProps) {
  const [amount, setAmount] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<TopUpPaymentMethod>('BANK_TRANSFER');
  const [bankCode, setBankCode] = useState('BCA');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const needsBankCode = paymentMethod === 'BANK_TRANSFER' || paymentMethod === 'VIRTUAL_ACCOUNT';

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    const amountNum = Number(amount);
    if (!amount || isNaN(amountNum) || amountNum <= 0) {
      setError('Masukkan nominal yang valid');
      return;
    }
    if (needsBankCode && !bankCode) {
      setError('Pilih kode bank');
      return;
    }

    setSubmitting(true);
    try {
      await authorizedFetch<unknown>('payment', '/topups', {
        method: 'POST',
        body: {
          amount: amountNum,
          payment_method: paymentMethod,
          bank_code: bankCode,
          idempotency_key: generateIdempotencyKey(),
        },
      });
      onSuccess(`Top-up ${formatRupiah(amountNum)} berhasil diajukan. Menunggu konfirmasi admin.`);
      onClose();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal mengajukan top-up');
      } else {
        setError('Terjadi kesalahan. Coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const inputCls =
    'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="topup-modal-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <div className="mb-5 flex items-center justify-between">
          <h2 id="topup-modal-title" className="text-lg font-semibold text-gray-900">
            Top-Up Saldo
          </h2>
          <button
            onClick={onClose}
            aria-label="Tutup modal"
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} noValidate className="space-y-4">
          {/* Amount */}
          <div>
            <label htmlFor="topup-amount" className="mb-1.5 block text-sm font-medium text-gray-700">
              Nominal (IDR) <span className="text-red-500">*</span>
            </label>
            <input
              id="topup-amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="100000"
              min={1}
              disabled={submitting}
              className={inputCls}
            />
          </div>

          {/* Payment method */}
          <div>
            <label htmlFor="topup-method" className="mb-1.5 block text-sm font-medium text-gray-700">
              Metode Pembayaran <span className="text-red-500">*</span>
            </label>
            <select
              id="topup-method"
              value={paymentMethod}
              onChange={(e) => setPaymentMethod(e.target.value as TopUpPaymentMethod)}
              disabled={submitting}
              className={inputCls}
            >
              {PAYMENT_METHODS.map((m) => (
                <option key={m.value} value={m.value}>{m.label}</option>
              ))}
            </select>
          </div>

          {/* Bank code — only for BANK_TRANSFER / VIRTUAL_ACCOUNT */}
          {needsBankCode && (
            <div>
              <label htmlFor="topup-bank" className="mb-1.5 block text-sm font-medium text-gray-700">
                Bank <span className="text-red-500">*</span>
              </label>
              <select
                id="topup-bank"
                value={bankCode}
                onChange={(e) => setBankCode(e.target.value)}
                disabled={submitting}
                className={inputCls}
              >
                {BANK_CODES.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            </div>
          )}

          {/* Info note */}
          <p className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-xs text-yellow-800">
            Top-up akan berstatus <strong>Menunggu</strong> hingga dikonfirmasi oleh admin. Saldo tidak langsung bertambah.
          </p>

          {/* Error */}
          {error && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {error}
            </p>
          )}

          {/* Actions */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              disabled={submitting}
              className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
            >
              Batal
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {submitting ? 'Memproses...' : 'Ajukan Top-Up'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WalletPage() {
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useAuth();
  const { authorizedFetch } = useAuthorizedFetch();

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loadingWallet, setLoadingWallet] = useState(true);
  const [loadingTx, setLoadingTx] = useState(true);
  const [walletError, setWalletError] = useState('');
  const [txError, setTxError] = useState('');

  const [activeTab, setActiveTab] = useState<TabFilter>('ALL');
  const [showTopUpModal, setShowTopUpModal] = useState(false);
  const [successMessage, setSuccessMessage] = useState('');

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login?redirect=/wallet');
    }
  }, [authLoading, accessToken, router]);

  // ---------------------------------------------------------------------------
  // Fetch wallet
  // ---------------------------------------------------------------------------
  const fetchWallet = useCallback(async () => {
    if (!accessToken) return;
    setLoadingWallet(true);
    setWalletError('');
    try {
      const data = await authorizedFetch<WalletResponse>('payment', '/wallets/me');
      setWallet(data);
    } catch (err) {
      if (isApiError(err)) {
        setWalletError(err.message || 'Gagal memuat saldo.');
      } else {
        setWalletError('Tidak dapat terhubung ke server.');
      }
    } finally {
      setLoadingWallet(false);
    }
  }, [accessToken, authorizedFetch]);

  // ---------------------------------------------------------------------------
  // Fetch transactions
  // ---------------------------------------------------------------------------
  const fetchTransactions = useCallback(async () => {
    if (!accessToken) return;
    setLoadingTx(true);
    setTxError('');
    try {
      const data = await authorizedFetch<TransactionSummary[]>('payment', '/transactions');
      setTransactions(data);
    } catch (err) {
      if (isApiError(err)) {
        setTxError(err.message || 'Gagal memuat riwayat transaksi.');
      } else {
        setTxError('Tidak dapat terhubung ke server.');
      }
    } finally {
      setLoadingTx(false);
    }
  }, [accessToken, authorizedFetch]);

  useEffect(() => {
    if (authLoading || !accessToken) return;
    fetchWallet();
    fetchTransactions();
  }, [authLoading, accessToken, fetchWallet, fetchTransactions]);

  // ---------------------------------------------------------------------------
  // Filtered transactions
  // ---------------------------------------------------------------------------
  const filteredTx = activeTab === 'ALL'
    ? transactions
    : transactions.filter((tx) => tx.type === (activeTab as TransactionType));

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleTopUpSuccess(message: string) {
    setSuccessMessage(message);
    setTimeout(() => setSuccessMessage(''), 6000);
    // Refresh wallet and transactions after a short delay to allow backend processing
    setTimeout(() => {
      fetchWallet();
      fetchTransactions();
    }, 800);
  }

  // ---------------------------------------------------------------------------
  // Loading state
  // ---------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-(--color-primary) border-t-transparent" />
      </div>
    );
  }

  if (!accessToken) return null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          <nav className="flex items-center gap-4">
            <Link href="/catalog" className="text-sm text-white/80 hover:text-white">Katalog</Link>
            <Link href="/profile" className="text-sm text-white/80 hover:text-white">Profil</Link>
          </nav>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dompet JSON Saya</h1>

        {/* Success toast */}
        {successMessage && (
          <div
            role="alert"
            className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800 flex items-start justify-between gap-3"
          >
            <span>✓ {successMessage}</span>
            <button
              onClick={() => setSuccessMessage('')}
              aria-label="Tutup notifikasi"
              className="shrink-0 text-green-600 hover:text-green-800"
            >
              ✕
            </button>
          </div>
        )}

        {/* Wallet balance card */}
        <div className="rounded-2xl bg-linear-to-br from-(--color-primary) to-(--color-primary-dark) p-6 text-white shadow-md">
          <p className="text-sm text-white/80 mb-1">Saldo Aktif</p>
          {loadingWallet ? (
            <div className="h-10 w-40 animate-pulse rounded-lg bg-white/20 mb-6" />
          ) : walletError ? (
            <p className="text-white/70 text-sm mb-6">{walletError}</p>
          ) : (
            <p className="text-4xl font-bold mb-6">
              {wallet ? formatRupiah(wallet.balance) : '—'}
            </p>
          )}
          <div className="flex flex-wrap gap-3">
            <button
              onClick={() => setShowTopUpModal(true)}
              className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-(--color-primary-dark) hover:bg-gray-100 transition"
            >
              + Top-Up
            </button>
          </div>
        </div>

        {/* Transaction history */}
        <section aria-labelledby="tx-history-heading">
          <h2 id="tx-history-heading" className="mb-4 text-lg font-semibold text-gray-800">
            Riwayat Transaksi
          </h2>

          {/* Filter tabs */}
          <div
            className="mb-4 flex gap-2 overflow-x-auto pb-1 scrollbar-none"
            role="tablist"
            aria-label="Filter transaksi"
          >
            {TABS.map((tab) => (
              <button
                key={tab.value}
                role="tab"
                aria-selected={activeTab === tab.value}
                onClick={() => setActiveTab(tab.value)}
                className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                  activeTab === tab.value
                    ? 'bg-(--color-primary) text-white'
                    : 'bg-white border border-gray-200 text-gray-600 hover:border-(--color-primary) hover:text-(--color-primary)'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Transaction list */}
          {loadingTx ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="flex items-center gap-3 rounded-xl bg-white p-4 shadow-sm animate-pulse">
                  <div className="h-8 w-8 rounded-full bg-gray-200 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-32 rounded bg-gray-200" />
                    <div className="h-3 w-24 rounded bg-gray-100" />
                  </div>
                  <div className="h-4 w-20 rounded bg-gray-200" />
                </div>
              ))}
            </div>
          ) : txError ? (
            <div className="rounded-xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-red-600 mb-3">{txError}</p>
              <button
                onClick={fetchTransactions}
                className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark)"
              >
                Coba lagi
              </button>
            </div>
          ) : filteredTx.length === 0 ? (
            <div className="rounded-xl bg-white p-10 text-center shadow-sm">
              <p className="text-gray-400 text-sm">Belum ada transaksi.</p>
            </div>
          ) : (
            <ul className="space-y-2" aria-label="Daftar transaksi">
              {filteredTx.map((tx) => (
                <li
                  key={tx.transaction_id}
                  className="flex items-center gap-3 rounded-xl bg-white px-4 py-3.5 shadow-sm hover:shadow-md transition"
                >
                  <DirectionIcon direction={tx.direction} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {txTypeLabel(tx.type)}
                    </p>
                    <p className="text-xs text-gray-400 truncate">
                      {tx.description || formatDate(tx.created_at)}
                    </p>
                    {tx.description && (
                      <p className="text-xs text-gray-400">{formatDate(tx.created_at)}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    <p className={`text-sm font-semibold ${tx.direction === 'CREDIT' ? 'text-green-600' : 'text-red-500'}`}>
                      {tx.direction === 'CREDIT' ? '+' : '−'} {formatRupiah(tx.amount)}
                    </p>
                    <StatusPill status={tx.status} />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {/* Top-Up Modal */}
      {showTopUpModal && (
        <TopUpModal
          onClose={() => setShowTopUpModal(false)}
          onSuccess={handleTopUpSuccess}
          authorizedFetch={authorizedFetch}
        />
      )}
    </div>
  );
}
