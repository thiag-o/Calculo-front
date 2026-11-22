// How the panel of an execution reads (E6-21; estilos.md §3, §7.3 and §10): the phases, the progress, the resolved
// parameters, the trace level and why the CSV cannot be downloaded. Brazilian pattern for numbers and dates.
import type { Schemas } from '../../api';
import { isRunning, type Execution } from '../api';
import { dateTime } from '../list/format';
import { formatApiNumber, formatDate } from '../parameter-form/literals';

export type PhaseState = 'done' | 'current' | 'waiting' | 'stopped' | 'todo';

export interface Phase {
  key: 'load' | 'calculate' | 'deliver';
  label: string;
  state: PhaseState;
}

/** How each phase state is read (it also goes to the screen reader, beside the phase). */
export const PHASE_STATE_WORDS: Readonly<Record<PhaseState, string>> = {
  done: 'concluída',
  current: 'em andamento',
  waiting: 'aguardando a fonte',
  stopped: 'interrompida',
  todo: 'a fazer',
};

const PHASES: readonly Omit<Phase, 'state'>[] = [
  { key: 'load', label: 'Carga' },
  { key: 'calculate', label: 'Cálculo' },
  { key: 'deliver', label: 'Entrega' },
];

/**
 * Where the execution stopped or waits: the load while the batch was not counted yet (`total_records` null), the
 * calculation while records are missing, otherwise the delivery.
 */
function reachedPhase(execution: Execution): number {
  if (execution.total_records === null) return 0;
  return execution.progress.records_done < execution.total_records ? 1 : 2;
}

/** Carga → Cálculo → Entrega, each with its state (E6-8: `awaiting_source` takes the place of `loading` or `calculating`). */
export function executionPhases(execution: Execution): Phase[] {
  let at = -1;
  let state: PhaseState = 'current';
  switch (execution.status) {
    case 'pending':
      at = -1;
      break;
    case 'loading':
      at = 0;
      break;
    case 'calculating':
      at = 1;
      break;
    case 'delivering':
      at = 2;
      break;
    case 'awaiting_source':
      at = execution.total_records === null ? 0 : 1;
      state = 'waiting';
      break;
    case 'completed':
    case 'completed_with_errors':
      at = PHASES.length;
      break;
    case 'aborted':
    case 'cancelled':
      at = reachedPhase(execution);
      state = 'stopped';
      break;
  }
  return PHASES.map((phase, index) => ({ ...phase, state: index < at ? 'done' : index === at ? state : 'todo' }));
}

function count(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** The records done over the total, once the batch was counted: "1.180 de 2.400 registros · 49%". */
export interface Progress {
  done: number;
  total: number;
  percent: number;
  text: string;
}

export function executionProgress(execution: Execution): Progress | null {
  const total = execution.total_records;
  if (total === null) return null;
  const done = Math.min(execution.progress.records_done, total);
  const percent = total === 0 ? 100 : Math.floor((done / total) * 100);
  const records = total === 1 ? 'registro' : 'registros';
  return { done, total, percent, text: `${count(done)} de ${count(total)} ${records} · ${percent}%` };
}

/** The trace levels (E6-17). */
export const TRACE_LEVEL_LABELS: Readonly<Record<Schemas['TraceLevel'], string>> = {
  minimal: 'Mínimo',
  standard: 'Padrão',
  full: 'Completo',
};

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;

function scalar(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Verdadeiro' : 'Falso';
  if (DATE.test(value)) return formatDate(value);
  if (NUMBER.test(value)) return formatApiNumber(value);
  return value === '' ? '—' : value;
}

/** A resolved parameter, whole: "01/10/2026 a 31/10/2026", "A, B, C, D", "100,00". */
export function parameterText(value: Execution['parameters'][string]): string {
  if (Array.isArray(value)) return value.length > 0 ? value.map(scalar).join(', ') : 'Nenhum valor';
  if (typeof value === 'object' && value !== null) return `${formatDate(value.start)} a ${formatDate(value.end)}`;
  return scalar(value);
}

/** "5%", "2,5%" (the limit comes as API text). */
export function percentText(value: string): string {
  return `${formatApiNumber(value)}%`;
}

/** Whether the delivered file can no longer be downloaded (the deadline passed). */
export function outputExpired(execution: Execution, now: Date): boolean {
  if (execution.status !== 'completed' && execution.status !== 'completed_with_errors') return false;
  if (!execution.output.available) return true;
  const until = execution.output.expires_at ? new Date(execution.output.expires_at).getTime() : Number.NaN;
  return !Number.isNaN(until) && until <= now.getTime();
}

/** Why "Baixar CSV" is disabled (E6-21: running, aborted, cancelled or expired); `undefined` when it can download. */
export function downloadReason(execution: Execution, now: Date): string | undefined {
  if (isRunning(execution.status)) return 'O CSV fica disponível quando a execução terminar';
  if (execution.status === 'aborted') return 'Execução abortada não entrega CSV';
  if (execution.status === 'cancelled') return 'Execução cancelada não entrega CSV';
  if (outputExpired(execution, now)) {
    const until = execution.output.expires_at ? dateTime(execution.output.expires_at) : '';
    return until ? `O prazo para baixar o CSV acabou em ${until}` : 'O prazo para baixar o CSV acabou';
  }
  return undefined;
}

/** "1.180 linhas · disponível até 28/11/2026 às 15:04". */
export function outputSummary(execution: Execution): string {
  const rows = execution.output.rows;
  const lines = rows === null ? '' : rows === 1 ? '1 linha' : `${count(rows)} linhas`;
  const until = execution.output.expires_at ? `disponível até ${dateTime(execution.output.expires_at)}` : '';
  return [lines, until].filter(Boolean).join(' · ');
}

/** The first 8 characters of the id, as the execution is told apart in the list (mono, estilos.md §7.6). */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

export { count as countText };
