'use client';

/**
 * TASK-222: /jastiper/catalog/[productId]/edit — Edit Product Page
 *
 * Access: JASTIPER only (owner of the product)
 *
 * GET /products/my/{id} — prefills the form (camelCase response fields)
 * PATCH /products/{id}  — request body is camelCase:
 *   name, description, price, stock, status, originCountry, purchaseDate,
 *   categoryId, serviceFee, weightGram, images[], tags[]
 *
 * REMOVED_BY_ADMIN: form shown as read-only with a warning banner.
 */

import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import {
  getMyProduct,
  updateProduct,
  getCategories,
  isApiError,
} from '@/services/inventory.service';
import type { CategoryResponse, ProductResponse } from '@/services/inventory.service';
import { useAuth } from '@/lib/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FieldErrors = Record<string, string>;
type ToastType = 'success' | 'error';

// ---------------------------------------------------------------------------
// Shared style helpers
// ---------------------------------------------------------------------------
const inputCls =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:text-gray-400 disabled:cursor-not-allowed';

const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p role="alert" className="mt-1 text-xs text-red-600">{msg}</p>;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
function Toast({
  message,
  type,
  onClose,
}: {
  message: string;
  type: ToastType;
  onClose: () => void;
}) {
  useEffect(() => {
    const t = setTimeout(onClose, 4000);
    return () => clearTimeout(t);
  }, [onClose]);

  return (
    <div
      role="alert"
      className={`fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-xl px-4 py-3 shadow-lg text-sm font-medium text-white ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
      }`}
    >
      <span>{message}</span>
      <button onClick={onClose} aria-label="Tutup" className="opacity-80 hover:opacity-100">
        ✕
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section wrapper
// ---------------------------------------------------------------------------
function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6">
      <h2 className="mb-5 text-base font-semibold text-gray-800">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Form skeleton
// ---------------------------------------------------------------------------
function FormSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-gray-200 bg-white p-6 space-y-4">
          <div className="h-4 w-32 rounded bg-gray-200" />
          <div className="h-10 w-full rounded-xl bg-gray-200" />
          <div className="h-10 w-full rounded-xl bg-gray-200" />
        </div>
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------
export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const productId = params.productId as string;
  const { accessToken, isLoading: authLoading } = useAuth();

  // Remote data
  const [product, setProduct] = useState<ProductResponse | null>(null);
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loadingProduct, setLoadingProduct] = useState(true);
  const [notFound, setNotFound] = useState(false);

  // Form state — initialised from product once loaded
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [status, setStatus] = useState<'ACTIVE' | 'OUT_OF_STOCK' | 'HIDDEN'>('ACTIVE');
  const [originCountry, setOriginCountry] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [weightGram, setWeightGram] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [images, setImages] = useState<string[]>(['']);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const tagInputRef = useRef<HTMLInputElement>(null);

  const isReadOnly = product?.status === 'REMOVED_BY_ADMIN';

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.replace(`/login?redirect=/jastiper/catalog/${productId}/edit`);
    }
  }, [authLoading, accessToken, router, productId]);

  // ---------------------------------------------------------------------------
  // Fetch product + categories in parallel
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!accessToken || !productId) return;

    setLoadingProduct(true);
    Promise.all([
      getMyProduct(accessToken, productId),
      getCategories(),
    ])
      .then(([prod, cats]) => {
        setProduct(prod);
        setCategories(cats);

        // Prefill form from camelCase ProductResponse fields
        setName(prod.name);
        setDescription(prod.description);
        setPrice(String(prod.price));
        setStock(String(prod.stock));
        // Status: only ACTIVE, OUT_OF_STOCK, HIDDEN are selectable
        if (
          prod.status === 'ACTIVE' ||
          prod.status === 'OUT_OF_STOCK' ||
          prod.status === 'HIDDEN'
        ) {
          setStatus(prod.status);
        } else {
          // REMOVED_BY_ADMIN — keep form read-only, show current status as display only
          setStatus('ACTIVE');
        }
        setOriginCountry(prod.originCountry);
        setPurchaseDate(prod.purchaseDate); // already YYYY-MM-DD
        setCategoryId(prod.category ? String(prod.category.id) : '');
        setWeightGram(prod.weightGram > 0 ? String(prod.weightGram) : '');
        setServiceFee(prod.serviceFee > 0 ? String(prod.serviceFee) : '');
        setImages(prod.images.length > 0 ? prod.images : ['']);
        setTags(prod.tags);
      })
      .catch((err) => {
        if (isApiError(err) && (err.status === 404 || err.status === 403)) {
          setNotFound(true);
        } else {
          setNotFound(true);
        }
      })
      .finally(() => setLoadingProduct(false));
  }, [accessToken, productId]);

  // ---------------------------------------------------------------------------
  // Image URL management
  // ---------------------------------------------------------------------------
  function addImage() {
    if (images.length < 5) setImages((prev) => [...prev, '']);
  }

  function removeImage(idx: number) {
    setImages((prev) => prev.filter((_, i) => i !== idx));
  }

  function updateImage(idx: number, val: string) {
    setImages((prev) => prev.map((img, i) => (i === idx ? val : img)));
  }

  // ---------------------------------------------------------------------------
  // Tag management
  // ---------------------------------------------------------------------------
  function addTag(raw: string) {
    const trimmed = raw.trim().replace(/,$/, '').trim();
    if (trimmed && !tags.includes(trimmed)) {
      setTags((prev) => [...prev, trimmed]);
    }
    setTagInput('');
  }

  function handleTagKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addTag(tagInput);
    } else if (e.key === 'Backspace' && tagInput === '' && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1));
    }
  }

  function removeTag(tag: string) {
    setTags((prev) => prev.filter((t) => t !== tag));
  }

  // ---------------------------------------------------------------------------
  // Client-side validation
  // ---------------------------------------------------------------------------
  function validate(): FieldErrors {
    const errs: FieldErrors = {};
    if (!name.trim()) errs.name = 'Nama produk wajib diisi';
    else if (name.length > 255) errs.name = 'Nama produk maksimal 255 karakter';

    if (!description.trim()) errs.description = 'Deskripsi wajib diisi';
    else if (description.length > 5000) errs.description = 'Deskripsi maksimal 5000 karakter';

    const priceNum = Number(price);
    if (!price) errs.price = 'Harga wajib diisi';
    else if (isNaN(priceNum) || priceNum <= 0) errs.price = 'Harga harus lebih dari 0';

    const stockNum = Number(stock);
    if (stock === '') errs.stock = 'Stok wajib diisi';
    else if (isNaN(stockNum) || stockNum < 0) errs.stock = 'Stok tidak boleh negatif';

    if (!originCountry.trim()) errs.originCountry = 'Negara asal wajib diisi';
    if (!purchaseDate) errs.purchaseDate = 'Tanggal pembelian wajib diisi';

    if (serviceFee !== '') {
      const sfNum = Number(serviceFee);
      if (isNaN(sfNum) || sfNum < 0) errs.serviceFee = 'Biaya jasa tidak boleh negatif';
    }

    if (weightGram !== '') {
      const wgNum = Number(weightGram);
      if (isNaN(wgNum) || wgNum < 0) errs.weightGram = 'Berat tidak boleh negatif';
    }

    return errs;
  }

  // ---------------------------------------------------------------------------
  // Submit — PATCH /products/{id} with camelCase body
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isReadOnly) return;

    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors({});

    if (!accessToken) return;
    setSubmitting(true);

    const cleanImages = images.filter((img) => img.trim() !== '');

    try {
      await updateProduct(accessToken, productId, {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        stock: Number(stock),
        status,
        originCountry: originCountry.trim(),
        purchaseDate,
        categoryId: categoryId ? Number(categoryId) : undefined,
        weightGram: weightGram ? Number(weightGram) : undefined,
        serviceFee: serviceFee ? Number(serviceFee) : undefined,
        images: cleanImages,
        tags,
      });

      router.push('/jastiper/catalog?updated=1');
    } catch (err) {
      if (isApiError(err)) {
        if (err.status === 400 && err.field) {
          setFieldErrors({ [err.field]: err.message });
        } else {
          setToast({ message: err.message || 'Gagal memperbarui produk', type: 'error' });
        }
      } else {
        setToast({ message: 'Terjadi kesalahan. Coba lagi.', type: 'error' });
      }
    } finally {
      setSubmitting(false);
    }
  }

  // ---------------------------------------------------------------------------
  // Render guards
  // ---------------------------------------------------------------------------
  if (authLoading) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="animate-spin h-8 w-8 rounded-full border-4 border-(--color-primary) border-t-transparent" />
      </div>
    );
  }

  if (!accessToken) return null;

  if (loadingProduct) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          </div>
        </header>
        <div className="mx-auto max-w-3xl px-4 py-8">
          <div className="mb-6 h-6 w-48 rounded bg-gray-200 animate-pulse" />
          <FormSkeleton />
        </div>
      </div>
    );
  }

  if (notFound || !product) {
    return (
      <div className="min-h-screen bg-gray-50">
        <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
          <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
            <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          </div>
        </header>
        <div className="flex flex-col items-center justify-center py-32 text-center px-4">
          <svg className="h-16 w-16 text-gray-300 mb-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <h1 className="text-xl font-bold text-gray-800 mb-2">Produk tidak ditemukan</h1>
          <p className="text-gray-500 mb-6">Produk tidak ada atau bukan milik Anda.</p>
          <Link
            href="/jastiper/catalog"
            className="rounded-xl bg-(--color-primary) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) transition"
          >
            Kembali ke Katalog
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          <nav className="flex items-center gap-4">
            <Link href="/jastiper/catalog" className="text-sm text-white/80 hover:text-white">
              Katalog Saya
            </Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/jastiper/catalog" className="hover:text-(--color-primary)">Katalog Saya</Link>
          <span>/</span>
          <span className="text-gray-800 line-clamp-1">{product.name}</span>
          <span>/</span>
          <span className="text-gray-800">Edit</span>
        </nav>

        <h1 className="mb-2 text-2xl font-bold text-gray-900">Edit Produk</h1>
        <p className="mb-6 text-sm text-gray-500 line-clamp-1">{product.name}</p>

        {/* REMOVED_BY_ADMIN warning banner */}
        {isReadOnly && (
          <div
            role="alert"
            className="mb-6 flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-4 py-4"
          >
            <svg className="h-5 w-5 text-red-500 shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <div>
              <p className="text-sm font-semibold text-red-700">Produk ini telah dihapus oleh admin</p>
              <p className="mt-0.5 text-sm text-red-600">
                Produk tidak dapat diedit. Hubungi admin untuk informasi lebih lanjut.
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Basic Info */}
          <Section title="Informasi Dasar">
            {/* Name */}
            <div id="field-name">
              <label htmlFor="name" className={labelCls}>
                Nama Produk {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                maxLength={255}
                disabled={isReadOnly}
                className={inputCls}
              />
              <div className="mt-1 flex justify-between">
                <FieldError msg={fieldErrors.name} />
                {!isReadOnly && (
                  <span className="text-xs text-gray-400 ml-auto">{name.length}/255</span>
                )}
              </div>
            </div>

            {/* Description */}
            <div id="field-description">
              <label htmlFor="description" className={labelCls}>
                Deskripsi {!isReadOnly && <span className="text-red-500">*</span>}
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={5}
                maxLength={5000}
                disabled={isReadOnly}
                className={`${inputCls} resize-y`}
              />
              <div className="mt-1 flex justify-between">
                <FieldError msg={fieldErrors.description} />
                {!isReadOnly && (
                  <span className="text-xs text-gray-400 ml-auto">{description.length}/5000</span>
                )}
              </div>
            </div>

            {/* Price + Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div id="field-price">
                <label htmlFor="price" className={labelCls}>
                  Harga (IDR) {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  min={1}
                  disabled={isReadOnly}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.price} />
              </div>
              <div id="field-stock">
                <label htmlFor="stock" className={labelCls}>
                  Stok {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="stock"
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  min={0}
                  disabled={isReadOnly}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.stock} />
              </div>
            </div>

            {/* Status — only shown on edit, not on create */}
            <div>
              <label htmlFor="status" className={labelCls}>Status Produk</label>
              {isReadOnly ? (
                <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-sm text-red-700 font-medium">
                  REMOVED_BY_ADMIN
                </div>
              ) : (
                <select
                  id="status"
                  value={status}
                  onChange={(e) => setStatus(e.target.value as 'ACTIVE' | 'OUT_OF_STOCK' | 'HIDDEN')}
                  className={inputCls}
                >
                  <option value="ACTIVE">Aktif</option>
                  <option value="OUT_OF_STOCK">Stok Habis</option>
                  <option value="HIDDEN">Disembunyikan</option>
                </select>
              )}
              <p className="mt-1 text-xs text-gray-400">
                Pilih &quot;Disembunyikan&quot; untuk menyembunyikan produk dari katalog publik.
              </p>
            </div>
          </Section>

          {/* Origin */}
          <Section title="Asal Produk">
            <div className="grid grid-cols-2 gap-4">
              <div id="field-originCountry">
                <label htmlFor="originCountry" className={labelCls}>
                  Negara Asal {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="originCountry"
                  type="text"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  disabled={isReadOnly}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.originCountry} />
              </div>
              <div id="field-purchaseDate">
                <label htmlFor="purchaseDate" className={labelCls}>
                  Tanggal Pembelian {!isReadOnly && <span className="text-red-500">*</span>}
                </label>
                <input
                  id="purchaseDate"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  disabled={isReadOnly}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.purchaseDate} />
              </div>
            </div>
          </Section>

          {/* Category & Details */}
          <Section title="Kategori dan Detail">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label htmlFor="categoryId" className={labelCls}>Kategori</label>
                <select
                  id="categoryId"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
                  disabled={isReadOnly}
                  className={inputCls}
                >
                  <option value="">— Pilih Kategori —</option>
                  {categories.map((c) => (
                    <option key={c.category_id} value={String(c.category_id)}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </div>
              <div id="field-serviceFee">
                <label htmlFor="serviceFee" className={labelCls}>Biaya Jasa (IDR)</label>
                <input
                  id="serviceFee"
                  type="number"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                  min={0}
                  disabled={isReadOnly}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.serviceFee} />
              </div>
            </div>
            <div id="field-weightGram">
              <label htmlFor="weightGram" className={labelCls}>Berat (gram)</label>
              <input
                id="weightGram"
                type="number"
                value={weightGram}
                onChange={(e) => setWeightGram(e.target.value)}
                min={0}
                disabled={isReadOnly}
                className={`${inputCls} max-w-xs`}
              />
              <FieldError msg={fieldErrors.weightGram} />
            </div>
          </Section>

          {/* Images */}
          <Section title="Gambar Produk">
            <p className="text-xs text-gray-500 -mt-2">Masukkan URL gambar. Maksimal 5 gambar.</p>
            <div className="space-y-2">
              {images.map((img, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type="url"
                    value={img}
                    onChange={(e) => updateImage(idx, e.target.value)}
                    placeholder={`URL Gambar ${idx + 1}`}
                    disabled={isReadOnly}
                    className={inputCls}
                    aria-label={`URL Gambar ${idx + 1}`}
                  />
                  {!isReadOnly && images.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeImage(idx)}
                      className="shrink-0 rounded-lg border border-red-200 p-2 text-red-500 hover:bg-red-50 transition"
                      aria-label={`Hapus gambar ${idx + 1}`}
                    >
                      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  )}
                </div>
              ))}
            </div>
            {!isReadOnly && (
              <button
                type="button"
                onClick={addImage}
                disabled={images.length >= 5}
                className="mt-1 flex items-center gap-1.5 rounded-lg border border-dashed border-gray-300 px-4 py-2 text-sm text-gray-600 hover:border-(--color-primary) hover:text-(--color-primary) disabled:opacity-40 disabled:cursor-not-allowed transition"
              >
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
                </svg>
                Tambah Gambar {images.length >= 5 && '(Maks. 5)'}
              </button>
            )}
          </Section>

          {/* Tags */}
          <Section title="Tag Produk">
            <p className="text-xs text-gray-500 -mt-2">
              {isReadOnly ? 'Tag produk.' : 'Tekan Enter atau koma untuk menambah tag.'}
            </p>
            <div
              className={`flex flex-wrap gap-2 rounded-xl border border-gray-300 bg-white p-2.5 min-h-[44px] ${
                isReadOnly ? 'bg-gray-50 cursor-default' : 'cursor-text focus-within:ring-2 focus-within:ring-(--color-primary) focus-within:border-transparent'
              }`}
              onClick={() => !isReadOnly && tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-(--color-primary) px-2.5 py-0.5 text-xs font-medium text-white"
                >
                  {tag}
                  {!isReadOnly && (
                    <button
                      type="button"
                      onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                      aria-label={`Hapus tag ${tag}`}
                      className="opacity-80 hover:opacity-100"
                    >
                      ✕
                    </button>
                  )}
                </span>
              ))}
              {!isReadOnly && (
                <input
                  ref={tagInputRef}
                  type="text"
                  value={tagInput}
                  onChange={(e) => setTagInput(e.target.value)}
                  onKeyDown={handleTagKeyDown}
                  onBlur={() => { if (tagInput.trim()) addTag(tagInput); }}
                  placeholder={tags.length === 0 ? 'Tambah tag...' : ''}
                  className="flex-1 min-w-[120px] border-none bg-transparent text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none"
                  aria-label="Input tag produk"
                />
              )}
            </div>
          </Section>

          {/* Form actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/jastiper/catalog"
              className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              {isReadOnly ? 'Kembali' : 'Batal'}
            </Link>
            {!isReadOnly && (
              <button
                type="submit"
                disabled={submitting}
                className="flex items-center gap-2 rounded-xl bg-(--color-primary) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) disabled:opacity-60 disabled:cursor-not-allowed transition"
              >
                {submitting && (
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                )}
                {submitting ? 'Menyimpan...' : 'Simpan Perubahan'}
              </button>
            )}
          </div>
        </form>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
