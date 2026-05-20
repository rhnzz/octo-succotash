import Link from 'next/link';
import type { Order } from '@/services/order.service';
import { StatusBadge } from './StatusBadge';

type OrderCardProps = {
  order: Order;
  viewAs: 'TITIPERS' | 'JASTIPER' | 'ADMIN';
  onAction?: (action: string, orderId: string) => void;
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

export function OrderCard({ order, viewAs, onAction }: OrderCardProps) {
  const detailHref = viewAs === 'JASTIPER'
    ? `/jastiper/orders/${order.order_id}`
    : `/orders/${order.order_id}`;

  const snapshot = order.product_snapshot;
  const counterpartyName = viewAs === 'TITIPERS'
    ? `Jastiper: ${order.jastiper_id.slice(0, 8)}...`
    : `Titipers: ${order.titipers_id.slice(0, 8)}...`;

  return (
    <div className="rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition overflow-hidden">
      <div className="flex items-start gap-4 p-4">
        {/* Product image */}
        <div className="h-16 w-16 shrink-0 rounded-lg bg-gray-100 overflow-hidden">
          {snapshot?.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={snapshot.image_url}
              alt={snapshot.name}
              className="h-full w-full object-cover"
            />
          ) : (
            <div className="flex h-full w-full items-center justify-center text-gray-300">
              <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2">
            <div>
              <Link
                href={detailHref}
                className="text-sm font-semibold text-gray-900 hover:text-(--color-primary) line-clamp-1"
              >
                {snapshot?.name ?? 'Produk'}
              </Link>
              <p className="text-xs text-gray-500 mt-0.5">{counterpartyName}</p>
            </div>
            <StatusBadge status={order.status} type="order" />
          </div>

          <div className="mt-2 flex items-center justify-between">
            <div className="text-xs text-gray-400">
              {formatDate(order.created_at)}
            </div>
            <p className="text-sm font-bold text-(--color-primary-dark)">
              {formatRupiah(order.total_price)}
            </p>
          </div>
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2 border-t border-gray-50 bg-gray-50/50 px-4 py-2">
        <Link
          href={detailHref}
          className="rounded-lg px-3 py-1.5 text-xs font-medium text-(--color-primary) hover:bg-(--color-primary)/10 transition"
        >
          Lihat Detail
        </Link>

        {viewAs === 'TITIPERS' && order.status === 'PENDING' && onAction && (
          <button
            onClick={() => onAction('pay', order.order_id)}
            className="rounded-lg bg-(--color-primary) px-3 py-1.5 text-xs font-medium text-white hover:bg-(--color-primary-dark) transition"
          >
            Bayar Sekarang
          </button>
        )}
        {viewAs === 'TITIPERS' && order.status === 'SHIPPED' && onAction && (
          <button
            onClick={() => onAction('confirm', order.order_id)}
            className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 transition"
          >
            Konfirmasi
          </button>
        )}

        {viewAs === 'JASTIPER' && order.status === 'PAID' && onAction && (
          <button
            onClick={() => onAction('purchased', order.order_id)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
          >
            Tandai Dibeli
          </button>
        )}
        {viewAs === 'JASTIPER' && order.status === 'PURCHASED' && onAction && (
          <button
            onClick={() => onAction('shipped', order.order_id)}
            className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 transition"
          >
            Tandai Dikirim
          </button>
        )}

        {onAction && ['PENDING', 'PAID', 'PURCHASED'].includes(order.status) && viewAs !== 'TITIPERS' && (
          <button
            onClick={() => onAction('cancel', order.order_id)}
            className="rounded-lg border border-red-200 px-3 py-1.5 text-xs font-medium text-red-600 hover:bg-red-50 transition"
          >
            Batalkan
          </button>
        )}
      </div>
    </div>
  );
}
