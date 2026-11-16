// Ícones Lucide (estilos.md §6) usados na tela de segurança: traço 1.5, currentColor, decorativos.
import type { ReactNode } from 'react';

interface IconeProps {
  tamanho?: number;
}

function Svg({ tamanho = 16, children }: IconeProps & { children: ReactNode }) {
  return (
    <svg
      width={tamanho}
      height={tamanho}
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

/** Lucide "info": nota sobre o que é do sistema, não do tenant. */
export function IconeInfo(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

/** Lucide "rotate-ccw": "Voltar ao padrão". */
export function IconeVoltarPadrao(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
      <path d="M3 3v5h5" />
    </Svg>
  );
}
