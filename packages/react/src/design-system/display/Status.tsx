import type { HTMLAttributes, ReactNode } from 'react';
import './markers.css';

/**
 * Dot color (estilos.md §7.3 and §7.5). Never blue (§12).
 * - `gray` (gray-500): Na fila, Cancelada, Sem entrega, ignored
 * - `amber` (amber-700): Calculando, Aguardando fonte/estado, with warnings
 * - `green` (green-700): Entregue, ok
 * - `red` (red-700): Com erros, Abortada, error
 * - `decision` (cat-decision): locked
 * - `multi` (cat-multi): filtered
 */
export type StatusTone = 'gray' | 'amber' | 'green' | 'red' | 'decision' | 'multi';

export interface StatusProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  tone: StatusTone;
  /** The status word ("Com erros"). Required: the status is never only the color (estilos.md §11). Never "Status: …". */
  children: ReactNode;
  /** The dot pulses only while "Calculando" or "Na fila" (estilos.md §5). Still with `prefers-reduced-motion`. */
  pulsing?: boolean;
}

/** Status as dot + word (estilos.md §1.4): "● Com erros". The dot is decorative; the word is the content. */
export function Status({ tone: tone, pulsing = false, className, children, ...rest }: StatusProps) {
  const classes = ['fc-status', `fc-status-${tone}`, pulsing ? 'fc-status-pulsing' : null, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...rest}>
      <span className="fc-status-dot" aria-hidden="true" />
      <span className="fc-status-word">{children}</span>
    </span>
  );
}
