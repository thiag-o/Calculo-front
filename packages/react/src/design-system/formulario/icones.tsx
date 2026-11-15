import type { ReactNode } from 'react';

// Ícones dos controles de formulário, desenhados com os traços do Lucide (ISC), estilos.md §6:
// currentColor, traço de 1,5 a 2. Ficam aqui, privados, para os controles não dependerem de uma biblioteca de ícones.

interface PropsIcone {
  /** Lado em px. Padrão: 16 (14 em botões pequenos, 12 junto de textos de 12px). */
  tamanho?: 12 | 14 | 16;
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

export function IconeInfo(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 16v-4" />
      <path d="M12 8h.01" />
    </Svg>
  );
}

export function IconeAlerta(props: PropsIcone) {
  return (
    <Svg {...props}>
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </Svg>
  );
}

export function IconeOlho(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
      <circle cx="12" cy="12" r="3" />
    </Svg>
  );
}

export function IconeOlhoRiscado(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M10.733 5.076a10.744 10.744 0 0 1 11.205 6.575 1 1 0 0 1 0 .696 10.747 10.747 0 0 1-1.444 2.49" />
      <path d="M14.084 14.158a3 3 0 0 1-4.242-4.242" />
      <path d="M17.479 17.499a10.75 10.75 0 0 1-15.417-5.151 1 1 0 0 1 0-.696 10.75 10.75 0 0 1 4.446-5.143" />
      <path d="m2 2 20 20" />
    </Svg>
  );
}

export function IconeMarca(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M20 6 9 17l-5-5" />
    </Svg>
  );
}

export function IconeMenos(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M5 12h14" />
    </Svg>
  );
}

export function IconeSetaBaixo(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="m6 9 6 6 6-6" />
    </Svg>
  );
}

export function IconeCarregando(props: PropsIcone) {
  return (
    <Svg {...props}>
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </Svg>
  );
}
