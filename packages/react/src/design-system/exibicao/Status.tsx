import type { HTMLAttributes, ReactNode } from 'react';
import './marcadores.css';

/**
 * Cor do ponto (estilos.md §7.3 e §7.5). Nunca azul (§12).
 * - `cinza` (gray-500): Na fila, Cancelada, Sem entrega, ignorado
 * - `ambar` (amber-700): Calculando, Aguardando fonte/estado, com avisos
 * - `verde` (green-700): Entregue, ok
 * - `vermelho` (red-700): Com erros, Abortada, erro
 * - `decisao` (cat-decision): bloqueado
 * - `multiplo` (cat-multi): filtrado
 */
export type CorStatus = 'cinza' | 'ambar' | 'verde' | 'vermelho' | 'decisao' | 'multiplo';

export interface StatusProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  cor: CorStatus;
  /** A palavra do status ("Com erros"). Obrigatória: o status nunca é só a cor (estilos.md §11). Nunca "Status: …". */
  children: ReactNode;
  /** O ponto pulsa só enquanto "Calculando" ou "Na fila" (estilos.md §5). Parado com `prefers-reduced-motion`. */
  pulsando?: boolean;
}

/** Status por ponto + palavra (estilos.md §1.4): "● Com erros". O ponto é decorativo; a palavra é o conteúdo. */
export function Status({ cor, pulsando = false, className, children, ...resto }: StatusProps) {
  const classes = ['fc-status', `fc-status-${cor}`, pulsando ? 'fc-status-pulsando' : null, className].filter(Boolean).join(' ');
  return (
    <span className={classes} {...resto}>
      <span className="fc-status-ponto" aria-hidden="true" />
      <span className="fc-status-palavra">{children}</span>
    </span>
  );
}
