'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

import { searchProducts, getCategories } from '@/services/inventory.service';
import type { ProductResponse, CategoryResponse, ProductJastiper } from '@/services/inventory.service';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatRupiah(amount: number) {
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);
}

// ---------------------------------------------------------------------------
// RatingStars
// ---------------------------------------------------------------------------
function RatingStars({ rating = 0 }: { rating?: number }) {
  const safeRating = rating ?? 0;
  return (
    <span className="inline-flex items-center gap-0.5">
      {[1, 2, 3, 4, 5].map((star) => (
        <svg
          key={star}
          className={`h-3.5 w-3.5 ${star <= Math.round(safeRating) ? 'text-yellow-400' : 'text-gray-200'}`}
          fill="currentColor"
          viewBox="0 0 20 20"
        >
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
      ))}
      <span className="ml-1 text-xs text-gray-500">{safeRating.toFixed(1)}</span>
    </span>
  );
}

// ---------------------------------------------------------------------------
// ProductCard
// ---------------------------------------------------------------------------
function ProductCard({ product }: { product: ProductResponse }) {
  const p = product as any;
  const productId = p.productId || p.product_id;
  const avgRating = p.stats?.avgRating ?? p.stats?.avg_rating ?? 0;
  const images = p.images ?? [];

  return (
    <Link
      href={`/catalog/${productId}`}
      className="group shrink-0 w-48 rounded-xl border border-gray-100 bg-white shadow-sm hover:shadow-md transition overflow-hidden"
    >
      <div className="aspect-square bg-gray-100 overflow-hidden">
        {images[0] ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={images[0]}
            alt={p.name}
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-200"
          />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-gray-300">
            <svg className="h-10 w-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>
      <div className="p-3">
        <p className="text-xs font-medium text-gray-800 line-clamp-2 mb-1">{p.name}</p>
        <p className="text-sm font-bold text-(--color-primary-dark)">{formatRupiah(p.price)}</p>
        {avgRating > 0 && (
          <div className="mt-1">
            <RatingStars rating={avgRating} />
          </div>
        )}
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// ProductCard skeleton
// ---------------------------------------------------------------------------
function ProductCardSkeleton() {
  return (
    <div className="shrink-0 w-48 rounded-xl border border-gray-100 bg-white overflow-hidden animate-pulse">
      <div className="aspect-square bg-gray-200" />
      <div className="p-3 space-y-2">
        <div className="h-3 w-full rounded bg-gray-200" />
        <div className="h-3 w-2/3 rounded bg-gray-200" />
        <div className="h-4 w-1/2 rounded bg-gray-100" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// JastiperCard
// ---------------------------------------------------------------------------
function JastiperCard({ jastiper }: { jastiper: ProductJastiper }) {
  const js = jastiper as any;
  const username = js.username;
  const avgRating = js.avgRating ?? js.avg_rating ?? 0;
  const totalOrders = js.totalOrders ?? js.total_orders ?? 0;
  const profilePictureUrl = js.profilePictureUrl || js.profile_picture_url;

  if (!username) return null;
  return (
    <Link
      href={`/jastiper/${username}`}
      className="group flex flex-col items-center gap-2 rounded-xl border border-gray-100 bg-white p-4 shadow-sm hover:shadow-md transition text-center w-36 shrink-0"
    >
      {profilePictureUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={profilePictureUrl}
          alt={username}
          className="h-14 w-14 rounded-full object-cover border-2 border-(--color-primary)"
        />
      ) : (
        <div className="h-14 w-14 rounded-full bg-(--color-primary) flex items-center justify-center text-white text-xl font-bold">
          {username[0].toUpperCase()}
        </div>
      )}
      <p className="text-xs font-semibold text-gray-800 truncate w-full">{username}</p>
      <RatingStars rating={avgRating} />
      <p className="text-xs text-gray-500">{totalOrders} pesanan</p>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------
export default function LandingPage() {
  const [products, setProducts] = useState<ProductResponse[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState(false);

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [categoriesLoading, setCategoriesLoading] = useState(true);

  const topJastipers = (() => {
    const seen = new Set<string>();
    const result: ProductJastiper[] = [];
    for (const p of products) {
      const js = p.jastiper as any;
      if (!js) continue;
      const uId = js.userId || js.user_id;
      const uname = js.username;
      
      if (uname && uId && !seen.has(uId)) {
        seen.add(uId);
        result.push(js);
        if (result.length >= 6) break;
      }
    }
    return result;
  })();

  // ---------------------------------------------------------------------------
  // Fetch featured products
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setProductsLoading(true);
    setProductsError(false);

    searchProducts({ limit: 8, sortBy: 'rating', order: 'desc' })
      .then((data) => { if (!cancelled) setProducts(data.data); })
      .catch(() => { if (!cancelled) setProductsError(true); })
      .finally(() => { if (!cancelled) setProductsLoading(false); });

    return () => { cancelled = true; };
  }, []);

  // ---------------------------------------------------------------------------
  // Fetch categories
  // ---------------------------------------------------------------------------
  useEffect(() => {
    let cancelled = false;
    setCategoriesLoading(true);

    getCategories()
      .then((data) => { if (!cancelled) setCategories(data); })
      .catch(() => { /* silently ignore */ })
      .finally(() => { if (!cancelled) setCategoriesLoading(false); });

    return () => { cancelled = true; };
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">

      {/* ------------------------------------------------------------------ */}
      {/* Navbar                                                             */}
      {/* ------------------------------------------------------------------ */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white tracking-tight">
            JSON
          </Link>
          <nav className="flex items-center gap-3">
            <Link href="/catalog" className="text-sm text-white/80 hover:text-white transition">
              Katalog
            </Link>
            <Link
              href="/login"
              className="rounded-lg border border-white/30 px-3 py-1.5 text-sm text-white hover:bg-white/10 transition"
            >
              Masuk
            </Link>
            <Link
              href="/register"
              className="rounded-lg bg-white px-3 py-1.5 text-sm font-semibold text-(--color-primary-dark) hover:bg-gray-100 transition"
            >
              Daftar
            </Link>
          </nav>
        </div>
      </header>

      {/* ------------------------------------------------------------------ */}
      {/* 1. Hero Section                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-linear-to-br from-(--color-primary-dark) to-(--color-primary) px-4 py-20 text-center text-white">
        <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">
          Jastip Online Nasional,
          <br />
          <span className="text-(--color-secondary-light)">Mudah dan Terpercaya</span>
        </h1>
        <p className="mx-auto mt-4 max-w-xl text-base text-white/80">
          Temukan produk jastip pilihan dari Jastiper terpercaya di seluruh Indonesia.
        </p>
        <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/catalog"
            className="rounded-xl bg-white px-6 py-3 text-sm font-bold text-(--color-primary-dark) shadow-md hover:bg-gray-100 transition"
          >
            Mulai Belanja
          </Link>
          <Link
            href="/register"
            className="rounded-xl border-2 border-white px-6 py-3 text-sm font-bold text-white hover:bg-white/10 transition"
          >
            Daftar Sebagai Jastiper
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 2. Featured Products                                               */}
      {/* ------------------------------------------------------------------ */}
      <section className="mx-auto max-w-6xl px-4 py-12">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-bold text-gray-900">Produk Unggulan</h2>
          <Link href="/catalog" className="text-sm text-(--color-primary) hover:underline">
            Lihat semua →
          </Link>
        </div>

        {productsError ? (
          <p className="text-sm text-gray-500">Gagal memuat produk. Coba muat ulang halaman.</p>
        ) : (
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {productsLoading
              ? Array.from({ length: 8 }).map((_, i) => <ProductCardSkeleton key={i} />)
              : products.length === 0
              ? (
                <p className="text-sm text-gray-500 py-8">Belum ada produk tersedia.</p>
              )
              : products.map((p) => {
                  const id = p.productId || (p as any).product_id;
                  return <ProductCard key={id} product={p} />;
                })
            }
          </div>
        )}
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 3. How It Works                                                    */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-4 py-14">
        <div className="mx-auto max-w-4xl">
          <h2 className="mb-10 text-center text-xl font-bold text-gray-900">Cara Kerja JSON</h2>
          <div className="grid grid-cols-1 gap-8 sm:grid-cols-3">
            {[
              {
                icon: (
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                ),
                step: '1',
                title: 'Pilih Produk',
                desc: 'Browse dan pilih produk dari Jastiper terpercaya di seluruh dunia.',
              },
              {
                icon: (
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z" />
                  </svg>
                ),
                step: '2',
                title: 'Bayar via Dompet',
                desc: 'Bayar dengan aman menggunakan Dompet JSON Anda.',
              },
              {
                icon: (
                  <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                  </svg>
                ),
                step: '3',
                title: 'Terima Barang',
                desc: 'Barang dikirim langsung ke pintu rumah Anda.',
              },
            ].map(({ icon, step, title, desc }) => (
              <div key={step} className="flex flex-col items-center text-center gap-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-full bg-(--color-primary)/10 text-(--color-primary)">
                  {icon}
                </div>
                <div className="flex h-6 w-6 items-center justify-center rounded-full bg-(--color-primary) text-xs font-bold text-white">
                  {step}
                </div>
                <h3 className="font-semibold text-gray-800">{title}</h3>
                <p className="text-sm text-gray-500">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 4. Top Jastipers                                                   */}
      {/* ------------------------------------------------------------------ */}
      {(productsLoading || topJastipers.length > 0) && (
        <section className="mx-auto max-w-6xl px-4 py-12">
          <h2 className="mb-5 text-xl font-bold text-gray-900">Jastiper Terpopuler</h2>
          <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
            {productsLoading
              ? Array.from({ length: 6 }).map((_, i) => (
                  <div key={i} className="shrink-0 w-36 rounded-xl border border-gray-100 bg-white p-4 animate-pulse">
                    <div className="h-14 w-14 rounded-full bg-gray-200 mx-auto mb-2" />
                    <div className="h-3 w-20 rounded bg-gray-200 mx-auto mb-1" />
                    <div className="h-3 w-16 rounded bg-gray-100 mx-auto" />
                  </div>
                ))
              : topJastipers.map((j) => {
                  const id = j.userId || (j as any).user_id;
                  return <JastiperCard key={id} jastiper={j} />;
                })
            }
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------------ */}
      {/* 5. Category Quick Links                                            */}
      {/* ------------------------------------------------------------------ */}
      <section className="bg-white px-4 py-12">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-5 text-xl font-bold text-gray-900">Jelajahi Kategori</h2>
          <div className="flex flex-wrap gap-2">
            {categoriesLoading
              ? Array.from({ length: 8 }).map((_, i) => (
                  <div key={i} className="h-8 w-24 rounded-full bg-gray-200 animate-pulse" />
                ))
              : categories.map((cat) => (
                  <Link
                    key={cat.category_id}
                    href={`/catalog?categoryId=${cat.category_id}`}
                    className="rounded-full border border-(--color-primary)/30 bg-(--color-primary)/5 px-4 py-1.5 text-sm font-medium text-(--color-primary-dark) hover:bg-(--color-primary)/15 transition"
                  >
                    {cat.name}
                    {cat.product_count > 0 && (
                      <span className="ml-1.5 text-xs text-gray-400">({cat.product_count})</span>
                    )}
                  </Link>
                ))
            }
          </div>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* 6. Footer                                                          */}
      {/* ------------------------------------------------------------------ */}
      <footer className="bg-(--color-primary-dark) px-4 py-10 text-white">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div>
              <p className="text-xl font-extrabold">JSON</p>
              <p className="mt-1 text-sm text-white/60">JaStip Online Nasional</p>
            </div>
            <nav className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-white/70">
              <Link href="#" className="hover:text-white transition">Tentang</Link>
              <Link href="#" className="hover:text-white transition">FAQ</Link>
              <Link href="#" className="hover:text-white transition">Kontak</Link>
              <Link href="#" className="hover:text-white transition">Syarat & Ketentuan</Link>
              <Link href="#" className="hover:text-white transition">Kebijakan Privasi</Link>
            </nav>
          </div>
          <p className="mt-8 text-center text-xs text-white/40">
            © {new Date().getFullYear()} JaStip Online Nasional. Hak cipta dilindungi.
          </p>
        </div>
      </footer>
    </div>
  );
}