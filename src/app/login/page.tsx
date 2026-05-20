'use client';

import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState } from 'react';

import { login, isApiError } from '@/services/auth.service';
import { useAuth } from '@/lib/auth/AuthProvider';

// ---------------------------------------------------------------------------
// Inner component — uses useSearchParams (requires Suspense boundary)
// ---------------------------------------------------------------------------
function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAccessToken } = useAuth();

  const successMessage = searchParams.get('success') ?? '';
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(formData: FormData) {
    setError('');
    setIsSubmitting(true);

    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');

    try {
      const data = await login({ email, password });

      // Store access token + user info in context.
      // The backend returns the access token in `refresh_token` (naming quirk).
      setAccessToken(data.refresh_token, data.user);

      // Role-based redirect
      const role = data.user.role;
      if (role === 'ADMIN') {
        router.push('/admin/dashboard');
      } else if (role === 'JASTIPER') {
        router.push('/jastiper/dashboard');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      if (isApiError(err)) {
        setError(err.message || 'Login gagal.');
      } else {
        setError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
      {/* Brand */}
      <div className="mb-6 text-center">
        <span className="text-3xl font-extrabold text-(--color-primary-dark)">JSON</span>
        <p className="mt-1 text-sm text-gray-500">JaStip Online Nasional</p>
      </div>

      <h1 className="mb-6 text-center text-xl font-semibold text-gray-800">
        Masuk ke Akun Anda
      </h1>

      {/* Success message from register redirect */}
      {successMessage && (
        <div className="mb-4 rounded-lg border border-green-200 bg-green-50 px-3 py-2 text-sm text-green-700">
          {successMessage}
        </div>
      )}

      <form action={handleSubmit} className="space-y-4">
        {/* Email */}
        <div>
          <label htmlFor="email" className="mb-1 block text-sm font-medium text-gray-700">
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={isSubmitting}
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70"
            placeholder="nama@email.com"
          />
        </div>

        {/* Password */}
        <div>
          <label htmlFor="password" className="mb-1 block text-sm font-medium text-gray-700">
            Kata Sandi
          </label>
          <div className="relative">
            <input
              id="password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              required
              autoComplete="current-password"
              disabled={isSubmitting}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 pr-10 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70"
              placeholder="••••••••"
            />
            <button
              type="button"
              onClick={() => setShowPassword((v) => !v)}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
            >
              <EyeIcon open={showPassword} />
            </button>
          </div>
        </div>

        {/* Error */}
        {error && (
          <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
            {error}
          </p>
        )}

        {/* Submit */}
        <button
          type="submit"
          disabled={isSubmitting}
          className="w-full rounded-lg bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--color-primary-dark) focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
        >
          {isSubmitting ? 'Memuat...' : 'Masuk'}
        </button>
      </form>

      <p className="mt-5 text-center text-sm text-gray-600">
        Belum punya akun?{' '}
        <Link href="/register" className="font-medium text-(--color-primary-dark) hover:underline">
          Daftar sekarang
        </Link>
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Page — wraps LoginForm in Suspense (required by useSearchParams)
// ---------------------------------------------------------------------------
export default function LoginPage() {
  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-(--color-primary-dark) to-(--color-primary) px-4 py-12">
      <Suspense fallback={
        <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">
          <div className="animate-pulse space-y-4">
            <div className="h-8 w-24 mx-auto rounded bg-gray-200" />
            <div className="h-4 w-32 mx-auto rounded bg-gray-100" />
            <div className="h-10 rounded bg-gray-200" />
            <div className="h-10 rounded bg-gray-200" />
            <div className="h-10 rounded bg-gray-200" />
          </div>
        </div>
      }>
        <LoginForm />
      </Suspense>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Eye icon helper
// ---------------------------------------------------------------------------
function EyeIcon({ open }: { open: boolean }) {
  if (open) {
    return (
      <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
      </svg>
    );
  }
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
    </svg>
  );
}
