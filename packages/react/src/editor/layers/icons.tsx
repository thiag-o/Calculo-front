// Lucide icons (estilos.md §6) of the layers tree: 1.5 stroke, currentColor, decorative.
import type { ReactNode } from 'react';

function Svg({ size = 16, children }: { size?: number; children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.5}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Lucide "circle-alert": an item with problems. */
export function AlertIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <line x1="12" x2="12" y1="8" y2="12" />
      <line x1="12" x2="12.01" y1="16" y2="16" />
    </Svg>
  );
}

/** Lucide "chevron-right": a collapsed item. */
export function ChevronRightIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}

/** Lucide "chevron-down": an expanded item. */
export function ChevronDownIcon({ size }: { size?: number }) {
  return (
    <Svg size={size}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}
