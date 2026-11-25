// The batch of the epic 7 simulation (pnpm e2e), over the epic 5 and epic 6 engines: the records of a run with the counts of
// each Fonte block, the pre-validation (E7-1 to E7-3), the scope of an execution (E7-6), the values of a query of allowed
// values (E7-5) and the check and the comparison of a reference file (E7-10, E7-11), as the backend describes them
// (../backend/docs/plano.md, Contratos, "Pré-validação, agendamento e arquivo de referência"). Test support, not the
// product: the front never evaluates.
//
// The epic 5 engine reads only its own catalog: the datasets of the empties and of the defects are read as the items they
// copy (same columns), and each of their rows is calculated with the item of the same key, with the values of the row.
import { createHash } from 'node:crypto';
import { ITEMS, STORES, variablesOf, type CatalogDataset, type CellValue } from '../../epic-5/support/campaign';
import { analyze, findRecord, runRecord, type UnitRunTrace } from '../../epic-5/support/engine';
import { DEFECTS, DEFECTS_VARIABLES, ITEMS_DATE_VARIABLE, ITEMS_WITH_DATE } from '../../epic-6/support/campaign';
import { analyzeDefinition, bindDefinition, previewWith, resolveParameters, resultKeyOf, runKeyWith, type ParameterValues, type Resolution } from '../../epic-6/support/engine';
import { CATALOG } from '../../epic-5/support/campaign';
import { EXAMPLES, type Schemas } from '../../support/contract';
import { EMPTIES, EMPTIES_VARIABLES } from './campaign';

type Definition = Schemas['WorkflowDefinition'];
type WorkflowNode = Definition['root']['nodes'][number];
type Parameter = Schemas['WorkflowParameter'];
type Value = Schemas['Value'];

export type { ParameterValues, Resolution };

/** One record of a batch: what the records list, the trace, the CSV and the comparison say about it. */
export interface BatchRecord {
  recordKey: Record<string, string | null>;
  /** The `result_key`; null in the key errors and in an empty row, which have no trace. */
  resultKey: string | null;
  status: Schemas['UnitRunStatus'];
  errorNodeId: string | null;
  errorCode: Schemas['RecordFailureCode'] | null;
  trace: UnitRunTrace | null;
  /** What each Fonte block found for the record (the counts of the panel, E7-1). */
  sources: Record<string, SourceOutcome>;
}

/** What a Fonte block found for one record: the counts of the preview (E5-11). */
export type SourceOutcome = 'found' | 'no_match' | 'multiple_rows' | 'kept' | 'filtered';

/** The catalog the simulation serves: the epic 6 one and the empties. */
export const EPIC7_CATALOG: readonly CatalogDataset[] = [...CATALOG.map((dataset) => (dataset.id === ITEMS.id ? ITEMS_WITH_DATE : dataset)), DEFECTS, EMPTIES];

/** The datasets that copy the items, with their variables. */
const COPIES: ReadonlyMap<string, { dataset: CatalogDataset; variables: readonly Schemas['Variable'][] }> = new Map([
  [DEFECTS.id, { dataset: DEFECTS, variables: DEFECTS_VARIABLES }],
  [EMPTIES.id, { dataset: EMPTIES, variables: EMPTIES_VARIABLES }],
]);

const ITEM_VARIABLES = [...variablesOf(ITEMS), ITEMS_DATE_VARIABLE];

/** The definition read from the items: a batch source over a copy of them is moved to the items' own variables. */
export function asItems(definition: Definition): Definition {
  const source = definition.root.batch_source;
  const copy = source ? COPIES.get(source.dataset_id) : undefined;
  if (!source || !copy) return definition;
  const outputs = source.outputs.map((output) => {
    const column = copy.variables.find((variable) => variable.id === output.variable_id)?.column;
    return { ...output, variable_id: ITEM_VARIABLES.find((variable) => variable.column === column)?.id ?? output.variable_id };
  });
  return { ...definition, root: { ...definition.root, batch_source: { ...source, dataset_id: ITEMS.id, outputs } } };
}

/** The analysis of a draft (epic 6), over the items when the batch source copies them. */
export function analysisOf(definition: Definition): Schemas['Analysis'] {
  return analyzeDefinition(asItems(definition));
}

export function previewOf(definition: Definition, values: ParameterValues, size: number): Schemas['Preview'] {
  return previewWith(asItems(definition), values, size);
}

export function unitRunOf(definition: Definition, values: ParameterValues, key: Readonly<Record<string, unknown>>): UnitRunTrace | null {
  return runKeyWith(asItems(definition), values, key);
}

// --- The batch -------------------------------------------------------------------------------------------------------

/** What a run reads and calculates: the records and what the pre-validation needs. */
export interface BatchRun {
  records: BatchRecord[];
  /** The rows read whose every column is null (the empty rows). */
  emptyRows: number;
  /** The batch variables used by the flow (not the key), each with how many records have it null. */
  emptyByVariable: { variable: string; empty: number }[];
}

/** The Fonte blocks, in the order of the definition (in any group). */
function sourceNodes(nodes: readonly WorkflowNode[]): Extract<WorkflowNode, { type: 'source' }>[] {
  return nodes.flatMap((node) => (node.type === 'source' ? [node] : node.type === 'group' ? sourceNodes(node.nodes) : []));
}

/**
 * The batch variables the flow uses (E7-1, `used_batch_variables`), not the key: the ones read by a formula, a cell of a
 * Decision Table, a link of a Fonte block or a field of the output. A filter of the batch source does not count.
 */
function usedBatchVariables(definition: Definition): string[] {
  const source = definition.root.batch_source;
  if (!source) return [];
  const texts: string[] = [];
  const walk = (nodes: readonly WorkflowNode[]) => {
    for (const node of nodes) {
      if (node.type === 'group') walk(node.nodes);
      else if (node.type === 'calculation') texts.push(node.expression, node.default_value ?? '');
      else if (node.type === 'decision_table') {
        texts.push(...node.conditions.map((condition) => condition.expression));
        for (const rule of node.rules) texts.push(...rule.when, ...rule.then);
      } else if (node.type === 'source') texts.push(...node.links.map((link) => link.variable));
    }
  };
  walk(definition.root.nodes);
  texts.push(...definition.root.output.fields.map((field) => field.variable));
  const words = new Set(texts.flatMap((text) => text.match(/[\p{L}_][\p{L}\p{N}_]*/gu) ?? []));
  return source.outputs.map((output) => output.name).filter((name) => !source.key.includes(name) && words.has(name)).sort();
}

const isEmptyCell = (value: CellValue | undefined) => value === null || value === undefined;

/**
 * The whole batch, in the reading order: the rows outside the batch source filters are not read; an empty row is
 * `ignored`; a null key is `null_record_key` and a repeated key, after the first, `duplicate_record_key`.
 */
export function runBatch(definition: Definition, values: ParameterValues, tenantId: string, workflowId: string): BatchRun {
  const source = definition.root.batch_source;
  if (!source) return { records: [], emptyRows: 0, emptyByVariable: [] };
  const bound = bindDefinition(asItems(definition), values);
  const analysis = analyze(bound);
  const copy = COPIES.get(source.dataset_id);
  const dataset = copy?.dataset ?? ITEMS;
  const variables = copy?.variables ?? variablesOf(ITEMS);
  const columnOf = (name: string) => variables.find((variable) => variable.id === source.outputs.find((output) => output.name === name)?.variable_id)?.column ?? name;
  const outputColumns = source.outputs.map((output) => columnOf(output.name));
  const number = (value: unknown) => (value === null || value === undefined ? Number.POSITIVE_INFINITY : Number(value));
  const rows = [...dataset.rows].sort((a, b) => {
    for (const name of source.key) {
      const compared = number(a[columnOf(name)]) - number(b[columnOf(name)]);
      if (compared !== 0) return compared;
    }
    return 0;
  });

  const used = usedBatchVariables(definition);
  const empties = new Map(used.map((name) => [name, 0]));
  const seen = new Set<string>();
  const records: BatchRecord[] = [];
  let emptyRows = 0;

  for (const row of rows) {
    if (outputColumns.every((column) => isEmptyCell(row[column]))) {
      emptyRows += 1;
      const recordKey = Object.fromEntries(source.key.map((name) => [name, null]));
      records.push({ recordKey, resultKey: null, status: 'ignored', errorNodeId: null, errorCode: null, trace: null, sources: {} });
      continue;
    }
    const recordKey = Object.fromEntries(source.key.map((name) => {
      const cell = row[columnOf(name)];
      return [name, isEmptyCell(cell) ? null : String(cell)];
    }));
    const keyError = (code: Schemas['RecordFailureCode']): BatchRecord => ({ recordKey, resultKey: null, status: 'error', errorNodeId: null, errorCode: code, trace: null, sources: {} });
    if (Object.values(recordKey).some((value) => value === null)) {
      records.push(keyError('null_record_key'));
      continue;
    }
    const key = recordKey as Record<string, string>;
    const item = findRecord(bound, key);
    if (!item?.kept) continue;
    for (const name of used) {
      if (isEmptyCell(row[columnOf(name)])) empties.set(name, (empties.get(name) ?? 0) + 1);
    }
    const id = JSON.stringify(key);
    if (seen.has(id)) {
      records.push(keyError('duplicate_record_key'));
      continue;
    }
    seen.add(id);
    // A row of a copy is calculated with its own values (an empty `quantidade` stays empty).
    const own = copy ? Object.fromEntries(outputColumns.map((column) => [column, row[column] ?? null])) : {};
    const sources: Record<string, SourceOutcome> = {};
    const trace = runRecord(bound, analysis, { ...item, row: { ...item.row, ...own } }, ({ node, rows: found, passed }) => {
      sources[node.id] = node.mode === 'filter' ? (passed ? 'kept' : 'filtered') : found === 0 ? 'no_match' : found > 1 ? 'multiple_rows' : 'found';
    });
    records.push({
      recordKey,
      resultKey: resultKeyOf(tenantId, workflowId, key),
      status: trace.status,
      errorNodeId: trace.error?.node_id ?? null,
      errorCode: (trace.error?.code as Schemas['RecordFailureCode'] | undefined) ?? null,
      trace,
      sources,
    });
  }
  return { records, emptyRows, emptyByVariable: used.map((variable) => ({ variable, empty: empties.get(variable) ?? 0 })) };
}

/** The counts of each Fonte block (in the order of the definition) over the records calculated so far. */
export function sourceCounts(definition: Definition, records: readonly BatchRecord[]): Schemas['SourceCount'][] {
  return sourceNodes(definition.root.nodes).map((node) => {
    const count = (outcome: SourceOutcome) => records.filter((record) => record.sources[node.id] === outcome).length;
    const linear = node.mode === 'linear';
    return {
      node_id: node.id,
      node_name: node.name,
      mode: node.mode,
      found: linear ? count('found') : null,
      no_match: linear ? count('no_match') : null,
      multiple_rows: linear ? count('multiple_rows') : null,
      kept: linear ? null : count('kept'),
      filtered: linear ? null : count('filtered'),
    };
  });
}

// --- Pre-validation --------------------------------------------------------------------------------------------------

/** "22.22": `part / whole × 100`, truncated at 2 places, as text. */
export function truncatedPercent(part: number, whole: number): string {
  if (whole === 0) return '0.00';
  return (Math.floor((part * 10000) / whole) / 100).toFixed(2);
}

/** The pre-validation of a run (E7-1 to E7-3), without the decision. */
export function preValidation(run: BatchRun, alertPercent: string): Schemas['PreValidation'] {
  const read = run.records.filter((record) => record.resultKey !== null || record.errorCode !== null);
  const records = read.length;
  const duplicates = new Map<string, Record<string, string>>();
  for (const record of run.records) {
    if (record.errorCode === 'duplicate_record_key') duplicates.set(JSON.stringify(record.recordKey), record.recordKey as Record<string, string>);
  }
  const emptyValues = run.emptyByVariable
    .filter((each) => each.empty > 0)
    .map((each) => {
      const percent = truncatedPercent(each.empty, records);
      return { variable: each.variable, empty: each.empty, percent, alert: Number(percent) > Number(alertPercent) };
    });
  const status: Schemas['PreValidationStatus'] = duplicates.size > 0 ? 'blocked' : emptyValues.some((each) => each.alert) ? 'alerted' : 'passed';
  return {
    status,
    records,
    empty_rows: run.emptyRows,
    null_key_records: run.records.filter((record) => record.errorCode === 'null_record_key').length,
    duplicate_keys: { count: duplicates.size, examples: [...duplicates.values()].slice(0, 5) },
    empty_values: emptyValues,
    alert_percent: alertPercent,
    decision: null,
    decision_expires_at: null,
  };
}

// --- Scope (E7-6) ----------------------------------------------------------------------------------------------------

function canonicalValue(value: Schemas['ParameterValue']): unknown {
  if (Array.isArray(value)) return [...new Set(value.map(String))].sort();
  if (typeof value === 'object' && value !== null) return { end: value.end, start: value.start };
  return String(value);
}

/** The scope of an execution: SHA-256 of `[tenant, workflow, resolved parameters]`, keys in order, lists as sets. */
export function scopeHash(tenantId: string, workflowId: string, values: ParameterValues): string {
  const parameters = Object.fromEntries(Object.keys(values).sort().map((name) => [name, canonicalValue(values[name]!)]));
  return createHash('sha256').update(JSON.stringify([tenantId, workflowId, parameters]), 'utf8').digest('hex');
}

// --- Allowed values by query (E7-5) --------------------------------------------------------------------------------------

/** A literal of a filter of the query as the text of the column (`"SP"` → `SP`, `verdadeiro` → `true`). */
function literalText(literal: string): string {
  const text = literal.trim();
  if (text.startsWith('"') && text.endsWith('"')) return text.slice(1, -1).replace(/""/g, '"');
  if (text === 'verdadeiro') return 'true';
  if (text === 'falso') return 'false';
  return text;
}

/** The distinct values of the query, without nulls, in ascending order, as text; `null` for an unknown dataset or variable. */
export function queryValues(query: Schemas['AllowedValuesQuery']): string[] | null {
  const dataset = EPIC7_CATALOG.find((each) => each.id === query.dataset_id);
  const variables = dataset ? (dataset.id === STORES.id ? variablesOf(STORES) : variablesOf(dataset)) : [];
  const column = variables.find((variable) => variable.id === query.variable_id)?.column;
  if (!dataset || !column) return null;
  const columnOf = (id: string) => variables.find((variable) => variable.id === id)?.column ?? '';
  const passes = (row: Readonly<Record<string, CellValue>>) =>
    query.filters.every((filter) => {
      const cell = row[columnOf(filter.variable_id)];
      const text = cell === null || cell === undefined ? null : String(cell);
      const wanted = filter.values.map(literalText);
      switch (filter.operator) {
        case 'is_null':
          return text === null;
        case 'is_not_null':
          return text !== null;
        case 'in':
          return text !== null && wanted.includes(text);
        case '<>':
          return text !== null && text !== wanted[0];
        default:
          return text !== null && text === wanted[0];
      }
    });
  const found = dataset.rows.filter(passes).map((row) => row[column]).filter((cell) => cell !== null && cell !== undefined).map(String);
  return [...new Set(found)].sort();
}

/** Each value of a parameter with a query is among the allowed ones (`422 invalid_parameter`, without the value). */
export function checkAllowedValues(declared: readonly Parameter[], values: ParameterValues): Resolution {
  const invalid: Record<string, string> = {};
  for (const parameter of declared) {
    const query = parameter.allowed_values;
    const value = values[parameter.name];
    if (!query || Array.isArray(query) || value === undefined) continue;
    const allowed = queryValues(query) ?? [];
    const given = Array.isArray(value) ? value : [value];
    if (given.some((each) => typeof each !== 'string' || !allowed.includes(each))) invalid[parameter.name] = 'O valor não está entre os valores permitidos.';
  }
  if (Object.keys(invalid).length > 0) return { ok: false, problem: { ...EXAMPLES.InvalidParameter, fields: invalid } };
  return { ok: true, values };
}

// --- Reference file (E7-10) ----------------------------------------------------------------------------------------------

/** RFC 4180: fields split at commas, quotes around a field with a comma, a quote or a line break, `""` for a quote. */
export function readCsv(text: string): string[][] {
  const lines: string[][] = [];
  let field = '';
  let line: string[] = [];
  let quoted = false;
  const content = text.replace(/^﻿/, '');
  for (let at = 0; at < content.length; at += 1) {
    const char = content[at]!;
    if (quoted) {
      if (char === '"' && content[at + 1] === '"') {
        field += '"';
        at += 1;
      } else if (char === '"') quoted = false;
      else field += char;
    } else if (char === '"') quoted = true;
    else if (char === ',') {
      line.push(field);
      field = '';
    } else if (char === '\n' || char === '\r') {
      if (char === '\r' && content[at + 1] === '\n') at += 1;
      line.push(field);
      lines.push(line);
      line = [];
      field = '';
    } else field += char;
  }
  if (field !== '' || line.length > 0) {
    line.push(field);
    lines.push(line);
  }
  return lines.filter((each) => !(each.length === 1 && each[0] === ''));
}

/** One line of a reference file: the key, the status (null: calculated) and the fields, typed as the API sends values. */
export interface ReferenceLine {
  key: Record<string, string>;
  status: Schemas['UnitRunStatus'] | null;
  fields: Record<string, Value>;
}

export interface ReadReferenceFile {
  keyColumns: string[];
  fieldColumns: string[];
  hasStatus: boolean;
  lines: ReferenceLine[];
}

type ScalarType = 'integer' | 'decimal' | 'text' | 'boolean' | 'date' | 'datetime';

const STATUSES: readonly Schemas['UnitRunStatus'][] = ['ok', 'ok_with_warnings', 'error', 'ignored', 'filtered'];
const IGNORED_COLUMNS = new Set(['result_key', 'revision', 'run_id', 'workflow_version', '_warnings']);
const MAX_ERRORS = 20;

function typeError(type: ScalarType, scale: number | null, text: string): string | null {
  switch (type) {
    case 'integer':
      return /^-?[0-9]+$/.test(text) ? null : 'Use um número inteiro, como 12.';
    case 'decimal': {
      const match = /^-?[0-9]+(?:\.([0-9]+))?$/.exec(text);
      if (!match) return 'Use número com ponto, como 225.00.';
      return (match[1]?.length ?? 0) > 18 ? 'Use no máximo 18 casas decimais.' : null;
    }
    case 'boolean':
      return /^(true|false)$/i.test(text) ? null : 'Use true ou false.';
    case 'date':
      return /^\d{4}-\d{2}-\d{2}$/.test(text) ? null : 'Use a data como AAAA-MM-DD.';
    case 'datetime':
      return Number.isNaN(Date.parse(text)) ? 'Use data e hora ISO 8601 com fuso.' : null;
    default:
      void scale;
      return null;
  }
}

function typedValue(type: ScalarType, text: string): Value {
  if (text === '') return null;
  if (type === 'boolean') return text.toLowerCase() === 'true';
  if (type === 'text' && /^'[=+\-@\t\r]/.test(text)) return text.slice(1);
  return text;
}

/**
 * Reads a reference file against the saved draft (E7-10): the key columns (all required), the fields of the output (at
 * least one, or `status`), the technical columns of a delivered CSV (ignored); each value by its type. The errors go by
 * "linha N, coluna X" (the header is line 1) and `header`, up to 20; with any error, nothing is read.
 */
export function readReferenceFile(text: string, definition: Definition, analysis: Schemas['Analysis']): ReadReferenceFile | { errors: Record<string, string> } {
  const source = definition.root.batch_source!;
  const [header = [], ...rows] = readCsv(text);
  const names = header.map((name) => name.trim());
  const typeOf = (variable: string): { type: ScalarType; scale: number | null } => {
    const symbol = analysis.symbols.find((each) => each.name === variable);
    return { type: (symbol?.type ?? 'text') as ScalarType, scale: symbol?.scale ?? null };
  };
  const fields = new Map(definition.root.output.fields.map((field) => [field.name, typeOf(field.variable)]));
  const headerErrors: string[] = [];
  const counted = new Map<string, number>();
  for (const name of names) counted.set(name, (counted.get(name) ?? 0) + 1);
  for (const [name, times] of counted) if (times > 1) headerErrors.push(`A coluna "${name}" aparece mais de uma vez.`);
  for (const name of names) {
    if (!source.key.includes(name) && !fields.has(name) && name !== 'status' && !IGNORED_COLUMNS.has(name)) {
      headerErrors.push(`A coluna "${name}" não é da chave do registro nem um campo da saída.`);
    }
  }
  for (const name of source.key) if (!names.includes(name)) headerErrors.push(`Falta a coluna "${name}" da chave do registro.`);
  const fieldColumns = names.filter((name) => fields.has(name));
  const hasStatus = names.includes('status');
  if (fieldColumns.length === 0 && !hasStatus) headerErrors.push('O arquivo precisa de pelo menos um campo da saída ou da coluna status.');

  const errors: Record<string, string> = {};
  if (headerErrors.length > 0) errors.header = headerErrors.join(' ');
  const add = (line: number, column: string, message: string) => {
    if (Object.keys(errors).length < MAX_ERRORS) errors[`linha ${line}, coluna ${column}`] = message;
  };
  const keyTypes = new Map(source.key.map((name) => [name, typeOf(name)]));
  const seen = new Map<string, number>();
  const lines: ReferenceLine[] = [];
  rows.forEach((cells, index) => {
    const line = index + 2;
    const cell = (name: string) => (cells[names.indexOf(name)] ?? '').trim();
    const key: Record<string, string> = {};
    for (const name of source.key) {
      if (!names.includes(name)) continue;
      const text = cell(name);
      if (text === '') add(line, name, 'Preencha todas as partes da chave do registro.');
      else {
        const { type, scale } = keyTypes.get(name)!;
        const error = typeError(type, scale, text);
        if (error) add(line, name, error);
      }
      key[name] = text;
    }
    const id = JSON.stringify(source.key.map((name) => key[name] ?? ''));
    const first = seen.get(id);
    if (first !== undefined && Object.values(key).every((value) => value !== '')) add(line, source.key[0]!, `Chave repetida no arquivo: já apareceu na linha ${first}.`);
    else seen.set(id, line);
    const statusText = hasStatus ? cell('status') : '';
    const status = statusText === '' ? null : (STATUSES.find((each) => each === statusText) ?? null);
    if (statusText !== '' && status === null) add(line, 'status', 'Use ok, ok_with_warnings, error, ignored ou filtered.');
    const typed: Record<string, Value> = {};
    for (const name of fieldColumns) {
      const text = cell(name);
      const { type, scale } = fields.get(name)!;
      if (text !== '') {
        const error = typeError(type, scale, text);
        if (error) add(line, name, error);
        if (status === 'error' || status === 'ignored' || status === 'filtered') add(line, name, 'Registro sem saída: deixe os campos vazios.');
      }
      typed[name] = typedValue(type, text);
    }
    lines.push({ key, status, fields: typed });
  });
  if (Object.keys(errors).length > 0) return { errors };
  return { keyColumns: names.filter((name) => source.key.includes(name)), fieldColumns, hasStatus, lines };
}

// --- Comparison (E7-11) ----------------------------------------------------------------------------------------------

type StatusClass = 'calculated' | 'error' | 'ignored' | 'filtered';

function classOf(status: Schemas['UnitRunStatus'] | null): StatusClass {
  if (status === null || status === 'ok' || status === 'ok_with_warnings') return 'calculated';
  return status;
}

function numberText(text: string): string {
  const [whole = '0', decimals = ''] = text.replace(/^\+/, '').split('.');
  const trimmed = decimals.replace(/0+$/, '');
  const integer = whole.replace(/^(-?)0+(?=\d)/, '$1');
  const result = trimmed ? `${integer}.${trimmed}` : integer;
  return result === '-0' ? '0' : result;
}

/** The same value (contract): a number by its value, text exact, boolean, null only equal to null. */
function sameValue(expected: Value, obtained: Value): boolean {
  if (expected === null || obtained === null) return expected === obtained;
  if (typeof expected === 'boolean' || typeof obtained === 'boolean') return expected === obtained;
  if (typeof expected === 'string' && typeof obtained === 'string') {
    const numeric = /^[+-]?\d+(?:\.\d+)?$/;
    if (numeric.test(expected) && numeric.test(obtained)) return numberText(expected) === numberText(obtained);
    return expected === obtained;
  }
  return JSON.stringify(expected) === JSON.stringify(obtained);
}

export interface Comparison {
  summary: Schemas['ComparisonSummary'];
  records: Schemas['ComparisonRecord'][];
}

/** Compares the records of a simulation with a reference file, by key (the `result_key` of the file's key). */
export function compare(records: readonly BatchRecord[], file: ReadReferenceFile, tenantId: string, workflowId: string): Comparison {
  const byKey = new Map(file.lines.map((line) => [JSON.stringify(Object.keys(line.key).sort().map((name) => [name, line.key[name]])), line]));
  const keyOf = (key: Record<string, string>) => JSON.stringify(Object.keys(key).sort().map((name) => [name, key[name]]));
  const result: Schemas['ComparisonRecord'][] = [];
  const matched = new Set<string>();
  let notCompared = 0;
  for (const record of records) {
    if (Object.values(record.recordKey).some((value) => value === null)) {
      notCompared += 1;
      continue;
    }
    const key = record.recordKey as Record<string, string>;
    const id = keyOf(key);
    const line = byKey.get(id);
    const resultKey = resultKeyOf(tenantId, workflowId, key);
    if (!line) {
      if (classOf(record.status) === 'calculated') {
        result.push({ result_key: resultKey, record_key: key, outcome: 'missing_from_file', expected_status: null, obtained_status: record.status, fields: [] });
      } else notCompared += 1;
      continue;
    }
    matched.add(id);
    const base = { result_key: resultKey, record_key: key, expected_status: line.status, obtained_status: record.status };
    if (classOf(line.status) !== classOf(record.status)) {
      result.push({ ...base, outcome: 'status_differs', fields: [] });
      continue;
    }
    const different = classOf(record.status) !== 'calculated'
      ? []
      : file.fieldColumns
          .map((name) => ({ name, expected: line.fields[name] ?? null, obtained: record.trace?.outputs[name] ?? null }))
          .filter((field) => !sameValue(field.expected, field.obtained));
    result.push({ ...base, outcome: different.length > 0 ? 'different' : 'equal', fields: different });
  }
  for (const line of file.lines) {
    const id = keyOf(line.key);
    if (matched.has(id)) continue;
    result.push({
      result_key: resultKeyOf(tenantId, workflowId, line.key),
      record_key: line.key,
      outcome: 'missing_from_result',
      expected_status: line.status,
      obtained_status: null,
      fields: [],
    });
  }
  const count = (outcome: Schemas['ComparisonOutcome']) => result.filter((record) => record.outcome === outcome).length;
  const compared = result.length;
  const equal = count('equal');
  return {
    summary: {
      compared,
      equal,
      different: count('different'),
      status_differs: count('status_differs'),
      missing_from_result: count('missing_from_result'),
      missing_from_file: count('missing_from_file'),
      not_compared: notCompared,
      equal_percent: compared === 0 ? null : truncatedPercent(equal, compared),
    },
    records: result,
  };
}

/** The resolved values of a run: `resolveParameters` of epic 6, then the query of the allowed values. */
export function resolveRun(declared: readonly Parameter[], sent: unknown, now: Date): Resolution {
  const resolved = resolveParameters(declared, sent, now);
  return resolved.ok ? checkAllowedValues(declared, resolved.values) : resolved;
}
