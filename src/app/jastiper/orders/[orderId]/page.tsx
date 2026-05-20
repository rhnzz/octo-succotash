'use client';

import Link from 'next/link';
import { useRouter, useParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  getOrder,
  getOrderHistory,
  markPurchased,
  markShipped,
  cancelOrder,
  type Order,
  type OrderHistory,
} from '@/services/order.service';
import { isApiError } from '@/services/api-client';
import { Navbar } from '@/components/Navbar';
import { StatusBadge } from '@/components/StatusBadge';
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

export default function JastiperOrderDetailPage() {
  const router = useRouter();
  const params = useParams<{ orderId: string }>();
  const { accessToken, user, isLoading: authLoading } = useAuth();
  const { showToast } = useToast();

  const [order, setOrder] = useState<Order | null>(null);
  const [history, setHistory] = useState<OrderHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Action modals
  const [showPurchasedModal, setShowPurchasedModal] = useState(false);
  const [showShippedModal, setShowShippedModal] = useState(false);
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [courier, setCourier] = useState('');
  const [cancelReason, setCancelReason] = useState('');

  // Auth guard
  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login');
    }
  }, [authLoading, accessToken, router]);

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
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Gagal memuat detail pesanan');
      } else {
        setError('Terjadi kesalahan');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, params.orderId]);

  useEffect(() => {
    if (!authLoading && accessToken) fetchData();
  }, [authLoading, accessToken, fetchData]);

  async function handleMarkPurchased() {
    if (!accessToken || !order) return;
    setActionLoading(true);
    try {
      const updated = await markPurchased(accessToken, order.order_id);
      setOrder((prev) => prev ? { ...prev, ...updated } : null);
      setShowPurchasedModal(false);
      showToast('Pesanan telah ditandai sebagai dibeli', 'success');
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal menandai pesanan', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleMarkShipped() {
    if (!accessToken || !order) return;
    setActionLoading(true);
    try {
      const updated = await markShipped(accessToken, order.order_id, trackingNumber || null, courier || null);
      setOrder((prev) => prev ? { ...prev, ...updated } : null);
      setShowShippedModal(false);
      setTrackingNumber('');
      setCourier('');
      showToast('Pesanan telah ditandai sebagai dikirim', 'success');
      fetchData();
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal menandai pesanan', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  async function handleCancel() {
    if (!accessToken || !order || !cancelReason.trim()) return;
    setActionLoading(true);
    try {
      const updated = await cancelOrder(accessToken, order.order_id, cancelReason);
      setOrder(updated);
      setShowCancelModal(false);
      setCancelReason('');
      showToast('Pesanan berhasil dibatalkan', 'success');
    } catch (err) {
      showToast(isApiError(err) ? err.message : 'Gagal membatalkan pesanan', 'error');
    } finally {
      setActionLoading(false);
    }
  }

  // Derived state
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
        <Link href="/jastiper/orders" className="text-sm text-(--color-primary) hover:underline inline-block">
          &larr; Kembali ke Pesanan Masuk
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

            {/* Buyer Info */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <h2 className="text-sm font-semibold text-gray-900 mb-2">Pembeli</h2>
              <p className="text-sm text-gray-600">
                ID Titipers: {order.titipers_id}
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
                <h2 className="text-sm font-semibold text-gray-900 mb-2">Catatan dari Pembeli</h2>
                <p className="text-sm text-gray-600">{order.note_to_jastiper}</p>
              </div>
            )}

            {/* Tracking Info */}
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

            {/* Action Buttons — Jastiper */}
            <div className="flex flex-wrap gap-3">
              {order.status === 'PAID' && (
                <button
                  onClick={() => setShowPurchasedModal(true)}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Tandai Dibeli
                </button>
              )}

              {order.status === 'PURCHASED' && (
                <button
                  onClick={() => setShowShippedModal(true)}
                  className="rounded-xl bg-blue-600 px-6 py-3 text-sm font-semibold text-white hover:bg-blue-700 transition"
                >
                  Tandai Dikirim
                </button>
              )}

              {['PENDING', 'PAID', 'PURCHASED'].includes(order.status) && (
                <button
                  onClick={() => setShowCancelModal(true)}
                  className="rounded-xl border border-red-200 px-6 py-3 text-sm font-semibold text-red-600 hover:bg-red-50 transition"
                >
                  Batalkan Pesanan
                </button>
              )}
            </div>
          </>
        ) : null}
      </main>

      {/* Confirm Mark Purchased Modal */}
      <ConfirmModal
        isOpen={showPurchasedModal}
        onClose={() => !actionLoading && setShowPurchasedModal(false)}
        onConfirm={handleMarkPurchased}
        title="Tandai Dibeli"
        message="Apakah Anda sudah membeli produk ini? Tandai setelah produk benar-benar dibeli."
        confirmLabel="Ya, Sudah Dibeli"
        isLoading={actionLoading}
      />

      {/* Shipped Modal */}
      <ConfirmModal
        isOpen={showShippedModal}
        onClose={() => { setShowShippedModal(false); setTrackingNumber(''); setCourier(''); }}
        onConfirm={handleMarkShipped}
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

      {/* Cancel Modal */}
      <ConfirmModal
        isOpen={showCancelModal}
        onClose={() => { setShowCancelModal(false); setCancelReason(''); }}
        onConfirm={handleCancel}
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
