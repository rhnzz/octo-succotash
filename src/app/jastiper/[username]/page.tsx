'use client';

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import {
  getPublicProfile,
  isApiError,
  type PublicProfileResponse,
  type AccountStatus,
} from '@/services/auth.service';
import {
  getJastiperCatalog,
  type ProductResponse,
  type PaginatedProducts,
} from '@/services/inventory.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', { style: 'currency', currency: 'IDR', maximumFractionDigits: 0 }).format(amount);
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' });
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, { label: string; cls: string }> = {
    ACTIVE: { label: 'Aktif', cls: 'bg-green-100 text-green-700' },
    BANNED: { label: 'Dinonaktifkan', cls: 'bg-red-100 text-red-700' },
    PENDING_VERIFICATION: { label: 'Menunggu Verifikasi', cls: 'bg-yellow-100 text-yellow-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function RatingStars({ rating, size = 'sm' }: { rating: number; size?: 'sm' | 'md' }) {
  const starSize = size === 'md' ? 'h-5 w-5' : 'h-4 w-4';
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`${starSize} ${star <= Math.round(rating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-sm text-gray-600">{rating.toFixed(1)}</span>
    </span>
  );
}

function ProductCard({ product }: { product: ProductResponse }) {
  return (
    <Link
      href={`/catalog/${product.productId}`}
      className="group rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
    >
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {product.images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={product.images[0]}
            alt={product.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-300">
            <svg className="h-12 w-12" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-sm font-medium text-gray-800 line-clamp-2">{product.name}</p>
        <p className="mt-1 text-sm font-semibold text-(--color-primary-dark)">{formatRupiah(product.price)}</p>
        {product.stats.avgRating > 0 && (
          <div className="mt-1">
            <RatingStars rating={product.stats.avgRating} />
          </div>
        )}
        {product.status === 'OUT_OF_STOCK' && (
          <span className="mt-1 inline-block rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">
            Stok Habis
          </span>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function JastiperProfilePage() {
  const params = useParams();
  const router = useRouter();
  const username = String(params.username ?? '');

  const [profile, setProfile] = useState<PublicProfileResponse | null>(null);
  const [profileLoading, setProfileLoading] = useState(true);
  const [profileError, setProfileError] = useState('');

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total_pages: 1, total: 0 });
  const [productsLoading, setProductsLoading] = useState(true);

  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [page, setPage] = useState(1);

  // ---------------------------------------------------------------------------
  // Fetch profile
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!username) return;
    let cancelled = false;
    setProfileLoading(true);
    setProfileError('');

    getPublicProfile(username)
      .then((data) => { if (!cancelled) setProfile(data); })
      .catch((err) => {
        if (cancelled) return;
        if (isApiError(err) && err.status === 404) {
          setProfileError('not_found');
        } else {
          setProfileError('error');
        }
      })
      .finally(() => { if (!cancelled) setProfileLoading(false); });

    return () => { cancelled = true; };
  }, [username]);

  // ---------------------------------------------------------------------------
  // Fetch products
  // ---------------------------------------------------------------------------
  const fetchProducts = useCallback(async (q: string, pg: number) => {
    if (!username) return;
    setProductsLoading(true);
    try {
      const data: PaginatedProducts = await getJastiperCatalog(username, {
        q: q || undefined,
        page: pg,
        size: 12,
      });
      setProducts(data.data);
      setPagination({
        page: data.pagination.page,
        total_pages: data.pagination.total_pages,
        total: data.pagination.total,
      });
    } catch {
      setProducts([]);
    } finally {
      setProductsLoading(false);
    }
  }, [username]);

  useEffect(() => {
    fetchProducts(search, page);
  }, [fetchProducts, search, page]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---------------------------------------------------------------------------
  // Render states
  // ---------------------------------------------------------------------------
  if (profileLoading) {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto max-w-4xl animate-pulse space-y-6">
          <div className="flex gap-6 items-center">
            <div className="h-24 w-24 rounded-full bg-gray-200" />
            <div className="space-y-2 flex-1">
              <div className="h-6 w-40 rounded bg-gray-200" />
              <div className="h-4 w-60 rounded bg-gray-100" />
              <div className="h-4 w-32 rounded bg-gray-100" />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-gray-200" />
            ))}
          </div>
        </div>
      </main>
    );
  }

  if (profileError === 'not_found') {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-2xl font-bold text-gray-800 mb-2">Profil tidak ditemukan</p>
          <p className="text-gray-500 mb-6">Pengguna dengan username &quot;{username}&quot; tidak ada.</p>
          <Link href="/catalog" className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark)">
            Kembali ke Katalog
          </Link>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  return (
    <main className="min-h-screen bg-gray-50">
      {/* Profile header */}
      <div className="bg-white border-b border-gray-100">
        <div className="mx-auto max-w-4xl px-4 py-8">
          {/* Status banners */}
          {profile.status === 'PENDING_VERIFICATION' && (
            <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
              Akun ini sedang dalam proses verifikasi.
            </div>
          )}
          {profile.status === 'BANNED' && (
            <div className="mb-4 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
              Akun ini telah dinonaktifkan.
            </div>
          )}

          <div className="flex flex-col sm:flex-row gap-6 items-start sm:items-center">
            {/* Avatar */}
            <div className="shrink-0">
              {profile.profile_picture_url ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profile.profile_picture_url}
                  alt={profile.username}
                  className="h-24 w-24 rounded-full object-cover border-2 border-(--color-primary)"
                />
              ) : (
                <div className="h-24 w-24 rounded-full bg-(--color-primary) flex items-center justify-center text-white text-3xl font-bold">
                  {profile.username[0].toUpperCase()}
                </div>
              )}
            </div>

            {/* Info */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-1">
                <h1 className="text-2xl font-bold text-gray-900">{profile.username}</h1>
                <StatusBadge status={profile.status} />
              </div>
              {profile.full_name && (
                <p className="text-gray-600 mb-1">{profile.full_name}</p>
              )}
              <p className="text-xs text-gray-400 mb-3">
                Bergabung sejak {formatDate(profile.member_since)}
              </p>

              {/* Stats — JASTIPER only */}
              {profile.stats && (
                <div className="flex flex-wrap gap-4 mb-3">
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-800">{profile.stats.total_orders}</p>
                    <p className="text-xs text-gray-500">Pesanan</p>
                  </div>
                  <div className="text-center">
                    <p className="text-lg font-bold text-gray-800">
                      {(profile.stats.success_rate * 100).toFixed(0)}%
                    </p>
                    <p className="text-xs text-gray-500">Sukses</p>
                  </div>
                  <div className="text-center">
                    <RatingStars rating={profile.stats.avg_rating} size="md" />
                    <p className="text-xs text-gray-500">Rating</p>
                  </div>
                </div>
              )}

              {/* Badges */}
              {profile.badges && profile.badges.length > 0 && (
                <div className="flex flex-wrap gap-1">
                  {profile.badges.map((badge) => (
                    <span
                      key={badge}
                      className="inline-flex items-center rounded-full bg-(--color-secondary-light) px-2.5 py-0.5 text-xs font-medium text-gray-800"
                    >
                      {badge}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Product catalog */}
      <div className="mx-auto max-w-4xl px-4 py-8">
        <div className="mb-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-gray-800">
            Produk dari {profile.username}
          </h2>
          {/* Search */}
          <div className="relative w-full sm:w-64">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari produk..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)"
            />
            <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <div key={i} className="animate-pulse">
                <div className="aspect-square rounded-xl bg-gray-200 mb-2" />
                <div className="h-4 w-3/4 rounded bg-gray-100 mb-1" />
                <div className="h-4 w-1/2 rounded bg-gray-100" />
              </div>
            ))}
          </div>
        ) : products.length === 0 ? (
          <div className="py-16 text-center">
            <p className="text-gray-500">
              {search ? 'Tidak ada produk yang sesuai.' : 'Jastiper ini belum memiliki produk aktif.'}
            </p>
            {search && (
              <button
                onClick={() => { setSearchInput(''); setSearch(''); }}
                className="mt-3 text-sm text-(--color-primary) hover:underline"
              >
                Hapus pencarian
              </button>
            )}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
              {products.map((product) => (
                <ProductCard key={product.productId} product={product} />
              ))}
            </div>

            {/* Pagination */}
            {pagination.total_pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Sebelumnya
                </button>
                <span className="text-sm text-gray-600">
                  {page} / {pagination.total_pages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(pagination.total_pages, p + 1))}
                  disabled={page >= pagination.total_pages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Berikutnya →
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
}
