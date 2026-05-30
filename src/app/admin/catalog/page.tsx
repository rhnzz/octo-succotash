'use client';

/**
 * TASK-223: /admin/catalog — Admin All Products Page
 *
 * Access: ADMIN only (role guard enforced here + middleware guards /admin/*)
 *
 * API:
 * GET  /admin/products?q=&status=&jastiperId=&page=&size=&sort=
 * PATCH /admin/products/{id}/moderate  { action, reason }
 *
 * ProductResponse fields are camelCase (productId, originCountry, purchaseDate, etc.)
 *
 * Moderation actions:
 * HIDE     → status = HIDDEN
 * REMOVE   → status = HIDDEN + deleted_at set (soft-delete)
 * RESTORE  → status = ACTIVE, deleted_at cleared
 * ACTIVATE → status = ACTIVE, deleted_at cleared
 * reason is required and logged in the moderation log.
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  adminGetAllProducts,
  adminModerateProduct,
  adminCreateCategory,
  isApiError,
} from '@/services/inventory.service';
import type {
  ProductResponse,
  ProductStatus,
  ModerationAction,
} from '@/services/inventory.service';

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
  // purchaseDate is YYYY-MM-DD (LocalDate)
  return new Date(dateStr + 'T00:00:00').toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// StatusBadge
// ---------------------------------------------------------------------------
function StatusBadge({ status }: { status: ProductStatus }) {
  const map: Record<ProductStatus, { label: string; cls: string }> = {
    ACTIVE: { label: 'Aktif', cls: 'bg-green-100 text-green-700' },
    OUT_OF_STOCK: { label: 'Stok Habis', cls: 'bg-orange-100 text-orange-700' },
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
// Toast
// ---------------------------------------------------------------------------
type ToastType = 'success' | 'error';

function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} aria-label="Tutup notifikasi" className="opacity-80 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Moderation Modal
// ---------------------------------------------------------------------------
const MODERATION_OPTIONS: {
  value: ModerationAction;
  label: string;
  description: string;
  danger: boolean;
}[] = [
  { value: 'HIDE', label: 'Sembunyikan', description: 'Produk tidak tampil di katalog publik', danger: false },
  { value: 'REMOVE', label: 'Hapus (soft-delete)', description: 'Produk dihapus dari platform oleh admin', danger: true },
  { value: 'RESTORE', label: 'Pulihkan', description: 'Kembalikan produk ke status ACTIVE', danger: false },
  { value: 'ACTIVATE', label: 'Aktifkan', description: 'Set status ke ACTIVE', danger: false },
];

function ModerationModal({
  product,
  onConfirm,
  onClose,
  loading,
}: {
  product: ProductResponse;
  onConfirm: (action: ModerationAction, reason: string) => void;
  onClose: () => void;
  loading: boolean;
}) {
  const [action, setAction] = useState<ModerationAction>('HIDE');
  const [reason, setReason] = useState('');
  const canSubmit = reason.trim().length > 0 && !loading;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mod-title"
    >
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
        <h2 id="mod-title" className="text-lg font-bold text-gray-900 mb-1">
          Moderasi Produk
        </h2>
        <p className="mb-5 text-sm text-gray-500 line-clamp-1">{product.name}</p>

        {/* Action radio group */}
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-medium text-gray-700">Tindakan</legend>
          <div className="space-y-2">
            {MODERATION_OPTIONS.map((opt) => (
              <label
                key={opt.value}
                className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition ${
                  action === opt.value
                    ? 'border-(--color-primary) bg-green-50'
                    : 'border-gray-200 hover:border-gray-300'
                }`}
              >
                <input
                  type="radio"
                  name="mod-action"
                  value={opt.value}
                  checked={action === opt.value}
                  onChange={() => setAction(opt.value)}
                  className="mt-0.5"
                />
                <div>
                  <p className={`text-sm font-medium ${opt.danger ? 'text-red-700' : 'text-gray-800'}`}>
                    {opt.label}
                  </p>
                  <p className="text-xs text-gray-500">{opt.description}</p>
                </div>
              </label>
            ))}
          </div>
        </fieldset>

        {/* Reason textarea */}
        <div className="mb-5">
          <label htmlFor="mod-reason" className="mb-1.5 block text-sm font-medium text-gray-700">
            Alasan <span className="text-red-500">*</span>
          </label>
          <textarea
            id="mod-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder="Jelaskan alasan tindakan moderasi ini..."
            className="w-full resize-none rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)"
          />
          {reason.trim().length === 0 && (
            <p className="mt-1 text-xs text-gray-400">Alasan wajib diisi sebelum melanjutkan.</p>
          )}
        </div>

        <div className="flex gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            Batal
          </button>
          <button
            type="button"
            onClick={() => onConfirm(action, reason.trim())}
            disabled={!canSubmit}
            className="flex-1 rounded-xl bg-(--color-primary) py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Memproses...
              </span>
            ) : (
              'Terapkan'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Table row skeleton
// ---------------------------------------------------------------------------
function RowSkeleton() {
  return (
    <tr className="animate-pulse">
      <td className="px-4 py-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-lg bg-gray-100 shrink-0" />
          <div className="h-4 w-36 rounded bg-gray-100" />
        </div>
      </td>
      <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-8 rounded bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-5 w-20 rounded-full bg-gray-100" /></td>
      <td className="px-4 py-3"><div className="h-4 w-20 rounded bg-gray-100" /></td>
      <td className="px-4 py-3">
        <div className="flex justify-end gap-2">
          <div className="h-7 w-12 rounded-lg bg-gray-100" />
          <div className="h-7 w-20 rounded-lg bg-gray-100" />
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Status filter options
// ---------------------------------------------------------------------------
const STATUS_OPTIONS: { value: ProductStatus | ''; label: string }[] = [
  { value: '', label: 'Semua Status' },
  { value: 'ACTIVE', label: 'Aktif' },
  { value: 'OUT_OF_STOCK', label: 'Stok Habis' },
  { value: 'HIDDEN', label: 'Disembunyikan' },
  { value: 'REMOVED_BY_ADMIN', label: 'Dihapus Admin' },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function AdminCatalogPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();

  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [totalItems, setTotalItems] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Filters
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<ProductStatus | ''>('');
  const [jastiperIdFilter, setJastiperIdFilter] = useState('');
  const [page, setPage] = useState(0); // 0-based for Spring Pageable
  const PAGE_SIZE = 20;

  // Moderation
  const [moderateTarget, setModerateTarget] = useState<ProductResponse | null>(null);
  const [moderating, setModerating] = useState(false);

  // Toast
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  // Add Category States
  const [isCategoryOpen, setIsCategoryOpen] = useState(false);
  const [categoryName, setCategoryName] = useState('');
  const [categoryCreating, setCategoryCreating] = useState(false);

  // ---------------------------------------------------------------------------
  // Auth guard — ADMIN only
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading) {
      if (!accessToken) { router.replace('/login'); return; }
      if (user && user.role !== 'ADMIN') { router.replace('/'); }
    }
  }, [authLoading, accessToken, user, router]);

  // ---------------------------------------------------------------------------
  // Fetch products
  // ---------------------------------------------------------------------------
  const fetchProducts = useCallback(() => {
    if (!accessToken) return;
    setLoading(true);
    setFetchError('');

    adminGetAllProducts(accessToken, {
      q: search || undefined,
      status: statusFilter || undefined,
      jastiperId: jastiperIdFilter.trim() || undefined,
      page,
      size: PAGE_SIZE,
      sort: 'createdAt,desc',
    })
      .then((data) => {
        setProducts(data.data);
        setTotalItems(data.pagination.total);
        setTotalPages(data.pagination.total_pages);
      })
      .catch((err) => {
        setFetchError(isApiError(err) ? err.message : 'Gagal memuat produk.');
      })
      .finally(() => setLoading(false));
  }, [accessToken, user, search, statusFilter, jastiperIdFilter, page]);

useEffect(() => {
    if (!authLoading && accessToken) {
      fetchProducts();
    }
  }, [authLoading, accessToken, fetchProducts]);

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(searchInput);
      setPage(0);
    }, 300);
    return () => clearTimeout(t);
  }, [searchInput]);

  // ---------------------------------------------------------------------------
  // Moderation submit
  // ---------------------------------------------------------------------------
  async function handleModerate(action: ModerationAction, reason: string) {
    if (!accessToken || !moderateTarget) return;
    const tgt = moderateTarget as any;
    const currentId = tgt.productId || tgt.product_id;
    setModerating(true);
    try {
      const updated = await adminModerateProduct(
        accessToken,
        currentId,
        action,
        reason
      );
      const updatedId = updated.productId || (updated as any).product_id;
      setProducts((prev) =>
        prev.map((p) => ((p.productId || (p as any).product_id) === updatedId ? updated : p))
      );
      setModerateTarget(null);
      const actionLabel =
        MODERATION_OPTIONS.find((o) => o.value === action)?.label ?? action;
      setToast({
        message: `Produk berhasil di-${actionLabel.toLowerCase()}`,
        type: 'success',
      });
    } catch (err) {
      setToast({
        message: isApiError(err) ? err.message : 'Gagal melakukan moderasi',
        type: 'error',
      });
    } finally {
      setModerating(false);
    }
  }

  async function handleCreateCategory(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken || !categoryName.trim()) return;

    setCategoryCreating(true);
    try {
      await adminCreateCategory(accessToken, { name: categoryName.trim() });

      setToast({ message: 'Kategori baru berhasil ditambahkan!', type: 'success' });
      setCategoryName('');
      setIsCategoryOpen(false);

      fetchProducts();
    } catch (err) {
      setToast({
        message: isApiError(err) ? err.message : 'Gagal menambahkan kategori',
        type: 'error',
      });
    } finally {
      setCategoryCreating(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-(--color-primary) border-t-transparent" />
      </div>
    );
  }

  if (!accessToken) return null;
  if (user && user.role !== 'ADMIN') return null;

  const displayPage = page + 1;
  const selectCls =
    'rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">
            JSON
          </Link>
          <nav className="flex items-center gap-4 overflow-x-auto">
            <Link href="/admin/dashboard" className="shrink-0 text-sm text-white/80 hover:text-white">
              Dashboard
            </Link>
            <Link href="/admin/users" className="shrink-0 text-sm text-white/80 hover:text-white">
              Pengguna
            </Link>
            <Link href="/admin/kyc" className="shrink-0 text-sm text-white/80 hover:text-white">
              KYC
            </Link>
            <Link href="/admin/catalog" className="shrink-0 text-sm font-semibold text-white">
              Produk
            </Link>
            <Link href="/admin/orders" className="shrink-0 text-sm text-white/80 hover:text-white">
              Pesanan
            </Link>
            <Link href="/admin/wallet" className="shrink-0 text-sm text-white/80 hover:text-white">
              Keuangan
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-7xl px-4 py-8">
        {/* Page header */}
        <div className="mb-6 flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Semua Produk</h1>
            {!loading && (
                <p className="mt-1 text-sm text-gray-500">{totalItems} produk terdaftar</p>
            )}
          </div>

          <button
              onClick={() => setIsCategoryOpen(true)}
              className="rounded-xl bg-(--color-primary) px-4 py-2 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition shadow-sm"
          >
            + Kategori
          </button>
        </div>

        {/* Filters */}
        <div className="mb-5 flex flex-wrap gap-3">
          {/* Search */}
          <div className="relative flex-1 min-w-52">
            <input
              type="text"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              placeholder="Cari nama produk..."
              className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)"
            />
            <svg
              className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ProductStatus | '');
              setPage(0);
            }}
            className={selectCls}
          >
            {STATUS_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>

          {/* Jastiper ID filter */}
          <input
            type="text"
            value={jastiperIdFilter}
            onChange={(e) => {
              setJastiperIdFilter(e.target.value);
              setPage(0);
            }}
            placeholder="Filter Jastiper ID (UUID)..."
            className="w-64 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)"
          />
        </div>

        {/* Fetch error */}
        {fetchError && (
          <div
            role="alert"
            className="mb-4 flex items-center justify-between rounded-xl bg-red-50 px-4 py-3 text-sm text-red-600"
          >
            <span>{fetchError}</span>
            <button onClick={fetchProducts} className="ml-2 underline">
              Coba lagi
            </button>
          </div>
        )}

        {/* Table */}
        <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Produk
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Jastiper
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Harga
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Stok
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Status
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Tgl. Beli
                  </th>
                  <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Aksi
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {loading ? (
                  Array.from({ length: 8 }).map((_, i) => <RowSkeleton key={i} />)
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-16 text-center">
                      <svg
                        className="mx-auto mb-3 h-10 w-10 text-gray-300"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={1}
                          d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4"
                        />
                      </svg>
                      <p className="text-gray-500">Tidak ada produk ditemukan</p>
                    </td>
                  </tr>
                ) : (
                  products.map((product) => {
                    const p = product as any;
                    const currentId = p.productId || p.product_id;
                    const purchaseDate = p.purchaseDate || p.purchase_date || '';
                    const jastiperUserId = p.jastiper?.userId || p.jastiper?.user_id || '';
                    const jastiperUsername = p.jastiper?.username;

                    return (
                      <tr key={currentId} className="transition hover:bg-gray-50">
                        {/* Product name + thumbnail */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100">
                              {p.images && p.images[0] ? (
                                <img
                                  src={p.images[0]}
                                  alt={p.name}
                                  className="h-full w-full object-cover"
                                />
                              ) : (
                                <div className="flex h-full w-full items-center justify-center text-gray-300">
                                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      strokeWidth={1}
                                      d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="min-w-0">
                              <Link
                                href={`/catalog/${currentId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="line-clamp-1 font-medium text-gray-900 transition hover:text-(--color-primary)"
                              >
                                {p.name}
                              </Link>
                              {p.category && (
                                <p className="text-xs text-gray-400">{p.category.name || 'Uncategorized'}</p>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Jastiper */}
                        <td className="px-4 py-3">
                          {jastiperUsername ? (
                            <Link
                              href={`/jastiper/${jastiperUsername}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-sm text-gray-700 transition hover:text-(--color-primary)"
                            >
                              {jastiperUsername}
                            </Link>
                          ) : (
                            <span className="font-mono text-xs text-gray-400">
                              {jastiperUserId ? `${jastiperUserId.slice(0, 8)}…` : '-'}
                            </span>
                          )}
                        </td>

                        {/* Price */}
                        <td className="px-4 py-3 text-sm font-medium text-gray-800">
                          {formatRupiah(p.price)}
                        </td>

                        {/* Stock */}
                        <td className="px-4 py-3">
                          <span
                            className={`text-sm font-medium ${
                              p.stock === 0 ? 'text-red-500' : 'text-gray-700'
                            }`}
                          >
                            {p.stock}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="px-4 py-3">
                          <StatusBadge status={p.status} />
                        </td>

                        {/* Purchase date */}
                        <td className="px-4 py-3 text-xs text-gray-500">
                          {purchaseDate ? formatDate(purchaseDate) : '-'}
                        </td>

                        {/* Actions */}
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/catalog/${currentId}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700 transition hover:bg-gray-50"
                            >
                              Lihat
                            </Link>
                            <button
                              onClick={() => setModerateTarget(product)}
                              className="rounded-lg border border-(--color-primary) px-3 py-1 text-xs font-medium text-(--color-primary) transition hover:bg-green-50"
                            >
                              Moderasi
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Pagination */}
        {!loading && totalPages > 1 && (
          <div className="mt-5 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Halaman {displayPage} dari {totalPages} &mdash; {totalItems} produk
            </p>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page <= 0}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                «
              </button>
              <button
                onClick={() => setPage((p) => Math.max(0, p - 1))}
                disabled={page <= 0}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                ← Sebelumnya
              </button>

              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                const start = Math.max(0, Math.min(page - 2, totalPages - 5));
                return start + i;
              }).map((p) => (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  className={`rounded-lg border px-3 py-1.5 text-sm ${
                    p === page
                      ? 'border-(--color-primary) bg-(--color-primary) text-white'
                      : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {p + 1}
                </button>
              ))}

              <button
                onClick={() => setPage((p) => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                Berikutnya →
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="rounded-lg border border-gray-300 px-2.5 py-1.5 text-xs text-gray-700 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
              >
                »
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Moderation modal */}
      {moderateTarget && (
        <ModerationModal
          product={moderateTarget}
          onConfirm={handleModerate}
          onClose={() => setModerateTarget(null)}
          loading={moderating}
        />
      )}

      {/* Modal Popup Tambah Kategori */}
      {isCategoryOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" role="dialog" aria-modal="true">
            <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Tambah Kategori Baru</h2>

              <form onSubmit={handleCreateCategory}>
                <div className="mb-5">
                  <label htmlFor="cat-name" className="mb-1.5 block text-sm font-medium text-gray-700">
                    Nama Kategori <span className="text-red-500">*</span>
                  </label>
                  <input
                      id="cat-name"
                      type="text"
                      required
                      value={categoryName}
                      onChange={(e) => setCategoryName(e.target.value)}
                      placeholder="Contoh: Elektronik, Pakaian, Makanan..."
                      className="w-full rounded-xl border border-gray-300 px-3 py-2.5 text-sm text-gray-900 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)"
                  />
                </div>

                <div className="flex gap-3">
                  <button
                      type="button"
                      onClick={() => { setIsCategoryOpen(false); setCategoryName(''); }}
                      disabled={categoryCreating}
                      className="flex-1 rounded-xl border border-gray-300 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
                  >
                    Batal
                  </button>
                  <button
                      type="submit"
                      disabled={categoryCreating || !categoryName.trim()}
                      className="flex-1 rounded-xl bg-(--color-primary) py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) disabled:opacity-50 transition"
                  >
                    {categoryCreating ? 'Menyimpan...' : 'Simpan'}
                  </button>
                </div>
              </form>
            </div>
          </div>
      )}

      {/* Toast */}
      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}