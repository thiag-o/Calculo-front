// Lucide icons (estilos.md §6) used by the panel of an execution: 1.5 stroke, currentColor, decorative.
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

/** Lucide "download": "Baixar CSV". */
export function DownloadIcon() {
  return (
    <Svg>
      <path d="M12 15V3" />
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <path d="m7 10 5 5 5-5" />
    </Svg>
  );
}

/** Lucide "check": a finished phase. */
export function CheckIcon() {
  return (
    <Svg size={14}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

/** Lucide "chevron-right": between two phases. */
export function ChevronIcon() {
  return (
    <Svg size={14}>
      <path d="m9 18 6-6-6-6" />
    </Svg>
  );
}
