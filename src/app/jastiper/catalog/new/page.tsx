'use client';

/**
 * TASK-221: /jastiper/catalog/new — Create Product Page
 *
 * Access: JASTIPER only (redirects to /login if unauthenticated)
 *
 * POST /products request body uses snake_case:
 *   name, description, price, stock, origin_country, purchase_date,
 *   category_id, weight_gram, service_fee, images[], tags[]
 *
 * Validation (client-side mirrors backend):
 * - name: required, max 255
 * - description: required, max 5000
 * - price: required, > 0
 * - stock: required, >= 0
 * - origin_country: required
 * - purchase_date: required, YYYY-MM-DD
 * - service_fee: optional, >= 0
 * - images: max 5 URLs
 */

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useEffect, useRef, useState } from 'react';

import { createProduct, getCategories, isApiError } from '@/services/inventory.service';
import type { CategoryResponse } from '@/services/inventory.service';
import { useAuth } from '@/lib/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------
type FieldErrors = Record<string, string>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------
const inputCls =
  'w-full rounded-xl border border-gray-300 bg-white px-3 py-2.5 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:text-gray-400';

const labelCls = 'mb-1.5 block text-sm font-medium text-gray-700';

function FieldError({ msg }: { msg?: string }) {
  if (!msg) return null;
  return <p role="alert" className="mt-1 text-xs text-red-600">{msg}</p>;
}

// ---------------------------------------------------------------------------
// Toast
// ---------------------------------------------------------------------------
type ToastType = 'success' | 'error';
function Toast({ message, type, onClose }: { message: string; type: ToastType; onClose: () => void }) {
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
      <button onClick={onClose} aria-label="Tutup" className="opacity-80 hover:opacity-100">✕</button>
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
// Main page
// ---------------------------------------------------------------------------
export default function CreateProductPage() {
  const router = useRouter();
  const { accessToken, isLoading: authLoading } = useAuth();

  // Form state
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [price, setPrice] = useState('');
  const [stock, setStock] = useState('');
  const [originCountry, setOriginCountry] = useState('');
  const [purchaseDate, setPurchaseDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [weightGram, setWeightGram] = useState('');
  const [serviceFee, setServiceFee] = useState('');
  const [images, setImages] = useState<string[]>(['']);
  const [tagInput, setTagInput] = useState('');
  const [tags, setTags] = useState<string[]>([]);

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: ToastType } | null>(null);

  const tagInputRef = useRef<HTMLInputElement>(null);

  // ---------------------------------------------------------------------------
  // Auth guard
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (!authLoading && !accessToken) {
      router.replace('/login?redirect=/jastiper/catalog/new');
    }
  }, [authLoading, accessToken, router]);

  // ---------------------------------------------------------------------------
  // Fetch categories
  // ---------------------------------------------------------------------------
  useEffect(() => {
    getCategories().then(setCategories).catch(() => {});
  }, []);

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

    if (!originCountry.trim()) errs.origin_country = 'Negara asal wajib diisi';
    if (!purchaseDate) errs.purchase_date = 'Tanggal pembelian wajib diisi';

    if (serviceFee !== '') {
      const sfNum = Number(serviceFee);
      if (isNaN(sfNum) || sfNum < 0) errs.service_fee = 'Biaya jasa tidak boleh negatif';
    }

    if (weightGram !== '') {
      const wgNum = Number(weightGram);
      if (isNaN(wgNum) || wgNum < 0) errs.weight_gram = 'Berat tidak boleh negatif';
    }

    return errs;
  }

  // ---------------------------------------------------------------------------
  // Submit
  // ---------------------------------------------------------------------------
  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      // Scroll to first error
      const firstKey = Object.keys(errs)[0];
      document.getElementById(`field-${firstKey}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      return;
    }
    setFieldErrors({});

    if (!accessToken) return;
    setSubmitting(true);

    // Filter out empty image URLs
    const cleanImages = images.filter((img) => img.trim() !== '');

    try {
      await createProduct(accessToken, {
        name: name.trim(),
        description: description.trim(),
        price: Number(price),
        stock: Number(stock),
        origin_country: originCountry.trim(),
        purchase_date: purchaseDate,
        category_id: categoryId ? Number(categoryId) : undefined,
        weight_gram: weightGram ? Number(weightGram) : undefined,
        service_fee: serviceFee ? Number(serviceFee) : undefined,
        images: cleanImages.length > 0 ? cleanImages : undefined,
        tags: tags.length > 0 ? tags : undefined,
      });

      // Redirect with success message via URL param (catalog page reads it)
      router.push('/jastiper/catalog?created=1');
    } catch (err) {
      if (isApiError(err)) {
        // Map backend validation errors to field errors
        if (err.status === 400 && err.field) {
          setFieldErrors({ [err.field]: err.message });
        } else {
          setToast({ message: err.message || 'Gagal membuat produk', type: 'error' });
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

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Navbar */}
      <header className="sticky top-0 z-40 bg-(--color-primary-dark) shadow-sm">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link href="/" className="text-xl font-extrabold text-white">JSON</Link>
          <nav className="flex items-center gap-4">
            <Link href="/jastiper/catalog" className="text-sm text-white/80 hover:text-white">Katalog Saya</Link>
          </nav>
        </div>
      </header>

      <div className="mx-auto max-w-3xl px-4 py-8">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-gray-500" aria-label="Breadcrumb">
          <Link href="/jastiper/catalog" className="hover:text-(--color-primary)">Katalog Saya</Link>
          <span>/</span>
          <span className="text-gray-800">Tambah Produk</span>
        </nav>

        <h1 className="mb-6 text-2xl font-bold text-gray-900">Tambah Produk Baru</h1>

        <form onSubmit={handleSubmit} noValidate className="space-y-5">
          {/* Basic Info */}
          <Section title="Informasi Dasar">
            {/* Name */}
            <div id="field-name">
              <label htmlFor="name" className={labelCls}>
                Nama Produk <span className="text-red-500">*</span>
              </label>
              <input
                id="name"
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Contoh: Skincare Korea COSRX Snail Mucin"
                maxLength={255}
                className={inputCls}
                aria-describedby={fieldErrors.name ? 'name-error' : undefined}
              />
              <div className="mt-1 flex justify-between">
                <FieldError msg={fieldErrors.name} />
                <span className="text-xs text-gray-400 ml-auto">{name.length}/255</span>
              </div>
            </div>

            {/* Description */}
            <div id="field-description">
              <label htmlFor="description" className={labelCls}>
                Deskripsi <span className="text-red-500">*</span>
              </label>
              <textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Jelaskan produk secara detail: kondisi, ukuran, warna, dll."
                rows={5}
                maxLength={5000}
                className={`${inputCls} resize-y`}
              />
              <div className="mt-1 flex justify-between">
                <FieldError msg={fieldErrors.description} />
                <span className="text-xs text-gray-400 ml-auto">{description.length}/5000</span>
              </div>
            </div>

            {/* Price + Stock */}
            <div className="grid grid-cols-2 gap-4">
              <div id="field-price">
                <label htmlFor="price" className={labelCls}>
                  Harga (IDR) <span className="text-red-500">*</span>
                </label>
                <input
                  id="price"
                  type="number"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="150000"
                  min={1}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.price} />
              </div>
              <div id="field-stock">
                <label htmlFor="stock" className={labelCls}>
                  Stok <span className="text-red-500">*</span>
                </label>
                <input
                  id="stock"
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  placeholder="10"
                  min={0}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.stock} />
              </div>
            </div>
          </Section>

          {/* Origin */}
          <Section title="Asal Produk">
            <div className="grid grid-cols-2 gap-4">
              <div id="field-origin_country">
                <label htmlFor="origin_country" className={labelCls}>
                  Negara Asal <span className="text-red-500">*</span>
                </label>
                <input
                  id="origin_country"
                  type="text"
                  value={originCountry}
                  onChange={(e) => setOriginCountry(e.target.value)}
                  placeholder="Contoh: Japan"
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.origin_country} />
              </div>
              <div id="field-purchase_date">
                <label htmlFor="purchase_date" className={labelCls}>
                  Tanggal Pembelian <span className="text-red-500">*</span>
                </label>
                <input
                  id="purchase_date"
                  type="date"
                  value={purchaseDate}
                  onChange={(e) => setPurchaseDate(e.target.value)}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.purchase_date} />
              </div>
            </div>
          </Section>

          {/* Category & Details */}
          <Section title="Kategori dan Detail">
            <div className="grid grid-cols-2 gap-4">
              {/* Category */}
              <div>
                <label htmlFor="category_id" className={labelCls}>Kategori</label>
                <select
                  id="category_id"
                  value={categoryId}
                  onChange={(e) => setCategoryId(e.target.value)}
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

              {/* Service fee */}
              <div id="field-service_fee">
                <label htmlFor="service_fee" className={labelCls}>Biaya Jasa (IDR)</label>
                <input
                  id="service_fee"
                  type="number"
                  value={serviceFee}
                  onChange={(e) => setServiceFee(e.target.value)}
                  placeholder="15000"
                  min={0}
                  className={inputCls}
                />
                <FieldError msg={fieldErrors.service_fee} />
              </div>
            </div>

            {/* Weight */}
            <div id="field-weight_gram">
              <label htmlFor="weight_gram" className={labelCls}>Berat (gram)</label>
              <input
                id="weight_gram"
                type="number"
                value={weightGram}
                onChange={(e) => setWeightGram(e.target.value)}
                placeholder="200"
                min={0}
                className={`${inputCls} max-w-xs`}
              />
              <FieldError msg={fieldErrors.weight_gram} />
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
                    className={inputCls}
                    aria-label={`URL Gambar ${idx + 1}`}
                  />
                  {images.length > 1 && (
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
          </Section>

          {/* Tags */}
          <Section title="Tag Produk">
            <p className="text-xs text-gray-500 -mt-2">Tekan Enter atau koma untuk menambah tag.</p>
            {/* Tag chips */}
            <div
              className="flex flex-wrap gap-2 rounded-xl border border-gray-300 bg-white p-2.5 min-h-[44px] cursor-text focus-within:ring-2 focus-within:ring-(--color-primary) focus-within:border-transparent"
              onClick={() => tagInputRef.current?.focus()}
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full bg-(--color-primary) px-2.5 py-0.5 text-xs font-medium text-white"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); removeTag(tag); }}
                    aria-label={`Hapus tag ${tag}`}
                    className="opacity-80 hover:opacity-100"
                  >
                    ✕
                  </button>
                </span>
              ))}
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
            </div>
          </Section>

          {/* Form actions */}
          <div className="flex items-center justify-end gap-3 pt-2">
            <Link
              href="/jastiper/catalog"
              className="rounded-xl border border-gray-300 px-6 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50 transition"
            >
              Batal
            </Link>
            <button
              type="submit"
              disabled={submitting}
              className="flex items-center gap-2 rounded-xl bg-(--color-primary) px-6 py-2.5 text-sm font-semibold text-white hover:bg-(--color-primary-dark) disabled:opacity-60 disabled:cursor-not-allowed transition"
            >
              {submitting && (
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              )}
              {submitting ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </div>

      {toast && (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
      )}
    </div>
  );
}
