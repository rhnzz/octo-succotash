'use client';

/**
 * TASK-317: /checkout/[productId] — Order form page
 *
 * Only accessible to authenticated TITIPERS.
 * Redirects to /login if unauthenticated.
 * Redirects to /catalog if user is JASTIPER or ADMIN.
 *
 * Features:
 * - Product summary (name, price, serviceFee, stock)
 * - Quantity selector (1 to min(product.stock, 10))
 * - Full shipping address form
 * - Note to jastiper (optional, max 500 chars)
 * - Order summary sidebar with wallet balance check
 * - Submit calls createOrder, redirects to /orders/[orderId] on success
 */

import { getProduct, isApiError } from '@/services/inventory.service';
import type { ProductResponse } from '@/services/inventory.service';
import { getWallet } from '@/services/payment.service';
import { createOrder } from '@/services/order.service';
import { useAuth } from '@/lib/auth/AuthProvider';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { useEffect, useState } from 'react';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// Shipping address form state shape
// ---------------------------------------------------------------------------

type ShippingForm = {
  recipient_name: string;
  phone_number: string;
  street: string;
  kelurahan: string;
  kecamatan: string;
  city: string;
  province: string;
  postal_code: string;
  notes: string;
};

const EMPTY_SHIPPING: ShippingForm = {
  recipient_name: '',
  phone_number: '',
  street: '',
  kelurahan: '',
  kecamatan: '',
  city: '',
  province: '',
  postal_code: '',
  notes: '',
};

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function PageSkeleton() {
  return (
    <div className="animate-pulse mx-auto max-w-5xl px-4 py-8">
      <div className="h-6 w-48 rounded bg-gray-200 mb-6" />
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 space-y-4">
          <div className="h-40 rounded-xl bg-gray-200" />
          <div className="h-64 rounded-xl bg-gray-200" />
          <div className="h-48 rounded-xl bg-gray-200" />
        </div>
        <div className="w-full lg:w-80 space-y-4">
          <div className="h-48 rounded-xl bg-gray-200" />
          <div className="h-12 rounded-xl bg-gray-200" />
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Field component
// ---------------------------------------------------------------------------

function Field({
  label,
  required,
  children,
  hint,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
  hint?: string;
}) {
  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-gray-700">
        {label}
        {required && <span className="ml-0.5 text-red-500">*</span>}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-gray-500">{hint}</p>}
    </div>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-(--color-primary) focus:outline-none focus:ring-1 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:text-gray-500';

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.productId as string;

  const { accessToken, user, isLoading: authLoading } = useAuth();

  // Data state
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [dataLoading, setDataLoading] = useState(true);
  const [dataError, setDataError] = useState<string | null>(null);

  // Form state
  const [quantity, setQuantity] = useState(1);
  const [shipping, setShipping] = useState<ShippingForm>(EMPTY_SHIPPING);
  const [noteToJastiper, setNoteToJastiper] = useState('');

  // Submit state
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  // ---------------------------------------------------------------------------
  // Auth guard — redirect after auth resolves
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;

    if (!accessToken) {
      router.replace(`/login?redirect=/checkout/${productId}`);
      return;
    }

    if (user?.role === 'JASTIPER' || user?.role === 'ADMIN') {
      router.replace('/catalog');
    }
  }, [authLoading, accessToken, user, router, productId]);

  // ---------------------------------------------------------------------------
  // Fetch product + wallet
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authLoading) return;
    if (!accessToken) return;
    if (user?.role === 'JASTIPER' || user?.role === 'ADMIN') return;

    setDataLoading(true);
    setDataError(null);

    Promise.all([
      getProduct(productId),
      getWallet(accessToken),
    ])
      .then(([prod, wallet]) => {
        setProduct(prod);
        setWalletBalance(wallet.balance);
      })
      .catch((err) => {
        if (isApiError(err) && err.status === 404) {
          setDataError('Produk tidak ditemukan.');
        } else {
          setDataError('Gagal memuat data. Silakan coba lagi.');
        }
      })
      .finally(() => setDataLoading(false));
  }, [authLoading, accessToken, user, productId]);

  // ---------------------------------------------------------------------------
  // Derived values
  // ---------------------------------------------------------------------------
  const maxQty = product ? Math.min(product.stock, 10) : 1;
  const unitPrice = product?.price ?? 0;
  const serviceFee = product?.serviceFee ?? 0;
  const total = unitPrice * quantity + serviceFee;
  const balanceInsufficient = walletBalance !== null && walletBalance < total;

  // ---------------------------------------------------------------------------
  // Shipping field change handler
  // ---------------------------------------------------------------------------
  function handleShippingChange(field: keyof ShippingForm, value: string) {
    setShipping((prev) => ({ ...prev, [field]: value }));
  }

  // ---------------------------------------------------------------------------
  // Validation
  // ---------------------------------------------------------------------------
  function validate(): string | null {
    const s = shipping;
    if (!s.recipient_name.trim()) return 'Nama penerima wajib diisi.';
    if (!s.phone_number.trim()) return 'Nomor telepon wajib diisi.';
    if (!s.street.trim()) return 'Alamat jalan wajib diisi.';
    if (!s.kelurahan.trim()) return 'Kelurahan wajib diisi.';
    if (!s.kecamatan.trim()) return 'Kecamatan wajib diisi.';
    if (!s.city.trim()) return 'Kota wajib diisi.';
    if (!s.province.trim()) return 'Provinsi wajib diisi.';
    if (!/^\d{5}$/.test(s.postal_code)) return 'Kode pos harus tepat 5 digit angka.';
    if (noteToJastiper.length > 500) return 'Catatan untuk jastiper maksimal 500 karakter.';
    return null;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitError(null);

    const validationError = validate();
    if (validationError) {
      setSubmitError(validationError);
      return;
    }

    if (!accessToken || !product) return;

    setSubmitting(true);
    try {
      const order = await createOrder(accessToken, {
        product_id: product.productId,
        quantity,
        shipping_address: {
          recipient_name: shipping.recipient_name.trim(),
          phone_number: shipping.phone_number.trim(),
          street: shipping.street.trim(),
          kelurahan: shipping.kelurahan.trim(),
          kecamatan: shipping.kecamatan.trim(),
          city: shipping.city.trim(),
          province: shipping.province.trim(),
          postal_code: shipping.postal_code.trim(),
          notes: shipping.notes.trim() || null,
        },
        note_to_jastiper: noteToJastiper.trim() || null,
      });

      router.push(`/orders/${order.order_id}`);
    } catch (err) {
      if (isApiError(err)) {
        setSubmitError(err.message || 'Gagal membuat pesanan. Silakan coba lagi.');
      } else {
        setSubmitError('Terjadi kesalahan. Silakan coba lagi.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render — loading
  // ---------------------------------------------------------------------------
  if (authLoading || dataLoading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          </div>
        </header>
        <PageSkeleton />
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — error
  // ---------------------------------------------------------------------------
  if (dataError || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
          <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <svg className="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-bold text-gray-800 mb-2">
            {dataError ?? 'Produk tidak ditemukan'}
          </h1>
          <Link
            href="/catalog"
            className="mt-4 rounded-xl bg-(--color-primary) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
          >
            Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  // ---------------------------------------------------------------------------
  // Render — main
  // ---------------------------------------------------------------------------
  const firstImage = product.images[0] ?? null;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          <nav className="flex items-center gap-3">
            <Link href="/catalog" className="text-sm text-white/80 hover:text-white">Katalog</Link>
            <span className="text-sm text-white/80">{user?.username ?? user?.email}</span>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Back link */}
        <Link
          href={`/catalog/${productId}`}
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-(--color-primary) hover:text-(--color-primary-dark) transition"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Kembali ke detail produk
        </Link>

        <h1 className="mb-8 text-2xl font-bold text-gray-900">Checkout</h1>

        <form onSubmit={handleSubmit} noValidate>
          <div className="flex flex-col lg:flex-row gap-8">
            {/* ----------------------------------------------------------------
                Left column — product summary + form
            ---------------------------------------------------------------- */}
            <div className="flex-1 space-y-6">

              {/* Product summary card */}
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-base font-semibold text-gray-900">Produk</h2>
                <div className="flex gap-4">
                  {/* Image */}
                  <div className="h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                    {firstImage ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={firstImage}
                        alt={product.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full items-center justify-center text-gray-300">
                        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold text-gray-900 line-clamp-2">{product.name}</p>
                    {product.jastiper.username && (
                      <p className="mt-0.5 text-xs text-gray-500">
                        oleh{' '}
                        <Link
                          href={`/jastiper/${product.jastiper.username}`}
                          className="text-(--color-primary) hover:underline"
                        >
                          {product.jastiper.username}
                        </Link>
                      </p>
                    )}
                    <p className="mt-1 text-sm font-semibold text-(--color-primary-dark)">
                      {formatRupiah(product.price)}
                    </p>
                    <p className="mt-0.5 text-xs text-gray-500">
                      Stok tersedia: {product.stock}
                    </p>
                  </div>
                </div>

                {/* Quantity selector */}
                <div className="mt-4 flex items-center gap-3">
                  <span className="text-sm font-medium text-gray-700">Jumlah:</span>
                  <div className="flex items-center rounded-lg border border-gray-300 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                      disabled={quantity <= 1}
                      className="flex h-9 w-9 items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition"
                      aria-label="Kurangi jumlah"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 12H4" />
                      </svg>
                    </button>
                    <span className="w-10 text-center text-sm font-semibold text-gray-900">
                      {quantity}
                    </span>
                    <button
                      type="button"
                      onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                      disabled={quantity >= maxQty}
                      className="flex h-9 w-9 items-center justify-center text-gray-600 hover:bg-gray-100 disabled:text-gray-300 disabled:cursor-not-allowed transition"
                      aria-label="Tambah jumlah"
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                      </svg>
                    </button>
                  </div>
                  <span className="text-xs text-gray-500">maks. {maxQty}</span>
                </div>
              </section>

              {/* Shipping address form */}
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-base font-semibold text-gray-900">Alamat Pengiriman</h2>
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                  <Field label="Nama Penerima" required>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Nama lengkap penerima"
                      value={shipping.recipient_name}
                      onChange={(e) => handleShippingChange('recipient_name', e.target.value)}
                      disabled={submitting}
                      autoComplete="name"
                    />
                  </Field>

                  <Field label="Nomor Telepon" required>
                    <input
                      type="tel"
                      className={inputCls}
                      placeholder="Contoh: 08123456789"
                      value={shipping.phone_number}
                      onChange={(e) => handleShippingChange('phone_number', e.target.value)}
                      disabled={submitting}
                      autoComplete="tel"
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Alamat Jalan" required>
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="Nama jalan, nomor rumah, RT/RW"
                        value={shipping.street}
                        onChange={(e) => handleShippingChange('street', e.target.value)}
                        disabled={submitting}
                        autoComplete="street-address"
                      />
                    </Field>
                  </div>

                  <Field label="Kelurahan" required>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Kelurahan / Desa"
                      value={shipping.kelurahan}
                      onChange={(e) => handleShippingChange('kelurahan', e.target.value)}
                      disabled={submitting}
                    />
                  </Field>

                  <Field label="Kecamatan" required>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Kecamatan"
                      value={shipping.kecamatan}
                      onChange={(e) => handleShippingChange('kecamatan', e.target.value)}
                      disabled={submitting}
                    />
                  </Field>

                  <Field label="Kota / Kabupaten" required>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Kota atau Kabupaten"
                      value={shipping.city}
                      onChange={(e) => handleShippingChange('city', e.target.value)}
                      disabled={submitting}
                      autoComplete="address-level2"
                    />
                  </Field>

                  <Field label="Provinsi" required>
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="Provinsi"
                      value={shipping.province}
                      onChange={(e) => handleShippingChange('province', e.target.value)}
                      disabled={submitting}
                      autoComplete="address-level1"
                    />
                  </Field>

                  <Field label="Kode Pos" required hint="Tepat 5 digit angka">
                    <input
                      type="text"
                      className={inputCls}
                      placeholder="12345"
                      maxLength={5}
                      value={shipping.postal_code}
                      onChange={(e) =>
                        handleShippingChange('postal_code', e.target.value.replace(/\D/g, ''))
                      }
                      disabled={submitting}
                      autoComplete="postal-code"
                      inputMode="numeric"
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field label="Catatan Alamat" hint="Opsional — patokan, warna pintu, dll.">
                      <input
                        type="text"
                        className={inputCls}
                        placeholder="Contoh: Rumah cat biru, dekat masjid"
                        value={shipping.notes}
                        onChange={(e) => handleShippingChange('notes', e.target.value)}
                        disabled={submitting}
                      />
                    </Field>
                  </div>
                </div>
              </section>

              {/* Note to jastiper */}
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-1 text-base font-semibold text-gray-900">Catatan untuk Jastiper</h2>
                <p className="mb-3 text-xs text-gray-500">Opsional — instruksi khusus untuk jastiper Anda</p>
                <textarea
                  className={`${inputCls} resize-none`}
                  rows={3}
                  placeholder="Contoh: Tolong pilih warna merah jika tersedia"
                  maxLength={500}
                  value={noteToJastiper}
                  onChange={(e) => setNoteToJastiper(e.target.value)}
                  disabled={submitting}
                />
                <p className="mt-1 text-right text-xs text-gray-400">
                  {noteToJastiper.length}/500
                </p>
              </section>
            </div>

            {/* ----------------------------------------------------------------
                Right column — order summary + submit
            ---------------------------------------------------------------- */}
            <div className="w-full lg:w-80 space-y-4">
              {/* Order summary */}
              <section className="rounded-xl border border-gray-200 bg-white p-5">
                <h2 className="mb-4 text-base font-semibold text-gray-900">Ringkasan Pesanan</h2>

                <div className="space-y-2.5 text-sm">
                  <div className="flex justify-between text-gray-600">
                    <span>Harga satuan</span>
                    <span>{formatRupiah(unitPrice)}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Jumlah</span>
                    <span>× {quantity}</span>
                  </div>
                  <div className="flex justify-between text-gray-600">
                    <span>Biaya jasa</span>
                    <span>{formatRupiah(serviceFee)}</span>
                  </div>
                  <div className="my-2 border-t border-gray-100" />
                  <div className="flex justify-between font-semibold text-gray-900">
                    <span>Total</span>
                    <span className="text-(--color-primary-dark)">{formatRupiah(total)}</span>
                  </div>
                </div>

                {/* Wallet balance */}
                <div className="mt-4 rounded-lg bg-gray-50 p-3">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-gray-600">Saldo dompet</span>
                    <span className={`font-semibold ${balanceInsufficient ? 'text-red-600' : 'text-gray-900'}`}>
                      {walletBalance !== null ? formatRupiah(walletBalance) : '—'}
                    </span>
                  </div>
                  {balanceInsufficient && (
                    <p className="mt-2 text-xs text-red-600 leading-snug">
                      Saldo tidak cukup. Top up dompet Anda terlebih dahulu.
                    </p>
                  )}
                </div>

                {/* Top up link if insufficient */}
                {balanceInsufficient && (
                  <Link
                    href="/wallet"
                    className="mt-3 block w-full rounded-lg border border-(--color-secondary) py-2 text-center text-sm font-semibold text-(--color-secondary) hover:bg-yellow-50 transition"
                  >
                    Top Up Dompet
                  </Link>
                )}
              </section>

              {/* Error message */}
              {submitError && (
                <div
                  role="alert"
                  className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700"
                >
                  {submitError}
                </div>
              )}

              {/* Submit button */}
              <button
                type="submit"
                disabled={submitting || balanceInsufficient}
                className="w-full rounded-xl bg-(--color-primary) py-3 text-sm font-semibold text-white transition hover:bg-(--color-primary-dark) active:scale-95 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {submitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Memproses...
                  </span>
                ) : (
                  'Buat Pesanan'
                )}
              </button>

              <p className="text-center text-xs text-gray-400">
                Dengan menekan &ldquo;Buat Pesanan&rdquo;, Anda menyetujui syarat dan ketentuan JSON.
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
