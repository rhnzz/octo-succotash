'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import { isApiError } from '@/services/api-client';
import {
  getAdminTopUps,
  getAdminWithdrawals,
  processAdminTopUp,
  processAdminWithdrawal,
  type TopUpSummary,
  type WithdrawalSummary,
} from '@/services/payment.service';
import { ConfirmModal } from '@/components/ConfirmModal';
import { StatusBadge } from '@/components/StatusBadge';
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

export default function AdminWalletRequestsPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [activeTab, setActiveTab] = useState<'topup' | 'withdrawal'>('topup');
  const [topUps, setTopUps] = useState<TopUpSummary[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Review modal
  const [reviewModal, setReviewModal] = useState<{
    type: 'topup' | 'withdrawal';
    transactionId: string;
    amount: number;
  } | null>(null);
  const [rejectModal, setRejectModal] = useState<{
    type: 'topup' | 'withdrawal';
    transactionId: string;
  } | null>(null);
  const [rejectionReason, setRejectionReason] = useState('');
  const [actionLoading, setActionLoading] = useState(false);

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
      const [topUpData, withdrawalData] = await Promise.all([
        getAdminTopUps(accessToken, { status: 'PENDING' }),
        getAdminWithdrawals(accessToken, { status: 'PENDING' }),
      ]);
      setTopUps(topUpData);
      setWithdrawals(withdrawalData);
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat data');
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!authLoading && accessToken && user?.role === 'ADMIN') {
      fetchData();
    }
  }, [authLoading, accessToken, user, fetchData]);

  async function handleApprove() {
    if (!accessToken || !reviewModal) return;
    setActionLoading(true);
    try {
      if (reviewModal.type === 'topup') {
        await processAdminTopUp(accessToken, reviewModal.transactionId, { action: 'APPROVE' });
      } else {
        await processAdminWithdrawal(accessToken, reviewModal.transactionId, { action: 'APPROVE' });
      }
      showToast('Permintaan berhasil disetujui', 'success');
      setReviewModal(null);
      fetchData();
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal memproses permintaan', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleReject() {
    if (!accessToken || !rejectModal || !rejectionReason.trim()) return;
    setActionLoading(true);
    try {
      if (rejectModal.type === 'topup') {
        await processAdminTopUp(accessToken, rejectModal.transactionId, {
          action: 'REJECT',
          rejection_reason: rejectionReason,
        });
      } else {
        await processAdminWithdrawal(accessToken, rejectModal.transactionId, {
          action: 'REJECT',
          rejection_reason: rejectionReason,
        });
      }
      showToast('Permintaan ditolak', 'success');
      setRejectModal(null);
      setRejectionReason('');
      fetchData();
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal memproses permintaan', 'error');
    } finally {
      setActionLoading(false);
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

  const currentList = activeTab === 'topup' ? topUps : withdrawals;

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNavbar currentPath="/admin/wallet/requests" />
      <WalletSubNav current="requests" />

      <main className="mx-auto max-w-4xl px-4 py-8 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Permintaan Top-Up & Penarikan</h1>
            <p className="mt-1 text-sm text-gray-500">Tinjau dan proses permintaan yang menunggu persetujuan</p>
          </div>
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

        {/* Tab buttons */}
        <div className="flex gap-2" role="tablist">
          <button
            role="tab"
            aria-selected={activeTab === 'topup'}
            onClick={() => setActiveTab('topup')}
            className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
              activeTab === 'topup'
                ? 'bg-(--color-primary) text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-(--color-primary) hover:text-(--color-primary)'
            }`}
          >
            Top-Up ({topUps.length})
          </button>
          <button
            role="tab"
            aria-selected={activeTab === 'withdrawal'}
            onClick={() => setActiveTab('withdrawal')}
            className={`rounded-xl px-5 py-2 text-sm font-medium transition ${
              activeTab === 'withdrawal'
                ? 'bg-(--color-primary) text-white'
                : 'bg-white border border-gray-200 text-gray-600 hover:border-(--color-primary) hover:text-(--color-primary)'
            }`}
          >
            Penarikan ({withdrawals.length})
          </button>
        </div>

        {/* Error */}
        {error && (
          <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700 flex items-center justify-between">
            <span>{error}</span>
            <button onClick={fetchData} className="ml-4 shrink-0 rounded-lg border border-red-300 px-3 py-1 text-xs font-medium text-red-700 hover:bg-red-100 transition">Coba lagi</button>
          </div>
        )}

        {/* Content */}
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="rounded-xl bg-white p-5 shadow-sm animate-pulse space-y-3">
                <div className="h-5 w-40 bg-gray-100 rounded" />
                <div className="h-4 w-60 bg-gray-100 rounded" />
              </div>
            ))}
          </div>
        ) : currentList.length === 0 ? (
          <div className="rounded-xl bg-white p-8 text-center shadow-sm">
            <p className="text-sm text-gray-500">Tidak ada permintaan {activeTab === 'topup' ? 'top-up' : 'penarikan'} yang menunggu.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {currentList.map((item) => (
              <div key={item.transaction_id} className="rounded-xl bg-white p-5 shadow-sm flex flex-wrap items-center justify-between gap-4">
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-gray-900">
                    {formatRupiah(item.amount)}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">
                    {formatDate(item.created_at)} &middot; ID: {item.transaction_id.slice(0, 8)}
                  </p>
                </div>
                <StatusBadge status={item.status} type="transaction" />
                <div className="flex gap-2 shrink-0">
                  <button
                    onClick={() => setReviewModal({
                      type: activeTab,
                      transactionId: item.transaction_id,
                      amount: item.amount,
                    })}
                    className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition"
                  >
                    Setujui
                  </button>
                  <button
                    onClick={() => setRejectModal({
                      type: activeTab,
                      transactionId: item.transaction_id,
                    })}
                    className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
                  >
                    Tolak
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Approve Modal */}
      <ConfirmModal
        isOpen={!!reviewModal}
        onClose={() => !actionLoading && setReviewModal(null)}
        onConfirm={handleApprove}
        title="Setujui Permintaan"
        message={`Anda akan menyetujui ${activeTab === 'topup' ? 'top-up' : 'penarikan'} sebesar ${reviewModal ? formatRupiah(reviewModal.amount) : ''}.`}
        confirmLabel="Setujui"
        isLoading={actionLoading}
      />

      {/* Reject Modal */}
      <ConfirmModal
        isOpen={!!rejectModal}
        onClose={() => { setRejectModal(null); setRejectionReason(''); }}
        onConfirm={handleReject}
        title="Tolak Permintaan"
        message="Berikan alasan penolakan untuk permintaan ini."
        confirmLabel="Tolak"
        isLoading={actionLoading}
      >
        <div>
          <label htmlFor="rejection-reason" className="block text-sm font-medium text-gray-700 mb-1">
            Alasan Penolakan <span className="text-red-500">*</span>
          </label>
          <textarea
            id="rejection-reason"
            value={rejectionReason}
            onChange={(e) => setRejectionReason(e.target.value)}
            placeholder="Jelaskan alasan penolakan"
            rows={3}
            maxLength={500}
            className="w-full rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:border-transparent resize-none"
          />
          <p className="text-xs text-gray-400 mt-1">{rejectionReason.length}/500</p>
        </div>
      </ConfirmModal>
    </div>
  );
}
