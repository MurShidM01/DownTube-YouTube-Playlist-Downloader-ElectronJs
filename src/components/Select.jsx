import React, { useEffect, useRef, useState } from 'react';
import { IconCheck, IconChevronDown } from './icons/Feather.jsx';

export default function Select({
  label,
  value,
  options = [],
  placeholder = 'Select',
  onChange,
  className = ''
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);

  const selected = options.find((opt) => opt.value === value);
  const display = selected ? selected.label : placeholder;

  useEffect(() => {
    function handleClick(event) {
      if (!rootRef.current) return;
      if (!rootRef.current.contains(event.target)) {
        setOpen(false);
      }
    }

    function handleEsc(event) {
      if (event.key === 'Escape') setOpen(false);
    }

    document.addEventListener('mousedown', handleClick);
    document.addEventListener('keydown', handleEsc);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleEsc);
    };
  }, []);

  return (
    <div className={`dt-select-field ${className}`} ref={rootRef}>
      {label ? <div className="dt-label">{label}</div> : null}
      <button
        type="button"
        className="dt-select-trigger"
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className={`dt-select-value ${selected ? '' : 'dt-muted'}`}>{display}</span>
        <span className={`dt-select-caret ${open ? 'open' : ''}`}>
          <IconChevronDown size={16} />
        </span>
      </button>
      {open ? (
        <div className="dt-select-menu" role="listbox">
          <div className="dt-select-scroll">
            {options.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`dt-select-item ${opt.value === value ? 'active' : ''}`}
                role="option"
                aria-selected={opt.value === value}
                onClick={() => {
                  onChange?.(opt.value);
                  setOpen(false);
                }}
              >
                <span>{opt.label}</span>
                {opt.value === value ? (
                  <span className="dt-select-check"><IconCheck size={14} /></span>
                ) : null}
              </button>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
