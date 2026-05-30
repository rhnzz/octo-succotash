'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { getMyPurchases, type Order } from '@/services/order.service';
import { isApiError } from '@/services/api-client';
import { Navbar } from '@/components/Navbar';
import { OrderCard } from '@/components/OrderCard';
import { Pagination } from '@/components/Pagination';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';

const STATUS_TABS: { value: string; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'PENDING', label: 'Menunggu' },
  { value: 'PAID', label: 'Dibayar' },
  { value: 'PURCHASED', label: 'Dibeli' },
  { value: 'SHIPPED', label: 'Dikirim' },
  { value: 'COMPLETED', label: 'Selesai' },
  { value: 'CANCELLED', label: 'Dibatalkan' },
];

export default function OrdersPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState('ALL');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login?redirect=/orders');
    }
  }, [authLoading, accessToken, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params: Record<string, number | string> = { page, limit, sort_by: 'created_at', order: 'Desc' };
      const result = await getMyPurchases(accessToken, params);
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
        <h1 className="text-2xl font-bold text-gray-900">Riwayat Pesanan</h1>

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
            title="Belum ada pesanan"
            description={statusFilter !== 'ALL' ? 'Tidak ada pesanan dengan status ini' : 'Mulai belanja dari katalog produk'}
            action={{ label: 'Mulai Belanja', href: '/catalog' }}
          />
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <OrderCard key={order.order_id} order={order} viewAs="TITIPERS" />
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
    </div>
  );
}
