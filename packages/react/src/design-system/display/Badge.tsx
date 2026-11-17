import type { HTMLAttributes, ReactNode } from 'react';
import './markers.css';

/**
 * Badge family (estilos.md §7.4). No dot: the dot belongs only to the execution Status.
 * - `gray` (gray-200): Rascunho, Configurador, counts
 * - `blue` (blue-100/blue-900): Em revisão, Cliente (the only use of blue outside links and focus, §12)
 * - `green`: Aprovada, Publicada
 * - `amber`: "1 teste falhando", warning
 * - `red`: Abortada (in summaries), problem counts
 */
export type BadgeTone = 'gray' | 'blue' | 'green' | 'amber' | 'red';

export interface BadgeProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Default: `gray`. */
  tone?: BadgeTone;
  children: ReactNode;
}

/** Badge for what is not an execution (estilos.md §7.4): 20px, pill, 11px/500 text. */
export function Badge({ tone: tone = 'gray', className, ...rest }: BadgeProps) {
  const classes = ['fc-badge', `fc-badge-${tone}`, className].filter(Boolean).join(' ');
  return <span className={classes} {...rest} />;
}
