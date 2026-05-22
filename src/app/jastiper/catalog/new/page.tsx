'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth/AuthProvider';
import { getCategories, createProduct, uploadImageS3 } from '@/services/inventory.service';
import type { CategoryResponse, ShoppingMode } from '@/services/inventory.service';
import Link from 'next/link';

export default function NewProductPage() {
  const router = useRouter();
  const { accessToken } = useAuth();
  const [categories, setCategories] = useState<CategoryResponse[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  
  const [imageFile, setImageFile] = useState<File | null>(null);
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
    service_fee: '0',
    mode: 'LIVE' as ShoppingMode,
    flash_sale_start: '',
    flash_sale_end: '',
  });

  useEffect(() => {
    getCategories()
      .then(setCategories)
      .catch(() => setError('Gagal memuat daftar kategori.'));
  }, []);

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
    if (!accessToken) {
      setError('Sesi Anda habis, silakan login kembali.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      let imageUrls: string[] = [];
      if (imageFile) {
        const uploadedUrl = await uploadImageS3(accessToken, imageFile);
        imageUrls.push(uploadedUrl);
      }

      const parsedTags = tagsInput
        .split(',')
        .map((t) => t.trim())
        .filter((t) => t.length > 0);

      const payload = {
        name: form.name,
        description: form.description,
        price: form.price ? Number(form.price) : 0,
        stock: Number(form.stock),
        origin_country: form.origin_country,
        purchase_date: form.purchase_date,
        category_id: form.category_id ? Number(form.category_id) : null,
        weight_gram: form.weight_gram ? Number(form.weight_gram) : null,
        service_fee: form.service_fee ? Number(form.service_fee) : 0,
        mode: form.mode,
        images: imageUrls,
        tags: parsedTags,
        flash_sale_start: form.mode === 'FLASH_SALE' ? formatLocalDateTime(form.flash_sale_start) : null,
        flash_sale_end: form.mode === 'FLASH_SALE' ? formatLocalDateTime(form.flash_sale_end) : null,
      };

      await createProduct(accessToken, payload);
      router.push('/jastiper/catalog');
    } catch (err: any) {
      setError(err.message || 'Gagal menyimpan produk.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-3xl px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Tambah Produk Jastip</h1>
        <Link href="/jastiper/catalog" className="text-sm text-gray-500 hover:underline">Kembali</Link>
      </div>

      {error && (
        <div className="mb-4 rounded-lg bg-red-50 p-4 text-sm text-red-600">{error}</div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6 rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div>
          <label className="block text-sm font-medium text-gray-700">Nama Barang *</label>
          <input type="text" name="name" required value={form.name} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="Contoh: Tokyo Banana Edisi Terbatas" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Deskripsi Produk *</label>
          <textarea name="description" rows={4} required value={form.description} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="Jelaskan kondisi barang, varian, lokasi pembelian..." />
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700">Harga Barang (IDR) *</label>
            <input type="number" name="price" min={1} required value={form.price} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="150000" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Biaya Jasa Titip (IDR) *</label>
            <input type="number" name="service_fee" min={0} required value={form.service_fee} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="25000" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-gray-700">Stok / Kuota *</label>
            <input type="number" name="stock" min={0} required value={form.stock} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="10" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Negara Asal *</label>
            <input type="text" name="origin_country" required value={form.origin_country} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="Japan" />
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
            <input type="number" name="weight_gram" min={0} value={form.weight_gram} onChange={handleInputChange} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="250" />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Foto Barang</label>
          <input type="file" accept="image/*" onChange={handleFileChange} className="mt-1 w-full text-sm text-gray-500 file:mr-4 file:rounded-lg file:border-0 file:bg-gray-100 file:px-4 file:py-2 file:text-sm file:font-semibold" />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Tags (Pisahkan dengan tanda koma)</label>
          <input type="text" value={tagsInput} onChange={(e) => setTagsInput(e.target.value)} className="mt-1 w-full rounded-lg border border-gray-300 p-2.5 text-sm" placeholder="titip, viral, limited" />
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

        <button type="submit" disabled={loading} className="w-full rounded-xl bg-emerald-600 py-3 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
          {loading ? 'Sedang Memproses...' : 'Daftarkan Produk Jastip'}
        </button>
      </form>
    </div>
  );
}