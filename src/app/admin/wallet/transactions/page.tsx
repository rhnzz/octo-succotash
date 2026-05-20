'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import { isApiError } from '@/services/api-client';
import {
  getAdminTransactions,
  adjustWallet,
  type AdminTransactionItem,
  type AdminTransactionListResponse,
  type TransactionType,
  type TransactionStatus,
  type TransactionDirection,
} from '@/services/payment.service';
import { Pagination } from '@/components/Pagination';
import { StatusBadge } from '@/components/StatusBadge';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/Toast';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

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
        <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
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

const TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Tipe' },
  { value: 'TOPUP', label: 'Top-Up' },
  { value: 'PAYMENT', label: 'Pembayaran' },
  { value: 'REFUND', label: 'Refund' },
  { value: 'EARNING', label: 'Penghasilan' },
  { value: 'WITHDRAWAL', label: 'Penarikan' },
  { value: 'ADJUSTMENT', label: 'Penyesuaian' },
];

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'PENDING', label: 'Pending' },
  { value: 'SUCCESS', label: 'Sukses' },
  { value: 'FAILED', label: 'Gagal' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
];

export default function AdminWalletTransactionsPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [transactions, setTransactions] = useState<AdminTransactionItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Filters
  const [typeFilter, setTypeFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Adjustment modal
  const [showAdjustModal, setShowAdjustModal] = useState(false);
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustDirection, setAdjustDirection] = useState<TransactionDirection>('CREDIT');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [adjustLoading, setAdjustLoading] = useState(false);

  useEffect(() => {
    if (!authLoading) {
      if (!accessToken) { router.replace('/login'); return; }
      if (user?.role !== 'ADMIN') { router.replace('/'); }
    }
  }, [authLoading, accessToken, user, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number | undefined> = {
        page, limit,
        type: typeFilter || undefined,
        status: statusFilter || undefined,
      };
      const result = await getAdminTransactions(accessToken, params as any);
      setTransactions(result.data);
      setTotalItems(result.pagination.total_items);
      setTotalPages(result.pagination.total_pages);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat transaksi');
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, typeFilter, statusFilter, page]);

  useEffect(() => {
    if (!authLoading && accessToken && user?.role === 'ADMIN') {
      fetchData();
    }
  }, [authLoading, accessToken, user, fetchData]);

  function handleFilterChange() {
    setPage(1);
    fetchData();
  }

  async function handleAdjust() {
    if (!accessToken || !adjustUserId.trim() || !adjustAmount || !adjustReason.trim()) {
      showToast('Semua field harus diisi', 'warning');
      return;
    }
    const amount = parseInt(adjustAmount, 10);
    if (isNaN(amount) || amount <= 0) {
      showToast('Jumlah harus berupa angka positif', 'warning');
      return;
    }
    setAdjustLoading(true);
    try {
      await adjustWallet(accessToken, adjustUserId.trim(), {
        direction: adjustDirection,
        amount,
        reason: adjustReason,
      });
      showToast('Penyesuaian saldo berhasil', 'success');
      setShowAdjustModal(false);
      setAdjustUserId('');
      setAdjustAmount('');
      setAdjustReason('');
      fetchData();
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal melakukan penyesuaian', 'error');
    } finally {
      setAdjustLoading(false);
    }
  }

  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!accessToken || user?.role !== 'ADMIN') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar currentPath="/admin/wallet/transactions" />
      <WalletSubNav current="transactions" />

      <main className="mx-auto max-w-7xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Semua Transaksi & Penyesuaian</h1>
            <p className="mt-1 text-sm text-gray-500">Monitor seluruh transaksi dan lakukan penyesuaian saldo manual</p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAdjustModal(true)}
              className="rounded-xl bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
            >
              + Penyesuaian Manual
            </button>
            <button
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
            >
              <svg className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
              Muat Ulang
            </button>
          </div>
        </div>

        {/* Filters */}
        <div className="flex flex-wrap gap-3">
          <select
            value={typeFilter}
            onChange={(e) => { setTypeFilter(e.target.value); handleFilterChange(); }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent"
          >
            {TYPE_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <select
            value={statusFilter}
            onChange={(e) => { setStatusFilter(e.target.value); handleFilterChange(); }}
            className="rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent"
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchData} className="ml-4 shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition">Coba lagi</button>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <div key={i} className="rounded-xl bg-white p-5 shadow-sm animate-pulse h-16" />
            ))}
          </div>
        ) : transactions.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">Tidak ada transaksi ditemukan.</p>
          </div>
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Tipe</th>
                  <th className="px-4 py-3">Jumlah</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">User</th>
                  <th className="px-4 py-3">Deskripsi</th>
                  <th className="px-4 py-3">Tanggal</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {transactions.map((tx) => (
                  <tr key={tx.transaction_id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {tx.transaction_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`font-medium ${
                        tx.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'
                      }`}>
                        {tx.type}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {formatRupiah(tx.amount)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={tx.status} type="transaction" />
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {tx.user.user_id.slice(0, 8)}
                    </td>
                    <td className="px-4 py-3 text-gray-500 max-w-xs truncate">
                      {tx.description}
                    </td>
                    <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                      {formatDate(tx.created_at)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && transactions.length > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            itemsPerPage={limit}
          />
        )}
      </main>

      {/* Adjustment Modal */}
      <ConfirmModal
        isOpen={showAdjustModal}
        onClose={() => { setShowAdjustModal(false); setAdjustUserId(''); setAdjustAmount(''); setAdjustReason(''); }}
        onConfirm={handleAdjust}
        title="Penyesuaian Saldo Manual"
        message="Masukkan detail penyesuaian saldo untuk pengguna."
        confirmLabel="Simpan Penyesuaian"
        isLoading={adjustLoading}
      >
        <div className="space-y-4">
          <div>
            <label htmlFor="adjust-user-id" className="block text-sm font-medium text-gray-700 mb-1">
              User ID <span className="text-red-500">*</span>
            </label>
            <input
              id="adjust-user-id"
              type="text"
              value={adjustUserId}
              onChange={(e) => setAdjustUserId(e.target.value)}
              placeholder="UUID pengguna"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="adjust-direction" className="block text-sm font-medium text-gray-700 mb-1">
              Arah <span className="text-red-500">*</span>
            </label>
            <select
              id="adjust-direction"
              value={adjustDirection}
              onChange={(e) => setAdjustDirection(e.target.value as TransactionDirection)}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent"
            >
              <option value="CREDIT">Kredit (+)</option>
              <option value="DEBIT">Debit (-)</option>
            </select>
          </div>
          <div>
            <label htmlFor="adjust-amount" className="block text-sm font-medium text-gray-700 mb-1">
              Jumlah (IDR) <span className="text-red-500">*</span>
            </label>
            <input
              id="adjust-amount"
              type="number"
              min={1}
              value={adjustAmount}
              onChange={(e) => setAdjustAmount(e.target.value)}
              placeholder="100000"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="adjust-reason" className="block text-sm font-medium text-gray-700 mb-1">
              Alasan <span className="text-red-500">*</span>
            </label>
            <textarea
              id="adjust-reason"
              value={adjustReason}
              onChange={(e) => setAdjustReason(e.target.value)}
              placeholder="Alasan penyesuaian saldo"
              rows={2}
              maxLength={500}
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent resize-none"
            />
            <p className="text-xs text-gray-400 mt-1">{adjustReason.length}/500</p>
          </div>
        </div>
      </ConfirmModal>
    </div>
  );
}
