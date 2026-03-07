import React from 'react';

export default function ToastStack({ toasts }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className={`px-4 py-2 rounded-2xl text-sm font-semibold shadow ${
            toast.variant === 'error'
              ? 'bg-rose-500 text-white'
              : 'bg-white text-slate-900 border border-black/5'
          }`}
        >
          {toast.message}
        </div>
      ))}
    </div>
  );
}
