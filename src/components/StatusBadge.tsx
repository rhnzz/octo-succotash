type StatusBadgeType = 'order' | 'product' | 'user' | 'kyc' | 'transaction';

type StatusBadgeProps = {
  status: string;
  type?: StatusBadgeType;
};

const COLOR_MAP: Record<string, string> = {
  ACTIVE: 'bg-green-100 text-green-700',
  COMPLETED: 'bg-green-100 text-green-700',
  SUCCESS: 'bg-green-100 text-green-700',
  APPROVED: 'bg-green-100 text-green-700',
  PENDING: 'bg-yellow-100 text-yellow-700',
  PENDING_VERIFICATION: 'bg-yellow-100 text-yellow-700',
  HIDDEN: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-red-100 text-red-700',
  REJECTED: 'bg-red-100 text-red-700',
  FAILED: 'bg-red-100 text-red-700',
  SHIPPED: 'bg-blue-100 text-blue-700',
  PURCHASED: 'bg-blue-100 text-blue-700',
  REFUNDING: 'bg-orange-100 text-orange-700',
  REMOVED_BY_ADMIN: 'bg-red-200 text-red-800',
  BANNED: 'bg-red-200 text-red-800',
  OUT_OF_STOCK: 'bg-gray-100 text-gray-600',
  REFUND_FAILED: 'bg-red-100 text-red-700',
};

const LABEL_MAP: Record<string, string> = {
  ACTIVE: 'Aktif',
  COMPLETED: 'Selesai',
  SUCCESS: 'Berhasil',
  APPROVED: 'Disetujui',
  PENDING: 'Menunggu',
  PENDING_VERIFICATION: 'Menunggu Verifikasi',
  HIDDEN: 'Tersembunyi',
  CANCELLED: 'Dibatalkan',
  REJECTED: 'Ditolak',
  FAILED: 'Gagal',
  SHIPPED: 'Dikirim',
  PURCHASED: 'Dibeli',
  REFUNDING: 'Refund',
  REMOVED_BY_ADMIN: 'Dihapus Admin',
  BANNED: 'Diblokir',
  OUT_OF_STOCK: 'Stok Habis',
  REFUND_FAILED: 'Refund Gagal',
};

export function StatusBadge({ status, type }: StatusBadgeProps) {
  const color = COLOR_MAP[status] ?? 'bg-gray-100 text-gray-600';
  const label = LABEL_MAP[status] ?? status;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${color}`}
      data-status={status}
      data-type={type}
    >
      {label}
    </span>
  );
}
