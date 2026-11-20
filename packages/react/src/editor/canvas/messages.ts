// Texts of the canvas on screen (pt-BR).
import type { BlockKind } from './graph';

/** The block type beside its name (11px, tertiary) and in the toolbar. */
export const BLOCK_KIND_LABELS: Readonly<Record<BlockKind, string>> = {
  calculation: 'Cálculo',
  decision_table: 'Tabela de Decisão',
};

/** "1 problema", "3 problemas". */
export function problemsText(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/** The accessible name of a block on the canvas: "Pontos, Cálculo, 1 problema". */
export function blockLabel(name: string, kind: BlockKind, problems: number): string {
  return [name, BLOCK_KIND_LABELS[kind], problems > 0 ? problemsText(problems) : null].filter(Boolean).join(', ');
}

/** The Delete confirmation: who still reads the block's output (from the `dependencies` of the analysis). */
export function readersText(readers: number): string {
  if (readers === 0) return 'Nenhum bloco usa a saída dele.';
  if (readers === 1) return '1 bloco usa a saída dele e passa a mostrar problema.';
  return `${readers.toLocaleString('pt-BR')} blocos usam a saída dele e passam a mostrar problema.`;
}

/** What the keyboard does on a block (its `aria-describedby`). */
export const BLOCK_KEYS_HELP = 'Enter abre as propriedades, as setas movem o bloco, Delete remove e Esc tira a seleção.';
export const BLOCK_KEYS_HELP_READ_ONLY = 'Enter abre as propriedades e Esc tira a seleção.';

/** The announcement after a block moved by the keyboard. */
export function movedText(name: string, x: number, y: number): string {
  return `${name} na posição ${Math.round(x)}, ${Math.round(y)}`;
}

/** A link, for screen readers: "fator, de Elegibilidade para Pontos". */
export function linkLabel(name: string, source: string, target: string): string {
  return `${name}, de ${source} para ${target}`;
}
