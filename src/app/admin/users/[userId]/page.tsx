'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  adminGetUser,
  isApiError,
  type AdminUserDetailResponse,
  type KycStatus,
} from '@/services/auth.service';
import { getAdminWallet, type AdminWalletResponse } from '@/services/payment.service';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { StatusBadge } from '@/components/StatusBadge';
import { KYCStatusBanner } from '@/components/KYCStatusBanner';
import { RatingStars } from '@/components/RatingStars';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SkeletonLoader } from '@/components/SkeletonLoader';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric',
  });
}

function formatDateShort(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const ROLE_LABEL: Record<string, string> = {
  TITIPERS: 'Pembeli',
  JASTIPER: 'Jastiper',
  ADMIN: 'Admin',
};

const ROLE_CLS: Record<string, string> = {
  TITIPERS: 'bg-blue-100 text-blue-700',
  JASTIPER: 'bg-purple-100 text-purple-700',
  ADMIN: 'bg-orange-100 text-orange-700',
};

export default function AdminUserDetailPage() {
  const router = useRouter();
  const params = useParams<{ userId: string }>();
  const { accessToken, user, isLoading: authLoading } = useAuth();

  const [userDetail, setUserDetail] = useState<AdminUserDetailResponse | null>(null);
  const [wallet, setWallet] = useState<AdminWalletResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [walletLoading, setWalletLoading] = useState(false);
  const [error, setError] = useState('');

  // Auth guard
  useEffect(() => {
    if (!authLoading && (!accessToken || user?.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [authLoading, accessToken, user, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken || !params.userId) return;
    setLoading(true);
    setError('');
    try {
      const data = await adminGetUser(accessToken, params.userId);
      setUserDetail(data);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat data pengguna');
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, params.userId]);

  const fetchWallet = useCallback(async () => {
    if (!accessToken || !params.userId) return;
    setWalletLoading(true);
    try {
      const data = await getAdminWallet(accessToken, params.userId);
      setWallet(data);
    } catch {
      // Wallet may not exist yet — that's fine
    } finally {
      setWalletLoading(false);
    }
  }, [accessToken, params.userId]);

  useEffect(() => {
    if (!authLoading && accessToken && user?.role === 'ADMIN') {
      fetchData();
      fetchWallet();
    }
  }, [authLoading, accessToken, user, fetchData, fetchWallet]);

  if (authLoading || !accessToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  if (!user || user.role !== 'ADMIN') return null;

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <div className="flex">
        <Sidebar role="ADMIN" />
        <main className="flex-1 p-6 max-w-4xl">
          {/* Header */}
          <div className="mb-6">
            <Link href="/admin/users" className="text-sm text-(--color-primary) hover:underline">
              &larr; Kembali ke Manajemen Pengguna
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 mt-1">Detail Pengguna</h1>
          </div>

          {loading ? (
            <div className="space-y-6">
              <SkeletonLoader variant="card" />
              <SkeletonLoader variant="text" count={3} />
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
          ) : userDetail ? (
            <>
              {/* Profile Card */}
              <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
                <div className="flex items-start gap-4">
                  <div className="h-16 w-16 shrink-0 rounded-full bg-(--color-primary) flex items-center justify-center text-white text-xl font-bold">
                    {(userDetail.full_name || userDetail.username || '?').charAt(0).toUpperCase()}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h2 className="text-lg font-semibold text-gray-900">
                      {userDetail.full_name || userDetail.username || 'Tanpa Nama'}
                    </h2>
                    <p className="text-sm text-gray-500">{userDetail.email}</p>
                    <div className="flex flex-wrap gap-2 mt-2">
                      <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${ROLE_CLS[userDetail.role] ?? 'bg-gray-100 text-gray-700'}`}>
                        {ROLE_LABEL[userDetail.role] ?? userDetail.role}
                      </span>
                      <StatusBadge status={userDetail.status} type="user" />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      Bergabung {formatDate(userDetail.created_at)}
                    </p>
                  </div>
                </div>
                {userDetail.phone_number && (
                  <p className="mt-3 text-sm text-gray-600">
                    Telepon: {userDetail.phone_number}
                  </p>
                )}
              </div>

              {/* KYC Section */}
              <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Verifikasi KYC</h3>
                {userDetail.kyc_status ? (
                  <div>
                    <KYCStatusBanner
                      status={userDetail.kyc_status as KycStatus}
                      rejectionReason={userDetail.kyc_rejection_reason ?? undefined}
                      ctaLink="/admin/kyc"
                      ctaText="Lihat Antrian KYC"
                    />
                    <div className="mt-3 space-y-1 text-sm text-gray-600">
                      {userDetail.kyc_submitted_at && (
                        <p>Diajukan: {formatDateShort(userDetail.kyc_submitted_at)}</p>
                      )}
                      {userDetail.kyc_reviewed_at && (
                        <p>Direview: {formatDateShort(userDetail.kyc_reviewed_at)}</p>
                      )}
                    </div>
                  </div>
                ) : (
                  <p className="text-sm text-gray-400">Belum ada pengajuan KYC</p>
                )}
              </div>

              {/* Stats Section */}
              {userDetail.stats && (
                <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
                  <h3 className="text-base font-semibold text-gray-900 mb-4">Statistik</h3>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Total Pesanan</p>
                      <p className="text-xl font-bold text-gray-900">{userDetail.stats.totalOrders ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Pesanan Selesai</p>
                      <p className="text-xl font-bold text-gray-900">{userDetail.stats.completedOrders ?? 0}</p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Tingkat Keberhasilan</p>
                      <p className="text-xl font-bold text-gray-900">
                        {userDetail.stats.successRate != null
                          ? `${(userDetail.stats.successRate * 100).toFixed(0)}%`
                          : '-'}
                      </p>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Rating Rata-rata</p>
                      <div className="mt-1">
                        {userDetail.stats.avgRating != null && userDetail.stats.avgRating > 0 ? (
                          <RatingStars rating={userDetail.stats.avgRating} />
                        ) : (
                          <p className="text-xl font-bold text-gray-900">-</p>
                        )}
                      </div>
                    </div>
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs text-gray-500">Total Ulasan</p>
                      <p className="text-xl font-bold text-gray-900">{userDetail.stats.totalReviews ?? 0}</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Wallet Section */}
              <div className="rounded-2xl bg-white p-6 shadow-sm mb-6">
                <h3 className="text-base font-semibold text-gray-900 mb-3">Dompet</h3>
                {walletLoading ? (
                  <SkeletonLoader variant="text" count={2} />
                ) : wallet ? (
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Saldo Aktif</span>
                      <span className="font-semibold text-gray-900">{formatRupiah(wallet.balance)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Dalam Escrow</span>
                      <span className="font-semibold text-gray-900">{formatRupiah(wallet.escrow_balance)}</span>
                    </div>
                    <div className="flex justify-between py-2 border-b border-gray-100">
                      <span className="text-gray-600">Total Top-Up</span>
                      <span className="font-semibold text-green-600">{formatRupiah(wallet.total_topup_lifetime)}</span>
                    </div>
                    <div className="flex justify-between py-2">
                      <span className="text-gray-600">Total Penarikan</span>
                      <span className="font-semibold text-red-500">{formatRupiah(wallet.total_withdrawal_lifetime)}</span>
                    </div>
                  </div>
                ) : (
                  <div>
                    <p className="text-sm text-gray-400 mb-3">Dompet belum tersedia</p>
                    <button
                      onClick={fetchWallet}
                      className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark) transition"
                    >
                      Muat Dompet
                    </button>
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-wrap gap-3">
                <Link
                  href={`/admin/orders?userId=${params.userId}`}
                  className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm font-medium text-white hover:bg-(--color-primary-dark) transition"
                >
                  Lihat Pesanan
                </Link>
                <Link
                  href={`/admin/wallet/transactions?user_id=${params.userId}`}
                  className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
                >
                  Lihat Transaksi
                </Link>
              </div>
            </>
          ) : null}
        </main>
      </div>
    </div>
  );
}
