import React from 'react';

const items = [
  { id: 'home', label: 'Home' },
  { id: 'downloads', label: 'Downloads' },
  { id: 'converter', label: 'Converter' },
  { id: 'settings', label: 'Settings' }
];

export default function MobileNav({ active, onChange, disabledIds = [] }) {
  return (
    <div className="dt-bottom-nav">
      <div className="dt-bottom-nav-card">
        {items.map((item) => (
          <button
            key={item.id}
            disabled={disabledIds.includes(item.id)}
            onClick={() => {
              if (!disabledIds.includes(item.id)) onChange(item.id);
            }}
            className={`dt-bottom-item ${active === item.id ? 'active' : ''} ${
              disabledIds.includes(item.id) ? 'opacity-40 cursor-not-allowed' : ''
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>
    </div>
  );
}
