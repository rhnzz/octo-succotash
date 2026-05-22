'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import { getMySales, type Order } from '@/services/order.service';
import { isApiError } from '@/services/api-client';
import type { WalletResponse } from '@/services/payment.service';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function StatCard({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-xl bg-white p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <p className={`mt-1 text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

export default function JastiperDashboardPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { authorizedFetch } = useAuthorizedFetch();

  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login?redirect=/jastiper/dashboard');
    }
  }, [authLoading, accessToken, router]);

  useEffect(() => {
    if (!authLoading && user && user.role !== 'JASTIPER') {
      router.push('/dashboard');
    }
  }, [authLoading, user, router]);

  const fetchDashboard = useCallback(async () => {
    if (!accessToken) return;
    setOrdersLoading(true);
    setError('');
    try {
      const [ordersData, walletData] = await Promise.all([
        getMySales(accessToken, { page: 1, limit: 5, sort_by: 'created_at', order: 'Desc' }),
        authorizedFetch<WalletResponse>('payment', '/wallets/me').catch(() => null),
      ]);
      setOrders(ordersData.data);
      if (walletData) setWalletBalance(walletData.balance);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message);
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setOrdersLoading(false);
      setWalletLoading(false);
    }
  }, [accessToken, authorizedFetch]);

  useEffect(() => {
    if (!authLoading && accessToken) fetchDashboard();
  }, [authLoading, accessToken, fetchDashboard]);

  const aktifOrders = orders.filter((o) => ['PAID', 'PURCHASED', 'SHIPPED'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED');

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
      <main className="mx-auto max-w-5xl px-4 py-8 space-y-8">
        {/* Header */}
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Dashboard Jastiper</h1>
          <p className="text-sm text-gray-500 mt-1">
            Selamat datang, {user?.username || 'Jastiper'}
          </p>
        </div>

        {/* Wallet Section */}
        <div className="rounded-2xl bg-linear-to-br from-(--color-secondary) to-orange-500 p-6 text-white shadow-sm">
          <p className="text-sm text-white/80">Saldo Dompet</p>
          {walletLoading ? (
            <div className="h-8 w-40 rounded bg-white/20 animate-pulse mt-1" />
          ) : walletBalance !== null ? (
            <p className="mt-1 text-3xl font-extrabold">{formatRupiah(walletBalance)}</p>
          ) : (
            <p className="mt-1 text-sm text-white/60">Gagal memuat saldo</p>
          )}
          <div className="mt-4 flex gap-3">
            <Link
              href="/jastiper/wallet"
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 transition"
            >
              Kelola Dompet
            </Link>
            <Link
              href="/jastiper/wallet"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-orange-700 hover:bg-gray-100 transition"
            >
              Tarik Saldo
            </Link>
          </div>
        </div>

        {/* Stats */}
        {ordersLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-white p-5 shadow-sm border border-gray-100 animate-pulse">
                <div className="h-3 w-20 rounded bg-gray-200" />
                <div className="h-8 w-12 rounded bg-gray-200 mt-2" />
              </div>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <StatCard label="Pesanan Aktif" value={aktifOrders.length} color="text-blue-600" />
            <StatCard label="Selesai" value={completedOrders.length} color="text-green-600" />
            <StatCard label="Dibatalkan" value={cancelledOrders.length} color="text-red-600" />
          </div>
        )}

        {/* Recent Orders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pesanan Masuk Terbaru</h2>
            <Link href="/jastiper/orders" className="text-sm text-(--color-primary) hover:underline">
              Lihat Semua
            </Link>
          </div>

          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <SkeletonLoader key={i} variant="row" />)}
            </div>
          ) : error ? (
            <div className="rounded-xl bg-white p-6 text-center shadow-sm">
              <p className="text-sm text-red-600">{error}</p>
              <button
                onClick={fetchDashboard}
                className="mt-3 rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark) transition"
              >
                Coba lagi
              </button>
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              title="Belum ada pesanan masuk"
              description="Belum ada pembeli yang memesan produk Anda"
              action={{ label: 'Buka Katalog', href: '/jastiper/catalog' }}
            />
          ) : (
            <div className="overflow-hidden rounded-xl bg-white shadow-sm">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    <th className="px-4 py-3">Produk</th>
                    <th className="px-4 py-3">Pembeli</th>
                    <th className="px-4 py-3">Total</th>
                    <th className="px-4 py-3">Status</th>
                    <th className="px-4 py-3">Tanggal</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {orders.map((order) => (
                    <tr
                      key={order.order_id}
                      onClick={() => router.push(`/jastiper/orders/${order.order_id}`)}
                      className="hover:bg-gray-50 transition cursor-pointer"
                    >
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
                                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
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
                      <td className="px-4 py-3 font-semibold text-gray-900">
                        {formatRupiah(order.total_price)}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={order.status} type="order" />
                      </td>
                      <td className="px-4 py-3 text-xs text-gray-400">
                        {formatDate(order.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* Quick Links */}
        <section className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <Link
            href="/jastiper/orders"
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-center"
          >
            <p className="text-sm font-semibold text-gray-900">Pesanan</p>
            <p className="text-xs text-gray-500 mt-1">Kelola pesanan</p>
          </Link>
          <Link
            href="/jastiper/catalog"
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-center"
          >
            <p className="text-sm font-semibold text-gray-900">Katalog</p>
            <p className="text-xs text-gray-500 mt-1">Atur produk</p>
          </Link>
          <Link
            href="/jastiper/wallet"
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-center"
          >
            <p className="text-sm font-semibold text-gray-900">Dompet</p>
            <p className="text-xs text-gray-500 mt-1">Tarik saldo</p>
          </Link>
        </section>
      </main>
    </div>
  );
}
