// What is typed in the parameters form, how it goes to the API (`ParameterValue`) and how a parameter starts (E6-5, E4-24).
import { ApiError, type Schemas } from '../../api';
import { literalToApiText, type ScalarType } from './literals';
import { formatApiNumber, readBrazilianNumber } from '../../design-system';

export type WorkflowParameter = Schemas['WorkflowParameter'];
export type ParameterValue = Schemas['ParameterValue'];

/** The part of a field the browser holds half typed (it reports an empty value; see `validity.badInput`). */
export type ParameterPart = 'text' | 'start' | 'end';

/**
 * What is typed in one parameter.
 * - `usingDefault`: the relative default is still in use; the parameter is not sent and the execution resolves it;
 * - `text`: a scalar. A number is typed as on screen (`1.500,5`); a date is `aaaa-mm-dd`; a datetime is the local
 *   date and time; a boolean is `''`, `'true'` or `'false'`. With `allowed_values`, it is the API text of the chosen one;
 * - `start` and `end`: the two dates of a period (`aaaa-mm-dd`);
 * - `items`: a list, as API texts (the chosen allowed values, or the tags).
 */
export interface ParameterFieldState {
  usingDefault: boolean;
  text: string;
  start: string;
  end: string;
  items: readonly string[];
  incomplete: readonly ParameterPart[];
}

/** What was typed, by parameter name. A parameter that is not here is still as its declaration starts it. */
export type ParameterFormValues = Readonly<Record<string, ParameterFieldState>>;

/** The errors of the form, by parameter name. */
export type ParameterErrors = Readonly<Record<string, string>>;

/** Whether the parameter is chosen among the `allowed_values` (a closed list) and not typed. */
export function hasAllowedValues(parameter: WorkflowParameter): boolean {
  // Only the list form is a closed list here for now; the query form (values read from the API) comes with F124.
  return Array.isArray(parameter.allowed_values) && parameter.allowed_values.length > 0;
}

/** The type of the elements of a parameter that is not a period. */
export function scalarType(parameter: WorkflowParameter): ScalarType {
  return parameter.type === 'period' ? 'text' : parameter.type;
}

function typedFromApi(apiText: string, parameter: WorkflowParameter): string {
  if (hasAllowedValues(parameter)) return apiText;
  return parameter.type === 'integer' || parameter.type === 'decimal' ? formatApiNumber(apiText) : apiText;
}

/** How a parameter starts: with its fixed default typed in, or on the relative default, or empty. */
export function initialFieldState(parameter: WorkflowParameter): ParameterFieldState {
  const empty: ParameterFieldState = { usingDefault: false, text: '', start: '', end: '', items: [], incomplete: [] };
  const fallback = parameter.default;
  if (fallback === null) return empty;
  if (fallback.kind === 'relative') return { ...empty, usingDefault: true };

  const value = fallback.value;
  if (parameter.type === 'period') {
    if (typeof value === 'string' || Array.isArray(value)) return empty;
    return {
      ...empty,
      start: literalToApiText(value.start, 'date') ?? '',
      end: literalToApiText(value.end, 'date') ?? '',
    };
  }
  const type = scalarType(parameter);
  if (parameter.list) {
    const literals = Array.isArray(value) ? value : typeof value === 'string' ? [value] : [];
    return { ...empty, items: literals.map((literal) => literalToApiText(literal, type)).filter((item): item is string => item !== null) };
  }
  if (typeof value !== 'string') return empty;
  const apiText = literalToApiText(value, type);
  return apiText === null ? empty : { ...empty, text: typedFromApi(apiText, parameter) };
}

/** The state of a parameter in the form. */
export function fieldState(values: ParameterFormValues, parameter: WorkflowParameter): ParameterFieldState {
  return values[parameter.name] ?? initialFieldState(parameter);
}

/** A typed text read as the API value of its type, or the reason it was refused. `null` is empty. */
export type ScalarReading = { ok: true; value: string | boolean | null } | { ok: false; message: string };

export function incompleteMessage(type: ScalarType): string {
  return type === 'datetime' ? 'Digite a data e a hora completas.' : 'Digite a data completa.';
}

/**
 * Reads what was typed in a field of a scalar type. Empty is not sent (null here). `incomplete`: the browser holds a date
 * it cannot read, which it reports as empty; it is refused, not dropped.
 */
export function readScalar(text: string, type: ScalarType, scale: number | null, incomplete = false): ScalarReading {
  if ((type === 'date' || type === 'datetime') && incomplete && text.trim() === '') return { ok: false, message: incompleteMessage(type) };
  if (text === '' || (type !== 'text' && text.trim() === '')) return { ok: true, value: null };
  switch (type) {
    case 'integer':
    case 'decimal': {
      const reading = readBrazilianNumber(text, type === 'integer' ? 0 : scale);
      return reading.ok ? { ok: true, value: reading.value } : reading;
    }
    case 'boolean':
      return { ok: true, value: text === 'true' };
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? { ok: true, value: text } : { ok: false, message: incompleteMessage('date') };
    case 'datetime': {
      // The field gives the local date and time; the API takes ISO 8601 in UTC.
      const moment = new Date(text);
      return Number.isNaN(moment.getTime()) ? { ok: false, message: incompleteMessage('datetime') } : { ok: true, value: moment.toISOString() };
    }
    default:
      return { ok: true, value: text };
  }
}

const PERIOD_MISSING_PART = 'Informe o início e o fim do período.';

/** The warning of a period whose start is after its end (the back refuses it too: `invalid_parameter`). */
export function periodWarning(state: Pick<ParameterFieldState, 'start' | 'end'>): string | null {
  return state.start !== '' && state.end !== '' && state.start > state.end ? 'O início do período vem depois do fim. Confira as datas.' : null;
}

/** The error of what is typed in one parameter, or `null` when it can go (or is empty). */
export function readParameter(parameter: WorkflowParameter, state: ParameterFieldState): { value: ParameterValue | null; error: string | null } {
  const nothing = { value: null, error: null };
  if (state.usingDefault) return nothing;

  if (parameter.type === 'period') {
    const startOpen = state.incomplete.includes('start') && state.start === '';
    const endOpen = state.incomplete.includes('end') && state.end === '';
    if (startOpen || endOpen) return { value: null, error: incompleteMessage('date') };
    if (state.start === '' && state.end === '') return nothing;
    if (state.start === '' || state.end === '') return { value: null, error: PERIOD_MISSING_PART };
    // An inverted period still goes: the back answers `invalid_parameter` at this field.
    return { value: { start: state.start, end: state.end }, error: null };
  }

  if (parameter.list) return state.items.length === 0 ? nothing : { value: [...state.items], error: null };

  if (hasAllowedValues(parameter)) return state.text === '' ? nothing : { value: state.text, error: null };

  const reading = readScalar(state.text, scalarType(parameter), parameter.scale, state.incomplete.includes('text'));
  if (!reading.ok) return { value: null, error: reading.message };
  return { value: reading.value, error: null };
}

/** The result of reading the whole form: the `parameters` of the request, or the errors by parameter name. */
export type ParametersReading = { ok: true; parameters: Record<string, ParameterValue> } | { ok: false; errors: ParameterErrors };

/**
 * Reads the form for the `parameters` of the request (execution, preview and unit run). A parameter left empty, or still on
 * its relative default, is not sent: the back uses the default (or answers `missing_parameter` if it is required without
 * one). A value that cannot go (a number with more places, a half-typed date) is an error at its field, and nothing is sent.
 */
export function readParameters(parameters: readonly WorkflowParameter[], values: ParameterFormValues): ParametersReading {
  const result: Record<string, ParameterValue> = {};
  const errors: Record<string, string> = {};
  for (const parameter of parameters) {
    const { value, error } = readParameter(parameter, fieldState(values, parameter));
    if (error !== null) errors[parameter.name] = error;
    else if (value !== null) result[parameter.name] = value;
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, parameters: result };
}

/** `missing_parameter` and `invalid_parameter` (`422`): the message of each parameter by its name, or `null` for another error. */
export function parameterErrorsFrom(error: unknown): ParameterErrors | null {
  return error instanceof ApiError && (error.code === 'missing_parameter' || error.code === 'invalid_parameter') ? error.fields : null;
}
