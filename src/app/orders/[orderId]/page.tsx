'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import {
  getOrder,
  getOrderHistory,
  payOrder,
  confirmOrder,
  getJastiperRating,
  getProductRating,
  rateJastiper,
  rateProduct,
  type Order,
  type OrderHistory,
} from '@/services/order.service';
import type { JastiperRating, ProductRating } from '@/lib/api/orders';
import { isApiError } from '@/services/api-client';
import type { WalletResponse } from '@/services/payment.service';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
import { RatingStars } from '@/components/RatingStars';
import { ConfirmModal } from '@/components/ConfirmModal';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { SkeletonLoader } from '@/components/SkeletonLoader';
import { useToast } from '@/components/Toast';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

const TIMELINE_STEPS = ['PENDING', 'PAID', 'PURCHASED', 'SHIPPED', 'COMPLETED'];

export default function OrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { authorizedFetch } = useAuthorizedFetch();
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Wallet pre-check (TASK-419)
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);

  // Pay/Confirm modals
  const [showPayModal, setShowPayModal] = useState(false);
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);

  // Ratings
  const [jastiperRating, setJastiperRating] = useState<JastiperRating | null>(null);
  const [productRating, setProductRating] = useState<ProductRating | null>(null);
  const [ratingLoading, setRatingLoading] = useState(false);
  const [showRateJastiper, setShowRateJastiper] = useState(false);
  const [showRateProduct, setShowRateProduct] = useState(false);
  const [rateJastiperValue, setRateJastiperValue] = useState(5);
  const [rateProductValue, setRateProductValue] = useState(5);
  const [rateJastiperReview, setRateJastiperReview] = useState('');
  const [rateProductReview, setRateProductReview] = useState('');
  const [rateSubmitting, setRateSubmitting] = useState(false);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login');
    }
  }, [authLoading, accessToken, router]);

  const fetchWallet = useCallback(async () => {
    if (!accessToken) return;
    setBalanceLoading(true);
    try {
      const data = await authorizedFetch<WalletResponse>('payment', '/wallets/me');
      setWalletBalance(data.balance);
    } catch {
      setWalletBalance(null);
    } finally {
      setBalanceLoading(false);
    }
  }, [accessToken, authorizedFetch]);

  const fetchData = useCallback(async () => {
    if (!accessToken || !params.orderId) return;
    setLoading(true);
    setError('');
    try {
      const [orderData, historyData] = await Promise.all([
        getOrder(accessToken, params.orderId),
        getOrderHistory(accessToken, params.orderId),
      ]);
      setOrder(orderData);
      setHistory(historyData);

      // Fetch wallet balance for PAY button pre-check (TASK-419)
      fetchWallet();
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat detail pesanan');
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, params.orderId, fetchWallet]);

  useEffect(() => {
    if (!authLoading && accessToken) fetchData();
  }, [authLoading, accessToken, fetchData]);

  // Fetch ratings when order is COMPLETED
  const fetchRatings = useCallback(async () => {
    if (!accessToken || !params.orderId || order?.status !== 'COMPLETED') return;
    setRatingLoading(true);
    try {
      const [jr, pr] = await Promise.allSettled([
        getJastiperRating(accessToken, params.orderId),
        getProductRating(accessToken, params.orderId),
      ]);
      if (jr.status === 'fulfilled') setJastiperRating(jr.value);
      if (pr.status === 'fulfilled') setProductRating(pr.value);
    } finally {
      setRatingLoading(false);
    }
  }, [accessToken, params.orderId, order?.status]);

  useEffect(() => {
    if (order?.status === 'COMPLETED') fetchRatings();
  }, [order?.status, fetchRatings]);

  // Actions
  async function handlePay() {
    if (!accessToken || !order) return;
    setActionLoading(true);
    try {
      const updated = await payOrder(accessToken, order.order_id);
      setOrder(updated);
      setShowPayModal(false);
      showToast('Pembayaran berhasil', 'success');
    } catch (err) {
      if (isApiError(err)) {
        showToast(err.message || 'Gagal memproses pembayaran', 'error');
      } else {
        showToast('Terjadi kesalahan', 'error');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleConfirm() {
    if (!accessToken || !order) return;
    setActionLoading(true);
    try {
      await confirmOrder(accessToken, order.order_id);
      setShowConfirmModal(false);
      showToast('Pesanan dikonfirmasi selesai', 'success');
      fetchData();
    } catch (err) {
      if (isApiError(err)) {
        showToast(err.message || 'Gagal mengkonfirmasi', 'error');
      } else {
        showToast('Terjadi kesalahan', 'error');
      }
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRateJastiper() {
    if (!accessToken || !order) return;
    setRateSubmitting(true);
    try {
      await rateJastiper(accessToken, order.order_id, {
        jastiper_rating: rateJastiperValue,
        jastiper_review: rateJastiperReview || null,
      });
      showToast('Rating jastiper berhasil dikirim', 'success');
      setShowRateJastiper(false);
      fetchRatings();
    } catch (err) {
      if (isApiError(err)) {
        showToast(err.message || 'Gagal mengirim rating', 'error');
      } else {
        showToast('Terjadi kesalahan', 'error');
      }
    } finally {
      setRateSubmitting(false);
    }
  }

  async function handleRateProduct() {
    if (!accessToken || !order) return;
    setRateSubmitting(true);
    try {
      await rateProduct(accessToken, order.order_id, {
        product_rating: rateProductValue,
        product_review: rateProductReview || null,
      });
      showToast('Rating produk berhasil dikirim', 'success');
      setShowRateProduct(false);
      fetchRatings();
    } catch (err) {
      if (isApiError(err)) {
        showToast(err.message || 'Gagal mengirim rating', 'error');
      } else {
        showToast('Terjadi kesalahan', 'error');
      }
    } finally {
      setRateSubmitting(false);
    }
  }

  // Derived state
  const insufficientBalance = walletBalance !== null && order !== null && walletBalance < order.total_price;
  const statusIdx = order ? TIMELINE_STEPS.indexOf(order.status as string) : -1;
  const cancelledStatuses = ['CANCELLED', 'REFUNDING', 'REFUND_FAILED'];

  // Build timeline from history
  const timelineMap = new Map<string, string>();
  history.forEach((h) => {
    if (!timelineMap.has(h.status)) {
      timelineMap.set(h.status, h.timestamp);
    }
  });

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
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        {/* Back link */}
        <Link href="/orders" className="text-sm text-(--color-primary) hover:underline inline-block">
          &larr; Kembali ke Pesanan
        </Link>

        {loading ? (
          <div className="space-y-6">
            <SkeletonLoader variant="text" count={2} />
            <SkeletonLoader variant="card" />
            <SkeletonLoader variant="text" count={4} />
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
        ) : order ? (
          <>
            {/* Header */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h1 className="text-xl font-bold text-gray-900">
                  Pesanan #{order.order_id.slice(0, 8)}
                </h1>
                <p className="text-sm text-gray-500 mt-0.5">{formatDate(order.created_at)}</p>
              </div>
              <StatusBadge status={order.status} type="order" />
            </div>

            {/* REFUNDING banner */}
            {(order.status === 'REFUNDING' || order.status === 'REFUND_FAILED') && (
              <div className={`rounded-xl border px-4 py-3 text-sm ${
                order.status === 'REFUNDING'
                  ? 'border-orange-200 bg-orange-50 text-orange-800'
                  : 'border-red-200 bg-red-50 text-red-800'
              }`}>
                {order.status === 'REFUNDING'
                  ? 'Pesanan sedang dalam proses refund'
                  : 'Refund gagal. Hubungi admin.'}
              </div>
            )}

            {/* Status Timeline */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Status Pesanan</h2>
              <div className="space-y-0">
                {TIMELINE_STEPS.map((step, idx) => {
                  const isActive = idx <= statusIdx;
                  const isCurrent = idx === statusIdx;
                  const timestamp = timelineMap.get(step);
                  return (
                    <div key={step} className="flex gap-3">
                      <div className="flex flex-col items-center">
                        <div className={`h-3 w-3 rounded-full ${
                          isActive ? 'bg-(--color-primary)' : 'bg-gray-200'
                        } ${isCurrent ? 'ring-2 ring-(--color-primary)/30' : ''}`} />
                        {idx < TIMELINE_STEPS.length - 1 && (
                          <div className={`w-0.5 h-8 ${isActive ? 'bg-(--color-primary)' : 'bg-gray-200'}`} />
                        )}
                      </div>
                      <div className="pb-6">
                        <p className={`text-sm font-medium ${isActive ? 'text-gray-900' : 'text-gray-400'}`}>
                          {step === 'PENDING' && 'Menunggu Pembayaran'}
                          {step === 'PAID' && 'Dibayar'}
                          {step === 'PURCHASED' && 'Dibeli Jastiper'}
                          {step === 'SHIPPED' && 'Dikirim'}
                          {step === 'COMPLETED' && 'Selesai'}
                        </p>
                        {timestamp && (
                          <p className="text-xs text-gray-400 mt-0.5">{formatDate(timestamp)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}

                {/* Cancellation step */}
                {cancelledStatuses.includes(order.status) && (
                  <div className="flex gap-3">
                    <div className="flex flex-col items-center">
                      <div className="h-3 w-3 rounded-full bg-red-500" />
                    </div>
                    <div className="pb-2">
                      <p className="text-sm font-medium text-red-600">
                        {order.status === 'CANCELLED' ? 'Dibatalkan' : order.status}
                      </p>
                      {order.cancellation_reason && (
                        <p className="text-xs text-gray-500 mt-0.5">
                          Alasan: {order.cancellation_reason}
                        </p>
                      )}
                      {order.cancelled_by && (
                        <p className="text-xs text-gray-400">
                          Oleh: {order.cancelled_by}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Product Snapshot */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-4">Detail Produk</h2>
              <div className="flex gap-4">
                <div className="h-20 w-20 shrink-0 rounded-lg bg-gray-100 overflow-hidden">
                  {order.product_snapshot?.image_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={order.product_snapshot.image_url}
                      alt={order.product_snapshot.name}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="flex h-full w-full items-center justify-center text-gray-300">
                      <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                      </svg>
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-gray-900">
                    {order.product_snapshot?.name ?? 'Produk'}
                  </p>
                  <p className="text-xs text-gray-500 mt-1">
                    {order.quantity} x {formatRupiah(order.unit_price)}
                  </p>
                  <div className="mt-2 space-y-0.5 text-sm">
                    <p className="text-gray-600">
                      Biaya Jasa: {formatRupiah(order.service_fee)}
                    </p>
                    <p className="font-bold text-(--color-primary-dark)">
                      Total: {formatRupiah(order.total_price)}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Jastiper Info */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Jastiper</h2>
              <p className="text-sm text-gray-600">
                ID Jastiper: {order.jastiper_id}
              </p>
            </div>

            {/* Shipping Address */}
            {order.shipping_address && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Alamat Pengiriman</h2>
                <div className="space-y-1 text-sm text-gray-600">
                  <p><span className="text-gray-400">Nama:</span> {order.shipping_address.recipient_name}</p>
                  <p><span className="text-gray-400">Telepon:</span> {order.shipping_address.phone_number}</p>
                  <p>{order.shipping_address.street}</p>
                  <p>{order.shipping_address.kelurahan}, {order.shipping_address.kecamatan}</p>
                  <p>{order.shipping_address.city}, {order.shipping_address.province} {order.shipping_address.postal_code}</p>
                  {order.shipping_address.notes && (
                    <p className="text-gray-400 italic">Catatan: {order.shipping_address.notes}</p>
                  )}
                </div>
              </div>
            )}

            {/* Note to Jastiper */}
            {order.note_to_jastiper && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Catatan untuk Jastiper</h2>
                <p className="text-sm text-gray-600">{order.note_to_jastiper}</p>
              </div>
            )}

            {/* Tracking Info — shown when SHIPPED or later */}
            {(order.tracking_number || order.courier) && (
              <div className="rounded-2xl bg-white p-6 shadow-sm">
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Informasi Pengiriman</h2>
                <div className="space-y-1 text-sm text-gray-600">
                  {order.courier && <p>Kurir: {order.courier}</p>}
                  {order.tracking_number && <p>No. Resi: {order.tracking_number}</p>}
                </div>
              </div>
            )}

            {/* Cancellation Info */}
            {order.status === 'CANCELLED' && (
              <div className="rounded-2xl bg-white p-6 shadow-sm border border-red-100">
                <h2 className="text-sm font-semibold text-red-700 mb-2">Informasi Pembatalan</h2>
                <div className="space-y-1 text-sm text-gray-600">
                  {order.cancellation_reason && (
                    <p>Alasan: {order.cancellation_reason}</p>
                  )}
                  {order.cancelled_by && (
                    <p>Dibatalkan oleh: {order.cancelled_by}</p>
                  )}
                </div>
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex flex-wrap gap-3">
              {/* Pay button — PENDING status */}
              {order.status === 'PENDING' && (
                <>
                  <button
                    onClick={() => {
                      fetchWallet();
                      setShowPayModal(true);
                    }}
                    disabled={insufficientBalance}
                    className={`flex items-center gap-2 rounded-xl px-6 py-3 text-sm font-semibold text-white transition ${
                      insufficientBalance
                        ? 'bg-gray-300 cursor-not-allowed'
                        : 'bg-(--color-primary) hover:bg-(--color-primary-dark)'
                    }`}
                  >
                    Bayar Sekarang
                  </button>
                  {insufficientBalance && (
                    <p className="w-full text-xs text-red-600">
                      Saldo tidak mencukupi ({walletBalance !== null ? formatRupiah(walletBalance) : '-'}).
                      Silakan <Link href="/wallet" className="underline">top up</Link> terlebih dahulu.
                    </p>
                  )}
                  {balanceLoading && (
                    <p className="text-xs text-gray-400 flex items-center gap-1">
                      <span className="h-3 w-3 animate-spin rounded-full border border-gray-400 border-t-transparent" />
                      Memeriksa saldo...
                    </p>
                  )}
                </>
              )}

              {/* Confirm button — SHIPPED status */}
              {order.status === 'SHIPPED' && (
                <button
                  onClick={() => setShowConfirmModal(true)}
                  className="rounded-xl bg-green-600 px-6 py-3 text-sm font-semibold text-white hover:bg-green-700 transition"
                >
                  Konfirmasi Penerimaan
                </button>
              )}

              {/* Rating buttons — COMPLETED status */}
              {order.status === 'COMPLETED' && (
                <div className="w-full space-y-3">
                  <div className="flex flex-wrap gap-3">
                    {!jastiperRating && !ratingLoading && (
                      <button
                        onClick={() => setShowRateJastiper(true)}
                        className="rounded-xl bg-(--color-primary) px-6 py-3 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
                      >
                        Beri Rating Jastiper
                      </button>
                    )}
                    {!productRating && !ratingLoading && (
                      <button
                        onClick={() => setShowRateProduct(true)}
                        className="rounded-xl border border-(--color-primary) px-6 py-3 text-sm font-semibold text-(--color-primary) hover:bg-(--color-primary)/5 transition"
                      >
                        Beri Rating Produk
                      </button>
                    )}
                  </div>

                  {/* Submitted ratings */}
                  {ratingLoading && <LoadingSpinner size="sm" />}
                  {jastiperRating && (
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Rating Jastiper</p>
                      <RatingStars rating={jastiperRating.jastiper_rating} />
                      {jastiperRating.jastiper_review && (
                        <p className="text-sm text-gray-600 mt-1">{jastiperRating.jastiper_review}</p>
                      )}
                    </div>
                  )}
                  {productRating && (
                    <div className="rounded-xl bg-gray-50 p-4">
                      <p className="text-xs font-medium text-gray-500 mb-1">Rating Produk</p>
                      <RatingStars rating={productRating.product_rating} />
                      {productRating.product_review && (
                        <p className="text-sm text-gray-600 mt-1">{productRating.product_review}</p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          </>
        ) : null}
      </main>

      {/* Pay Confirmation Modal */}
      <ConfirmModal
        isOpen={showPayModal}
        onClose={() => !actionLoading && setShowPayModal(false)}
        onConfirm={handlePay}
        title="Konfirmasi Pembayaran"
        message={`Anda akan membayar ${formatRupiah(order?.total_price ?? 0)} dari saldo dompet Anda.`}
        confirmLabel="Bayar Sekarang"
        isLoading={actionLoading}
      >
        <div className="rounded-lg bg-gray-50 p-3 text-sm space-y-1">
          <div className="flex justify-between">
            <span className="text-gray-600">Total Pesanan</span>
            <span className="font-semibold">{order ? formatRupiah(order.total_price) : '-'}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Saldo Dompet</span>
            <span className={insufficientBalance ? 'text-red-600 font-semibold' : 'font-semibold'}>
              {walletBalance !== null ? formatRupiah(walletBalance) : '-'}
            </span>
          </div>
          {insufficientBalance && (
            <p className="text-xs text-red-600 mt-1">
              Saldo tidak mencukupi untuk pembayaran ini.
            </p>
          )}
        </div>
      </ConfirmModal>

      {/* Confirm Receipt Modal */}
      <ConfirmModal
        isOpen={showConfirmModal}
        onClose={() => !actionLoading && setShowConfirmModal(false)}
        onConfirm={handleConfirm}
        title="Konfirmasi Penerimaan"
        message="Apakah Anda yakin barang sudah diterima dengan baik? Tindakan ini tidak dapat dibatalkan."
        confirmLabel="Ya, Konfirmasi"
        isLoading={actionLoading}
      />

      {/* Rate Jastiper Modal */}
      {showRateJastiper && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rate-jastiper-title"
          onClick={(e) => { if (e.target === e.currentTarget && !rateSubmitting) setShowRateJastiper(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="rate-jastiper-title" className="text-lg font-semibold text-gray-900 mb-4">
              Rating Jastiper
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Nilai Pelayanan</p>
                <RatingStars
                  rating={rateJastiperValue}
                  interactive
                  onRate={setRateJastiperValue}
                  size="lg"
                />
              </div>
              <div>
                <label htmlFor="rate-jastiper-review" className="block text-sm font-medium text-gray-700 mb-1">
                  Ulasan (opsional)
                </label>
                <textarea
                  id="rate-jastiper-review"
                  value={rateJastiperReview}
                  onChange={(e) => setRateJastiperReview(e.target.value)}
                  placeholder="Bagaimana pelayanan jastiper?"
                  rows={3}
                  maxLength={1000}
                  disabled={rateSubmitting}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-400 mt-1">{rateJastiperReview.length}/1000</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowRateJastiper(false)}
                disabled={rateSubmitting}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
              >
                Batal
              </button>
              <button
                onClick={handleRateJastiper}
                disabled={rateSubmitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) disabled:opacity-60 transition"
              >
                {rateSubmitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {rateSubmitting ? 'Mengirim...' : 'Kirim Rating'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Rate Product Modal */}
      {showRateProduct && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="rate-product-title"
          onClick={(e) => { if (e.target === e.currentTarget && !rateSubmitting) setShowRateProduct(false); }}
        >
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <h2 id="rate-product-title" className="text-lg font-semibold text-gray-900 mb-4">
              Rating Produk
            </h2>
            <div className="space-y-4">
              <div>
                <p className="text-sm font-medium text-gray-700 mb-2">Nilai Produk</p>
                <RatingStars
                  rating={rateProductValue}
                  interactive
                  onRate={setRateProductValue}
                  size="lg"
                />
              </div>
              <div>
                <label htmlFor="rate-product-review" className="block text-sm font-medium text-gray-700 mb-1">
                  Ulasan (opsional)
                </label>
                <textarea
                  id="rate-product-review"
                  value={rateProductReview}
                  onChange={(e) => setRateProductReview(e.target.value)}
                  placeholder="Bagaimana kualitas produk?"
                  rows={3}
                  maxLength={1000}
                  disabled={rateSubmitting}
                  className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50"
                />
                <p className="text-xs text-gray-400 mt-1">{rateProductReview.length}/1000</p>
              </div>
            </div>
            <div className="mt-6 flex gap-3">
              <button
                onClick={() => setShowRateProduct(false)}
                disabled={rateSubmitting}
                className="flex-1 rounded-xl border border-gray-300 px-4 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60 transition"
              >
                Batal
              </button>
              <button
                onClick={handleRateProduct}
                disabled={rateSubmitting}
                className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) disabled:opacity-60 transition"
              >
                {rateSubmitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {rateSubmitting ? 'Mengirim...' : 'Kirim Rating'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
