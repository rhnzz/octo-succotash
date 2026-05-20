import type { TransactionSummary } from '@/services/payment.service';

type TransactionRowProps = {
  transaction: TransactionSummary;
  onClick?: () => void;
};

const TYPE_LABEL: Record<string, string> = {
  TOPUP: 'Top-Up',
  PAYMENT: 'Pembayaran',
  REFUND: 'Refund',
  EARNING: 'Penghasilan',
  WITHDRAWAL: 'Penarikan',
  ADJUSTMENT: 'Penyesuaian',
};

const STATUS_CLS: Record<string, string> = {
  PENDING: 'bg-yellow-100 text-yellow-700',
  SUCCESS: 'bg-green-100 text-green-700',
  FAILED: 'bg-red-100 text-red-700',
  CANCELLED: 'bg-gray-100 text-gray-600',
};

const STATUS_LABEL: Record<string, string> = {
  PENDING: 'Menunggu',
  SUCCESS: 'Berhasil',
  FAILED: 'Gagal',
  CANCELLED: 'Dibatalkan',
};

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function TransactionRow({ transaction, onClick }: TransactionRowProps) {
  const isCredit = transaction.direction === 'CREDIT';

  return (
    <div
      className={`flex items-center gap-3 rounded-xl bg-white px-4 py-3.5 shadow-sm ${onClick ? 'hover:shadow-md cursor-pointer transition' : ''}`}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
      onKeyDown={onClick ? (e) => { if (e.key === 'Enter') onClick(); } : undefined}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full ${
          isCredit ? 'bg-green-100 text-green-600' : 'bg-red-100 text-red-500'
        }`}
        aria-hidden="true"
      >
        {isCredit ? '\u2193' : '\u2191'}
      </span>

      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-gray-900 truncate">
          {TYPE_LABEL[transaction.type] ?? transaction.type}
        </p>
        <p className="text-xs text-gray-400">
          {transaction.description || formatDate(transaction.created_at)}
        </p>
        {transaction.description && (
          <p className="text-xs text-gray-400">{formatDate(transaction.created_at)}</p>
        )}
      </div>

      <div className="text-right shrink-0">
        <p className={`text-sm font-semibold ${isCredit ? 'text-green-600' : 'text-red-500'}`}>
          {isCredit ? '+' : '\u2212'} {formatRupiah(transaction.amount)}
        </p>
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
            STATUS_CLS[transaction.status] ?? 'bg-gray-100 text-gray-600'
          }`}
        >
          {STATUS_LABEL[transaction.status] ?? transaction.status}
        </span>
      </div>
    </div>
  );
}
