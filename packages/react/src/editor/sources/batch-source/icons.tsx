// Lucide icons (estilos.md §6) of the batch source: currentColor, decorative (the buttons and rows carry the name).
import type { ReactNode } from 'react';

interface IconProps {
  /** 16px; 14px in small buttons; 12px beside 12px text. */
  size?: 12 | 14 | 16;
}

function Svg({ size = 16, children }: IconProps & { children: ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={size === 16 ? 1.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** Lucide "key-round": a variable of the record key. */
export function KeyIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M2.586 17.414A2 2 0 0 0 2 18.828V21a1 1 0 0 0 1 1h3a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h1a1 1 0 0 0 1-1v-1a1 1 0 0 1 1-1h.172a2 2 0 0 0 1.414-.586l.814-.814a6.5 6.5 0 1 0-4-4z" />
      <circle cx="16.5" cy="7.5" r=".5" fill="currentColor" />
    </Svg>
  );
}

/** Lucide "database": the dataset of the batch source. */
export function DatabaseIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14a9 3 0 0 0 18 0V5" />
      <path d="M3 12a9 3 0 0 0 18 0" />
    </Svg>
  );
}

/** Lucide "arrow-up": "Mover para cima". */
export function ArrowUpIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="m5 12 7-7 7 7" />
      <path d="M12 19V5" />
    </Svg>
  );
}

/** Lucide "arrow-down": "Mover para baixo". */
export function ArrowDownIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 5v14" />
      <path d="m19 12-7 7-7-7" />
    </Svg>
  );
}

/** Lucide "trash-2": "Remover critério". */
export function TrashIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 6h18" />
      <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
      <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
      <path d="M10 11v6" />
      <path d="M14 11v6" />
    </Svg>
  );
}

/** Lucide "plus": "Incluir critério". */
export function PlusIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </Svg>
  );
}

/** Lucide "info": a note beside a part of the form. */
export function InfoIcon({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}
