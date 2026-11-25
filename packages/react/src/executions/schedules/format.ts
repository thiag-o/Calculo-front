// How a schedule reads (estilos.md §3, §7.3 and §10): dates in dd/mm, the last trigger as dot + word, the parameters
// summed up as in the execution list.
import type { Schemas } from '../../api';
import type { StatusTone } from '../../design-system';
import { parametersSummary } from '../list/format';
import { RELATIVE_LABELS } from '../parameter-form';
import type { Schedule } from './queries';

const formats = new Map<string, Intl.DateTimeFormat>();

function formatIn(timeZone: string | undefined): Intl.DateTimeFormat {
  const key = timeZone ?? '';
  let format = formats.get(key);
  if (!format) {
    const options: Intl.DateTimeFormatOptions = { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' };
    try {
      format = new Intl.DateTimeFormat('pt-BR', { ...options, ...(timeZone ? { timeZone } : {}) });
    } catch {
      // A time zone the browser does not know: the user's own, and the console says so (the hours would otherwise be wrong
      // without anyone noticing).
      console.warn(`O navegador não conhece o fuso ${timeZone}: os horários dos agendamentos aparecem no fuso do navegador.`);
      format = new Intl.DateTimeFormat('pt-BR', options);
    }
    formats.set(key, format);
  }
  return format;
}

/**
 * "01/12 às 02:00" (estilos.md §10), in the schedule's time zone: the same clock as the recurrence ("Todo dia 1 às 02:00"),
 * whatever the zone of whoever reads it. Empty for no date or an invalid one.
 */
export function scheduleDateTime(iso: string | null, timeZone?: string): string {
  if (iso === null) return '';
  const when = new Date(iso);
  if (Number.isNaN(when.getTime())) return '';
  const parts = formatIn(timeZone).formatToParts(when);
  const value = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? '';
  return `${value('day')}/${value('month')} às ${value('hour')}:${value('minute')}`;
}

/** "Horário de America/Sao_Paulo": the time zone of the hours, read only (E7-24). */
export function timeZoneNote(timeZone: string | undefined): string {
  return timeZone ? `Horário de ${timeZone}` : 'Horário do fuso configurado no sistema';
}

export interface OutcomePresentation {
  label: string;
  tone: StatusTone;
}

/**
 * The last trigger as dot + word (estilos.md §1.4), by `outcome`: it created the execution (`triggered`), the scope had
 * already been delivered and nothing ran (`skipped_overlap`), or it failed and nothing ran (`failed`). The words follow the
 * alerts of the bell ("Agendamento não executou", "Agendamento não disparou").
 */
export const OUTCOME_PRESENTATION: Readonly<Record<Schemas['ScheduleRunOutcome'], OutcomePresentation>> = {
  triggered: { label: 'Disparou', tone: 'green' },
  skipped_overlap: { label: 'Não executou', tone: 'amber' },
  failed: { label: 'Não disparou', tone: 'red' },
};

/** "periodo: Mês anterior · meta: 100,00": the relative by its label, the fixed value as in the execution list. */
export function scheduleParametersSummary(parameters: Schedule['parameters']): string {
  return Object.entries(parameters)
    .map(([name, parameter]) =>
      parameter.kind === 'relative' ? `${name}: ${RELATIVE_LABELS[parameter.value]}` : parametersSummary({ [name]: parameter.value }),
    )
    .join(' · ');
}

function revision(value: number): string {
  return value.toLocaleString('pt-BR');
}

/** "Roda a revisão 42 do rascunho salvo." (E7-24). */
export function runsRevisionNote(value: number): string {
  return `Roda a revisão ${revision(value)} do rascunho salvo.`;
}

/** "O rascunho está na revisão 57." (E7-24), when the draft moved after the schedule froze it. */
export function draftMovedNote(value: number): string {
  return `O rascunho está na revisão ${revision(value)}.`;
}

/** The second line of a schedule in the list: the frozen revision and, when the draft moved, where it is now. */
export function revisionLine(schedule: Pick<Schedule, 'draft_revision' | 'current_draft_revision'>): string {
  const base = `Revisão ${revision(schedule.draft_revision)}`;
  return schedule.current_draft_revision !== schedule.draft_revision
    ? `${base} · rascunho na ${revision(schedule.current_draft_revision)}`
    : base;
}
