'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import {
  getMyKycStatus,
  submitKyc,
  isApiError,
  type KycStatus,
  type KycStatusResponse,
  type KycSocialMediaLink,
} from '@/services/auth.service';

// ---------------------------------------------------------------------------
// KYC status banner
// ---------------------------------------------------------------------------
function KycStatusBanner({
  status,
  rejectionReason,
}: {
  status: KycStatus;
  rejectionReason?: string | null;
}) {
  if (status === 'APPROVED') {
    return (
      <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-4 text-sm text-green-800">
        <p className="font-semibold">✓ KYC Anda telah disetujui</p>
        <p className="mt-1 text-green-700">Akun Anda telah terverifikasi sebagai Jastiper.</p>
      </div>
    );
  }
  if (status === 'PENDING_VERIFICATION') {
    return (
      <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-4 text-sm text-yellow-800">
        <p className="font-semibold">⏳ KYC Anda sedang ditinjau oleh admin</p>
        <p className="mt-1 text-yellow-700">Proses verifikasi biasanya memakan waktu 1–3 hari kerja.</p>
      </div>
    );
  }
  if (status === 'REJECTED') {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-4 text-sm text-red-800">
        <p className="font-semibold">✗ KYC Anda ditolak</p>
        {rejectionReason && (
          <p className="mt-1 text-red-700">Alasan: {rejectionReason}</p>
        )}
        <p className="mt-2 text-red-700">Silakan perbaiki data Anda dan ajukan ulang.</p>
      </div>
    );
  }
  return null;
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function KycPage() {
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useAuth();

  const [kycStatus, setKycStatus] = useState<KycStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Form fields
  const [fullNameKtp, setFullNameKtp] = useState('');
  const [ktpNumber, setKtpNumber] = useState('');
  const [ktpPhotoUrl, setKtpPhotoUrl] = useState('');
  const [selfieUrl, setSelfieUrl] = useState('');
  const [bio, setBio] = useState('');
  const [socialLinks, setSocialLinks] = useState<KycSocialMediaLink[]>([
    { platform: '', url: '' },
  ]);

  // Validation
  const [ktpError, setKtpError] = useState('');

  // Submit state
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');
  const [submitSuccess, setSubmitSuccess] = useState(false);

  // ---------------------------------------------------------------------------
  // Redirect if not authenticated
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login');
    }
  }, [authLoading, accessToken, router]);

  // ---------------------------------------------------------------------------
  // Fetch current KYC status
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (authLoading || !accessToken) return;

    let cancelled = false;
    setLoadingStatus(true);

    getMyKycStatus(accessToken)
      .then((data) => {
        if (!cancelled) setKycStatus(data);
      })
      .catch((err) => {
        // 404 = no KYC submitted yet — that's fine, show the form
        if (isApiError(err) && err.status === 404) {
          if (!cancelled) setKycStatus(null);
        }
        // Other errors: silently ignore, show form anyway
      })
      .finally(() => {
        if (!cancelled) setLoadingStatus(false);
      });

    return () => { cancelled = true; };
  }, [authLoading, accessToken]);

  // ---------------------------------------------------------------------------
  // Social links helpers
  // ---------------------------------------------------------------------------
  function addSocialLink() {
    setSocialLinks((prev) => [...prev, { platform: '', url: '' }]);
  }

  function removeSocialLink(index: number) {
    if (socialLinks.length <= 1) return; // minimum 1
    setSocialLinks((prev) => prev.filter((_, i) => i !== index));
  }

  function updateSocialLink(index: number, field: keyof KycSocialMediaLink, value: string) {
    setSocialLinks((prev) =>
      prev.map((link, i) => (i === index ? { ...link, [field]: value } : link))
    );
  }

  // ---------------------------------------------------------------------------
  // KTP number validation
  // ---------------------------------------------------------------------------
  function handleKtpChange(val: string) {
    // Only allow digits
    const digits = val.replace(/\D/g, '');
    setKtpNumber(digits);
    if (digits.length > 0 && digits.length !== 16) {
      setKtpError('Nomor KTP harus tepat 16 digit');
    } else {
      setKtpError('');
    }
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!accessToken) return;

    // Validate KTP
    if (ktpNumber.length !== 16) {
      setKtpError('Nomor KTP harus tepat 16 digit');
      return;
    }

    // Validate social links
    const validLinks = socialLinks.filter((l) => l.platform.trim() && l.url.trim());
    if (validLinks.length === 0) {
      setSubmitError('Minimal satu tautan media sosial harus diisi.');
      return;
    }

    setSubmitError('');
    setIsSubmitting(true);

    try {
      await submitKyc(accessToken, {
        full_name_ktp: fullNameKtp.trim(),
        ktp_number: ktpNumber,
        ktp_photo_url: ktpPhotoUrl.trim(),
        selfie_with_ktp_url: selfieUrl.trim(),
        social_media_links: validLinks,
        bio: bio.trim() || undefined,
      });

      setSubmitSuccess(true);
      // Refresh KYC status
      setKycStatus({
        kyc_id: '',
        status: 'PENDING_VERIFICATION',
        submitted_at: new Date().toISOString(),
        reviewed_at: null,
        rejection_reason: null,
      });
    } catch (err) {
      if (isApiError(err)) {
        setSubmitError(err.message || 'Gagal mengirim KYC.');
      } else {
        setSubmitError('Tidak dapat terhubung ke server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------
  if (authLoading || loadingStatus) {
    return (
      <main className="min-h-screen bg-gray-50 flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-lg rounded-2xl bg-white p-8 shadow-sm animate-pulse space-y-4">
          <div className="h-6 w-48 rounded bg-gray-200" />
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
          <div className="h-10 rounded bg-gray-100" />
        </div>
      </main>
    );
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70';

  // If APPROVED — show banner only, no form
  if (kycStatus?.status === 'APPROVED') {
    return (
      <main className="min-h-screen bg-gray-50 px-4 py-12">
        <div className="mx-auto w-full max-w-lg">
          <div className="rounded-2xl bg-white p-8 shadow-sm space-y-4">
            <h1 className="text-xl font-semibold text-gray-800">Verifikasi Identitas (KYC)</h1>
            <KycStatusBanner status="APPROVED" />
          </div>
        </div>
      </main>
    );
  }

  // If PENDING — show banner, form read-only
  const isPending = kycStatus?.status === 'PENDING_VERIFICATION' && !submitSuccess;
  const isRejected = kycStatus?.status === 'REJECTED';
  const showForm = !isPending; // show form when: no KYC yet, rejected, or just submitted

  return (
    <main className="min-h-screen bg-gray-50 px-4 py-12">
      <div className="mx-auto w-full max-w-lg">
        <div className="rounded-2xl bg-white p-8 shadow-sm">
          <h1 className="mb-5 text-xl font-semibold text-gray-800">
            Verifikasi Identitas (KYC)
          </h1>

          {/* Status banner */}
          {(kycStatus || submitSuccess) && (
            <div className="mb-6">
              <KycStatusBanner
                status={submitSuccess ? 'PENDING_VERIFICATION' : kycStatus!.status}
                rejectionReason={kycStatus?.rejection_reason}
              />
            </div>
          )}

          {/* Pending — no form */}
          {isPending && (
            <p className="text-sm text-gray-500">
              Pengajuan KYC Anda sedang dalam antrian. Anda akan dihubungi setelah proses selesai.
            </p>
          )}

          {/* Form */}
          {showForm && !submitSuccess && (
            <>
              {isRejected && (
                <p className="mb-4 text-sm text-gray-600">
                  Perbaiki data di bawah dan kirim ulang pengajuan KYC Anda.
                </p>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                {/* Full name KTP */}
                <div>
                  <label htmlFor="full_name_ktp" className="mb-1 block text-sm font-medium text-gray-700">
                    Nama Lengkap (sesuai KTP) <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="full_name_ktp"
                    type="text"
                    required
                    value={fullNameKtp}
                    onChange={(e) => setFullNameKtp(e.target.value)}
                    disabled={isSubmitting}
                    className={inputClass}
                    placeholder="Nama sesuai KTP"
                  />
                </div>

                {/* KTP number */}
                <div>
                  <label htmlFor="ktp_number" className="mb-1 block text-sm font-medium text-gray-700">
                    Nomor KTP <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ktp_number"
                    type="text"
                    inputMode="numeric"
                    required
                    maxLength={16}
                    value={ktpNumber}
                    onChange={(e) => handleKtpChange(e.target.value)}
                    disabled={isSubmitting}
                    className={`${inputClass} ${ktpError ? 'border-red-400' : ''} font-mono tracking-widest`}
                    placeholder="16 digit nomor KTP"
                  />
                  {ktpError ? (
                    <p role="alert" className="mt-1 text-xs text-red-600">{ktpError}</p>
                  ) : (
                    <p className="mt-1 text-xs text-gray-400">
                      {ktpNumber.length}/16 digit
                    </p>
                  )}
                </div>

                {/* KTP photo URL */}
                <div>
                  <label htmlFor="ktp_photo_url" className="mb-1 block text-sm font-medium text-gray-700">
                    URL Foto KTP <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="ktp_photo_url"
                    type="url"
                    required
                    value={ktpPhotoUrl}
                    onChange={(e) => setKtpPhotoUrl(e.target.value)}
                    disabled={isSubmitting}
                    className={inputClass}
                    placeholder="https://..."
                  />
                  <p className="mt-1 text-xs text-gray-400">
                    Upload foto KTP ke layanan penyimpanan dan tempel URL-nya di sini.
                  </p>
                </div>

                {/* Selfie with KTP URL */}
                <div>
                  <label htmlFor="selfie_url" className="mb-1 block text-sm font-medium text-gray-700">
                    URL Selfie dengan KTP <span className="text-red-500">*</span>
                  </label>
                  <input
                    id="selfie_url"
                    type="url"
                    required
                    value={selfieUrl}
                    onChange={(e) => setSelfieUrl(e.target.value)}
                    disabled={isSubmitting}
                    className={inputClass}
                    placeholder="https://..."
                  />
                </div>

                {/* Social media links */}
                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-sm font-medium text-gray-700">
                      Tautan Media Sosial <span className="text-red-500">*</span>
                    </label>
                    <button
                      type="button"
                      onClick={addSocialLink}
                      disabled={isSubmitting}
                      className="text-xs font-medium text-(--color-primary) hover:text-(--color-primary-dark) disabled:opacity-50"
                    >
                      + Tambah Link
                    </button>
                  </div>
                  <div className="space-y-2">
                    {socialLinks.map((link, index) => (
                      <div key={index} className="flex gap-2">
                        <input
                          type="text"
                          value={link.platform}
                          onChange={(e) => updateSocialLink(index, 'platform', e.target.value)}
                          disabled={isSubmitting}
                          className="w-32 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70"
                          placeholder="Platform"
                          required
                        />
                        <input
                          type="url"
                          value={link.url}
                          onChange={(e) => updateSocialLink(index, 'url', e.target.value)}
                          disabled={isSubmitting}
                          className="flex-1 rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70"
                          placeholder="https://..."
                          required
                        />
                        <button
                          type="button"
                          onClick={() => removeSocialLink(index)}
                          disabled={isSubmitting || socialLinks.length <= 1}
                          className="flex items-center justify-center rounded-lg border border-gray-200 px-2 text-gray-400 hover:border-red-300 hover:text-red-500 disabled:opacity-30"
                          aria-label="Hapus tautan"
                        >
                          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                  <p className="mt-1 text-xs text-gray-400">Minimal 1 tautan media sosial aktif.</p>
                </div>

                {/* Bio */}
                <div>
                  <label htmlFor="bio" className="mb-1 block text-sm font-medium text-gray-700">
                    Bio <span className="text-gray-400 font-normal">(opsional)</span>
                  </label>
                  <textarea
                    id="bio"
                    rows={3}
                    value={bio}
                    onChange={(e) => setBio(e.target.value)}
                    disabled={isSubmitting}
                    className={inputClass}
                    placeholder="Ceritakan sedikit tentang diri Anda sebagai calon Jastiper..."
                  />
                </div>

                {/* Submit error */}
                {submitError && (
                  <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
                    {submitError}
                  </p>
                )}

                {/* Submit button */}
                <button
                  type="submit"
                  disabled={isSubmitting || !!ktpError}
                  className="w-full rounded-lg bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--color-primary-dark) focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
                >
                  {isSubmitting ? 'Mengirim...' : 'Kirim KYC'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
