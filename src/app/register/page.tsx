'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

import { register, isApiError } from '@/services/auth.service';

type Role = 'TITIPERS' | 'JASTIPER';

export default function RegisterPage() {
  const router = useRouter();

  const [role, setRole] = useState<Role>('TITIPERS');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Per-field errors
  const [emailError, setEmailError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmError, setConfirmError] = useState('');
  const [generalError, setGeneralError] = useState('');

  const [isSubmitting, setIsSubmitting] = useState(false);

  function clearErrors() {
    setEmailError('');
    setPasswordError('');
    setConfirmError('');
    setGeneralError('');
  }

  async function handleSubmit(formData: FormData) {
    clearErrors();

    const email = String(formData.get('email') ?? '');
    const password = String(formData.get('password') ?? '');
    const passwordConfirmation = String(formData.get('password_confirmation') ?? '');

    // Client-side validation
    if (password !== passwordConfirmation) {
      setConfirmError('Kata sandi tidak cocok');
      return;
    }

    setIsSubmitting(true);

    try {
      await register({ email, password, password_confirmation: passwordConfirmation, role });

      // Role-based success message via query param, then redirect to /login
      const msg = role === 'JASTIPER'
        ? 'Akun Jastiper dibuat. Tunggu verifikasi KYC dari admin.'
        : 'Akun berhasil dibuat. Silakan masuk.';
      router.push(`/login?success=${encodeURIComponent(msg)}`);
    } catch (err) {
      if (isApiError(err)) {
        const msg = err.message ?? 'Registrasi gagal.';
        // Map common backend messages to per-field errors
        if (msg.toLowerCase().includes('email')) {
          setEmailError('Email sudah terdaftar');
        } else if (msg.toLowerCase().includes('password') || msg.toLowerCase().includes('kata sandi')) {
          setPasswordError(msg);
        } else {
          setGeneralError(msg);
        }
      } else {
        setGeneralError(err instanceof Error ? err.message : 'Tidak dapat terhubung ke server.');
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  const inputClass =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-(--color-primary) disabled:bg-gray-50 disabled:opacity-70';

  return (
    <main className="min-h-screen flex items-center justify-center bg-linear-to-br from-(--color-primary-dark) to-(--color-primary) px-4 py-12">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 shadow-xl">

        {/* Brand */}
        <div className="mb-6 text-center">
          <span className="text-3xl font-extrabold text-(--color-primary-dark)">JSON</span>
          <p className="mt-1 text-sm text-gray-500">JaStip Online Nasional</p>
        </div>

        <h1 className="mb-6 text-center text-xl font-semibold text-gray-800">
          Buat Akun Baru
        </h1>

        {/* Role selector */}
        <div className="mb-5 flex rounded-lg border border-gray-200 p-1 gap-1">
          <button
            type="button"
            onClick={() => setRole('TITIPERS')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              role === 'TITIPERS'
                ? 'bg-(--color-primary) text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Pembeli (Titipers)
          </button>
          <button
            type="button"
            onClick={() => setRole('JASTIPER')}
            className={`flex-1 rounded-md py-2 text-sm font-medium transition ${
              role === 'JASTIPER'
                ? 'bg-(--color-primary) text-white shadow-sm'
                : 'text-gray-600 hover:bg-gray-50'
            }`}
          >
            Jastiper
          </button>
        </div>

        {/* JASTIPER info banner */}
        {role === 'JASTIPER' && (
          <div className="mb-4 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            <span className="font-medium">Perhatian:</span> Akun Jastiper memerlukan verifikasi KYC sebelum dapat beroperasi.
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
              className={inputClass}
              placeholder="nama@email.com"
            />
            {emailError && (
              <p role="alert" className="mt-1 text-xs text-red-600">{emailError}</p>
            )}
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
                autoComplete="new-password"
                disabled={isSubmitting}
                className={`${inputClass} pr-10`}
                placeholder="Min. 8 karakter, huruf & angka"
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
            {passwordError && (
              <p role="alert" className="mt-1 text-xs text-red-600">{passwordError}</p>
            )}
            <p className="mt-1 text-xs text-gray-400">
              Minimal 8 karakter dan harus mengandung huruf dan angka
            </p>
          </div>

          {/* Password confirmation */}
          <div>
            <label htmlFor="password_confirmation" className="mb-1 block text-sm font-medium text-gray-700">
              Konfirmasi Kata Sandi
            </label>
            <div className="relative">
              <input
                id="password_confirmation"
                name="password_confirmation"
                type={showConfirm ? 'text' : 'password'}
                required
                autoComplete="new-password"
                disabled={isSubmitting}
                className={`${inputClass} pr-10`}
                placeholder="••••••••"
              />
              <button
                type="button"
                onClick={() => setShowConfirm((v) => !v)}
                className="absolute inset-y-0 right-0 flex items-center px-3 text-gray-400 hover:text-gray-600"
                aria-label={showConfirm ? 'Sembunyikan konfirmasi' : 'Tampilkan konfirmasi'}
              >
                <EyeIcon open={showConfirm} />
              </button>
            </div>
            {confirmError && (
              <p role="alert" className="mt-1 text-xs text-red-600">{confirmError}</p>
            )}
          </div>

          {/* General error */}
          {generalError && (
            <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600">
              {generalError}
            </p>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-(--color-primary) px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-(--color-primary-dark) focus:outline-none focus:ring-2 focus:ring-(--color-primary) focus:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {isSubmitting ? 'Memuat...' : 'Daftar'}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-gray-600">
          Sudah punya akun?{' '}
          <Link href="/login" className="font-medium text-(--color-primary-dark) hover:underline">
            Masuk
          </Link>
        </p>
      </div>
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
