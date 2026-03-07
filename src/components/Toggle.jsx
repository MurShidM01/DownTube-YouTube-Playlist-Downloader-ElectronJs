import React from 'react';

export default function Toggle({ label, checked, onChange, hint }) {
  return (
    <div className="flex items-center justify-between gap-4">
      <div>
        <div className="text-sm font-semibold">{label}</div>
        {hint ? <div className="text-xs dt-muted mt-1">{hint}</div> : null}
      </div>
      <button
        type="button"
        className={`dt-toggle ${checked ? 'active' : ''}`}
        onClick={() => onChange?.(!checked)}
        aria-pressed={checked}
      >
        <span className="dt-toggle-dot" />
      </button>
    </div>
  );
}
