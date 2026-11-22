// The rules of a filter (Contratos do back, "Filtros"; E5-1): the operators each type takes, how many values each operator
// takes, and how a typed value becomes a literal of the formula language (E4-3) and back. Numbers are typed in the
// Brazilian pattern (E4-24) and go as text with a dot; nothing here becomes a floating-point `number` (E4-4).
import type { Schemas } from '../../../api';
import { formatApiNumber, readBrazilianNumber } from '../../values';

export type DataType = Schemas['DataType'];
export type FilterOperator = Schemas['FilterOperator'];

/** The most values an `in` takes (the contract's `maxItems`). */
export const IN_VALUES_MAX = 100;
/** The most filters a source takes (Contratos, "Limites"). */
export const FILTERS_MAX = 20;

/** Every operator, in the order the select lists them. */
export const FILTER_OPERATORS: readonly FilterOperator[] = ['=', '<>', '>', '>=', '<', '<=', 'between', 'in', 'is_null', 'is_not_null'];
/** A text only compares by `=`, `<>` and `in`, besides the null ones (the rule of E4-8). */
const TEXT_OPERATORS: readonly FilterOperator[] = ['=', '<>', 'in', 'is_null', 'is_not_null'];
/** A boolean only by `=` and `<>`, besides the null ones (the rule of E4-8). */
const BOOLEAN_OPERATORS: readonly FilterOperator[] = ['=', '<>', 'is_null', 'is_not_null'];

/** The operators as the design writes them (design §6, "Fonte do lote"). */
export const OPERATOR_LABELS: Readonly<Record<FilterOperator, string>> = {
  '=': '=',
  '<>': '≠',
  '>': '>',
  '>=': '>=',
  '<': '<',
  '<=': '<=',
  between: 'ENTRE',
  in: 'EM (lista)',
  is_null: 'É NULO',
  is_not_null: 'NÃO É NULO',
};

/** The operators a variable of `type` takes. */
export function operatorsFor(type: DataType): readonly FilterOperator[] {
  if (type === 'text') return TEXT_OPERATORS;
  if (type === 'boolean') return BOOLEAN_OPERATORS;
  return FILTER_OPERATORS;
}

export function isNullOperator(operator: FilterOperator): boolean {
  return operator === 'is_null' || operator === 'is_not_null';
}

/**
 * The values for `operator`, kept from `previous` where they fit: none in the null ones, two in `between`, a list of 1 to
 * 100 in `in` and one in the others. A missing value is empty (the analysis points it out).
 */
export function valuesFor(operator: FilterOperator, previous: readonly string[]): string[] {
  if (isNullOperator(operator)) return [];
  if (operator === 'between') return [previous[0] ?? '', previous[1] ?? ''];
  if (operator === 'in') return previous.length > 0 ? previous.slice(0, IN_VALUES_MAX) : [''];
  return [previous[0] ?? ''];
}

/** Types whose literals are written the same way: `integer` and `decimal` keep the values between them. */
function literalFamily(type: DataType): string {
  return type === 'integer' || type === 'decimal' ? 'number' : type;
}

/**
 * The filter after its variable changed from `from` to `to`: an operator the new type does not take goes back to `=`, and
 * the values written for another kind of literal are emptied (their number stays).
 */
export function withVariableType(
  filter: { operator: FilterOperator; values: readonly string[] },
  from: DataType | undefined,
  to: DataType,
): { operator: FilterOperator; values: string[] } {
  const operator = operatorsFor(to).includes(filter.operator) ? filter.operator : '=';
  const same = from !== undefined && literalFamily(from) === literalFamily(to);
  const kept = same ? filter.values : filter.values.map(() => '');
  return { operator, values: valuesFor(operator, kept) };
}

/** A value that starts with `@` is a run parameter (`@lojas`, `@periodo.inicio`, E6-18): it goes as typed. */
export function isParameter(text: string): boolean {
  return text.trimStart().startsWith('@');
}

/** The literal of a typed value, or why it cannot be written. */
export type LiteralReading = { ok: true; value: string } | { ok: false; message: string };

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_LITERAL = /^DATA\(\s*(\d{1,4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)$/i;

/**
 * The literal of the formula language for what was typed:
 * - a parameter (`@periodo`) goes as typed;
 * - empty goes empty (the analysis says the value is missing);
 * - text between double quotes, with the quote doubled inside (`"A"`);
 * - a number typed as `1.500,50` goes as `1500.50`, with at most the variable's places;
 * - a date of the date picker (`2026-10-01`) goes as `DATA(2026, 10, 1)`;
 * - a boolean as `verdadeiro` or `falso`;
 * - a `datetime` has no literal of its own in the language: it goes as typed, only in ISO 8601 with the time zone.
 */
export function toLiteral(type: DataType, scale: number | null, text: string): LiteralReading {
  if (isParameter(text)) return { ok: true, value: text.trim() };
  if (text === '') return { ok: true, value: '' };
  switch (type) {
    case 'text':
      return { ok: true, value: `"${text.replaceAll('"', '""')}"` };
    case 'integer':
      return readBrazilianNumber(text, 0);
    case 'decimal':
      return readBrazilianNumber(text, scale);
    case 'date': {
      const match = DATE_INPUT.exec(text);
      if (!match) return { ok: false, message: 'Escolha uma data válida.' };
      const [, year, month, day] = match;
      return { ok: true, value: `DATA(${Number(year)}, ${Number(month)}, ${Number(day)})` };
    }
    case 'datetime':
      return isIsoDateTime(text) ? { ok: true, value: text } : { ok: false, message: DATETIME_RULE_MESSAGE };
    default:
      return { ok: true, value: text };
  }
}

// ISO 8601 with the time zone (`Z` or `±hh:mm`), like the API takes a `datetime` (D22 of the front, as in D65 Q5).
const ISO_DATETIME = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2})(?:\.\d{1,6})?)?(?:Z|[+-](\d{2}):(\d{2}))$/;

export const DATETIME_RULE_MESSAGE = 'Use data e hora em ISO 8601 com fuso, como 2026-10-01T08:00:00-03:00.';

/** Whether `text` is a real moment in ISO 8601 with the time zone. */
export function isIsoDateTime(text: string): boolean {
  const match = ISO_DATETIME.exec(text);
  if (!match) return false;
  const [, year, month, day, hour, minute, second = '0', zoneHour = '0', zoneMinute = '0'] = match;
  if (Number(second) > 59 || Number(zoneHour) > 23 || Number(zoneMinute) > 59) return false;
  // Build the moment from the numbers of the text and compare back: a day that does not exist rolls over and differs.
  // `setUTCFullYear` keeps years below 100 from being read as 19xx.
  const built = new Date(0);
  built.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
  built.setUTCHours(Number(hour), Number(minute), 0, 0);
  return (
    built.getUTCFullYear() === Number(year) &&
    built.getUTCMonth() === Number(month) - 1 &&
    built.getUTCDate() === Number(day) &&
    built.getUTCHours() === Number(hour) &&
    built.getUTCMinutes() === Number(minute)
  );
}

/** What the field shows for a literal of the definition: the inverse of `toLiteral` (anything else shows as it is). */
export function fromLiteral(type: DataType, literal: string): string {
  if (literal === '' || isParameter(literal)) return literal;
  switch (type) {
    case 'text': {
      const match = /^"((?:[^"]|"")*)"$/s.exec(literal);
      return match ? match[1]!.replaceAll('""', '"') : literal;
    }
    case 'integer':
    case 'decimal':
      return formatApiNumber(literal);
    case 'date': {
      const match = DATE_LITERAL.exec(literal);
      if (!match) return literal;
      const [, year, month, day] = match;
      return `${year!.padStart(4, '0')}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
    }
    default:
      return literal;
  }
}

/** Whether a date literal can be shown in the date picker (empty or `DATA(a, m, d)`). */
export function fitsDatePicker(literal: string): boolean {
  return literal === '' || DATE_LITERAL.test(literal);
}

export const BOOLEAN_LITERALS = { true: 'verdadeiro', false: 'falso' } as const;
