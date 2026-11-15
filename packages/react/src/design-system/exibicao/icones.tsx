import type { ReactNode } from 'react';

// Ícones dos componentes de exibição, com os traços do Lucide (ISC), estilos.md §6: currentColor, traço de 1,5 a 2.
// Privados, como os de formulario/icones.tsx (que já tem info e alerta, reutilizados daqui).

interface PropsIcone {
  /** Lado em px. Padrão: 16 (14 nos avisos). */
  tamanho?: 14 | 16;
  className?: string;
}

function Svg({ tamanho = 16, className, children }: PropsIcone & { children: ReactNode }) {
  return (
    <svg
      className={className ? `fc-icone ${className}` : 'fc-icone'}
      width={tamanho}
      height={tamanho}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={tamanho === 16 ? 1.5 : 2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {children}
    </svg>
  );
}

/** lucide:x */
export function IconeFechar(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M18 6 6 18" />
      <path d="m6 6 12 12" />
    </Svg>
  );
}

/** lucide:circle-check */
export function IconeSucesso(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="m9 12 2 2 4-4" />
    </Svg>
  );
}

/** lucide:triangle-alert */
export function IconeAtencao(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
      <path d="M12 9v4" />
      <path d="M12 17h.01" />
    </Svg>
  );
}

/** lucide:inbox, o ícone padrão do estado vazio. */
export function IconeVazio(props: PropsIcone) {
  return (
    <Svg {...props}>
      <polyline points="22 12 16 12 14 15 10 15 8 12 2 12" />
      <path d="M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z" />
    </Svg>
  );
}
