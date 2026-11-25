// The rules of a run parameter (E6-3, E6-17; Contratos do back, "Parâmetro na definição"): the types and their labels,
// what each type takes (a list, allowed values, relative defaults), and how a value typed in the Brazilian pattern becomes
// a literal of the formula language and back (D86: `"A"`, `1500.50`, `DATA(2026, 10, 1)`). Every change here keeps the
// parameter in the shape the engine accepts, so the draft is never saved with a shape error (ADR 0046). Only text is
// handled: a value never becomes a floating-point `number` (E4-4).
import type { Schemas } from '../../api';
import { DATA_TYPE_LABELS } from '../../catalog';
import type { WorkflowDefinition } from '../draft';
import { formatApiNumber, readBrazilianNumber, type SelectOption } from '../../design-system';

export type WorkflowParameter = Schemas['WorkflowParameter'];
export type ParameterType = Schemas['ParameterType'];
export type ParameterDefault = Schemas['ParameterDefault'];
export type RelativeDefault = Schemas['RelativeDefault'];
export type PeriodLiteral = Schemas['PeriodLiteral'];
export type TraceLevel = Schemas['TraceLevel'];
export type AllowedValuesQuery = Schemas['AllowedValuesQuery'];
/**
 * The types with a literal of their own: every parameter type but the `period` (whose ends are dates) and the `datetime`,
 * which the language has no literal for (D36: no fixed default, only none or the relative `now`).
 */
export type ValueType = Exclude<ParameterType, 'period' | 'datetime'>;

/** The most parameters a workflow takes (Contratos, E6-3). */
export const PARAMETERS_MAX = 20;
/** The most values in a list default and in the allowed values (the contract's `maxItems`). */
export const LITERALS_MAX = 100;
/** The longest description (the contract's `maxLength`). */
export const DESCRIPTION_MAX = 500;

const PARAMETER_TYPES: readonly ParameterType[] = ['text', 'integer', 'decimal', 'date', 'datetime', 'boolean', 'period'];

export const PARAMETER_TYPE_LABELS: Readonly<Record<ParameterType, string>> = { ...DATA_TYPE_LABELS, period: 'Período' };

export const PARAMETER_TYPE_OPTIONS: readonly SelectOption[] = PARAMETER_TYPES.map((value) => ({ value, label: PARAMETER_TYPE_LABELS[value] }));

/** Each relative default serves one type only (the contract's `RelativeDefault`); the other types have none. */
const RELATIVES: Readonly<Record<ParameterType, readonly RelativeDefault[]>> = {
  text: [],
  integer: [],
  decimal: [],
  date: ['today', 'yesterday', 'first_day_of_current_month', 'first_day_of_previous_month', 'last_day_of_previous_month'],
  datetime: ['now'],
  boolean: [],
  period: ['current_month', 'previous_month', 'last_7_days', 'last_30_days'],
};

/**
 * The relative defaults a parameter can take. A list takes none: a relative resolves to one value, and the contract only
 * writes the list default as a list of literals.
 */
export function relativesFor(type: ParameterType, list: boolean): readonly RelativeDefault[] {
  return list ? [] : RELATIVES[type];
}

/** The `datetime` has no fixed default, only none or the relative `now` (D36): the language has no literal for it. */
export function takesFixedDefault(type: ParameterType): boolean {
  return type !== 'datetime';
}

/** The `period` and the `boolean` are never a list (Contratos, E6-3). */
export function takesList(type: ParameterType): boolean {
  return type !== 'period' && type !== 'boolean';
}

/** Allowed values only in `text`, `integer` and `date` (Contratos, E6-3). */
export function takesAllowedValues(type: ParameterType): boolean {
  return type === 'text' || type === 'integer' || type === 'date';
}

/** How a parameter's values are restricted (E7-23): none, a closed list of literals, or a query to a catalog dataset. */
export type AllowedValuesKind = 'none' | 'list' | 'query';

export const ALLOWED_VALUES_KIND_LABELS: Readonly<Record<AllowedValuesKind, string>> = { none: 'Nenhum', list: 'Lista', query: 'Consulta' };

export function allowedValuesKind(parameter: WorkflowParameter): AllowedValuesKind {
  const allowed = parameter.allowed_values;
  if (allowed === null) return 'none';
  return Array.isArray(allowed) ? 'list' : 'query';
}

/** The literals of a closed list, or an empty list for none and for a query. */
export function allowedList(parameter: WorkflowParameter | null): readonly string[] {
  const allowed = parameter?.allowed_values;
  return Array.isArray(allowed) ? allowed : [];
}

/** The query of the allowed values, or `null` for none and for a list. */
export function allowedQuery(parameter: WorkflowParameter | null): AllowedValuesQuery | null {
  const allowed = parameter?.allowed_values ?? null;
  return allowed === null || Array.isArray(allowed) ? null : allowed;
}

/** Why a query filter takes no `@` (the engine's `parameter_in_allowed_values`): the values are read before any run. */
export const QUERY_PARAMETER_REFUSAL = 'A consulta dos valores permitidos não aceita parâmetros. Use um valor fixo.';

export const TRACE_LEVEL_LABELS: Readonly<Record<TraceLevel, string>> = {
  minimal: 'Mínimo',
  standard: 'Padrão',
  full: 'Completo',
};

export const TRACE_LEVEL_OPTIONS: readonly SelectOption[] = (['minimal', 'standard', 'full'] as const).map((value) => ({
  value,
  label: TRACE_LEVEL_LABELS[value],
}));

/** What each trace level keeps of each record (design §12, "Trace por registro"; E6-11). */
export const TRACE_LEVEL_NOTES: Readonly<Record<TraceLevel, string>> = {
  minimal: 'Guarda só os hashes das entradas e da saída: prova se o dado mudou, sem os valores.',
  standard: 'Guarda os valores das entradas, dos blocos e da saída de cada registro.',
  full: 'Guarda o mesmo que o Padrão; as linhas dos Múltiplos entram numa versão seguinte.',
};

export const ERROR_LIMIT_NOTE = 'A execução para sem entregar nada quando os registros com erro passam deste percentual.';
export const PRE_VALIDATION_ALERT_NOTE = 'A pré-validação avisa quando uma variável da fonte do lote tem mais vazios que isso.';
export const PERCENT_RULE_MESSAGE = 'Use um percentual de 0 a 100, com até 2 casas, como 2,5.';

// The contract's pattern of `error_limit_percent` and `pre_validation_alert_percent`: from 0 to 100, with up to 2 places.
const PERCENT = /^(100(\.0{1,2})?|[0-9]{1,2}(\.[0-9]{1,2})?)$/;

/** A percent typed in the Brazilian pattern (`2,5`) as the API text (`"2.5"`), or `null` when it cannot be written. */
export function readPercent(text: string): string | null {
  const reading = readBrazilianNumber(text, 2);
  return reading.ok && PERCENT.test(reading.value) ? reading.value : null;
}

/** The defaults of the contract for the settings a draft of an older form lacks (version 3, then version 4). */
export const DEFAULT_ERROR_LIMIT_PERCENT = '5';
export const DEFAULT_TRACE_LEVEL: TraceLevel = 'standard';
export const DEFAULT_PRE_VALIDATION_ALERT_PERCENT = '1';

export function formatPercent(value: string): string {
  return formatApiNumber(value);
}

export const PARAMETER_NAME_TAKEN_MESSAGE = 'Já existe um parâmetro com este nome. Escolha outro.';

/** A new parameter: a free name (`parametro_1`, `parametro_2`…), text, optional, without default nor restriction. */
export function newParameter(definition: WorkflowDefinition): WorkflowParameter {
  const taken = new Set(definition.parameters.map((parameter) => parameter.name));
  let number = 1;
  while (taken.has(`parametro_${number}`)) number += 1;
  return {
    name: `parametro_${number}`,
    type: 'text',
    required: false,
    list: false,
    scale: null,
    default: null,
    allowed_values: null,
    description: null,
  };
}

/** Types whose literals are written the same way: `integer` and `decimal` keep the values between them. */
function literalFamily(type: ParameterType): string {
  return type === 'integer' || type === 'decimal' ? 'number' : type;
}

/**
 * The parameter after its type changed: the places only in the `decimal` (the workflow's default places when it had none),
 * no list where the type takes none, a relative default only if it serves the new type, and the fixed default and the
 * allowed values only while they are written the same way (between `integer` and `decimal`); otherwise they go.
 */
export function withParameterType(parameter: WorkflowParameter, type: ParameterType, defaultScale: number): WorkflowParameter {
  if (type === parameter.type) return parameter;
  const list = takesList(type) && parameter.list;
  const same = literalFamily(type) === literalFamily(parameter.type);
  const current = parameter.default;
  let fallback: ParameterDefault | null = null;
  if (current?.kind === 'relative' && relativesFor(type, list).includes(current.value)) fallback = current;
  else if (current?.kind === 'fixed' && same && takesFixedDefault(type)) fallback = current;
  return {
    ...parameter,
    type,
    list,
    scale: type === 'decimal' ? (parameter.scale ?? defaultScale) : null,
    default: fallback,
    allowed_values: takesAllowedValues(type) && same ? parameter.allowed_values : null,
  };
}

/** The parameter as a list or not: a fixed default passes to a list of one value (or to its first value). */
export function withList(parameter: WorkflowParameter, list: boolean): WorkflowParameter {
  if (list === parameter.list || (list && !takesList(parameter.type))) return parameter;
  const current = parameter.default;
  let next: ParameterDefault | null = current;
  if (current?.kind === 'relative' && list) next = null;
  else if (current?.kind === 'fixed') {
    const value = current.value;
    if (list) next = { kind: 'fixed', value: [typeof value === 'string' ? value : ''] };
    else next = { kind: 'fixed', value: Array.isArray(value) ? (value[0] ?? '') : value };
  }
  return { ...parameter, list, default: next };
}

/** The kinds of default the "Padrão" control offers. */
export type DefaultKind = 'none' | 'fixed' | 'relative';

export function defaultKind(parameter: WorkflowParameter): DefaultKind {
  return parameter.default === null ? 'none' : parameter.default.kind;
}

/**
 * The default of the kind chosen: a fixed one starts empty in the parameter's shape (one value, a list of one, or the two
 * ends of the period), for the analysis to point out until it is filled; a relative one starts at the first that serves
 * the type.
 */
export function defaultOfKind(parameter: WorkflowParameter, kind: DefaultKind): ParameterDefault | null {
  if (kind === 'none') return null;
  if (kind === 'relative') {
    const first = relativesFor(parameter.type, parameter.list)[0];
    return first === undefined ? null : { kind: 'relative', value: first };
  }
  if (!takesFixedDefault(parameter.type)) return null;
  if (parameter.type === 'period') return { kind: 'fixed', value: { start: '', end: '' } };
  return { kind: 'fixed', value: parameter.list ? [''] : '' };
}

/** The literal of a typed value, or why it cannot be written. */
export type LiteralReading = { ok: true; value: string } | { ok: false; message: string };

export const DATE_RULE_MESSAGE = 'Escolha uma data válida.';

export const BOOLEAN_LITERALS = { true: 'verdadeiro', false: 'falso' } as const;

const DATE_INPUT = /^(\d{4})-(\d{2})-(\d{2})$/;
const DATE_LITERAL = /^DATA\(\s*(\d{1,4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)$/i;

/** Whether the day exists (a text typed as `2026-02-30` is not a date, and the picker could not show it). */
function isCalendarDate(year: number, month: number, day: number): boolean {
  const date = new Date(0);
  date.setUTCFullYear(year, month - 1, day);
  return year >= 1 && date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
}

/**
 * The literal of the formula language for what the field holds (D86):
 * - empty goes empty (the analysis says the value is missing);
 * - text between double quotes, with the quote doubled inside (`"A"`);
 * - a number typed as `1.500,50` goes as `1500.50`, with at most the parameter's places;
 * - a date of the date picker (`2026-10-01`) goes as `DATA(2026, 10, 1)`;
 * - a boolean as `verdadeiro` or `falso`.
 */
export function toLiteral(type: ValueType, scale: number | null, text: string): LiteralReading {
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
      if (!match || !isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) {
        return { ok: false, message: DATE_RULE_MESSAGE };
      }
      const [, year, month, day] = match;
      return { ok: true, value: `DATA(${Number(year)}, ${Number(month)}, ${Number(day)})` };
    }
    case 'boolean':
      // The select only offers `verdadeiro` and `falso`.
      return { ok: true, value: text };
  }
}

/**
 * What the field shows for a literal of the definition, the inverse of `toLiteral`, or `null` when the literal does not
 * fit the field's picker (a date not written as `DATA(a, m, d)` or not in the calendar, a boolean that is not `verdadeiro` nor `falso`): then the field
 * shows the literal as it is, in a text field.
 */
export function fromLiteral(type: ValueType, literal: string): string | null {
  if (literal === '') return '';
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
      if (!match) return null;
      // A day the calendar does not have (`DATA(2026, 2, 30)`, `DATA(2026, 13, 1)`) fits no picker: the field shows the text.
      if (!isCalendarDate(Number(match[1]), Number(match[2]), Number(match[3]))) return null;
      const [, year, month, day] = match;
      return `${year!.padStart(4, '0')}-${month!.padStart(2, '0')}-${day!.padStart(2, '0')}`;
    }
    case 'boolean': {
      const lower = literal.toLowerCase();
      return lower === BOOLEAN_LITERALS.true || lower === BOOLEAN_LITERALS.false ? lower : null;
    }
  }
}
