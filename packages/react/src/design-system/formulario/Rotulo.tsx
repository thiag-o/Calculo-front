import type { LabelHTMLAttributes } from 'react';
import { classesTexto } from '../tipografia';
import './campo.css';

export type RotuloProps = LabelHTMLAttributes<HTMLLabelElement>;

/** Rótulo de campo, acima dele: label-13 secundário (estilos.md §7.2). Ligue ao campo por `htmlFor`. */
export function Rotulo({ className, ...resto }: RotuloProps) {
  const classes = ['fc-rotulo', classesTexto({ estilo: 'label-13', tom: 'secundario' }), className].filter(Boolean).join(' ');
  return <label className={classes} {...resto} />;
}
