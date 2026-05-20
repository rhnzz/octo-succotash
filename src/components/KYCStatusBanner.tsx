import Link from 'next/link';

type KYCStatusBannerProps = {
  status: 'PENDING_VERIFICATION' | 'APPROVED' | 'REJECTED' | null;
  rejectionReason?: string;
  ctaLink?: string;
  ctaText?: string;
};

export function KYCStatusBanner({
  status,
  rejectionReason,
  ctaLink,
  ctaText,
}: KYCStatusBannerProps) {
  if (!status) return null;

  if (status === 'PENDING_VERIFICATION') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
        <span aria-hidden="true" className="mt-0.5 text-base">\u23F0</span>
        <div className="flex-1">
          <p className="font-medium">KYC Anda sedang ditinjau</p>
          <p className="mt-0.5 text-yellow-700">
            Dokumen identitas Anda sedang diproses oleh admin. Harap tunggu konfirmasi.
          </p>
        </div>
      </div>
    );
  }

  if (status === 'APPROVED') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
        <span aria-hidden="true" className="mt-0.5 text-base">\u2713</span>
        <div className="flex-1">
          <p className="font-medium">KYC Anda telah disetujui</p>
          <p className="mt-0.5 text-green-700">Anda sekarang dapat menggunakan fitur Jastiper.</p>
        </div>
      </div>
    );
  }

  if (status === 'REJECTED') {
    return (
      <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
        <span aria-hidden="true" className="mt-0.5 text-base">\u2717</span>
        <div className="flex-1">
          <p className="font-medium">KYC Anda ditolak</p>
          {rejectionReason && (
            <p className="mt-0.5 text-red-700">Alasan: {rejectionReason}</p>
          )}
          {ctaLink && (
            <Link
              href={ctaLink}
              className="mt-2 inline-block font-medium text-red-700 underline hover:text-red-900"
            >
              {ctaText ?? 'Ajukan ulang KYC'}
            </Link>
          )}
        </div>
      </div>
    );
  }

  return null;
}
