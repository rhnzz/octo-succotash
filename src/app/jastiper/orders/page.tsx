'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  getMySales,
  markPurchased,
  markShipped,
  cancelOrder,
  type Order,
} from '@/services/order.service';
import { isApiError } from '@/services/api-client';
import { Navbar } from '@/components/Navbar';
import { OrderCard } from '@/components/OrderCard';
import { Pagination } from '@/components/Pagination';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { ConfirmModal } from '@/components/ConfirmModal';
import { useToast } from '@/components/Toast';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'PAID', label: 'Dibayar' },
  { value: 'PURCHASED', label: 'Dibeli' },
  { value: 'SHIPPED', label: 'Dikirim' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
];

export default function JastiperOrdersPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Action modals
  const [actionLoading, setActionLoading] = useState(false);
  const [shippedModal, setShippedModal] = useState<{ orderId: string } | null>(null);
  const [cancelModal, setCancelModal] = useState<{ orderId: string } | null>(null);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login?redirect=/jastiper/orders');
    }
  }, [authLoading, accessToken, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, number | string> = { page, limit, sort_by: 'created_at', order: 'Desc' };
      const result = await getMySales(accessToken, params);
      const allOrders = result.data;
      const filtered = statusFilter === 'ALL'
        ? allOrders
        : allOrders.filter((o) => o.status === statusFilter);
      setOrders(filtered);
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
  }, [accessToken, statusFilter, page]);

  useEffect(() => {
    if (!authLoading && accessToken) fetchData();
  }, [authLoading, accessToken, fetchData]);

  function handleStatusChange(newStatus: string) {
    setStatusFilter(newStatus);
    setPage(1);
  }

  async function handleMarkPurchased(orderId: string) {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await markPurchased(accessToken, orderId);
      showToast('Pesanan telah ditandai sebagai dibeli', 'success');
      fetchData();
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal menandai pesanan', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkShipped(orderId: string) {
    if (!accessToken) return;
    setActionLoading(true);
    try {
      await markShipped(accessToken, orderId, trackingNumber || null, courier || null);
      showToast('Pesanan telah ditandai sebagai dikirim', 'success');
      setShippedModal(null);
      setTrackingNumber('');
      setCourier('');
      fetchData();
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal menandai pesanan', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel(orderId: string) {
    if (!accessToken || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      await cancelOrder(accessToken, orderId, cancelReason);
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

  function handleOrderAction(action: string, orderId: string) {
    if (action === 'purchased') {
      handleMarkPurchased(orderId);
    } else if (action === 'shipped') {
      setShippedModal({ orderId });
    } else if (action === 'cancel') {
      setCancelModal({ orderId });
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
      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Daftar Pesanan Masuk</h1>

        {/* Status filter tabs */}
        <div className="flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter status pesanan">
          {STATUS_TABS.map((tab) => (
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
              <SkeletonLoader key={i} variant="card" />
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
            title="Belum ada pesanan masuk"
            description={statusFilter !== 'ALL' ? 'Tidak ada pesanan dengan status ini' : 'Belum ada pembeli yang memesan produk Anda'}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.order_id} order={order} viewAs="JASTIPER" onAction={handleOrderAction} />
            ))}
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

      {/* Shipped modal */}
      <ConfirmModal
        isOpen={!!shippedModal}
        onClose={() => { setShippedModal(null); setTrackingNumber(''); setCourier(''); }}
        onConfirm={() => shippedModal && handleMarkShipped(shippedModal.orderId)}
        title="Tandai Dikirim"
        message="Masukkan informasi pengiriman untuk pesanan ini."
        confirmLabel="Konfirmasi Kirim"
        isLoading={actionLoading}
      >
        <div className="space-y-3">
          <div>
            <label htmlFor="tracking-number" className="block text-sm font-medium text-gray-700 mb-1">
              Nomor Resi
            </label>
            <input
              id="tracking-number"
              type="text"
              value={trackingNumber}
              onChange={(e) => setTrackingNumber(e.target.value)}
              placeholder="Opsional"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent"
            />
          </div>
          <div>
            <label htmlFor="courier" className="block text-sm font-medium text-gray-700 mb-1">
              Kurir
            </label>
            <input
              id="courier"
              type="text"
              value={courier}
              onChange={(e) => setCourier(e.target.value)}
              placeholder="Opsional, misal: JNE, SiCepat"
              className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent"
            />
          </div>
        </div>
      </ConfirmModal>

      {/* Cancel modal */}
      <ConfirmModal
        isOpen={!!cancelModal}
        onClose={() => { setCancelModal(null); setCancelReason(''); }}
        onConfirm={() => cancelModal && handleCancel(cancelModal.orderId)}
        title="Batalkan Pesanan"
        message="Apakah Anda yakin ingin membatalkan pesanan ini? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Batalkan"
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
