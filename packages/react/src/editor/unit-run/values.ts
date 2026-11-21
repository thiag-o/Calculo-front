// The form of the "Calcular" tab, generated from the declared inputs (E4-14, E4-24): what is typed (always text, as on
// screen), how it goes to the API (`Value`) and how the result values are shown.
import type { Schemas } from '../../api';
import type { DraftSymbol, WorkflowDefinition } from '../draft';
import { formatApiNumber, readBrazilianNumber } from './numbers';

export type DataType = Schemas['DataType'];
export type Value = Schemas['Value'];
export type DeclaredInput = WorkflowDefinition['root']['inputs'][number];

/** An item of a multiple input: what was typed in each field, by field name. `id` only keeps the row on screen. */
export interface TypedItem {
  id: number;
  fields: Record<string, string>;
}

/**
 * What was typed, by input name. A linear input is the text of the field (`''` is empty; a boolean is `''`, `'true'` or
 * `'false'`); a multiple input is the list of its items.
 */
export type TypedValues = Record<string, string | TypedItem[]>;

/** The errors of the form, by API path: `valor_item`, `pontuacoes[1].taxa` (0-based item) or `pontuacoes`. */
export type FieldErrors = Record<string, string>;

/** The path of a field of a multiple input's item, as the API names it in `invalid_inputs`. */
export function itemFieldPath(input: string, index: number, field: string): string {
  return `${input}[${index}].${field}`;
}

export function typedLinear(values: TypedValues, name: string): string {
  const value = values[name];
  return typeof value === 'string' ? value : '';
}

export function typedItems(values: TypedValues, name: string): TypedItem[] {
  const value = values[name];
  return Array.isArray(value) ? value : [];
}

/** A typed text turned into the API value of its type, or the reason it was refused. */
type Reading = { ok: true; value: Value } | { ok: false; message: string };

/** The places of a declared number: 0 for `integer`, the `scale` for `decimal` (none declared: no limit here). */
function placesOf(type: DataType, scale: number | null | undefined): number | null {
  if (type === 'integer') return 0;
  return scale ?? null;
}

function readDateTime(text: string): Reading {
  // The field gives the local date and time (`2026-11-20T10:30` or with seconds); the API takes ISO 8601 in UTC.
  const moment = new Date(text);
  if (Number.isNaN(moment.getTime())) return { ok: false, message: incompleteMessage('datetime') };
  return { ok: true, value: moment.toISOString() };
}

/** The message of a date field the browser holds as incomplete (it reports an empty value). */
export function incompleteMessage(type: DataType): string {
  return type === 'datetime' ? 'Digite a data e a hora completas.' : 'Digite a data completa.';
}

/**
 * Reads what was typed in a field of type `type`. Empty is null (E4-14); in a number, date or boolean field, only spaces
 * is empty too (a text keeps what was typed). `incomplete`: the browser holds a date it cannot read (half typed), which it
 * reports as empty; it is refused, not sent as null.
 */
export function readTyped(text: string, type: DataType, scale?: number | null, incomplete = false): Reading {
  if ((type === 'date' || type === 'datetime') && incomplete && text.trim() === '') return { ok: false, message: incompleteMessage(type) };
  if (text === '' || (type !== 'text' && text.trim() === '')) return { ok: true, value: null };
  switch (type) {
    case 'integer':
    case 'decimal': {
      const reading = readBrazilianNumber(text, placesOf(type, scale));
      return reading.ok ? { ok: true, value: reading.value } : reading;
    }
    case 'boolean':
      return { ok: true, value: text === 'true' };
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? { ok: true, value: text } : { ok: false, message: incompleteMessage('date') };
    case 'datetime':
      return readDateTime(text);
    default:
      return { ok: true, value: text };
  }
}

/** The result of reading the whole form: the `inputs` of the request, or the errors by path. */
export type FormReading = { ok: true; inputs: Record<string, Value> } | { ok: false; errors: FieldErrors };

/**
 * Reads the form for `POST …/unit-runs`: every declared input goes, an empty field as null and an empty multiple input as
 * an empty list (E4-14). A value that cannot go (a number with more places than the input, a broken date) is an error at
 * its field, and nothing is sent. `incomplete` has the paths of the date fields the browser holds half typed.
 */
export function readForm(inputs: readonly DeclaredInput[], values: TypedValues, incomplete: ReadonlySet<string> = new Set()): FormReading {
  const result: Record<string, Value> = {};
  const errors: FieldErrors = {};
  for (const input of inputs) {
    if (input.cardinality === 'multiple') {
      const items = typedItems(values, input.name).map((item, index) => {
        const read: Record<string, string | boolean | null> = {};
        for (const field of input.fields) {
          const path = itemFieldPath(input.name, index, field.name);
          const reading = readTyped(item.fields[field.name] ?? '', field.type, field.scale, incomplete.has(path));
          if (reading.ok) read[field.name] = reading.value as string | boolean | null;
          else errors[path] = reading.message;
        }
        return read;
      });
      result[input.name] = items;
    } else {
      const reading = readTyped(typedLinear(values, input.name), input.type, input.scale, incomplete.has(input.name));
      if (reading.ok) result[input.name] = reading.value;
      else errors[input.name] = reading.message;
    }
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, inputs: result };
}

/** The errors of the form as typed now, by path (shown after a field loses the focus or on "Calcular"). */
export function formErrors(inputs: readonly DeclaredInput[], values: TypedValues, incomplete: ReadonlySet<string> = new Set()): FieldErrors {
  const reading = readForm(inputs, values, incomplete);
  return reading.ok ? {} : reading.errors;
}

type DefinitionNode = WorkflowDefinition['root']['nodes'][number];

/** Every node of the definition, the ones inside groups too, in the order of the definition. */
export function allNodes(definition: WorkflowDefinition): DefinitionNode[] {
  const nodes: DefinitionNode[] = [];
  const visit = (list: readonly DefinitionNode[]) => {
    for (const node of list) {
      nodes.push(node);
      if (node.type === 'group') visit(node.nodes);
    }
  };
  visit(definition.root.nodes);
  return nodes;
}

/**
 * The type of each linear variable: from the symbols of the analysis (the batch source and the Source blocks, whose types
 * come from the catalog), then from the definition itself (inputs, Calculation outputs and Decision Table results, the
 * ones inside groups too), which wins.
 */
export function variableTypes(definition: WorkflowDefinition, symbols: readonly DraftSymbol[] = []): Map<string, DataType> {
  const types = new Map<string, DataType>();
  for (const symbol of symbols) if (symbol.cardinality === 'linear' && symbol.type !== null) types.set(symbol.name, symbol.type);
  for (const input of definition.root.inputs) if (input.cardinality === 'linear') types.set(input.name, input.type);
  for (const node of allNodes(definition)) {
    if (node.type === 'calculation') types.set(node.output.name, node.output.type);
    else if (node.type === 'decision_table') for (const result of node.results) types.set(result.name, result.type);
  }
  return types;
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026-11-20` → `20/11/2026`, without going through a date (no time zone shift). */
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** ISO 8601 → `20/11/2026 10:30:00`, in the browser's time zone (the one the date was typed in). */
function formatDateTime(value: string): string {
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return value;
  const date = `${two(moment.getDate())}/${two(moment.getMonth() + 1)}/${moment.getFullYear()}`;
  return `${date} ${two(moment.getHours())}:${two(moment.getMinutes())}:${two(moment.getSeconds())}`;
}

/** Empty values on screen (estilos.md §1.2). */
export const NO_VALUE = '—';

/**
 * A value of the result on screen (estilos.md §3): numbers as `1.500,00`, dates as `20/11/2026`, booleans as
 * "verdadeiro" and "falso", null as "—". `type` is the variable's declared type, when known.
 */
export function formatValue(value: Value, type: DataType | undefined): string {
  if (value === null) return NO_VALUE;
  if (typeof value === 'boolean') return value ? 'verdadeiro' : 'falso';
  if (Array.isArray(value)) return value.length === 1 ? 'lista com 1 item' : `lista com ${value.length.toLocaleString('pt-BR')} itens`;
  switch (type) {
    case 'integer':
    case 'decimal':
      return formatApiNumber(value);
    case 'date':
      return formatDate(value);
    case 'datetime':
      return formatDateTime(value);
    default:
      return value;
  }
}
