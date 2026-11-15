import type { HTMLAttributes, ReactNode } from 'react';
import './marcadores.css';

/**
 * Família do selo (estilos.md §7.4). Sem ponto: o ponto é só do Status de execução.
 * - `cinza` (gray-200): Rascunho, Configurador, contagens
 * - `azul` (blue-100/blue-900): Em revisão, Cliente (o único uso de azul fora de link e foco, §12)
 * - `verde`: Aprovada, Publicada
 * - `ambar`: "1 teste falhando", aviso
 * - `vermelho`: Abortada (em resumo), contagem de problemas
 */
export type CorSelo = 'cinza' | 'azul' | 'verde' | 'ambar' | 'vermelho';

export interface SeloProps extends Omit<HTMLAttributes<HTMLSpanElement>, 'children'> {
  /** Padrão: `cinza`. */
  cor?: CorSelo;
  children: ReactNode;
}

/** Selo (badge) para o que não é execução (estilos.md §7.4): 20px, pílula, texto 11px/500. */
export function Selo({ cor = 'cinza', className, ...resto }: SeloProps) {
  const classes = ['fc-selo', `fc-selo-${cor}`, className].filter(Boolean).join(' ');
  return <span className={classes} {...resto} />;
}
