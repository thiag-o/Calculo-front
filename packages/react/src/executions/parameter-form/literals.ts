// The declaration of a parameter holds the fixed default and the allowed values as literals of the formula language
// (D86): `"A"`, `10`, `1.5`, `DATA(2026, 10, 1)`, `verdadeiro`. The form shows them in the Brazilian pattern and sends the
// values as the API text (`"A"`, `"10"`, `"2026-10-01"`). Only text is handled: a number never becomes a `number`.
import type { Schemas } from '../../api';

export type ParameterType = Schemas['ParameterType'];

/** The type of the elements of a parameter: `period` is not a scalar and has no literal of one piece. */
export type ScalarType = Exclude<ParameterType, 'period'>;

const TEXT_LITERAL = /^"((?:[^"]|"")*)"$/;
const NUMBER_LITERAL = /^[+-]?\d+(?:\.\d+)?$/;
const DATE_LITERAL = /^DATA\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)$/i;

function two(value: number | string): string {
  return String(value).padStart(2, '0');
}

/**
 * A literal of the language as the API text of its type, or `null` when it is not a literal of that type (then the
 * declaration is wrong and the analysis of the draft already points it out; the form just shows nothing).
 */
export function literalToApiText(literal: string, type: ScalarType): string | null {
  const text = literal.trim();
  switch (type) {
    case 'text': {
      const match = TEXT_LITERAL.exec(text);
      return match ? (match[1] ?? '').replaceAll('""', '"') : null;
    }
    case 'integer':
    case 'decimal':
      return NUMBER_LITERAL.test(text) ? text.replace(/^\+/, '') : null;
    case 'date': {
      const match = DATE_LITERAL.exec(text);
      return match ? `${match[1]}-${two(match[2] ?? '')}-${two(match[3] ?? '')}` : null;
    }
    case 'boolean': {
      const word = text.toLowerCase();
      return word === 'verdadeiro' ? 'true' : word === 'falso' ? 'false' : null;
    }
    default:
      return null;
  }
}

/** Shows an API number (`"1500.00"`, `"-3"`) in the Brazilian pattern (`1.500,00`, `-3`), keeping every decimal. */
export function formatApiNumber(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign = '', whole = '', decimals] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}${decimals === undefined ? '' : `,${decimals}`}`;
}

/** `2026-11-20` → `20/11/2026`, without going through a date (no time zone shift). */
export function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** ISO 8601 → `20/11/2026 10:30:00`, in the browser's time zone (the one the date was typed in). */
export function formatDateTime(value: string): string {
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return value;
  const date = `${two(moment.getDate())}/${two(moment.getMonth() + 1)}/${moment.getFullYear()}`;
  return `${date} ${two(moment.getHours())}:${two(moment.getMinutes())}:${two(moment.getSeconds())}`;
}

/** An API text of a type, as shown to people: the number with comma, the date as dd/mm/aaaa, the boolean in words. */
export function displayApiText(value: string, type: ScalarType): string {
  switch (type) {
    case 'integer':
    case 'decimal':
      return formatApiNumber(value);
    case 'date':
      return formatDate(value);
    case 'datetime':
      return formatDateTime(value);
    case 'boolean':
      return value === 'true' ? 'Verdadeiro' : 'Falso';
    default:
      return value;
  }
}
