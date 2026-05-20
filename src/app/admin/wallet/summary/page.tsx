'use client';

/**
 * TASK-422a: /admin/wallet/summary — Platform Financial Summary
 *
 * Access: ADMIN only (role guard + middleware guards /admin/*)
 *
 * Fetches GET /admin/transactions?page=1&limit=1 solely to read the `summary`
 * field — no transaction rows are displayed here.
 *
 * Summary fields:
 *   total_topup, total_withdrawal, total_payment,
 *   total_refund, total_earning, platform_escrow_balance
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import { isApiError } from '@/services/api-client';
import type {
  AdminTransactionSummary,
  AdminTransactionListResponse,
} from '@/services/payment.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

// ---------------------------------------------------------------------------
// Admin Navbar (shared pattern across admin pages)
// ---------------------------------------------------------------------------

function AdminNavbar({ currentPath }: { currentPath: string }) {
  const links = [
    { href: '/admin/users', label: 'Pengguna' },
    { href: '/admin/kyc', label: 'KYC' },
    { href: '/admin/catalog', label: 'Produk' },
    { href: '/admin/orders', label: 'Pesanan' },
    { href: '/admin/wallet/summary', label: 'Keuangan' },
  ];

  return (
    <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        <Link href="/" className="text-xl font-extrabold text-white">
          JSON
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto" aria-label="Admin navigation">
          {links.map((link) => {
            const isActive = currentPath.startsWith(link.href);
            return (
              <Link
                key={link.href}
                href={link.href}
                className={`shrink-0 rounded-lg px-3 py-1.5 text-sm transition ${
                  isActive
                    ? 'bg-white/20 font-semibold text-white'
                    : 'text-white/80 hover:bg-white/10 hover:text-white'
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </div>
    </header>
  );
}

// ---------------------------------------------------------------------------
// Sub-nav for the three wallet pages
// ---------------------------------------------------------------------------

function WalletSubNav({ current }: { current: 'summary' | 'requests' | 'transactions' }) {
  const tabs = [
    { key: 'summary', href: '/admin/wallet/summary', label: 'Ringkasan' },
    { key: 'requests', href: '/admin/wallet/requests', label: 'Permintaan' },
    { key: 'transactions', href: '/admin/wallet/transactions', label: 'Transaksi & Penyesuaian' },
  ] as const;

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-4">
        <nav className="flex gap-1" aria-label="Wallet sub-navigation">
          {tabs.map((tab) => (
            <Link
              key={tab.key}
              href={tab.href}
              className={`inline-block border-b-2 px-4 py-3 text-sm font-medium transition ${
                current === tab.key
                  ? 'border-(--color-primary) text-(--color-primary)'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
              aria-current={current === tab.key ? 'page' : undefined}
            >
              {tab.label}
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Summary card
// ---------------------------------------------------------------------------

type CardVariant = 'green' | 'red' | 'blue' | 'orange' | 'purple' | 'yellow';

const variantCls: Record<CardVariant, { icon: string; amount: string; bg: string }> = {
  green:  { icon: 'bg-green-100 text-green-600',  amount: 'text-green-700',  bg: 'bg-white' },
  red:    { icon: 'bg-red-100 text-red-600',      amount: 'text-red-700',    bg: 'bg-white' },
  blue:   { icon: 'bg-blue-100 text-blue-600',    amount: 'text-blue-700',   bg: 'bg-white' },
  orange: { icon: 'bg-orange-100 text-orange-600',amount: 'text-orange-700', bg: 'bg-white' },
  purple: { icon: 'bg-purple-100 text-purple-600',amount: 'text-purple-700', bg: 'bg-white' },
  yellow: { icon: 'bg-yellow-100 text-yellow-600',amount: 'text-yellow-700', bg: 'bg-white' },
};

function SummaryCard({
  label,
  description,
  value,
  variant,
  icon,
  loading,
}: {
  label: string;
  description: string;
  value: number;
  variant: CardVariant;
  icon: React.ReactNode;
  loading: boolean;
}) {
  const cls = variantCls[variant];
  return (
    <div className={`rounded-2xl border border-gray-100 ${cls.bg} p-5 shadow-sm`}>
      <div className="flex items-start justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-gray-700">{label}</p>
          <p className="text-xs text-gray-400 mt-0.5">{description}</p>
        </div>
        <span className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${cls.icon}`}>
          {icon}
        </span>
      </div>
      {loading ? (
        <div className="h-7 w-32 animate-pulse rounded-lg bg-gray-100" />
      ) : (
        <p className={`text-2xl font-bold ${cls.amount}`}>{formatRupiah(value)}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Icons
// ---------------------------------------------------------------------------

const IconArrowDown = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
  </svg>
);
const IconArrowUp = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 10l7-7m0 0l7 7m-7-7v18" />
  </svg>
);
const IconCreditCard = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
  </svg>
);
const IconRefresh = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
  </svg>
);
const IconTrendingUp = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 7h8m0 0v8m0-8l-8 8-4-4-6 6" />
  </svg>
);
const IconLock = (
  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
  </svg>
);

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function AdminWalletSummaryPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { authorizedFetch } = useAuthorizedFetch();

  const [summary, setSummary] = useState<AdminTransactionSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // ---------------------------------------------------------------------------
  // Auth guard — ADMIN only
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading) {
      if (!accessToken) { router.replace('/login'); return; }
      if (user?.role !== 'ADMIN') { router.replace('/'); }
    }
  }, [authLoading, accessToken, user, router]);

  // ---------------------------------------------------------------------------
  // Fetch summary — use GET /admin/transactions?page=1&limit=1 to get summary
  // ---------------------------------------------------------------------------
  async function fetchSummary() {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const data = await authorizedFetch<AdminTransactionListResponse>(
        'payment',
        '/admin/transactions?page=1&limit=1'
      );
      setSummary(data.summary);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat ringkasan keuangan.');
      } else {
        setError('Tidak dapat terhubung ke server.');
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!authLoading && accessToken && user?.role === 'ADMIN') {
      fetchSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authLoading, accessToken, user]);

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-(--color-primary) border-t-transparent" />
      </div>
    );
  }

  if (!accessToken || user?.role !== 'ADMIN') return null;

  const cards = summary
    ? [
        {
          label: 'Total Top-Up',
          description: 'Seluruh top-up yang berhasil',
          value: summary.total_topup,
          variant: 'green' as CardVariant,
          icon: IconArrowDown,
        },
        {
          label: 'Total Penarikan',
          description: 'Seluruh penarikan yang diproses',
          value: summary.total_withdrawal,
          variant: 'red' as CardVariant,
          icon: IconArrowUp,
        },
        {
          label: 'Total Pembayaran',
          description: 'Pembayaran order oleh pembeli',
          value: summary.total_payment,
          variant: 'blue' as CardVariant,
          icon: IconCreditCard,
        },
        {
          label: 'Total Refund',
          description: 'Pengembalian dana ke pembeli',
          value: summary.total_refund,
          variant: 'orange' as CardVariant,
          icon: IconRefresh,
        },
        {
          label: 'Total Penghasilan',
          description: 'Penghasilan yang dikreditkan ke jastiper',
          value: summary.total_earning,
          variant: 'purple' as CardVariant,
          icon: IconTrendingUp,
        },
        {
          label: 'Escrow Platform',
          description: 'Dana tertahan untuk order aktif',
          value: summary.platform_escrow_balance,
          variant: 'yellow' as CardVariant,
          icon: IconLock,
        },
      ]
    : [];

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar currentPath="/admin/wallet/summary" />
      <WalletSubNav current="summary" />

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Ringkasan Keuangan</h1>
            <p className="mt-1 text-sm text-gray-500">
              Gambaran umum arus keuangan platform JSON
            </p>
          </div>
          <button
            onClick={fetchSummary}
            disabled={loading}
            className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            aria-label="Muat ulang data"
          >
            <svg
              className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`}
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            Muat Ulang
          </button>
        </div>

        {/* Error state */}
        {error && (
          <div
            role="alert"
            className="mb-6 flex items-center justify-between rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
          >
            <span>{error}</span>
            <button
              onClick={fetchSummary}
              className="ml-4 shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition"
            >
              Coba lagi
            </button>
          </div>
        )}

        {/* Summary cards grid */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {loading
            ? Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm animate-pulse"
                >
                  <div className="flex items-start justify-between mb-3">
                    <div className="space-y-1.5">
                      <div className="h-4 w-28 rounded bg-gray-100" />
                      <div className="h-3 w-36 rounded bg-gray-100" />
                    </div>
                    <div className="h-9 w-9 rounded-xl bg-gray-100 shrink-0" />
                  </div>
                  <div className="h-7 w-32 rounded-lg bg-gray-100" />
                </div>
              ))
            : cards.map((card) => (
                <SummaryCard
                  key={card.label}
                  label={card.label}
                  description={card.description}
                  value={card.value}
                  variant={card.variant}
                  icon={card.icon}
                  loading={false}
                />
              ))}
        </div>

        {/* Quick links */}
        {!loading && !error && (
          <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <Link
              href="/admin/wallet/requests"
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-(--color-primary) hover:shadow-md transition group"
            >
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-(--color-primary) transition">
                  Permintaan Top-Up & Penarikan
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Tinjau dan proses permintaan yang menunggu persetujuan
                </p>
              </div>
              <svg
                className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-(--color-primary) transition"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>

            <Link
              href="/admin/wallet/transactions"
              className="flex items-center justify-between rounded-2xl border border-gray-200 bg-white p-5 shadow-sm hover:border-(--color-primary) hover:shadow-md transition group"
            >
              <div>
                <p className="font-semibold text-gray-900 group-hover:text-(--color-primary) transition">
                  Semua Transaksi & Penyesuaian
                </p>
                <p className="mt-1 text-sm text-gray-500">
                  Monitor seluruh transaksi dan lakukan penyesuaian saldo manual
                </p>
              </div>
              <svg
                className="h-5 w-5 shrink-0 text-gray-400 group-hover:text-(--color-primary) transition"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
              </svg>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
}
