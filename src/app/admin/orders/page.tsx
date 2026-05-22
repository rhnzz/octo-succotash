'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  adminGetOrders,
  adminForceCancel,
  type Order,
} from '@/services/order.service';
import { isApiError } from '@/services/api-client';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/Pagination';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';
import { SearchBar } from '@/components/SearchBar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'PAID', label: 'Dibayar' },
  { value: 'PURCHASED', label: 'Dibeli' },
  { value: 'SHIPPED', label: 'Dikirim' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
  { value: 'REFUNDING', label: 'Refund' },
];

const TERMINAL_STATUSES = ['COMPLETED', 'CANCELLED', 'REFUND_FAILED'];

export default function AdminOrdersPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Cancel modal
  const [cancelModal, setCancelModal] = useState<{ orderId: string } | null>(null);
  const [cancelReason, setCancelReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login?redirect=/admin/orders');
    }
  }, [authLoading, accessToken, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== 'ADMIN') {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, string | number> = { page, limit, sort_by: 'created_at', order: 'Desc' };
      if (statusFilter) params.status = statusFilter;
      if (searchQuery.trim()) params.search = searchQuery.trim();
      const result = await adminGetOrders(accessToken, params);
      setOrders(result.data);
      setTotalItems(result.pagination.total_items);
      setTotalPages(result.pagination.total_pages);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat pesanan');
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter, searchQuery, page]);

  useEffect(() => {
    if (!authLoading && accessToken) fetchData();
  }, [authLoading, accessToken, fetchData]);

  function handleStatusChange(newStatus: string) {
    setStatusFilter(newStatus);
    setPage(1);
  }

  function handleSearch(value: string) {
    setSearchQuery(value);
    setPage(1);
  }

  async function handleForceCancel() {
    if (!accessToken || !cancelModal || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await adminForceCancel(accessToken, cancelModal.orderId, cancelReason);
      showToast('Pesanan berhasil dibatalkan', 'success');
      setCancelModal(null);
      setCancelReason('');
      fetchData();
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal membatalkan pesanan', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  if (authLoading || !accessToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-6xl px-4 py-8 space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <h1 className="text-2xl font-bold text-gray-900">Semua Pesanan</h1>
          <div className="w-full max-w-xs">
            <SearchBar
              value={searchQuery}
              onChange={handleSearch}
              placeholder="Cari ID pesanan..."
            />
          </div>
        </div>

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter status pesanan">
          {STATUS_OPTIONS.map((tab) => (
            <button
              key={tab.value}
              role="tab"
              aria-selected={statusFilter === tab.value}
              onClick={() => handleStatusChange(tab.value)}
              className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-medium transition ${
                statusFilter === tab.value
                  ? 'bg-(--color-primary) text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-(--color-primary) hover:text-(--color-primary)'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3, 4, 5].map((i) => (
              <SkeletonLoader key={i} variant="row" />
            ))}
          </div>
        ) : error ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={fetchData}
              className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark) transition"
            >
              Coba lagi
            </button>
          </div>
        ) : orders.length === 0 ? (
          <EmptyState
            title="Belum ada pesanan"
            description={statusFilter || searchQuery ? 'Tidak ada pesanan dengan filter ini' : 'Belum ada transaksi di platform'}
          />
        ) : (
          <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <th className="px-4 py-3">ID Pesanan</th>
                  <th className="px-4 py-3">Produk</th>
                  <th className="px-4 py-3">Pembeli</th>
                  <th className="px-4 py-3">Jastiper</th>
                  <th className="px-4 py-3">Total</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Tanggal</th>
                  <th className="px-4 py-3">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {orders.map((order) => (
                  <tr key={order.order_id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {order.order_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <div className="h-8 w-8 shrink-0 rounded bg-gray-100 overflow-hidden">
                          {order.product_snapshot?.image_url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={order.product_snapshot.image_url}
                              alt={order.product_snapshot.name}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="flex h-full w-full items-center justify-center text-gray-300 text-xs">
                              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <span className="text-gray-900 max-w-[160px] truncate">
                          {order.product_snapshot?.name ?? 'Produk'}
                        </span>
                      </div>
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {order.titipers_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-500">
                      {order.jastiper_id.slice(0, 8)}...
                    </td>
                    <td className="px-4 py-3 font-semibold text-gray-900">
                      {formatRupiah(order.total_price)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} type="order" />
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-400">
                      {formatDate(order.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      {!TERMINAL_STATUSES.includes(order.status) && (
                        <button
                          onClick={() => setCancelModal({ orderId: order.order_id })}
                          className="rounded-lg border border-red-200 px-2.5 py-1 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                        >
                          Force Cancel
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {!loading && orders.length > 0 && (
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={totalItems}
            itemsPerPage={limit}
          />
        )}
      </main>

      {/* Force Cancel modal */}
      <ConfirmModal
        isOpen={!!cancelModal}
        onClose={() => { setCancelModal(null); setCancelReason(''); }}
        onConfirm={handleForceCancel}
        title="Force Cancel Pesanan"
        message="Apakah Anda yakin ingin memaksa membatalkan pesanan ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Force Cancel"
        isLoading={actionLoading}
      >
        <div>
          <label htmlFor="cancel-reason" className="block text-sm font-medium text-gray-700 mb-1">
            Alasan Pembatalan <span className="text-red-500">*</span>
          </label>
          <textarea
            id="cancel-reason"
            value={cancelReason}
            onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Jelaskan alasan pembatalan"
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{cancelReason.length}/500</p>
        </div>
      </ConfirmModal>
    </div>
  );
}
