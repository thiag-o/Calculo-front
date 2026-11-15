import type { ReactNode } from 'react';

// Ícones da navegação do módulo, desenhados com os traços do Lucide (ISC), estilos.md §6: 16px, currentColor,
// traço 1,5. Ficam aqui, privados, para o módulo não depender de uma biblioteca de ícones.

function Svg({ children }: { children: ReactNode }) {
  return (
    <svg
      className="fc-modulo-icone"
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

export function IconeInicio() {
  return (
    <Svg>
      <path d="M15 21v-8a1 1 0 0 0-1-1h-4a1 1 0 0 0-1 1v8" />
      <path d="M3 10a2 2 0 0 1 .709-1.528l7-5.999a2 2 0 0 1 2.582 0l7 5.999A2 2 0 0 1 21 10v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
    </Svg>
  );
}

/** ⇅ do seletor de contexto (estilos.md §9). */
export function IconeTrocar() {
  return (
    <Svg>
      <path d="m7 15 5 5 5-5" />
      <path d="m7 9 5-5 5 5" />
    </Svg>
  );
}

export function IconeSair() {
  return (
    <Svg>
      <path d="m16 17 5-5-5-5" />
      <path d="M21 12H9" />
      <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
    </Svg>
  );
}

export function IconeRecolherMenu() {
  return (
    <Svg>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m16 15-3-3 3-3" />
    </Svg>
  );
}

export function IconeExpandirMenu() {
  return (
    <Svg>
      <rect width="18" height="18" x="3" y="3" rx="2" />
      <path d="M9 3v18" />
      <path d="m14 9 3 3-3 3" />
    </Svg>
  );
}

/** Marca do Fluxo de Cálculo no topo do menu (telas "D · …" do Superdesign). */
export function MarcaFluxo() {
  return (
    <svg className="fc-modulo-marca" width={18} height={18} viewBox="0 0 20 20" aria-hidden="true" focusable="false">
      <rect x="2" y="2" width="7" height="7" rx="1.5" fill="currentColor" />
      <rect x="11" y="11" width="7" height="7" rx="1.5" fill="currentColor" />
      <path d="M9 5.5h2.5a2 2 0 0 1 2 2V11" stroke="currentColor" strokeWidth="1.6" fill="none" />
    </svg>
  );
}
