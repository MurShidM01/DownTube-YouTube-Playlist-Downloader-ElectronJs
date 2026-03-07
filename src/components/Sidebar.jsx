import React from 'react';

const items = [
  { id: 'home', label: 'Home' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'converter', label: 'Converter' },
  { id: 'settings', label: 'Settings' }
];

export default function Sidebar({ active, onChange, disabledIds = [] }) {
  return (
    <aside className="hidden lg:block w-60">
      <div className="dt-sidebar space-y-2">
        <div className="dt-label px-2">Navigation</div>
        {items.map((item) => (
          <button
            key={item.id}
            disabled={disabledIds.includes(item.id)}
            onClick={() => {
              if (!disabledIds.includes(item.id)) onChange(item.id);
            }}
            className={`dt-nav-item ${active === item.id ? 'dt-nav-active' : ''} ${
              disabledIds.includes(item.id) ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </aside>
  );
}
