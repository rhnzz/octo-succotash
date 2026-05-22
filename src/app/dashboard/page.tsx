'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import { getMyPurchases, type Order } from '@/services/order.service';
import { getMyProfile } from '@/services/auth.service';
import type { ProfileResponse } from '@/services/auth.service';
import type { WalletResponse } from '@/services/payment.service';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { KYCStatusBanner } from '@/components/KYCStatusBanner';
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

export default function DashboardPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { authorizedFetch } = useAuthorizedFetch();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [orders, setOrders] = useState<Order[]>([]);
  const [ordersLoading, setOrdersLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login?redirect=/dashboard');
    }
  }, [authLoading, accessToken, router]);

  const fetchDashboard = useCallback(async () => {
    if (!accessToken) return;
    try {
      const [profileData, ordersData, walletData] = await Promise.all([
        getMyProfile(accessToken).catch(() => null),
        getMyPurchases(accessToken, { page: 1, limit: 5, sort_by: 'created_at', order: 'Desc' }),
        authorizedFetch<WalletResponse>('payment', '/wallets/me').catch(() => null),
      ]);
      if (profileData) setProfile(profileData);
      setOrders(ordersData.data);
      if (walletData) setWalletBalance(walletData.balance);
    } catch {
      // Fail silently
    } finally {
      setProfileLoading(false);
      setOrdersLoading(false);
      setWalletLoading(false);
    }
  }, [accessToken, authorizedFetch]);

  useEffect(() => {
    if (!authLoading && accessToken) fetchDashboard();
  }, [authLoading, accessToken, fetchDashboard]);

  const aktifOrders = orders.filter((o) => ['PENDING', 'PAID', 'PURCHASED', 'SHIPPED'].includes(o.status));
  const completedOrders = orders.filter((o) => o.status === 'COMPLETED');
  const cancelledOrders = orders.filter((o) => o.status === 'CANCELLED');

  const kycStatus = profile?.kyc_status ?? null;

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
          <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
          <p className="text-sm text-gray-500 mt-1">
            Selamat datang, {profile?.full_name || profile?.username || user?.username || 'Titipers'}
          </p>
        </div>

        {/* KYC Banner */}
        {profileLoading ? (
          <SkeletonLoader variant="text" count={1} />
        ) : (
          <KYCStatusBanner
            status={kycStatus}
            ctaLink="/profile/kyc"
            ctaText="Ajukan KYC"
          />
        )}

        {/* Wallet Section */}
        <div className="rounded-2xl bg-linear-to-br from-(--color-primary) to-(--color-primary-dark) p-6 text-white shadow-sm">
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
              href="/wallet"
              className="rounded-lg bg-white/20 px-4 py-2 text-sm font-medium hover:bg-white/30 transition"
            >
              Kelola Dompet
            </Link>
            <Link
              href="/wallet"
              className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-(--color-primary-dark) hover:bg-gray-100 transition"
            >
              Top Up
            </Link>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <StatCard label="Pesanan Aktif" value={aktifOrders.length} color="text-blue-600" />
          <StatCard label="Pesanan Selesai" value={completedOrders.length} color="text-green-600" />
          <StatCard label="Dibatalkan" value={cancelledOrders.length} color="text-red-600" />
        </div>

        {/* Recent Orders */}
        <section>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-gray-900">Pesanan Terbaru</h2>
            <Link href="/orders" className="text-sm text-(--color-primary) hover:underline">
              Lihat Semua
            </Link>
          </div>

          {ordersLoading ? (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => <SkeletonLoader key={i} variant="row" />)}
            </div>
          ) : orders.length === 0 ? (
            <EmptyState
              title="Belum ada pesanan"
              description="Mulai belanja dari katalog produk"
              action={{ label: 'Mulai Belanja', href: '/catalog' }}
            />
          ) : (
            <div className="space-y-2">
              {orders.map((order) => (
                <Link
                  key={order.order_id}
                  href={`/orders/${order.order_id}`}
                  className="flex items-center gap-4 rounded-xl bg-white p-4 shadow-sm hover:shadow-md transition"
                >
                  <div className="h-12 w-12 shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                    {order.product_snapshot?.image_url ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={order.product_snapshot.image_url}
                        alt={order.product_snapshot.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">
                      {order.product_snapshot?.name ?? 'Produk'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{formatDate(order.created_at)}</p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold text-(--color-primary-dark)">
                      {formatRupiah(order.total_price)}
                    </p>
                    <StatusBadge status={order.status} type="order" />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* Quick Links */}
        <section className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Link
            href="/orders"
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-center"
          >
            <p className="text-sm font-semibold text-gray-900">Pesanan</p>
            <p className="text-xs text-gray-500 mt-1">Lihat riwayat</p>
          </Link>
          <Link
            href="/catalog"
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-center"
          >
            <p className="text-sm font-semibold text-gray-900">Katalog</p>
            <p className="text-xs text-gray-500 mt-1">Cari produk</p>
          </Link>
          <Link
            href="/wallet"
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-center"
          >
            <p className="text-sm font-semibold text-gray-900">Dompet</p>
            <p className="text-xs text-gray-500 mt-1">Top up & mutasi</p>
          </Link>
          <Link
            href="/profile"
            className="rounded-xl bg-white p-4 shadow-sm border border-gray-100 hover:shadow-md transition text-center"
          >
            <p className="text-sm font-semibold text-gray-900">Profil</p>
            <p className="text-xs text-gray-500 mt-1">Pengaturan akun</p>
          </Link>
        </section>
      </main>
    </div>
  );
}
