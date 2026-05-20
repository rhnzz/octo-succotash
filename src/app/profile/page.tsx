'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import {
  getMyProfile,
  updateMyProfile,
  isApiError,
  type ProfileResponse,
  type KycStatus,
  type AccountStatus,
  type UserRole,
} from '@/services/auth.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const USERNAME_PATTERN = /^[A-Za-z0-9_]*$/;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
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
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function StatusBadge({ status }: { status: AccountStatus }) {
  const map: Record<AccountStatus, { label: string; cls: string }> = {
    ACTIVE: { label: 'Aktif', cls: 'bg-green-100 text-green-700' },
    BANNED: { label: 'Diblokir', cls: 'bg-red-100 text-red-700' },
    PENDING_VERIFICATION: { label: 'Menunggu Verifikasi', cls: 'bg-yellow-100 text-yellow-700' },
  };
  const { label, cls } = map[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  );
}

function KycBanner({ status }: { status: KycStatus | null }) {
  if (!status) return null;
  if (status === 'APPROVED') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        ✓ KYC Anda telah disetujui.
      </div>
    );
  }
  if (status === 'PENDING_VERIFICATION') {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        ⏳ KYC Anda sedang ditinjau oleh admin.
      </div>
    );
  }
  if (status === 'REJECTED') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        ✗ KYC Anda ditolak.{' '}
        <Link href="/profile/kyc" className="font-medium underline">
          Ajukan ulang
        </Link>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ProfilePage() {
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useAuth();
  const { authorizedFetch } = useAuthorizedFetch();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState('');

  // Form state
  const [username, setUsername] = useState('');
  const [fullName, setFullName] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profilePictureUrl, setProfilePictureUrl] = useState('');

  // Dirty tracking
  const originalRef = useRef<{ username: string; fullName: string; phoneNumber: string; profilePictureUrl: string } | null>(null);

  // Save state
  const [isSaving, setIsSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  // Username validation
  const [usernameError, setUsernameError] = useState('');

  // ---------------------------------------------------------------------------
  // Redirect if not authenticated
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login');
    }
  }, [authLoading, accessToken, router]);

  // ---------------------------------------------------------------------------
  // Fetch profile
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authLoading || !accessToken) return;

    let cancelled = false;
    setLoading(true);
    setFetchError('');

    getMyProfile(accessToken)
      .then((data) => {
        if (cancelled) return;
        setProfile(data);
        setUsername(data.username ?? '');
        setFullName(data.full_name ?? '');
        setPhoneNumber(data.phone_number ?? '');
        setProfilePictureUrl(data.profile_picture_url ?? '');
        originalRef.current = {
          username: data.username ?? '',
          fullName: data.full_name ?? '',
          phoneNumber: data.phone_number ?? '',
          profilePictureUrl: data.profile_picture_url ?? '',
        };
      })
      .catch((err) => {
        if (cancelled) return;
        setFetchError(isApiError(err) ? err.message : 'Gagal memuat profil.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => { cancelled = true; };
  }, [authLoading, accessToken]);

  // ---------------------------------------------------------------------------
  // Beforeunload warning when form is dirty
  // ---------------------------------------------------------------------------
  useEffect(() => {
    const isDirty = () =>
      originalRef.current !== null && (
        username !== originalRef.current.username ||
        fullName !== originalRef.current.fullName ||
        phoneNumber !== originalRef.current.phoneNumber ||
        profilePictureUrl !== originalRef.current.profilePictureUrl
      );

    const handler = (e: BeforeUnloadEvent) => {
      if (isDirty()) {
        e.preventDefault();
      }
    };
    window.addEventListener('beforeunload', handler);
    return () => window.removeEventListener('beforeunload', handler);
  }, [username, fullName, phoneNumber, profilePictureUrl]);

  // ---------------------------------------------------------------------------
  // Handlers
  // ---------------------------------------------------------------------------
  function handleUsernameChange(val: string) {
    setUsername(val);
    if (val && !USERNAME_PATTERN.test(val)) {
      setUsernameError('Hanya huruf, angka, dan underscore yang diperbolehkan');
    } else if (val.length > 30) {
      setUsernameError('Maksimal 30 karakter');
    } else {
      setUsernameError('');
    }
  }

  async function handleSave(formData: FormData) {
    if (usernameError) return;
    setSaveError('');
    setSaveSuccess(false);
    setIsSaving(true);

    const input = {
      username: String(formData.get('username') ?? '').trim() || undefined,
      full_name: String(formData.get('full_name') ?? '').trim() || undefined,
      phone_number: String(formData.get('phone_number') ?? '').trim() || undefined,
      profile_picture_url: String(formData.get('profile_picture_url') ?? '').trim() || undefined,
    };

    try {
      const updated = await authorizedFetch<ProfileResponse>('auth', '/profile/me', {
        method: 'PATCH',
        body: input,
      });
      setProfile(updated);
      setUsername(updated.username ?? '');
      setFullName(updated.full_name ?? '');
      setPhoneNumber(updated.phone_number ?? '');
      setProfilePictureUrl(updated.profile_picture_url ?? '');
      originalRef.current = {
        username: updated.username ?? '',
        fullName: updated.full_name ?? '',
        phoneNumber: updated.phone_number ?? '',
        profilePictureUrl: updated.profile_picture_url ?? '',
      };
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch (err) {
      if (isApiError(err)) {
        setSaveError(err.message || 'Gagal menyimpan profil.');
      } else {
        setSaveError('Tidak dapat terhubung ke server.');
      }
    } finally {
      setIsSaving(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (authLoading || loading) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm animate-pulse space-y-4">
          <div className="h-16 w-16 rounded-full bg-gray-200 mx-auto" />
          <div className="h-5 w-40 rounded bg-gray-200 mx-auto" />
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
        </div>
      </main>
    );
  }

  if (fetchError) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4">
        <div className="text-center">
          <p className="text-red-600 mb-4">{fetchError}</p>
          <button
            onClick={() => window.location.reload()}
            className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark)"
          >
            Coba lagi
          </button>
        </div>
      </main>
    );
  }

  if (!profile) return null;

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70';

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl bg-white p-8 shadow-sm">

          {/* Avatar */}
          <div className="mb-6 flex flex-col items-center gap-3">
            <div className="relative">
              {profilePictureUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={profilePictureUrl}
                  alt="Foto profil"
                  className="h-20 w-20 rounded-full object-cover border-2 border-(--color-primary)"
                />
              ) : (
                <div className="h-20 w-20 rounded-full bg-(--color-primary) flex items-center justify-center text-white text-2xl font-bold">
                  {(profile.username ?? profile.email)[0].toUpperCase()}
                </div>
              )}
            </div>
            <div className="flex items-center gap-2">
              <RoleBadge role={profile.role} />
              <StatusBadge status={profile.status} />
            </div>
            <p className="text-xs text-gray-400">
              Bergabung sejak {formatDate(profile.created_at)}
            </p>
          </div>

          {/* KYC banner */}
          {profile.kyc_status && (
            <div className="mb-5">
              <KycBanner status={profile.kyc_status} />
            </div>
          )}

          {/* KYC link for TITIPERS without KYC */}
          {profile.role === 'TITIPERS' && !profile.kyc_status && (
            <div className="mb-5 rounded-lg border border-gray-200 bg-gray-50 px-4 py-3 text-sm text-gray-600">
              Ingin menjadi Jastiper?{' '}
              <Link href="/profile/kyc" className="font-medium text-(--color-primary-dark) hover:underline">
                Ajukan KYC
              </Link>
            </div>
          )}

          {/* Success toast */}
          {saveSuccess && (
            <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
              ✓ Profil berhasil diperbarui
            </div>
          )}

          <h1 className="mb-5 text-lg font-semibold text-gray-800">Edit Profil</h1>

          <form action={handleSave} className="space-y-4">
            {/* Username */}
            <div>
              <label htmlFor="username" className="mb-1 block text-sm font-medium text-gray-700">
                Username
              </label>
              <input
                id="username"
                name="username"
                type="text"
                maxLength={30}
                value={username}
                onChange={(e) => handleUsernameChange(e.target.value)}
                disabled={isSaving}
                className={`${inputClass} ${usernameError ? 'border-red-400' : ''}`}
                placeholder="username_kamu"
              />
              {usernameError ? (
                <p role="alert" className="mt-1 text-xs text-red-600">{usernameError}</p>
              ) : (
                <p className="mt-1 text-xs text-gray-400">
                  Maks. 30 karakter. Huruf, angka, dan underscore saja.
                </p>
              )}
            </div>

            {/* Full name */}
            <div>
              <label htmlFor="full_name" className="mb-1 block text-sm font-medium text-gray-700">
                Nama Lengkap
              </label>
              <input
                id="full_name"
                name="full_name"
                type="text"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isSaving}
                className={inputClass}
                placeholder="Nama lengkap Anda"
              />
            </div>

            {/* Phone */}
            <div>
              <label htmlFor="phone_number" className="mb-1 block text-sm font-medium text-gray-700">
                Nomor Telepon
              </label>
              <input
                id="phone_number"
                name="phone_number"
                type="tel"
                value={phoneNumber}
                onChange={(e) => setPhoneNumber(e.target.value)}
                disabled={isSaving}
                className={inputClass}
                placeholder="08xxxxxxxxxx"
              />
            </div>

            {/* Profile picture URL */}
            <div>
              <label htmlFor="profile_picture_url" className="mb-1 block text-sm font-medium text-gray-700">
                URL Foto Profil
              </label>
              <input
                id="profile_picture_url"
                name="profile_picture_url"
                type="url"
                value={profilePictureUrl}
                onChange={(e) => setProfilePictureUrl(e.target.value)}
                disabled={isSaving}
                className={inputClass}
                placeholder="https://..."
              />
            </div>

            {/* Email (read-only) */}
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">
                Email
              </label>
              <input
                type="email"
                value={profile.email}
                readOnly
                className="w-full rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-sm text-gray-500 cursor-not-allowed"
              />
              <p className="mt-1 text-xs text-gray-400">Email tidak dapat diubah.</p>
            </div>

            {/* Save error */}
            {saveError && (
              <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                {saveError}
              </p>
            )}

            {/* Save button */}
            <button
              type="submit"
              disabled={isSaving || !!usernameError}
              className="w-full rounded-lg bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--color-primary-dark) focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </form>
        </div>
      </div>
    </main>
  );
}
