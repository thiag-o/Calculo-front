// Texts of the values of the last "Calcular" on the canvas (pt-BR).
import type { StatusTone } from '../../../design-system';
import type { NodeRunStatus, RecordRunStatus } from './views';

/** The status of a node, as in the trace of the "Calcular" tab (estilos.md §7.5 and §8, "Debug"). */
export const NODE_RUN_STATUS: Readonly<Record<NodeRunStatus, { tone: StatusTone; word: string }>> = {
  ok: { tone: 'green', word: 'ok' },
  warning: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  not_run: { tone: 'gray', word: 'não rodado' },
};

/** The status of the record (estilos.md §7.5). */
export const RECORD_RUN_STATUS: Readonly<Record<RecordRunStatus, { tone: StatusTone; word: string }>> = {
  ok: { tone: 'green', word: 'ok' },
  ok_with_warnings: { tone: 'amber', word: 'com avisos' },
  error: { tone: 'red', word: 'erro' },
  ignored: { tone: 'gray', word: 'ignorado' },
  filtered: { tone: 'multi', word: 'filtrado' },
};

/** What the accessible name of a node adds after a run: "ok no último cálculo". Never only the color (estilos §11). */
export function runStatusText(status: NodeRunStatus): string {
  return `${NODE_RUN_STATUS[status].word} no último cálculo`;
}

/** The accessible name of a node with the status of the last run appended. */
export function withRunStatus(label: string, status: NodeRunStatus | undefined): string {
  return status ? `${label}, ${runStatusText(status)}` : label;
}

/** "Regra 2": the rule of the Decision Table that matched. */
export function ruleText(rule: number): string {
  return `Regra ${rule.toLocaleString('pt-BR')}`;
}

export const NO_RULE_TEXT = 'Nenhuma regra';

/** "1 linha encontrada", "3 linhas encontradas", "Nenhuma linha encontrada". */
export function rowsFoundText(count: number): string {
  if (count === 0) return 'Nenhuma linha encontrada';
  return count === 1 ? '1 linha encontrada' : `${count.toLocaleString('pt-BR')} linhas encontradas`;
}

export const RUN_BANNER_TEXT = 'Os valores são do último cálculo';
export const RUN_BANNER_LABEL = 'Valores do último cálculo';
export const CLEAR_RUN_LABEL = 'Limpar';
/** The list of the values of a block: "Valores de Pontos". */
export function runValuesLabel(name: string): string {
  return `Valores de ${name}`;
}
export const RUN_CLEARED_TEXT = 'Valores do último cálculo limpos';
export const RUN_SHOWN_TEXT = 'Os valores do último cálculo estão no canvas';

/** The record of the run, in the banner: "Registro ok", "Registro filtrado". */
export function recordText(status: RecordRunStatus): string {
  return `Registro ${RECORD_RUN_STATUS[status].word}`;
}
