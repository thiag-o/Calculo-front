// Lucide icons (estilos.md §6) used by the records of an execution: 1.5 stroke, currentColor, decorative.
import type { ReactNode } from 'react';

function Svg({ children, size = 16 }: { children: ReactNode; size?: number }) {
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

/** Lucide "x": closes the drawer (14px in a small button). */
export function CloseIcon() {
  return (
    <Svg size={14}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

/** Lucide "list": no record yet. */
export function ListIcon() {
  return (
    <Svg>
      <path d="M3 12h.01" />
      <path d="M3 18h.01" />
      <path d="M3 6h.01" />
      <path d="M8 12h13" />
      <path d="M8 18h13" />
      <path d="M8 6h13" />
    </Svg>
  );
}

/** Lucide "filter-x": nothing with the chosen filter. */
export function EmptyFilterIcon() {
  return (
    <Svg>
      <path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055" />
      <path d="m22 3-5 5" />
      <path d="m17 3 5 5" />
    </Svg>
  );
}
