'use client';

/**
 * TASK-219: /catalog/[productId] — Product Detail Page
 *
 * Public page. Checkout button logic:
 * - Guest: shows "Masuk untuk membeli" link
 * - TITIPERS (not owner): shows "Beli Sekarang" button
 * - TITIPERS (owner): disabled button with tooltip
 * - JASTIPER (owner): hidden checkout, shows "Edit Produk" link
 * - OUT_OF_STOCK: button disabled, shows "Stok Habis"
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { getProduct, isApiError } from '@/services/inventory.service';
import type { ProductResponse } from '@/services/inventory.service';
import { useAuth } from '@/lib/auth/AuthProvider';

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

function formatDate(dateStr: string) {
  if (!dateStr) return '-';
  const [year, month, day] = dateStr.split('-');
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'Mei', 'Jun', 'Jul', 'Agu', 'Sep', 'Okt', 'Nov', 'Des'];
  return `${day} ${months[Number(month) - 1]} ${year}`;
}

// ---------------------------------------------------------------------------
// RatingStars
// ---------------------------------------------------------------------------
function RatingStars({ rating, size = 'md' }: { rating: number; size?: 'sm' | 'md' }) {
  const sz = size === 'sm' ? 'h-3.5 w-3.5' : 'h-5 w-5';
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${sz} ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
          aria-hidden="true"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm text-gray-500">{rating.toFixed(1)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; cls: string }> = {
    ACTIVE: { label: 'Tersedia', cls: 'bg-green-100 text-green-700' },
    OUT_OF_STOCK: { label: 'Stok Habis', cls: 'bg-gray-100 text-gray-600' },
    HIDDEN: { label: 'Disembunyikan', cls: 'bg-yellow-100 text-yellow-700' },
    REMOVED_BY_ADMIN: { label: 'Dihapus Admin', cls: 'bg-red-100 text-red-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-600' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Image Gallery
// ---------------------------------------------------------------------------
function ImageGallery({ images, name }: { images: string[]; name: string }) {
  const [activeIdx, setActiveIdx] = useState(0);
  const src = images?.[activeIdx] ?? null;

  return (
    <div>
      {/* Main image */}
      <div className="aspect-square w-full overflow-hidden rounded-xl bg-gray-100">
        {src ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={src}
            alt={name}
            className="h-full w-full object-cover"
          />
        ) : (
          <div className="flex h-full w-full items-center justify-center text-gray-300">
            <svg className="h-16 w-16" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Thumbnails */}
      {images && images.length > 1 && (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
          {images.map((img, i) => (
            <button
              key={i}
              onClick={() => setActiveIdx(i)}
              className={`shrink-0 h-16 w-16 overflow-hidden rounded-lg border-2 transition ${
                i === activeIdx ? 'border-(--color-primary)' : 'border-transparent hover:border-gray-300'
              }`}
              aria-label={`Gambar ${i + 1}`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={img} alt={`Thumbnail ${i + 1}`} className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page skeleton
// ---------------------------------------------------------------------------
function PageSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="flex flex-col lg:flex-row gap-8">
          <div className="w-full lg:w-3/5">
            <div className="aspect-square w-full rounded-xl bg-gray-200" />
            <div className="mt-3 flex gap-2">
              {[1, 2, 3].map((i) => <div key={i} className="h-16 w-16 rounded-lg bg-gray-200" />)}
            </div>
          </div>
          <div className="flex-1 space-y-4">
            <div className="h-6 w-3/4 rounded bg-gray-200" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
            <div className="h-8 w-1/2 rounded bg-gray-200" />
            <div className="h-4 w-1/3 rounded bg-gray-200" />
            <div className="h-4 w-1/4 rounded bg-gray-200" />
            <div className="h-12 w-full rounded-xl bg-gray-200 mt-6" />
          </div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function ProductDetailPage() {
  const params = useParams();
  const router = useRouter();
  const rawProductId = params.productId as string;

  const { accessToken, user, isLoading: authLoading } = useAuth();

  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [descExpanded, setDescExpanded] = useState(false);

  // ---------------------------------------------------------------------------
  // Fetch product
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!rawProductId || rawProductId === 'undefined') return;
    setLoading(true);
    setNotFound(false);

    getProduct(rawProductId)
      .then((data) => {
        setProduct(data);
      })
      .catch((err) => {
        if (isApiError(err) && err.status === 404) {
          setNotFound(true);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoading(false));
  }, [rawProductId]);

  // ---------------------------------------------------------------------------
  // Derived auth state
  // ---------------------------------------------------------------------------
  const isAuthenticated = !!accessToken;
  const userRole = user?.role ?? null;
  const userId = user?.user_id ?? null;

  const productJastiperId = product?.jastiper?.userId || (product?.jastiper as any)?.user_id;
  const isOwner = !!product && !!userId && productJastiperId === userId;

  // ---------------------------------------------------------------------------
  // Checkout button logic
  // ---------------------------------------------------------------------------
  function renderCheckoutArea() {
    if (!product) return null;

    const isOutOfStock = product.stock === 0 || product.status === 'OUT_OF_STOCK';

    // Guest
    if (!isAuthenticated) {
      return (
        <Link
          href={`/login?redirect=/catalog/${rawProductId}`}
          className="block w-full rounded-xl bg-(--color-primary) py-3 text-center text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
        >
          Masuk untuk membeli produk ini
        </Link>
      );
    }

    // Jastiper who owns the product
    if (userRole === 'JASTIPER' && isOwner) {
      return (
        <Link
          href={`/jastiper/catalog/${rawProductId}/edit`}
          className="block w-full rounded-xl border border-(--color-primary) py-3 text-center text-sm font-semibold text-(--color-primary) hover:bg-green-50 transition"
        >
          Edit Produk
        </Link>
      );
    }

    if (isOwner) {
      return (
        <div className="relative group">
          <button
            disabled
            className="w-full rounded-xl bg-gray-200 py-3 text-sm font-semibold text-gray-400 cursor-not-allowed"
            aria-disabled="true"
          >
            Beli Sekarang
          </button>
          <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 hidden group-hover:block whitespace-nowrap rounded-lg bg-gray-800 px-3 py-1.5 text-xs text-white shadow-lg">
            Anda tidak dapat membeli produk sendiri
          </div>
        </div>
      );
    }

    // Out of stock
    if (isOutOfStock) {
      return (
        <button
          disabled
          className="w-full rounded-xl bg-gray-200 py-3 text-sm font-semibold text-gray-400 cursor-not-allowed"
          aria-disabled="true"
        >
          Stok Habis
        </button>
      );
    }

    // Normal TITIPERS checkout
    return (
      <button
        onClick={() => router.push(`/checkout/${rawProductId}`)}
        className="w-full rounded-xl bg-(--color-primary) py-3 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition active:scale-95"
      >
        Beli Sekarang
      </button>
    );
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  if (loading || authLoading) {
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

  if (notFound || !product) {
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
          <h1 className="text-xl font-bold text-gray-800 mb-2">Produk tidak ditemukan</h1>
          <p className="text-gray-500 mb-6">Produk yang Anda cari tidak tersedia atau telah dihapus.</p>
          <Link
            href="/catalog"
            className="rounded-xl bg-(--color-primary) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
          >
            Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  const p = product as any;
  const serviceFee = p.serviceFee ?? p.service_fee ?? 0;
  const total = p.price + serviceFee;
  const originCountry = p.originCountry || p.origin_country || '-';
  const purchaseDate = p.purchaseDate || p.purchase_date || '';
  const isLongDesc = (p.description || '').length > 500;

  const jastiperUsername = p.jastiper?.username ?? p.jastiper?.user_id ?? 'Jastiper';
  const jastiperFullName = p.jastiper?.fullName || p.jastiper?.full_name;
  const jastiperAvgRating = p.jastiper?.avgRating ?? p.jastiper?.avg_rating ?? 0;
  const jastiperTotalOrders = p.jastiper?.totalOrders ?? p.jastiper?.total_orders ?? 0;

  const statsTotalOrders = p.stats?.totalOrders ?? p.stats?.total_orders ?? 0;
  const statsTotalReviews = p.stats?.totalReviews ?? p.stats?.total_reviews ?? 0;
  const statsAvgRating = p.stats?.avgRating ?? p.stats?.avg_rating ?? 0;
  const categoryName = p.category?.name ?? 'Uncategorized';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          <nav className="flex items-center gap-3">
            <Link href="/catalog" className="text-sm text-white/80 hover:text-white">Katalog</Link>
            {isAuthenticated ? (
              <span className="text-sm text-white/80">{user?.username ?? user?.email}</span>
            ) : (
              <>
                <Link href="/login" className="text-sm text-white/80 hover:text-white">Masuk</Link>
                <Link href="/register" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-(--color-primary-dark) hover:bg-gray-100">Daftar</Link>
              </>
            )}
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-5xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/" className="hover:text-(--color-primary)">Beranda</Link>
          <span>/</span>
          <Link href="/catalog" className="hover:text-(--color-primary)">Katalog</Link>
          <span>/</span>
          <span className="text-gray-800 line-clamp-1">{p.name}</span>
        </nav>

        {/* Main two-column layout */}
        <div className="flex flex-col lg:flex-row gap-8">
          {/* Left column — image gallery + tags */}
          <div className="w-full lg:w-3/5">
            <ImageGallery images={p.images || []} name={p.name} />

            {/* Tags */}
            {p.tags && p.tags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {p.tags.map((tag: string) => (
                  <span
                    key={tag}
                    className="rounded-full bg-gray-100 px-3 py-1 text-xs text-gray-600"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            )}
          </div>

          {/* Right column — product info + actions */}
          <div className="flex-1 space-y-4">

            {/* Status badge */}
            <div className="flex flex-wrap items-center gap-2">
              <StatusBadge status={p.status} />

              {p.mode === 'FLASH_SALE' && (
                <span className="inline-flex items-center rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-bold text-red-700">
                  ⚡ Flash Sale
                </span>
              )}
              {p.mode === 'PRE_ORDER' && (
                <span className="inline-flex items-center rounded-full bg-blue-100 px-2.5 py-0.5 text-xs font-bold text-blue-700">
                  📦 Pre-Order
                </span>
              )}
            </div>

            {/* Product name */}
            <h1 className="text-2xl font-bold text-gray-900">{p.name}</h1>

            {/* Rating */}
            {statsAvgRating > 0 && (
              <div className="flex items-center gap-2">
                <RatingStars rating={statsAvgRating} />
                <span className="text-sm text-gray-500">
                  ({statsTotalReviews} ulasan)
                </span>
              </div>
            )}

            {/* Price */}
            <div className="rounded-xl bg-gray-50 p-4 space-y-1.5">
              <p className="text-2xl font-bold text-(--color-primary-dark)">
                {formatRupiah(p.price)}
              </p>
              {serviceFee > 0 && (
                <p className="text-sm text-gray-500">
                  Biaya Jasa: {formatRupiah(serviceFee)}
                </p>
              )}
              {serviceFee > 0 && (
                <p className="text-sm font-semibold text-gray-700">
                  Total: {formatRupiah(total)}
                </p>
              )}
            </div>

            {/* Stock */}
            <div className="flex items-center gap-2">
              <svg className="h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
              </svg>
              <span className={`text-sm font-medium ${p.stock <= 3 && p.stock > 0 ? 'text-red-600' : 'text-gray-700'}`}>
                {p.stock === 0 ? 'Stok habis' : `Stok: ${p.stock} tersisa`}
                {p.stock > 0 && p.stock <= 3 && ' — segera habis!'}
              </span>
            </div>

            {/* Origin & purchase date */}
            <div className="space-y-1 text-sm text-gray-600">
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.055 11H5a2 2 0 012 2v1a2 2 0 002 2 2 2 0 012 2v2.945M8 3.935V5.5A2.5 2.5 0 0010.5 8h.5a2 2 0 012 2 2 2 0 104 0 2 2 0 012-2h1.064M15 20.488V18a2 2 0 012-2h3.064" />
                </svg>
                <span>Asal: <strong>{originCountry}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                <span>Tanggal Beli: <strong>{formatDate(purchaseDate)}</strong></span>
              </div>
              <div className="flex items-center gap-2">
                <svg className="h-4 w-4 text-gray-400 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 7h.01M7 3h5c.512 0 1.024.195 1.414.586l7 7a2 2 0 010 2.828l-7 7a2 2 0 01-2.828 0l-7-7A1.994 1.994 0 013 12V7a4 4 0 014-4z" />
                </svg>
                <span>Kategori: <strong>{categoryName}</strong></span>
              </div>
            </div>

            {/* Jastiper info card */}
            <div className="rounded-xl border border-gray-200 bg-white p-4">
              <p className="mb-2 text-xs font-medium text-gray-500 uppercase tracking-wide">Dijual oleh</p>
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-(--color-primary) flex items-center justify-center text-white font-bold text-sm shrink-0">
                  {jastiperUsername?.[0]?.toUpperCase() ?? 'J'}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/jastiper/${jastiperUsername}`}
                    className="font-semibold text-gray-800 hover:text-(--color-primary) transition truncate block"
                  >
                    {jastiperUsername}
                  </Link>
                  {jastiperFullName && (
                    <p className="text-xs text-gray-500 truncate">{jastiperFullName}</p>
                  )}
                  <div className="mt-0.5 flex items-center gap-2">
                    {jastiperAvgRating > 0 && (
                      <RatingStars rating={jastiperAvgRating} size="sm" />
                    )}
                    <span className="text-xs text-gray-400">
                      {jastiperTotalOrders} pesanan
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Checkout area */}
            <div className="pt-2">
              {renderCheckoutArea()}
            </div>
          </div>
        </div>

        {/* Below columns — description + stats + reviews */}
        <div className="mt-10 space-y-8">
          {/* Description */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-gray-900">Deskripsi Produk</h2>
            <div className="rounded-xl border border-gray-200 bg-white p-5">
              <p className={`text-sm text-gray-700 leading-relaxed whitespace-pre-wrap ${!descExpanded && isLongDesc ? 'line-clamp-6' : ''}`}>
                {p.description}
              </p>
              {isLongDesc && (
                <button
                  onClick={() => setDescExpanded((v) => !v)}
                  className="mt-2 text-sm font-medium text-(--color-primary) hover:underline"
                >
                  {descExpanded ? 'Tampilkan lebih sedikit' : 'Tampilkan selengkapnya'}
                </button>
              )}
            </div>
          </section>

          {/* Stats */}
          <section>
            <h2 className="mb-3 text-lg font-bold text-gray-900">Statistik Produk</h2>
            <div className="grid grid-cols-3 gap-4">
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-(--color-primary-dark)">{statsTotalOrders}</p>
                <p className="text-xs text-gray-500 mt-1">Total Pesanan</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-(--color-primary-dark)">{statsTotalReviews}</p>
                <p className="text-xs text-gray-500 mt-1">Ulasan</p>
              </div>
              <div className="rounded-xl border border-gray-200 bg-white p-4 text-center">
                <p className="text-2xl font-bold text-(--color-primary-dark)">
                  {statsAvgRating > 0 ? statsAvgRating.toFixed(1) : '—'}
                </p>
                <p className="text-xs text-gray-500 mt-1">Rating Rata-rata</p>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}