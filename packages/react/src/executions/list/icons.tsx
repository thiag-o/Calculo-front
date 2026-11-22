// Lucide icons (estilos.md §6) used by the execution list: 1.5 stroke, currentColor, decorative.
import type { ReactNode } from 'react';

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      width={16}
      height={16}
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

/** Lucide "play": the empty list. */
export function PlayIcon() {
  return (
    <Svg>
      <polygon points="6 3 20 12 6 21 6 3" />
    </Svg>
  );
}

/** Lucide "filter-x": nothing with the chosen filters. */
export function EmptyFilterIcon() {
  return (
    <Svg>
      <path d="M13.013 3H2l8 9.46V19l4 2v-8.54l.9-1.055" />
      <path d="m22 3-5 5" />
      <path d="m17 3 5 5" />
    </Svg>
  );
}
