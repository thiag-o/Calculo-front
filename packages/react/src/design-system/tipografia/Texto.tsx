import type { HTMLAttributes } from 'react';
import './tipografia.css';

/** Estilos da escala tipográfica (estilos.md §3). */
export const estilosTexto = [
  'heading-48',
  'heading-32',
  'heading-24',
  'heading-16',
  'heading-14',
  'copy-14',
  'label-14',
  'label-13',
  'label-12',
  'button-14',
  'mono-13',
  'mono-12',
] as const;

export type EstiloTexto = (typeof estilosTexto)[number];

/** Cor do texto: principal, secundário ou terciário (o terciário só para informação não essencial). */
export type TomTexto = 'principal' | 'secundario' | 'terciario';

type ElementoTexto = 'span' | 'p' | 'div' | 'h1' | 'h2' | 'h3' | 'h4' | 'h5' | 'h6' | 'strong' | 'em' | 'code';

export interface OpcoesTexto {
  estilo: EstiloTexto;
  tom?: TomTexto;
  /** Peso 500, para label-14, label-12 e mono-13. */
  medio?: boolean;
}

/** Classes fc- de um estilo de texto, para usar em elementos que não são o componente Texto. */
export function classesTexto({ estilo, tom, medio }: OpcoesTexto): string {
  return [`fc-${estilo}`, tom ? `fc-texto-${tom}` : null, medio ? 'fc-texto-medio' : null].filter(Boolean).join(' ');
}

export interface TextoProps extends OpcoesTexto, HTMLAttributes<HTMLElement> {
  /** Elemento HTML renderizado. Padrão: span. Títulos escolhem o nível (h1…h6) pela hierarquia da tela. */
  como?: ElementoTexto;
}

/** Texto na escala tipográfica do produto. */
export function Texto({ estilo, tom, medio, como: Elemento = 'span', className, ...resto }: TextoProps) {
  const classes = ['fc-texto', classesTexto({ estilo, tom, medio }), className].filter(Boolean).join(' ');
  return <Elemento className={classes} {...resto} />;
}
