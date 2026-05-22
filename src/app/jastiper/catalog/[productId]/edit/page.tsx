'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getCategories, getMyProduct, updateProduct, uploadImageS3 } from '@/services/inventory.service';
import type { CategoryResponse, ShoppingMode, ProductStatus } from '@/services/inventory.service';
import Link from 'next/link';

export default function EditProductPage() {
  const params = useParams();
  const router = useRouter();
  const { accessToken } = useAuth();
  const productId = params.productId as string;

  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [existingImages, setExistingImages] = useState<string[]>([]);
  const [tagsInput, setTagsInput] = useState('');

  const [form, setForm] = useState({
    name: '',
    description: '',
    price: '',
    stock: '',
    origin_country: '',
    purchase_date: '',
    category_id: '',
    weight_gram: '',
    service_fee: '',
    status: 'ACTIVE' as ProductStatus,
    mode: 'LIVE' as ShoppingMode,
    flash_sale_start: '',
    flash_sale_end: '',
  });

  const toHtmlDateTime = (isoStr: string | null) => {
    if (!isoStr) return '';
    return isoStr.substring(0, 16);
  };

  useEffect(() => {
    if (!accessToken || !productId) return;

    Promise.all([getCategories(), getMyProduct(accessToken, productId)])
      .then(([cats, prodResponse]) => {
        setCategories(cats);
        
        const p = (prodResponse as any).data || prodResponse;
        
        setExistingImages(p.images || []);
        setTagsInput((p.tags || []).join(', '));
        
        setForm({
          name: p.name || '',
          description: p.description || '',
          price: p.price !== undefined ? String(p.price) : '',
          stock: p.stock !== undefined ? String(p.stock) : '',
          
          origin_country: p.origin_country || p.originCountry || '',
          purchase_date: p.purchase_date || p.purchaseDate || '',
          
          category_id: p.category?.id ? String(p.category.id) : (p.category_id ? String(p.category_id) : ''),
          weight_gram: p.weight_gram || p.weightGram ? String(p.weight_gram || p.weightGram) : '',
          service_fee: p.service_fee !== undefined ? String(p.service_fee) : (p.serviceFee !== undefined ? String(p.serviceFee) : '0'),
          status: p.status || 'ACTIVE',
          mode: p.mode || 'LIVE',
          
          flash_sale_start: toHtmlDateTime(p.flash_sale_start || p.flashSaleStart),
          flash_sale_end: toHtmlDateTime(p.flash_sale_end || p.flashSaleEnd),
        });
        
        setLoading(false);
      })
      .catch((err) => {
        setError('Gagal memuat detail data produk.');
        setLoading(false);
      });
  }, [accessToken, productId]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      setImageFile(e.target.files[0]);
    }
  };

  const formatLocalDateTime = (dateTimeStr: string) => {
    if (!dateTimeStr) return null;
    return dateTimeStr.includes(':') && dateTimeStr.split(':').length === 2 ? `${dateTimeStr}:00` : dateTimeStr;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;

    setSubmitting(true);
    setError('');

    try {
      let finalImages = [...existingImages];
      if (imageFile) {
        const uploadedUrl = await uploadImageS3(accessToken, imageFile);
        finalImages = [uploadedUrl];
      }

      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        name: form.name,
        description: form.description,
        price: Number(form.price),
        stock: Number(form.stock),
        status: form.status,
        mode: form.mode,
        category_id: form.category_id ? Number(form.category_id) : null,
        origin_country: form.origin_country,
        purchase_date: form.purchase_date,
        service_fee: Number(form.service_fee),
        weight_gram: form.weight_gram ? Number(form.weight_gram) : null,
        images: finalImages,
        tags: parsedTags,
        flash_sale_start: form.mode === 'FLASH_SALE' ? formatLocalDateTime(form.flash_sale_start) : null,
        flash_sale_end: form.mode === 'FLASH_SALE' ? formatLocalDateTime(form.flash_sale_end) : null,
      };

      await updateProduct(accessToken, productId, payload);
      router.push('/jastiper/catalog');
    } catch (err: any) {
      setError(err.message || 'Gagal memperbarui data produk.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-600 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Edit Produk Jastip</h1>
        <Link href="/jastiper/catalog" className="text-sm text-gray-500 hover:underline">Batal</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Nama Barang *</label>
            <input type="text" name="name" required value={form.name} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status Produk *</label>
            <select name="status" value={form.status} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm">
              <option value="ACTIVE">ACTIVE (Tersedia)</option>
              <option value="OUT_OF_STOCK">OUT OF STOCK (Habis)</option>
              <option value="HIDDEN">HIDDEN (Sembunyikan)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Deskripsi Produk *</label>
          <textarea name="description" rows={4} required value={form.description} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Harga Barang (IDR) *</label>
            <input type="number" name="price" min={1} required value={form.price} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Biaya Jasa Titip (IDR) *</label>
            <input type="number" name="service_fee" min={0} required value={form.service_fee} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stok / Kuota *</label>
            <input type="number" name="stock" min={0} required value={form.stock} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Negara Asal *</label>
            <input type="text" name="origin_country" required value={form.origin_country} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Tanggal Pembelian *</label>
            <input type="date" name="purchase_date" required value={form.purchase_date} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Kategori</label>
            <select name="category_id" value={form.category_id} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm">
              <option value="">Pilih Kategori</option>
              {categories.map((c) => (
                <option key={c.category_id} value={c.category_id}>{c.name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Berat Barang (Gram)</label>
            <input type="number" name="weight_gram" min={0} value={form.weight_gram} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Ganti Foto Barang (Biarkan kosong jika tidak ingin mengubah)</label>
          <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold" />
          {existingImages.length > 0 && !imageFile && (
            <p className="mt-2 text-xs text-gray-400">Gambar saat ini: <a href={existingImages[0]} target="_blank" rel="noreferrer" className="text-emerald-600 hover:underline truncate inline-block max-w-xs align-bottom">{existingImages[0]}</a></p>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tags</label>
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" />
        </div>

        <div className="border-t border-gray-100 pt-4">
          <label className="block text-sm font-medium text-gray-700">Mode Penjualan</label>
          <select name="mode" value={form.mode} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm">
            <option value="LIVE">LIVE SHOPPING</option>
            <option value="PRE_ORDER">PRE-ORDER</option>
            <option value="FLASH_SALE">FLASH SALE (WAR SYSTEM)</option>
          </select>
        </div>

        {form.mode === 'FLASH_SALE' && (
          <div className="grid grid-cols-1 gap-4 rounded-xl bg-red-50 p-4 sm:grid-cols-2">
            <div>
              <label className="block text-xs font-bold text-red-700 uppercase">Waktu Mulai War *</label>
              <input type="datetime-local" name="flash_sale_start" required value={form.flash_sale_start} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white" />
            </div>
            <div>
              <label className="block text-xs font-bold text-red-700 uppercase">Waktu Selesai War *</label>
              <input type="datetime-local" name="flash_sale_end" required value={form.flash_sale_end} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm bg-white" />
            </div>
          </div>
        )}

        <button type="submit" disabled={submitting} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-50 transition">
          {submitting ? 'Sedang Menyimpan Perubahan...' : 'Simpan Perubahan Produk'}
        </button>
      </form>
    </div>
  );
}