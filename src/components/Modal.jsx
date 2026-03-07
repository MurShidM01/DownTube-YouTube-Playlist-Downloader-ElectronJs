import React from 'react';
import { IconX } from './icons/Feather.jsx';

export default function Modal({ open, title, description, children, onClose }) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="dt-card w-full max-w-lg p-6">
        <div className="flex items-start justify-between">
          <div>
            <h3 className="text-xl font-semibold">{title}</h3>
            {description ? <p className="mt-1 text-sm dt-muted">{description}</p> : null}
          </div>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-900">
            <IconX size={16} />
          </button>
        </div>
        <div className="mt-4 space-y-4">{children}</div>
      </div>
    </div>
  );
}
