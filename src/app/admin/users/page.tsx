'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  adminListUsers,
  isApiError,
  type AdminUserListItem,
  type AccountStatus,
  type UserRole,
} from '@/services/auth.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

function RoleBadge({ role }: { role: UserRole }) {
  const map: Record<UserRole, { label: string; cls: string }> = {
    TITIPERS: { label: 'Pembeli', cls: 'bg-blue-100 text-blue-700' },
    JASTIPER: { label: 'Jastiper', cls: 'bg-purple-100 text-purple-700' },
    ADMIN: { label: 'Admin', cls: 'bg-orange-100 text-orange-700' },
  };
  const { label, cls } = map[role] ?? { label: role, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, { label: string; cls: string }> = {
    ACTIVE: { label: 'Aktif', cls: 'bg-green-100 text-green-700' },
    BANNED: { label: 'Diblokir', cls: 'bg-red-100 text-red-700' },
    PENDING_VERIFICATION: { label: 'Menunggu', cls: 'bg-yellow-100 text-yellow-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Confirm modal
// ---------------------------------------------------------------------------
function ConfirmModal({
  isOpen,
  title,
  message,
  confirmLabel,
  onConfirm,
  onClose,
  isLoading,
}: {
  isOpen: boolean;
  title: string;
  message: string;
  confirmLabel: string;
  onConfirm: () => void;
  onClose: () => void;
  isLoading: boolean;
}) {
  if (!isOpen) return null;
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="modal-title"
    >
      <div className="w-full max-w-sm rounded-xl bg-white p-6 shadow-xl">
        <h2 id="modal-title" className="text-base font-semibold text-gray-900 mb-2">{title}</h2>
        <p className="text-sm text-gray-600 mb-5">{message}</p>
        <div className="flex gap-3 justify-end">
          <button
            onClick={onClose}
            disabled={isLoading}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-50"
          >
            Batal
          </button>
          <button
            onClick={onConfirm}
            disabled={isLoading}
            className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-50"
          >
            {isLoading ? 'Memproses...' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function AdminUsersPage() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading } = useAuth();

  const [users, setUsers] = useState<AdminUserListItem[]>([]);
  const [pagination, setPagination] = useState({ page: 1, total: 0 });
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Filters
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | ''>('');
  const [statusFilter, setStatusFilter] = useState<AccountStatus | ''>('');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  // Ban/unban modal
  const [modalUser, setModalUser] = useState<AdminUserListItem | null>(null);
  const [isBanning, setIsBanning] = useState(false);
  const [actionError, setActionError] = useState('');

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading) {
      if (!accessToken) { router.push('/login'); return; }
      if (user?.role !== 'ADMIN') { router.push('/dashboard'); }
    }
  }, [authLoading, accessToken, user, router]);

  // ---------------------------------------------------------------------------
  // Fetch users
  // ---------------------------------------------------------------------------
  const fetchUsers = useCallback(async () => {
    if (!accessToken) return;
    setLoading(true);
    setFetchError('');
    try {
      const data = await adminListUsers(accessToken, {
        search: search || undefined,
        role: roleFilter || undefined,
        status: statusFilter || undefined,
        page,
        limit: LIMIT,
      });
      setUsers(data.data);
      setPagination({ page: data.pagination.page, total: data.pagination.total });
    } catch (err) {
      setFetchError(isApiError(err) ? err.message : 'Gagal memuat data pengguna.');
    } finally {
      setLoading(false);
    }
  }, [accessToken, search, roleFilter, statusFilter, page]);

  useEffect(() => {
    if (!authLoading && accessToken && user?.role === 'ADMIN') {
      fetchUsers();
    }
  }, [authLoading, accessToken, user, fetchUsers]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setSearch(searchInput);
      setPage(1);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchInput]);

  // ---------------------------------------------------------------------------
  // Ban/unban — NOTE: endpoint not documented in backend contracts.
  // Showing UI but disabling the action with a notice.
  // ---------------------------------------------------------------------------
  async function handleBanConfirm() {
    if (!modalUser) return;
    setIsBanning(true);
    setActionError('');
    try {
      // Ban/unban endpoint is TBD — not yet in backend contracts.
      // When the endpoint is confirmed, implement it here.
      setActionError('Fitur blokir/aktifkan belum tersedia (endpoint belum terdokumentasi).');
    } finally {
      setIsBanning(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  const totalPages = Math.ceil(pagination.total / LIMIT);

  const selectClass =
    'rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-700 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) bg-white';

  if (authLoading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-(--color-primary) border-t-transparent" />
      </main>
    );
  }

  return (
    <>
      <main className="min-h-screen bg-gray-50 px-4 py-8">
        <div className="mx-auto max-w-6xl">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Manajemen Pengguna</h1>
            <p className="mt-1 text-sm text-gray-500">
              {pagination.total} pengguna terdaftar
            </p>
          </div>

          {/* Filters */}
          <div className="mb-5 flex flex-wrap gap-3">
            {/* Search */}
            <div className="relative flex-1 min-w-48">
              <input
                type="text"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Cari nama, email, username..."
                className="w-full rounded-lg border border-gray-300 py-2 pl-9 pr-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary)"
              />
              <svg className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
            </div>

            {/* Role filter */}
            <select
              value={roleFilter}
              onChange={(e) => { setRoleFilter(e.target.value as UserRole | ''); setPage(1); }}
              className={selectClass}
            >
              <option value="">Semua Role</option>
              <option value="TITIPERS">Pembeli</option>
              <option value="JASTIPER">Jastiper</option>
              <option value="ADMIN">Admin</option>
            </select>

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => { setStatusFilter(e.target.value as AccountStatus | ''); setPage(1); }}
              className={selectClass}
            >
              <option value="">Semua Status</option>
              <option value="ACTIVE">Aktif</option>
              <option value="BANNED">Diblokir</option>
              <option value="PENDING_VERIFICATION">Menunggu Verifikasi</option>
            </select>
          </div>

          {/* Error */}
          {fetchError && (
            <div className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
              {fetchError}
              <button onClick={fetchUsers} className="ml-2 underline">Coba lagi</button>
            </div>
          )}

          {/* Action error */}
          {actionError && (
            <div className="mb-4 rounded-lg bg-yellow-50 border border-yellow-200 px-4 py-3 text-sm text-yellow-800">
              {actionError}
            </div>
          )}

          {/* Table */}
          <div className="rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Pengguna</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Role</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                    <th className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Bergabung</th>
                    <th className="px-4 py-3 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Aksi</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {loading ? (
                    Array.from({ length: 8 }).map((_, i) => (
                      <tr key={i} className="animate-pulse">
                        <td className="px-4 py-3"><div className="h-4 w-32 rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-40 rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-16 rounded-full bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-5 w-14 rounded-full bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-4 w-24 rounded bg-gray-100" /></td>
                        <td className="px-4 py-3"><div className="h-7 w-16 rounded bg-gray-100 ml-auto" /></td>
                      </tr>
                    ))
                  ) : users.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-12 text-center text-gray-500">
                        Tidak ada pengguna ditemukan
                      </td>
                    </tr>
                  ) : (
                    users.map((u) => (
                      <tr key={u.user_id} className="hover:bg-gray-50 transition">
                        <td className="px-4 py-3">
                          <div className="font-medium text-gray-900">
                            {u.username ?? <span className="text-gray-400 italic">—</span>}
                          </div>
                          {u.full_name && (
                            <div className="text-xs text-gray-500">{u.full_name}</div>
                          )}
                        </td>
                        <td className="px-4 py-3 text-gray-600">{u.email}</td>
                        <td className="px-4 py-3"><RoleBadge role={u.role} /></td>
                        <td className="px-4 py-3"><StatusBadge status={u.status} /></td>
                        <td className="px-4 py-3 text-gray-500 text-xs">{formatDate(u.created_at)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-2">
                            <Link
                              href={`/admin/users/${u.user_id}`}
                              className="rounded-lg border border-gray-300 px-3 py-1 text-xs text-gray-700 hover:bg-gray-50"
                            >
                              Lihat
                            </Link>
                            {/* Ban/unban — hidden for ADMIN accounts */}
                            {u.role !== 'ADMIN' && (
                              <button
                                onClick={() => { setModalUser(u); setActionError(''); }}
                                className={`rounded-lg px-3 py-1 text-xs font-medium ${
                                  u.status === 'BANNED'
                                    ? 'border border-green-300 text-green-700 hover:bg-green-50'
                                    : 'border border-red-300 text-red-700 hover:bg-red-50'
                                }`}
                              >
                                {u.status === 'BANNED' ? 'Aktifkan' : 'Blokir'}
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-5 flex items-center justify-between">
              <p className="text-sm text-gray-500">
                Menampilkan {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, pagination.total)} dari {pagination.total}
              </p>
              <div className="flex gap-2">
                <button
                  onClick={() => setPage((p) => Math.max(1, p - 1))}
                  disabled={page <= 1}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  ← Sebelumnya
                </button>
                <span className="flex items-center px-3 text-sm text-gray-600">
                  {page} / {totalPages}
                </span>
                <button
                  onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                  disabled={page >= totalPages}
                  className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  Berikutnya →
                </button>
              </div>
            </div>
          )}
        </div>
      </main>

      {/* Confirm modal */}
      <ConfirmModal
        isOpen={!!modalUser}
        title={modalUser?.status === 'BANNED' ? 'Aktifkan Akun' : 'Blokir Akun'}
        message={
          modalUser?.status === 'BANNED'
            ? `Aktifkan kembali akun ${modalUser?.username ?? modalUser?.email}?`
            : `Blokir akun ${modalUser?.username ?? modalUser?.email}? Pengguna tidak akan bisa login.`
        }
        confirmLabel={modalUser?.status === 'BANNED' ? 'Aktifkan' : 'Blokir'}
        onConfirm={handleBanConfirm}
        onClose={() => { setModalUser(null); setActionError(''); }}
        isLoading={isBanning}
      />
    </>
  );
}
