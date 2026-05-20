'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

type SidebarProps = {
  role: 'JASTIPER' | 'ADMIN';
};

const JASTIPER_LINKS = [
  { href: '/jastiper/dashboard', label: 'Dashboard', icon: '\u2302' },
  { href: '/jastiper/catalog', label: 'Katalog Saya', icon: '\u2630' },
  { href: '/jastiper/orders', label: 'Pesanan Masuk', icon: '\u2709' },
  { href: '/jastiper/wallet', label: 'Dompet', icon: '\u25CB' },
];

const ADMIN_LINKS = [
  { href: '/admin/dashboard', label: 'Dashboard', icon: '\u2302' },
  { href: '/admin/users', label: 'Pengguna', icon: '\u263A' },
  { href: '/admin/kyc', label: 'Verifikasi KYC', icon: '\u2713' },
  { href: '/admin/catalog', label: 'Produk', icon: '\u2630' },
  { href: '/admin/orders', label: 'Pesanan', icon: '\u2709' },
  { href: '/admin/wallet/summary', label: 'Dompet', icon: '\u25CB' },
  { href: '/admin/wallet/requests', label: 'Permintaan', icon: '\u2191' },
  { href: '/admin/wallet/transactions', label: 'Transaksi', icon: '\u2261' },
];

export function Sidebar({ role }: SidebarProps) {
  const pathname = usePathname();
  const links = role === 'ADMIN' ? ADMIN_LINKS : JASTIPER_LINKS;

  return (
    <aside
      className="hidden md:flex w-60 shrink-0 flex-col bg-(--color-primary) text-white min-h-screen"
      aria-label="Navigasi sidebar"
    >
      <div className="p-4">
        <Link href="/" className="text-lg font-extrabold">
          JSON {role === 'ADMIN' ? 'Admin' : 'Jastiper'}
        </Link>
      </div>
      <nav className="flex-1 space-y-1 px-3 pb-4">
        {links.map((link) => {
          const isActive = pathname === link.href || pathname.startsWith(link.href + '/');
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition ${
                isActive
                  ? 'bg-white/20 text-white'
                  : 'text-white/70 hover:bg-white/10 hover:text-white'
              }`}
              aria-current={isActive ? 'page' : undefined}
            >
              <span aria-hidden="true">{link.icon}</span>
              {link.label}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
