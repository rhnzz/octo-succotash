'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import type { ReactNode } from 'react';

export type ToastType = 'success' | 'error' | 'info' | 'warning';

type ToastItem = {
  id: string;
  message: string;
  type: ToastType;
};

type ToastContextValue = {
  showToast: (message: string, type?: ToastType, duration?: number) => void;
};

const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error('useToast must be used within ToastProvider');
  return ctx;
}

const BORDER_MAP: Record<ToastType, string> = {
  success: 'border-green-200 bg-green-50 text-green-800',
  error: 'border-red-200 bg-red-50 text-red-800',
  info: 'border-blue-200 bg-blue-50 text-blue-800',
  warning: 'border-yellow-200 bg-yellow-50 text-yellow-800',
};

const ICON_MAP: Record<ToastType, string> = {
  success: '\u2713',
  error: '\u2717',
  info: '\u2139',
  warning: '\u26A0',
};

function ToastItem({ item, onClose }: { item: ToastItem; onClose: (id: string) => void }) {
  return (
    <div
      role="alert"
      aria-live="polite"
      className={`flex items-start justify-between gap-3 rounded-xl border px-4 py-3 text-sm shadow-md ${BORDER_MAP[item.type]}`}
    >
      <span>
        {ICON_MAP[item.type]} {item.message}
      </span>
      <button
        onClick={() => onClose(item.id)}
        aria-label="Tutup notifikasi"
        className="shrink-0 opacity-60 hover:opacity-100"
      >
        \u2715
      </button>
    </div>
  );
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, type: ToastType = 'info', duration = 4000) => {
    const id = crypto.randomUUID();
    setToasts((prev) => [...prev, { id, message, type }]);
    if (duration > 0) {
      setTimeout(() => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
      }, duration);
    }
  }, []);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}
      {toasts.length > 0 && (
        <div
          className="fixed right-4 top-4 z-[100] flex w-full max-w-sm flex-col gap-2"
          aria-label="Notifikasi"
        >
          {toasts.map((t) => (
            <ToastItem key={t.id} item={t} onClose={removeToast} />
          ))}
        </div>
      )}
    </ToastContext.Provider>
  );
}
