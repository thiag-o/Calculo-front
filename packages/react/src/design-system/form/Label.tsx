import type { LabelHTMLAttributes } from 'react';
import { textClasses } from '../typography';
import './field.css';

export type LabelProps = LabelHTMLAttributes<HTMLLabelElement>;

/** Field label, above it: secondary label-13 (estilos.md §7.2). Bind it to the field through `htmlFor`. */
export function Label({ className, ...rest }: LabelProps) {
  const classes = ['fc-label', textClasses({ variant: 'label-13', emphasis: 'secondary' }), className].filter(Boolean).join(' ');
  return <label className={classes} {...rest} />;
}
