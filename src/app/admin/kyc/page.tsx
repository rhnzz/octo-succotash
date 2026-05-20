'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  adminListKyc,
  adminReviewKyc,
  isApiError,
  type AdminKycListItem,
  type KycStatus,
} from '@/services/auth.service';
import { Navbar } from '@/components/Navbar';
import { Sidebar } from '@/components/Sidebar';
import { StatusBadge } from '@/components/StatusBadge';
import { Pagination } from '@/components/Pagination';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { EmptyState } from '@/components/EmptyState';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { useToast } from '@/components/Toast';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const STATUS_TABS: { value: KycStatus | 'ALL'; label: string }[] = [
  { value: 'ALL', label: 'Semua' },
  { value: 'PENDING_VERIFICATION', label: 'Menunggu' },
  { value: 'APPROVED', label: 'Disetujui' },
  { value: 'REJECTED', label: 'Ditolak' },
];

export default function AdminKycPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [items, setItems] = useState<AdminKycListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [statusFilter, setStatusFilter] = useState<KycStatus | 'ALL'>('ALL');
  const [page, setPage] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 20;

  // Review modal state
  const [reviewItem, setReviewItem] = useState<AdminKycListItem | null>(null);
  const [reviewAction, setReviewAction] = useState<'APPROVE' | 'REJECT' | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [reviewSubmitting, setReviewSubmitting] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && (!accessToken || user?.role !== 'ADMIN')) {
      router.replace('/login');
    }
  }, [authLoading, accessToken, user, router]);

  const fetchData = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setError('');
    try {
      const params: { status?: KycStatus; page: number; limit: number } = { page, limit };
      if (statusFilter !== 'ALL') params.status = statusFilter;
      const result = await adminListKyc(accessToken, params);
      setItems(result.data);
      setTotalItems(result.pagination.total);
      setTotalPages(Math.max(1, Math.ceil(result.pagination.total / limit)));
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat data KYC');
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, statusFilter, page]);

  useEffect(() => {
    if (!authLoading && accessToken && user?.role === 'ADMIN') {
      fetchData();
    }
  }, [authLoading, accessToken, user, fetchData]);

  function handleStatusChange(newStatus: KycStatus | 'ALL') {
    setStatusFilter(newStatus);
    setPage(1);
  }

  function openReviewModal(item: AdminKycListItem) {
    setReviewItem(item);
    setReviewAction(null);
    setRejectionReason('');
  }

  function closeReviewModal() {
    setReviewItem(null);
    setReviewAction(null);
    setRejectionReason('');
    setReviewSubmitting(false);
  }

  async function handleReviewConfirm() {
    if (!accessToken || !reviewItem) return;
    if (reviewAction === 'REJECT' && !rejectionReason.trim()) {
      showToast('Alasan penolakan wajib diisi', 'error');
      return;
    }

    setReviewSubmitting(true);
    try {
      const input = reviewAction === 'APPROVE'
        ? { action: 'APPROVE' as const }
        : { action: 'REJECT' as const, 'rejection-reason': rejectionReason.trim() };

      await adminReviewKyc(accessToken, reviewItem.kyc_id, input);

      showToast(
        reviewAction === 'APPROVE'
          ? 'KYC berhasil disetujui'
          : 'KYC ditolak',
        'success'
      );
      closeReviewModal();
      fetchData();
    } catch (err) {
      if (isApiError(err)) {
        showToast(err.message || 'Gagal memproses review', 'error');
      } else {
        showToast('Terjadi kesalahan', 'error');
      }
    } finally {
      setReviewSubmitting(false);
    }
  }

  async function handleQuickApprove(item: AdminKycListItem) {
    if (!accessToken) return;
    setReviewSubmitting(true);
    try {
      await adminReviewKyc(accessToken, item.kyc_id, { action: 'APPROVE' });
      showToast('KYC berhasil disetujui', 'success');
      fetchData();
    } catch (err) {
      if (isApiError(err)) {
        showToast(err.message || 'Gagal menyetujui KYC', 'error');
      } else {
        showToast('Terjadi kesalahan', 'error');
      }
    } finally {
      setReviewSubmitting(false);
    }
  }

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
        <main className="flex-1 p-6">
          <div className="max-w-5xl">
            <h1 className="text-2xl font-bold text-gray-900 mb-6">Antrian KYC</h1>

            {/* Status filter tabs */}
            <div className="mb-4 flex gap-2 overflow-x-auto pb-1" role="tablist" aria-label="Filter status KYC">
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
            ) : items.length === 0 ? (
              <EmptyState
                title="Tidak ada pengajuan KYC"
                description={statusFilter !== 'ALL' ? 'Tidak ada pengajuan dengan status ini' : 'Belum ada pengajuan KYC yang perlu ditinjau'}
              />
            ) : (
              <>
                {/* Table */}
                <div className="overflow-x-auto rounded-xl bg-white shadow-sm">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-gray-100 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        <th className="px-4 py-3">Username</th>
                        <th className="px-4 py-3">Nama KTP</th>
                        <th className="px-4 py-3">Diajukan</th>
                        <th className="px-4 py-3">Status</th>
                        <th className="px-4 py-3 text-right">Aksi</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {items.map((item) => (
                        <tr key={item.kyc_id} className="hover:bg-gray-50 transition">
                          <td className="px-4 py-3 font-medium text-gray-900">
                            {item.username || '-'}
                          </td>
                          <td className="px-4 py-3 text-gray-600">
                            {item.full_name_ktp}
                          </td>
                          <td className="px-4 py-3 text-gray-500 text-xs">
                            {formatDate(item.submitted_at)}
                          </td>
                          <td className="px-4 py-3">
                            <StatusBadge status={item.status} type="kyc" />
                          </td>
                          <td className="px-4 py-3 text-right">
                            <button
                              onClick={() => openReviewModal(item)}
                              className="rounded-lg bg-(--color-primary) px-3 py-1.5 text-xs font-medium text-white hover:bg-(--color-primary-dark) transition"
                            >
                              Review
                            </button>
                            {item.status === 'PENDING_VERIFICATION' && (
                              <button
                                onClick={() => handleQuickApprove(item)}
                                disabled={reviewSubmitting}
                                className="ml-2 rounded-lg border border-green-300 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-50 transition disabled:opacity-50"
                              >
                                Setujui
                              </button>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Pagination */}
                <div className="mt-4">
                  <Pagination
                    currentPage={page}
                    totalPages={totalPages}
                    onPageChange={setPage}
                    totalItems={totalItems}
                    itemsPerPage={limit}
                  />
                </div>
              </>
            )}
          </div>
        </main>
      </div>

      {/* Review Modal */}
      {reviewItem && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="review-modal-title"
          onClick={(e) => { if (e.target === e.currentTarget && !reviewSubmitting) closeReviewModal(); }}
        >
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-xl max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h2 id="review-modal-title" className="text-lg font-semibold text-gray-900">
                Review KYC
              </h2>
              <button
                onClick={closeReviewModal}
                disabled={reviewSubmitting}
                className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                aria-label="Tutup modal"
              >
                <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* KYC Data */}
            <div className="space-y-3 text-sm">
              <div>
                <span className="text-gray-500">Username:</span>
                <span className="ml-2 font-medium text-gray-900">{reviewItem.username || '-'}</span>
              </div>
              <div>
                <span className="text-gray-500">Nama KTP:</span>
                <span className="ml-2 font-medium text-gray-900">{reviewItem.full_name_ktp}</span>
              </div>
              <div>
                <span className="text-gray-500">Diajukan:</span>
                <span className="ml-2 text-gray-700">{formatDate(reviewItem.submitted_at)}</span>
              </div>
              <div>
                <span className="text-gray-500">Status:</span>
                <span className="ml-2">
                  <StatusBadge status={reviewItem.status} type="kyc" />
                </span>
              </div>
            </div>

            {reviewItem.status === 'PENDING_VERIFICATION' && (
              <div className="mt-6">
                {/* Action selector */}
                <div className="flex gap-3 mb-4">
                  <button
                    onClick={() => { setReviewAction('APPROVE'); setRejectionReason(''); }}
                    className={`flex-1 rounded-xl border-2 p-3 text-sm font-medium transition ${
                      reviewAction === 'APPROVE'
                        ? 'border-green-500 bg-green-50 text-green-700'
                        : 'border-gray-200 text-gray-600 hover:border-green-300'
                    }`}
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => setReviewAction('REJECT')}
                    className={`flex-1 rounded-xl border-2 p-3 text-sm font-medium transition ${
                      reviewAction === 'REJECT'
                        ? 'border-red-500 bg-red-50 text-red-700'
                        : 'border-gray-200 text-gray-600 hover:border-red-300'
                    }`}
                  >
                    Tolak
                  </button>
                </div>

                {/* Rejection reason — only when REJECT */}
                {reviewAction === 'REJECT' && (
                  <div className="mb-4">
                    <label htmlFor="rejection-reason" className="mb-1.5 block text-sm font-medium text-gray-700">
                      Alasan Penolakan <span className="text-red-500">*</span>
                    </label>
                    <textarea
                      id="rejection-reason"
                      value={rejectionReason}
                      onChange={(e) => setRejectionReason(e.target.value)}
                      placeholder="Masukkan alasan penolakan..."
                      rows={3}
                      disabled={reviewSubmitting}
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50"
                    />
                  </div>
                )}

                {/* Confirm button */}
                {reviewAction && (
                  <button
                    onClick={handleReviewConfirm}
                    disabled={reviewSubmitting || (reviewAction === 'REJECT' && !rejectionReason.trim())}
                    className={`w-full flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60 disabled:cursor-not-allowed ${
                      reviewAction === 'APPROVE'
                        ? 'bg-green-600 hover:bg-green-700'
                        : 'bg-red-600 hover:bg-red-700'
                    }`}
                  >
                    {reviewSubmitting && (
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    )}
                    {reviewSubmitting
                      ? 'Memproses...'
                      : reviewAction === 'APPROVE'
                        ? 'Konfirmasi Setujui'
                        : 'Konfirmasi Tolak'}
                  </button>
                )}
              </div>
            )}

            {reviewItem.status !== 'PENDING_VERIFICATION' && (
              <p className="mt-4 text-sm text-gray-400 italic">
                Pengajuan ini sudah diproses.
              </p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
