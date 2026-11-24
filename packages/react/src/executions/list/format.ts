// How an execution reads in the list (estilos.md §3 and §10): dates, duration, records and parameters in the Brazilian
// pattern. The parameter values are the resolved ones the execution froze, without their declaration.
import type { Execution } from '../api';
import { formatApiNumber, formatDate } from '../../design-system';

const dateTimeFormat = new Intl.DateTimeFormat('pt-BR', {
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

/** "21/11/2026 às 15:00", in the user's time zone; empty for an invalid date (the table shows "—"). */
export function dateTime(iso: string | null): string {
  if (iso === null) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const parts = dateTimeFormat.formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')}/${value('year')} às ${value('hour')}:${value('minute')}`;
}

/** "12s", "4m 12s", "1h 05m" (estilos.md §3). */
export function formatDuration(milliseconds: number): string {
  const seconds = Math.max(0, Math.floor(milliseconds / 1000));
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ${String(seconds % 60).padStart(2, '0')}s`;
  return `${Math.floor(minutes / 60)}h ${String(minutes % 60).padStart(2, '0')}m`;
}

/**
 * How long the execution ran: from when the worker took it to when it finished or, while it runs, to `now`. Empty while it
 * waits in the queue (nobody took it yet).
 */
export function executionDuration(execution: Pick<Execution, 'started_at' | 'finished_at'>, now: Date): string {
  if (execution.started_at === null) return '';
  const start = new Date(execution.started_at).getTime();
  const end = execution.finished_at === null ? now.getTime() : new Date(execution.finished_at).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return '';
  return formatDuration(end - start);
}

function count(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** "1.180 ok · 12 com erro"; empty while nothing was read. The ones with warnings count as ok (they are delivered). */
export function recordsSummary(totals: Execution['totals']): string {
  if (totals.read === 0) return '';
  return `${count(totals.ok + totals.ok_with_warnings)} ok · ${count(totals.error)} com erro`;
}

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const NUMBER = /^-?\d+(?:\.\d+)?$/;
/** A list shows up to this many values; the rest becomes "+N". */
const LIST_SHOWN = 3;

function scalar(value: string | boolean): string {
  if (typeof value === 'boolean') return value ? 'Verdadeiro' : 'Falso';
  if (DATE.test(value)) return formatDate(value);
  if (NUMBER.test(value)) return formatApiNumber(value);
  return value;
}

function parameterValue(value: Execution['parameters'][string]): string {
  if (Array.isArray(value)) {
    const shown = value.slice(0, LIST_SHOWN).map(scalar).join(', ');
    return value.length > LIST_SHOWN ? `${shown} +${value.length - LIST_SHOWN}` : shown;
  }
  if (typeof value === 'object') return `${formatDate(value.start)} a ${formatDate(value.end)}`;
  return scalar(value);
}

/** "periodo: 01/10/2026 a 31/10/2026 · categorias: A, B"; empty without parameters. */
export function parametersSummary(parameters: Execution['parameters']): string {
  return Object.entries(parameters)
    .map(([name, value]) => `${name}: ${parameterValue(value)}`)
    .join(' · ');
}
