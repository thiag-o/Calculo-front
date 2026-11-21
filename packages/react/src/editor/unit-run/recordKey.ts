// The record key of "Calcular" with a batch source (E5-12): the fields typed (always text, as on screen), how they go to
// the API (`RecordKey`, every value as text) and how a key of the preview sample fills them.
import type { Schemas } from '../../api';
import type { DraftSymbol, WorkflowDefinition } from '../draft';
import { formatApiNumber, readBrazilianNumber } from './numbers';
import type { DataType, FieldErrors, TypedValues } from './values';

export type RecordKey = Schemas['RecordKey'];

/** A variable of the record key, with the type the analysis gives it (`null` while unknown). */
export interface KeyField {
  name: string;
  type: DataType | null;
  scale: number | null;
}

/** The message at the key field when the API finds no record with the key (`404 record_not_found`). */
export const RECORD_NOT_FOUND_MESSAGE = 'Nenhum registro com essa chave.';

/** The variables of the record key, in the order of the batch source, typed by the symbols of the analysis. */
export function keyFields(definition: WorkflowDefinition, symbols: readonly DraftSymbol[]): KeyField[] {
  const key = definition.root.batch_source?.key ?? [];
  return key.map((name) => {
    const symbol = symbols.find((candidate) => candidate.name === name && candidate.cardinality === 'linear');
    return { name, type: symbol?.type ?? null, scale: symbol?.scale ?? null };
  });
}

/**
 * The field the key variable is typed in: a number in the Brazilian pattern (E4-24), a date with the browser's picker;
 * any other type as text, as the API takes the key.
 */
export function keyFieldType(field: KeyField): DataType {
  return field.type === 'integer' || field.type === 'decimal' || field.type === 'date' ? field.type : 'text';
}

function isNumber(field: KeyField): boolean {
  return field.type === 'integer' || field.type === 'decimal';
}

export type KeyReading = { ok: true; key: RecordKey } | { ok: false; errors: FieldErrors };

/**
 * Reads the key typed for `POST …/unit-runs` (`record_key`): every variable of the key goes, as text. An empty value or a
 * number that cannot be read is an error at its field, and nothing is sent. `incomplete` has the date fields the browser
 * holds half typed.
 */
export function readRecordKey(fields: readonly KeyField[], typed: TypedValues, incomplete: ReadonlySet<string> = new Set()): KeyReading {
  const key: RecordKey = {};
  const errors: FieldErrors = {};
  for (const field of fields) {
    const raw = typed[field.name];
    const text = typeof raw === 'string' ? raw : '';
    if (keyFieldType(field) === 'date' && incomplete.has(field.name) && text.trim() === '') {
      errors[field.name] = 'Digite a data completa.';
      continue;
    }
    if (text.trim() === '') {
      errors[field.name] = `Digite o valor de ${field.name}.`;
      continue;
    }
    if (isNumber(field)) {
      const reading = readBrazilianNumber(text, field.type === 'integer' ? 0 : field.scale);
      if (reading.ok) key[field.name] = reading.value;
      else errors[field.name] = reading.message;
      continue;
    }
    key[field.name] = keyFieldType(field) === 'text' ? text : text.trim();
  }
  return Object.keys(errors).length > 0 ? { ok: false, errors } : { ok: true, key };
}

/** A key of the API (a record of the preview sample) as the fields show it: numbers in the Brazilian pattern. */
export function typedFromKey(fields: readonly KeyField[], key: RecordKey): TypedValues {
  const typed: TypedValues = {};
  for (const field of fields) {
    const value = key[field.name] ?? '';
    typed[field.name] = isNumber(field) ? formatApiNumber(value) : value;
  }
  return typed;
}

/** Whether a key has exactly the variables of the record key (a sample from before the key changed does not). */
export function hasKeyOf(fields: readonly KeyField[], key: RecordKey): boolean {
  const names = Object.keys(key);
  return names.length === fields.length && fields.every((field) => field.name in key);
}

/** Two keys with the same values. */
export function sameKey(a: RecordKey, b: RecordKey): boolean {
  const names = Object.keys(a);
  return names.length === Object.keys(b).length && names.every((name) => a[name] === b[name]);
}

/** A key on screen, in the order of its variables: `nf_id 10 · item_seq 1`. */
export function keyText(key: RecordKey): string {
  return Object.entries(key)
    .map(([name, value]) => `${name} ${value}`)
    .join(' · ');
}
