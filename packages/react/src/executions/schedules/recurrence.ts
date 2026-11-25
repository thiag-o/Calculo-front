// The recurrence of a schedule (E7-7, E7-24): the text people read in the list and the fields of the dialog.
import type { Schemas } from '../../api';

/** The recurrence of a schedule (generated from the contract): daily, weekly or monthly, at a local `HH:MM`. */
export type Recurrence = Schemas['Recurrence'];
export type RecurrenceKind = Recurrence['kind'];
/** The day of a monthly recurrence: 1 to 28, or the last day of the month. */
export type MonthDay = Schemas['MonthlyRecurrence']['day'];

/** Diária | Semanal | Mensal, in this order. */
export const RECURRENCE_KINDS: readonly { value: RecurrenceKind; label: string }[] = [
  { value: 'daily', label: 'Diária' },
  { value: 'weekly', label: 'Semanal' },
  { value: 'monthly', label: 'Mensal' },
];

/** The ISO 8601 weekdays (1 is Monday), with the name of the field and the one inside a sentence. */
export const WEEKDAYS: readonly { day: number; label: string; inSentence: string; masculine: boolean }[] = [
  { day: 1, label: 'Segunda', inSentence: 'segunda', masculine: false },
  { day: 2, label: 'Terça', inSentence: 'terça', masculine: false },
  { day: 3, label: 'Quarta', inSentence: 'quarta', masculine: false },
  { day: 4, label: 'Quinta', inSentence: 'quinta', masculine: false },
  { day: 5, label: 'Sexta', inSentence: 'sexta', masculine: false },
  { day: 6, label: 'Sábado', inSentence: 'sábado', masculine: true },
  { day: 7, label: 'Domingo', inSentence: 'domingo', masculine: true },
];

/** The last day a monthly recurrence takes by number; after it, only "Último dia" (the contract stops at 28). */
export const LAST_NUMBERED_DAY = 28;

function joinWords(words: readonly string[]): string {
  if (words.length <= 1) return words.join('');
  return `${words.slice(0, -1).join(', ')} e ${words[words.length - 1]}`;
}

/**
 * The recurrence in words (E7-24): "Todo dia às 02:00", "Toda segunda e quinta às 08:00", "Todo dia 1 às 02:00" and
 * "Todo último dia do mês às 23:00". The hour is the local one of the schedule's time zone.
 */
export function recurrenceText(recurrence: Recurrence): string {
  const at = `às ${recurrence.time}`;
  switch (recurrence.kind) {
    case 'daily':
      return `Todo dia ${at}`;
    case 'weekly': {
      const days = WEEKDAYS.filter((weekday) => recurrence.weekdays.includes(weekday.day));
      if (days.length === WEEKDAYS.length) return `Todo dia ${at}`;
      if (days.length === 0) return `Semanal ${at}`;
      // The article agrees with the first day: "Toda segunda", "Todo sábado".
      const article = days[0]!.masculine ? 'Todo' : 'Toda';
      return `${article} ${joinWords(days.map((weekday) => weekday.inSentence))} ${at}`;
    }
    case 'monthly':
      return recurrence.day === 'last' ? `Todo último dia do mês ${at}` : `Todo dia ${recurrence.day} ${at}`;
  }
}

/** What the recurrence fields of the dialog hold: every kind keeps its own choice while another one is picked. */
export interface RecurrenceFields {
  kind: RecurrenceKind;
  /** As typed. */
  time: string;
  weekdays: readonly number[];
  day: MonthDay;
}

/** A new schedule: daily, no hour yet, Monday on the weekly and day 1 on the monthly. */
export const NEW_RECURRENCE: RecurrenceFields = { kind: 'daily', time: '', weekdays: [1], day: 1 };

/** The fields of a saved recurrence. */
export function recurrenceFields(recurrence: Recurrence): RecurrenceFields {
  return {
    ...NEW_RECURRENCE,
    kind: recurrence.kind,
    time: recurrence.time,
    ...(recurrence.kind === 'weekly' ? { weekdays: recurrence.weekdays } : {}),
    ...(recurrence.kind === 'monthly' ? { day: recurrence.day } : {}),
  };
}

const TIME = /^([01]?\d|2[0-3]):([0-5]\d)$/;

/** The errors of the recurrence fields, by field. */
export interface RecurrenceErrors {
  time?: string;
  weekdays?: string;
  /** The day of the month of a monthly recurrence. */
  day?: string;
}

export type RecurrenceReading = { ok: true; recurrence: Recurrence } | { ok: false; errors: RecurrenceErrors };

/** Reads the fields into the `recurrence` of the contract: the hour as `HH:MM` ("8:00" becomes "08:00"), the days in order. */
export function readRecurrence(fields: RecurrenceFields): RecurrenceReading {
  const errors: RecurrenceErrors = {};
  const typed = fields.time.trim();
  const match = TIME.exec(typed);
  if (typed === '') errors.time = 'Informe o horário, como 02:00.';
  else if (!match) errors.time = 'Use o formato HH:MM, de 00:00 a 23:59.';
  const weekdays = [...new Set(fields.weekdays)].sort((a, b) => a - b);
  if (fields.kind === 'weekly' && weekdays.length === 0) errors.weekdays = 'Escolha pelo menos um dia da semana.';
  if (!match || errors.weekdays) return { ok: false, errors };
  const time = `${match[1]!.padStart(2, '0')}:${match[2]}`;
  switch (fields.kind) {
    case 'daily':
      return { ok: true, recurrence: { kind: 'daily', time } };
    case 'weekly':
      return { ok: true, recurrence: { kind: 'weekly', time, weekdays } };
    case 'monthly':
      return { ok: true, recurrence: { kind: 'monthly', time, day: fields.day } };
  }
}
