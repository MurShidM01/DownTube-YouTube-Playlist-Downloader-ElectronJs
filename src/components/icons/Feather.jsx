import React from 'react';

const baseProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round'
};

function iconProps({ size = 16, className = '' } = {}) {
  return {
    width: size,
    height: size,
    viewBox: '0 0 24 24',
    className,
    'aria-hidden': 'true',
    focusable: 'false'
  };
}

export function IconX(props) {
  return (
    <svg {...iconProps(props)} {...baseProps}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function IconMinus(props) {
  return (
    <svg {...iconProps(props)} {...baseProps}>
      <line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  );
}

export function IconSquare(props) {
  return (
    <svg {...iconProps(props)} {...baseProps}>
      <rect x="5" y="5" width="14" height="14" rx="2" ry="2" />
    </svg>
  );
}

export function IconPlay(props) {
  return (
    <svg {...iconProps(props)} {...baseProps}>
      <polygon points="6 4 20 12 6 20 6 4" />
    </svg>
  );
}

export function IconCheck(props) {
  return (
    <svg {...iconProps(props)} {...baseProps}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function IconChevronDown(props) {
  return (
    <svg {...iconProps(props)} {...baseProps}>
      <polyline points="6 9 12 15 18 9" />
    </svg>
  );
}
