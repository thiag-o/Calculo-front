// Ícones Lucide (estilos.md §6) usados na tela de usuários: traço 1.5, currentColor, decorativos.
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

/** Lucide "ellipsis": menu "…" das linhas. */
export function IconeMaisAcoes(props: IconeProps) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="1" />
      <circle cx="19" cy="12" r="1" />
      <circle cx="5" cy="12" r="1" />
    </Svg>
  );
}

/** Lucide "users": estado vazio da lista. */
export function IconeUsuarios(props: IconeProps) {
  return (
    <Svg {...props}>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87" />
      <path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </Svg>
  );
}

/** Lucide "copy": botão "Copiar". */
export function IconeCopiar(props: IconeProps) {
  return (
    <Svg {...props}>
      <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
      <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
    </Svg>
  );
}
