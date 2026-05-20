'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { getWallet, getTransactions, type WalletResponse, type TransactionSummary } from '@/services/payment.service';
import { isApiError } from '@/services/api-client';
import { Navbar } from '@/components/Navbar';
import { LoadingSpinner } from '@/components/LoadingSpinner';
import { StatusBadge } from '@/components/StatusBadge';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('id-ID', {
    day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
  });
}

export default function JastiperWalletPage() {
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useAuth();

  const [wallet, setWallet] = useState<WalletResponse | null>(null);
  const [transactions, setTransactions] = useState<TransactionSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.push('/login?redirect=/jastiper/wallet');
    }
  }, [authLoading, accessToken, router]);

  useEffect(() => {
    async function fetchData() {
      if (!accessToken) return;
      setLoading(true);
      setError('');
      try {
        const [walletData, txData] = await Promise.all([
          getWallet(accessToken),
          getTransactions(accessToken),
        ]);
        setWallet(walletData);
        setTransactions(txData);
      } catch (err) {
        if (isApiError(err)) {
          setError(err.message || 'Gagal memuat data dompet');
        } else {
          setError('Terjadi kesalahan');
        }
      } finally {
        setLoading(false);
      }
    }
    if (!authLoading && accessToken) fetchData();
  }, [authLoading, accessToken]);

  if (authLoading || !accessToken) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  const creditTotal = transactions
    .filter((t) => t.direction === 'CREDIT' && t.status === 'SUCCESS')
    .reduce((sum, t) => sum + t.amount, 0);
  const debitTotal = transactions
    .filter((t) => t.direction === 'DEBIT' && t.status === 'SUCCESS')
    .reduce((sum, t) => sum + t.amount, 0);

  return (
    <div className="min-h-screen bg-gray-50">
      <Navbar />
      <main className="mx-auto max-w-3xl px-4 py-8 space-y-6">
        <h1 className="text-2xl font-bold text-gray-900">Dompet Saya</h1>

        {loading ? (
          <div className="space-y-4">
            <div className="rounded-2xl bg-white p-6 shadow-sm animate-pulse">
              <div className="h-8 w-40 bg-gray-100 rounded" />
              <div className="h-4 w-60 bg-gray-100 rounded mt-2" />
            </div>
          </div>
        ) : error ? (
          <div className="rounded-xl bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-red-600 mb-3">{error}</p>
            <button
              onClick={() => window.location.reload()}
              className="rounded-lg bg-(--color-primary) px-4 py-2 text-sm text-white hover:bg-(--color-primary-dark) transition"
            >
              Coba lagi
            </button>
          </div>
        ) : (
          <>
            {/* Balance Card */}
            <div className="rounded-2xl bg-white p-6 shadow-sm">
              <p className="text-sm text-gray-500">Saldo Tersedia</p>
              <p className="text-3xl font-bold text-(--color-primary-dark) mt-1">
                {wallet ? formatRupiah(wallet.balance) : '-'}
              </p>
              <div className="mt-4 flex gap-4 text-sm">
                <div className="flex items-center gap-1 text-green-600">
                  <span>Pemasukan: {formatRupiah(creditTotal)}</span>
                </div>
                <div className="flex items-center gap-1 text-red-600">
                  <span>Pengeluaran: {formatRupiah(debitTotal)}</span>
                </div>
              </div>
            </div>

            {/* Quick Actions */}
            <div className="flex gap-3">
              <Link
                href="/jastiper/wallet/topup"
                className="flex-1 rounded-xl bg-(--color-primary) px-4 py-3 text-center text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
              >
                Top-Up
              </Link>
              <Link
                href="/jastiper/wallet/withdraw"
                className="flex-1 rounded-xl border border-(--color-primary) px-4 py-3 text-center text-sm font-semibold text-(--color-primary) hover:bg-(--color-primary)/5 transition"
              >
                Tarik Saldo
              </Link>
            </div>

            {/* Transaction History */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Riwayat Transaksi</h2>
              {transactions.length === 0 ? (
                <div className="rounded-xl bg-white p-6 text-center shadow-sm">
                  <p className="text-sm text-gray-500">Belum ada transaksi</p>
                </div>
              ) : (
                <div className="space-y-2">
                  {transactions.map((tx) => (
                    <div key={tx.transaction_id} className="rounded-xl bg-white p-4 shadow-sm flex items-center justify-between">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-gray-900">{tx.description || tx.type}</p>
                        <p className="text-xs text-gray-500 mt-0.5">{formatDate(tx.created_at)}</p>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        <p className={`text-sm font-bold ${tx.direction === 'CREDIT' ? 'text-green-600' : 'text-red-600'}`}>
                          {tx.direction === 'CREDIT' ? '+' : '-'}{formatRupiah(tx.amount)}
                        </p>
                        <StatusBadge status={tx.status} type="transaction" />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}
