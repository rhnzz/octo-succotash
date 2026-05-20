'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useRef, useState } from 'react';

import { useAuth } from '@/lib/auth/AuthProvider';
import { useAuthorizedFetch } from '@/lib/api/useAuthorizedFetch';
import { isApiError } from '@/services/api-client';
import type { WalletResponse } from '@/services/payment.service';

function formatRupiah(amount: number): string {
  return `Rp ${amount.toLocaleString('id-ID')}`;
}

export function Navbar() {
  const router = useRouter();
  const { accessToken, user, isLoading: authLoading, clearAuth } = useAuth();
  const { authorizedFetch } = useAuthorizedFetch();

  const [showDropdown, setShowDropdown] = useState(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const fetchBalance = useCallback(async () => {
    if (!accessToken) return;
    setBalanceLoading(true);
    try {
      const data = await authorizedFetch<WalletResponse>('payment', '/wallets/me');
      setWalletBalance(data.balance);
    } catch {
      // Silently fail — wallet may not exist yet
    } finally {
      setBalanceLoading(false);
    }
  }, [accessToken, authorizedFetch]);

  const handleLogout = useCallback(async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {
      // Continue with local logout even if BFF call fails
    }
    clearAuth();
    router.push('/login');
  }, [clearAuth, router]);

  if (authLoading) {
    return (
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          <div className="h-6 w-20 rounded bg-white/20 animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3">
        {/* Logo */}
        <Link href={accessToken ? '/dashboard' : '/'} className="text-xl font-extrabold text-white">
          JSON
        </Link>

        {/* Nav links — role-based */}
        <nav className="hidden md:flex items-center gap-6">
          {accessToken && user ? (
            <>
              <Link href="/catalog" className="text-sm text-white/80 hover:text-white transition">
                Katalog
              </Link>
              {user.role === 'TITIPERS' && (
                <Link href="/orders" className="text-sm text-white/80 hover:text-white transition">
                  Pesanan
                </Link>
              )}
              {(user.role === 'JASTIPER' || user.role === 'ADMIN') && (
                <Link href={`/${user.role.toLowerCase()}/orders`} className="text-sm text-white/80 hover:text-white transition">
                  Pesanan
                </Link>
              )}
              {(user.role === 'TITIPERS' || user.role === 'JASTIPER') && (
                <Link
                  href={user.role === 'JASTIPER' ? '/jastiper/wallet' : '/wallet'}
                  className="text-sm text-white/80 hover:text-white transition"
                >
                  Dompet
                </Link>
              )}
              {user.role === 'ADMIN' && (
                <Link href="/admin/dashboard" className="text-sm text-white/80 hover:text-white transition">
                  Admin
                </Link>
              )}
            </>
          ) : (
            <>
              <Link href="/catalog" className="text-sm text-white/80 hover:text-white transition">
                Katalog
              </Link>
              <Link href="/login" className="text-sm text-white/80 hover:text-white transition">
                Masuk
              </Link>
              <Link
                href="/register"
                className="rounded-full bg-white px-4 py-1.5 text-sm font-semibold text-(--color-primary-dark) hover:bg-gray-100 transition"
              >
                Daftar
              </Link>
            </>
          )}
        </nav>

        {/* Right section — wallet + user menu */}
        {accessToken && user && (
          <div className="flex items-center gap-3">
            {/* Wallet balance */}
            <button
              onClick={fetchBalance}
              className="hidden sm:flex items-center gap-1 rounded-full bg-white/10 px-3 py-1.5 text-xs text-white hover:bg-white/20 transition"
              aria-label="Cek saldo"
            >
              {balanceLoading ? (
                <span className="h-3 w-3 animate-spin rounded-full border border-white border-t-transparent" />
              ) : walletBalance !== null ? (
                formatRupiah(walletBalance)
              ) : (
                'Saldo'
              )}
            </button>

            {/* User dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                onClick={() => setShowDropdown((prev) => !prev)}
                className="flex items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-sm text-white hover:bg-white/20 transition"
                aria-haspopup="true"
                aria-expanded={showDropdown}
              >
                <span className="hidden sm:inline">{user.username || 'User'}</span>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                </svg>
              </button>

              {showDropdown && (
                <div
                  className="absolute right-0 mt-2 w-48 rounded-xl bg-white shadow-lg ring-1 ring-black/5 py-1 z-50"
                  role="menu"
                >
                  <Link
                    href="/profile"
                    className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                    role="menuitem"
                    onClick={() => setShowDropdown(false)}
                  >
                    Profil
                  </Link>
                  {user.role === 'TITIPERS' && (
                    <Link
                      href="/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      role="menuitem"
                      onClick={() => setShowDropdown(false)}
                    >
                      Dashboard
                    </Link>
                  )}
                  {user.role === 'JASTIPER' && (
                    <Link
                      href="/jastiper/dashboard"
                      className="block px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
                      role="menuitem"
                      onClick={() => setShowDropdown(false)}
                    >
                      Dashboard
                    </Link>
                  )}
                  <hr className="my-1 border-gray-100" />
                  <button
                    onClick={() => { setShowDropdown(false); handleLogout(); }}
                    className="block w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50"
                    role="menuitem"
                  >
                    Keluar
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </header>
  );
}
