'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useCallback, useEffect, useState } from 'react';

import { searchProducts, getCategories } from '@/services/inventory.service';
import type { ProductResponse, CategoryResponse } from '@/services/inventory.service';

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
// RatingStars
// ---------------------------------------------------------------------------
function RatingStars({ rating }: { rating: number }) {
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-3.5 w-3.5 ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-gray-500">{rating.toFixed(1)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------
function ProductCard({ product }: { product: ProductResponse }) {
  const p = product as any;
  const productId = p.productId || p.product_id;
  const serviceFee = p.serviceFee ?? p.service_fee ?? 0;
  const avgRating = p.stats?.avgRating ?? p.stats?.avg_rating ?? 0;
  const jastiperUsername = p.jastiper?.username ?? p.jastiper?.user_id;

  return (
    <Link
      href={`/catalog/${productId}`}
      className="group relative rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
    >
      {p.mode === 'FLASH_SALE' && (
          <span className="absolute top-2 right-2 z-10 rounded bg-red-600 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
        ⚡ Flash Sale
      </span>
      )}
      {p.mode === 'PRE_ORDER' && (
          <span className="absolute top-2 right-2 z-10 rounded bg-blue-600 px-2 py-1 text-[10px] font-bold text-white uppercase tracking-wider shadow-sm">
        📦 Pre-Order
      </span>
      )}

      <div className="aspect-square bg-gray-100 overflow-hidden">
        {p.images && p.images[0] ? (
          <img
            src={p.images[0]}
            alt={p.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-300">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 line-clamp-2 mb-1">{p.name}</p>
        <p className="text-sm font-bold text-(--color-primary-dark)">{formatRupiah(p.price)}</p>
        {serviceFee > 0 && (
          <p className="text-xs text-gray-400">+ {formatRupiah(serviceFee)} jasa</p>
        )}
        {avgRating > 0 && (
          <div className="mt-1.5">
            <RatingStars rating={avgRating} />
          </div>
        )}
        {p.status === 'OUT_OF_STOCK' && (
          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Stok Habis
          </span>
        )}
        {jastiperUsername && (
          <p className="mt-1 text-xs text-gray-400 truncate">
            oleh {jastiperUsername}
          </p>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ProductCard skeleton
// ---------------------------------------------------------------------------
function ProductCardSkeleton() {
  return (
    <div className="rounded-xl border border-gray-100 bg-white overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-2/3 rounded bg-gray-200" />
        <div className="h-4 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Inner catalog component (uses useSearchParams — needs Suspense)
// ---------------------------------------------------------------------------
function CatalogContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  // Read initial values from URL
  const [q, setQ] = useState(searchParams.get('q') ?? '');
  const [qInput, setQInput] = useState(searchParams.get('q') ?? '');
  const [categoryId, setCategoryId] = useState(searchParams.get('categoryId') ?? '');
  const [minPrice, setMinPrice] = useState(searchParams.get('minPrice') ?? '');
  const [maxPrice, setMaxPrice] = useState(searchParams.get('maxPrice') ?? '');
  const [originCountry, setOriginCountry] = useState(searchParams.get('origin_country') ?? '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('purchase_date_from') ?? '');
  const [dateTo, setDateTo] = useState(searchParams.get('purchase_date_to') ?? '');
  const [sortBy, setSortBy] = useState<'created_at' | 'rating' | 'purchase_date'>(
    (searchParams.get('sortBy') as 'created_at' | 'rating' | 'purchase_date') ?? 'created_at'
  );
  const [order, setOrder] = useState<'asc' | 'desc'>(
    (searchParams.get('order') as 'asc' | 'desc') ?? 'desc'
  );
  const [page, setPage] = useState(Number(searchParams.get('page') ?? '1'));

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [categories, setCategories] = useState<CategoryResponse[]>([]);

  const LIMIT = 20;

  // ---------------------------------------------------------------------------
  // Sync URL params
  // ---------------------------------------------------------------------------
  const syncUrl = useCallback((params: Record<string, string>) => {
    const sp = new URLSearchParams();
    for (const [k, v] of Object.entries(params)) {
      if (v) sp.set(k, v);
    }
    router.replace(`/catalog?${sp.toString()}`, { scroll: false });
  }, [router]);

  useEffect(() => {
    const urlQ = searchParams.get('q') ?? '';
    const urlCategoryId = searchParams.get('categoryId') ?? '';
    const urlMinPrice = searchParams.get('minPrice') ?? '';
    const urlMaxPrice = searchParams.get('maxPrice') ?? '';
    const urlOriginCountry = searchParams.get('origin_country') ?? '';
    const urlDateFrom = searchParams.get('purchase_date_from') ?? '';
    const urlDateTo = searchParams.get('purchase_date_to') ?? '';
    const urlSortBy = searchParams.get('sortBy') ?? 'created_at';
    const urlOrder = searchParams.get('order') ?? 'desc';
    const urlPage = Number(searchParams.get('page') ?? '1');

    if (urlQ !== q) setQ(urlQ);
    if (urlQ !== qInput) setQInput(urlQ);
    if (urlCategoryId !== categoryId) setCategoryId(urlCategoryId);
    if (urlMinPrice !== minPrice) setMinPrice(urlMinPrice);
    if (urlMaxPrice !== maxPrice) setMaxPrice(urlMaxPrice);
    if (urlOriginCountry !== originCountry) setOriginCountry(urlOriginCountry);
    if (urlDateFrom !== dateFrom) setDateFrom(urlDateFrom);
    if (urlDateTo !== dateTo) setDateTo(urlDateTo);
    if (urlSortBy !== sortBy) setSortBy(urlSortBy as any);
    if (urlOrder !== order) setOrder(urlOrder as any);
    if (urlPage !== page) setPage(urlPage);
  }, [searchParams]);

  // ---------------------------------------------------------------------------
  // Fetch categories once
  // ---------------------------------------------------------------------------
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch products when filters/page change
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError('');

    searchProducts({
      q: q || undefined,
      categoryId: categoryId ? Number(categoryId) : undefined,
      minPrice: minPrice ? Number(minPrice) : undefined,
      maxPrice: maxPrice ? Number(maxPrice) : undefined,
      origin_country: originCountry || undefined,
      purchase_date_from: dateFrom || undefined,
      purchase_date_to: dateTo || undefined,
      sortBy,
      order,
      page,
      limit: LIMIT,
    })
      .then((data) => {
        if (cancelled) return;
        setProducts(data.data);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.total_pages);
      })
      .catch(() => {
        if (!cancelled) setError('Gagal memuat produk. Coba lagi.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [q, categoryId, minPrice, maxPrice, originCountry, dateFrom, dateTo, sortBy, order, page]);

  // ---------------------------------------------------------------------------
  // Debounced search input → q state + URL
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const timer = setTimeout(() => {
      setQ(qInput);
      setPage(1);
      syncUrl({ q: qInput, categoryId, minPrice, maxPrice, origin_country: originCountry, purchase_date_from: dateFrom, purchase_date_to: dateTo, sortBy, order, page: '1' });
    }, 300);
    return () => clearTimeout(timer);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [qInput]);

  // ---------------------------------------------------------------------------
  // Apply filters
  // ---------------------------------------------------------------------------
  function applyFilters() {
    setPage(1);
    syncUrl({ q, categoryId, minPrice, maxPrice, origin_country: originCountry, purchase_date_from: dateFrom, purchase_date_to: dateTo, sortBy, order, page: '1' });
  }

  // ---------------------------------------------------------------------------
  // Reset filters
  // ---------------------------------------------------------------------------
  function resetFilters() {
    setQ(''); setQInput('');
    setCategoryId(''); setMinPrice(''); setMaxPrice('');
    setOriginCountry(''); setDateFrom(''); setDateTo('');
    setSortBy('created_at'); setOrder('desc');
    setPage(1);
    router.replace('/catalog', { scroll: false });
  }

  // ---------------------------------------------------------------------------
  // Page change
  // ---------------------------------------------------------------------------
  function changePage(newPage: number) {
    setPage(newPage);
    syncUrl({ q, categoryId, minPrice, maxPrice, origin_country: originCountry, purchase_date_from: dateFrom, purchase_date_to: dateTo, sortBy, order, page: String(newPage) });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const inputClass = 'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Minimal header */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          <div className="flex items-center gap-3">
            <Link href="/login" className="text-sm text-white/80 hover:text-white">Masuk</Link>
            <Link href="/register" className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-(--color-primary-dark) hover:bg-gray-100">Daftar</Link>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-8">
        <h1 className="mb-6 text-2xl font-bold text-gray-900">Katalog Produk</h1>

        <div className="flex flex-col lg:flex-row gap-6">
          {/* ---------------------------------------------------------------- */}
          {/* Sidebar filters                                                   */}
          {/* ---------------------------------------------------------------- */}
          <aside className="w-full lg:w-64 shrink-0">
            <div className="rounded-xl border border-gray-200 bg-white p-5 space-y-5 sticky top-20">
              <h2 className="font-semibold text-gray-800">Filter</h2>

              {/* Search */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Kata Kunci</label>
                <div className="relative">
                  <input
                    type="text"
                    value={qInput}
                    onChange={(e) => setQInput(e.target.value)}
                    placeholder="Cari produk..."
                    className={`${inputClass} pl-8`}
                  />
                  <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>

              {/* Category */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Kategori</label>
                <select
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  className={inputClass}
                >
                  <option value="">Semua Kategori</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={String(c.category_id)}>
                      {c.name} ({c.product_count})
                    </option>
                  ))}
                </select>
              </div>

              {/* Price range */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Harga (IDR)</label>
                <div className="flex gap-2">
                  <input
                    type="number"
                    value={minPrice}
                    onChange={(e) => setMinPrice(e.target.value)}
                    placeholder="Min"
                    min={0}
                    className={inputClass}
                  />
                  <input
                    type="number"
                    value={maxPrice}
                    onChange={(e) => setMaxPrice(e.target.value)}
                    placeholder="Max"
                    min={0}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Origin country */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Negara Asal</label>
                <input
                  type="text"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  placeholder="Contoh: Japan"
                  className={inputClass}
                />
              </div>

              {/* Purchase date range */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Tanggal Pembelian</label>
                <div className="space-y-2">
                  <input
                    type="date"
                    value={dateFrom}
                    onChange={(e) => setDateFrom(e.target.value)}
                    className={inputClass}
                  />
                  <input
                    type="date"
                    value={dateTo}
                    onChange={(e) => setDateTo(e.target.value)}
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Sort */}
              <div>
                <label className="mb-1 block text-xs font-medium text-gray-600">Urutkan</label>
                <select
                  value={`${sortBy}:${order}`}
                  onChange={(e) => {
                    const [s, o] = e.target.value.split(':');
                    setSortBy(s as 'created_at' | 'rating' | 'purchase_date');
                    setOrder(o as 'asc' | 'desc');
                  }}
                  className={inputClass}
                >
                  <option value="created_at:desc">Terbaru</option>
                  <option value="rating:desc">Rating Tertinggi</option>
                  <option value="created_at:asc">Terlama</option>
                </select>
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 pt-1">
                <button
                  onClick={applyFilters}
                  className="w-full rounded-lg bg-(--color-primary) py-2 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
                >
                  Terapkan Filter
                </button>
                <button
                  onClick={resetFilters}
                  className="w-full rounded-lg border border-gray-300 py-2 text-sm text-gray-600 hover:bg-gray-50 transition"
                >
                  Reset Filter
                </button>
              </div>
            </div>
          </aside>

          {/* ---------------------------------------------------------------- */}
          {/* Main content                                                      */}
          {/* ---------------------------------------------------------------- */}
          <main className="flex-1 min-w-0">
            {/* Results count */}
            {!loading && !error && (
              <p className="mb-4 text-sm text-gray-500">
                Menampilkan <span className="font-medium text-gray-700">{totalItems}</span> produk
              </p>
            )}

            {/* Error */}
            {error && (
              <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600 flex items-center justify-between">
                <span>{error}</span>
                <button onClick={() => setPage((p) => p)} className="underline ml-2">Coba lagi</button>
              </div>
            )}

            {/* Grid */}
            {loading ? (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {Array.from({ length: 12 }).map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length === 0 ? (
              <div className="py-20 text-center">
                <svg className="mx-auto h-12 w-12 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <p className="text-gray-500 mb-4">Tidak ada produk yang sesuai dengan filter Anda</p>
                <button
                  onClick={resetFilters}
                  className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark)"
                >
                  Reset Filter
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
                {products.map((p, index) => (<ProductCard key={p.productId || (p as any).product_id || (p as any).id || index} product={p} />))}
              </div>
            )}

            {/* Pagination */}
            {!loading && totalPages > 1 && (
              <div className="mt-8 flex items-center justify-between">
                <p className="text-sm text-gray-500">
                  Halaman {page} dari {totalPages}
                </p>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => changePage(1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    «
                  </button>
                  <button
                    onClick={() => changePage(page - 1)}
                    disabled={page <= 1}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    ← Sebelumnya
                  </button>

                  {/* Page numbers */}
                  {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                    const start = Math.max(1, Math.min(page - 2, totalPages - 4));
                    return start + i;
                  }).map((p) => (
                    <button
                      key={p}
                      onClick={() => changePage(p)}
                      className={`rounded-lg border px-3 py-1.5 text-sm ${
                        p === page
                          ? 'border-(--color-primary) bg-(--color-primary) text-white'
                          : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                      }`}
                    >
                      {p}
                    </button>
                  ))}

                  <button
                    onClick={() => changePage(page + 1)}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    Berikutnya →
                  </button>
                  <button
                    onClick={() => changePage(totalPages)}
                    disabled={page >= totalPages}
                    className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                  >
                    »
                  </button>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — wraps in Suspense (required by useSearchParams)
// ---------------------------------------------------------------------------
export default function CatalogPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-(--color-primary) border-t-transparent" />
      </div>
    }>
      <CatalogContent />
    </Suspense>
  );
}
