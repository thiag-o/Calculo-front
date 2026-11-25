// The states of an execution (E6-8) as people see them: dot + word (estilos.md §7.3).
import type { Schemas } from '../../api';
import type { StatusTone } from '../../design-system';

/** The state of an execution (generated from the contract). */
export type ExecutionStatus = Schemas['ExecutionStatus'];
/** `batch` (delivers the CSV) or `simulation` (the batch without delivery, epic 7), generated from the contract. */
export type ExecutionMode = Schemas['ExecutionMode'];

/** A state never changes again once reached. */
export const FINAL_STATUSES: readonly ExecutionStatus[] = ['completed', 'completed_with_errors', 'aborted', 'cancelled'];

/** Whether the execution may still change (not in a final state). */
export function isRunning(status: ExecutionStatus): boolean {
  return !FINAL_STATUSES.includes(status);
}

export interface StatusPresentation {
  label: string;
  tone: StatusTone;
  /** The dot pulses only while "Na fila" or "Calculando" (estilos.md §5). */
  pulsing: boolean;
}

/**
 * The label and the dot of each state (estilos.md §7.3): the phases `loading`, `pre_validating`, `calculating`, `delivering` and
 * `comparing` are all "Calculando" (E7-21); `awaiting_decision` is a wait, without pulse; a finished execution with delivery is "Entregue".
 */
export const STATUS_PRESENTATION: Readonly<Record<ExecutionStatus, StatusPresentation>> = {
  pending: { label: 'Na fila', tone: 'gray', pulsing: true },
  loading: { label: 'Calculando', tone: 'amber', pulsing: true },
  calculating: { label: 'Calculando', tone: 'amber', pulsing: true },
  delivering: { label: 'Calculando', tone: 'amber', pulsing: true },
  pre_validating: { label: 'Calculando', tone: 'amber', pulsing: true },
  comparing: { label: 'Calculando', tone: 'amber', pulsing: true },
  awaiting_decision: { label: 'Aguardando decisão', tone: 'amber', pulsing: false },
  awaiting_source: { label: 'Aguardando fonte', tone: 'amber', pulsing: false },
  completed: { label: 'Entregue', tone: 'green', pulsing: false },
  completed_with_errors: { label: 'Com erros', tone: 'red', pulsing: false },
  aborted: { label: 'Abortada', tone: 'red', pulsing: false },
  cancelled: { label: 'Cancelada', tone: 'gray', pulsing: false },
};

/** A simulation that finished without errors delivers nothing: "Sem entrega", gray dot (estilos.md §7.3, E7-21). */
export const NO_DELIVERY_PRESENTATION: StatusPresentation = { label: 'Sem entrega', tone: 'gray', pulsing: false };

/** The dot and the word of one execution: the state, except a simulation finished without errors, which is "Sem entrega". */
export function statusPresentation(execution: { status: ExecutionStatus; mode: ExecutionMode }): StatusPresentation {
  if (execution.mode === 'simulation' && execution.status === 'completed') return NO_DELIVERY_PRESENTATION;
  return STATUS_PRESENTATION[execution.status];
}

/** The mode filter of the list (E7-21): batches or simulations, one at a time. */
export const MODE_CHOICES: readonly { value: ExecutionMode; label: string }[] = [
  { value: 'batch', label: 'Lotes' },
  { value: 'simulation', label: 'Simulações' },
];

/** A choice of the status filter: one label of estilos.md §7.3 and the API states it stands for. */
export interface StatusChoice {
  value: string;
  label: string;
  statuses: readonly ExecutionStatus[];
}

/** The status filter, one label at a time (as the audit type filter, D3): "Calculando" covers its five phases. */
export const STATUS_CHOICES: readonly StatusChoice[] = [
  { value: 'pending', label: 'Na fila', statuses: ['pending'] },
  { value: 'running', label: 'Calculando', statuses: ['loading', 'pre_validating', 'calculating', 'delivering', 'comparing'] },
  { value: 'awaiting_decision', label: 'Aguardando decisão', statuses: ['awaiting_decision'] },
  { value: 'awaiting_source', label: 'Aguardando fonte', statuses: ['awaiting_source'] },
  { value: 'completed', label: 'Entregue', statuses: ['completed'] },
  { value: 'completed_with_errors', label: 'Com erros', statuses: ['completed_with_errors'] },
  { value: 'aborted', label: 'Abortada', statuses: ['aborted'] },
  { value: 'cancelled', label: 'Cancelada', statuses: ['cancelled'] },
];
