// The run parameters and the batch of the epic 6 simulation (pnpm e2e), over the epic 5 engine
// (../../epic-5/support/engine.ts), as the backend describes them (../backend/docs/plano.md, Contratos, "Parâmetros de
// execução" and "Execução em lote e entrega em CSV"). Test support, not the product: the front never evaluates.
//
// The epic 5 engine reads only literals and the epic 5 catalog. So each run first binds the definition: every `@nome`
// becomes the literal of its value, the filter of the invoice date (`emissao`, which the epic 5 items do not have) becomes
// the filter of the invoices of that period (`nota_id EM …`), and the defects dataset reads as the items (same columns).
//
// What the simulation decides where the contract does not say (only the simulated mode depends on it):
// - a date parameter is not bound inside a formula (the epic 4 formula reader has no `DATA`); the flows use it in filters;
// - the messages of the parameter problems and of the `422` are this simulation's.
import { createHash } from 'node:crypto';
import { ITEMS, variableId, variablesOf } from '../../epic-5/support/campaign';
import { analyze, findRecord, preview, runRecord, type Analysis, type Preview, type UnitRunTrace } from '../../epic-5/support/engine';
import { EXAMPLES, type ErrorBody, type Schemas } from '../../support/contract';
import { DEFECTS, DEFECTS_VARIABLES, DEFECTS_DATE_VARIABLE_ID, INVOICE_DATES, ITEMS_DATE_VARIABLE, businessToday, isoDate, previousMonth, type Period } from './campaign';

type Definition = Schemas['WorkflowDefinition'];
type WorkflowNode = Definition['root']['nodes'][number];
type Parameter = Schemas['WorkflowParameter'];
type Problem = Schemas['WorkflowProblem'];
type FilterOperator = Schemas['FilterOperator'];
export type ParameterValue = Schemas['ParameterValue'];
export type ParameterValues = Record<string, ParameterValue>;
export type RecordFailureCode = Schemas['RecordFailureCode'];
export type { Analysis, Preview, UnitRunTrace };

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const INTEGER = /^-?\d+$/;
const DECIMAL = /^-?\d+(?:\.(\d+))?$/;
const DATA_LITERAL = /^DATA\(\s*(\d{4})\s*,\s*(\d{1,2})\s*,\s*(\d{1,2})\s*\)$/;
/** A parameter reference: `@nome`, `@periodo.inicio`, `@periodo.fim`. */
const REFERENCE = /@([a-z][a-z0-9_]{0,62})(?:\.(inicio|fim))?/g;

// --- Resolving the values of a run -------------------------------------------------------------------------------------

/** The date of a `DATA(2026, 10, 1)` literal, or `null`. */
function dateOfLiteral(literal: string): string | null {
  const match = DATA_LITERAL.exec(literal.trim());
  return match ? isoDate(Number(match[1]), Number(match[2]), Number(match[3])) : null;
}

/** The value of a literal of the language, as a run receives it (`"A"` → `A`, `verdadeiro` → `true`). */
function valueOfLiteral(type: Parameter['type'], literal: string): ParameterValue {
  const text = literal.trim();
  if (type === 'text') return text.startsWith('"') && text.endsWith('"') ? text.slice(1, -1).replace(/""/g, '"') : text;
  if (type === 'boolean') return text.toLowerCase() === 'verdadeiro';
  if (type === 'date') return dateOfLiteral(text) ?? text;
  return text;
}

/** The value of a relative default, by today in the business time zone (Contratos, `RelativeDefault`). */
function relativeValue(relative: Schemas['RelativeDefault'], now: Date): ParameterValue {
  const today = businessToday(now);
  const day = (offset: number) => {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    return isoDate(date.getUTCFullYear(), date.getUTCMonth() + 1, date.getUTCDate());
  };
  const previous = previousMonth(now);
  switch (relative) {
    case 'today':
      return day(0);
    case 'yesterday':
      return day(-1);
    case 'first_day_of_current_month':
      return isoDate(today.year, today.month, 1);
    case 'first_day_of_previous_month':
      return previous.start;
    case 'last_day_of_previous_month':
      return previous.end;
    case 'now':
      return now.toISOString();
    case 'current_month':
      return { start: isoDate(today.year, today.month, 1), end: day(0) };
    case 'previous_month':
      return previous;
    case 'last_7_days':
      return { start: day(-7), end: day(-1) };
    case 'last_30_days':
      return { start: day(-30), end: day(-1) };
  }
}

/** The value of a parameter's default, or `undefined` without one. */
function defaultValue(parameter: Parameter, now: Date): ParameterValue | undefined {
  const declared = parameter.default;
  if (!declared) return undefined;
  if (declared.kind === 'relative') return relativeValue(declared.value, now);
  const value = declared.value;
  if (Array.isArray(value)) return value.map((each) => String(valueOfLiteral(parameter.type, each)));
  if (typeof value === 'object') return { start: dateOfLiteral(value.start) ?? value.start, end: dateOfLiteral(value.end) ?? value.end };
  return valueOfLiteral(parameter.type, value);
}

/** Why a scalar does not fit the parameter's type (`null`: it fits). */
function scalarError(parameter: Parameter, value: unknown): string | null {
  const type = parameter.type;
  if (type === 'boolean') return typeof value === 'boolean' ? null : 'Use verdadeiro ou falso.';
  if (typeof value !== 'string') return 'O valor não é do tipo do parâmetro.';
  if (type === 'integer' && !INTEGER.test(value)) return 'Informe um número inteiro.';
  if (type === 'decimal') {
    const match = DECIMAL.exec(value);
    if (!match) return 'Informe um número.';
    if ((match[1]?.length ?? 0) > (parameter.scale ?? 0)) return `Use no máximo ${parameter.scale ?? 0} casas decimais.`;
  }
  if (type === 'date' && !DATE.test(value)) return 'Informe uma data.';
  if (type === 'datetime' && Number.isNaN(Date.parse(value))) return 'Informe uma data e hora.';
  const allowed = parameter.allowed_values?.map((literal) => valueOfLiteral(type, literal));
  if (allowed && !allowed.includes(value)) return 'O valor não está entre os valores permitidos.';
  return null;
}

/** Why a value does not fit the parameter (`null`: it fits). */
function valueError(parameter: Parameter, value: unknown): string | null {
  if (parameter.type === 'period') {
    if (value === null || typeof value !== 'object' || Array.isArray(value)) return 'Informe o início e o fim do período.';
    const { start, end } = value as Partial<Period>;
    if (typeof start !== 'string' || typeof end !== 'string' || !DATE.test(start) || !DATE.test(end)) return 'Informe o início e o fim do período.';
    return start > end ? 'O início do período vem depois do fim.' : null;
  }
  if (parameter.list) {
    if (!Array.isArray(value) || value.length === 0) return 'Informe de 1 a 100 valores.';
    for (const each of value) {
      const error = scalarError(parameter, each);
      if (error) return error;
    }
    return null;
  }
  return scalarError(parameter, value);
}

export type Resolution = { ok: true; values: ParameterValues } | { ok: false; problem: ErrorBody };

/**
 * The values a run uses (`parameters` of the trigger, the preview and "Calcular"): what was sent and, for the absent ones,
 * the default, the relative one resolved by `now`. `422 missing_parameter` and `422 invalid_parameter` as the contract says.
 */
export function resolveParameters(declared: readonly Parameter[], sent: unknown, now: Date): Resolution {
  const given = sent === undefined ? {} : sent;
  if (given === null || typeof given !== 'object' || Array.isArray(given)) {
    return { ok: false, problem: { ...EXAMPLES.InvalidData, fields: { parameters: 'Envie os parâmetros por nome.' } } };
  }
  const values: ParameterValues = {};
  const missing: Record<string, string> = {};
  const invalid: Record<string, string> = {};
  for (const name of Object.keys(given)) {
    if (!declared.some((parameter) => parameter.name === name)) invalid[name] = 'O workflow não tem este parâmetro.';
  }
  for (const parameter of declared) {
    const value = (given as Record<string, unknown>)[parameter.name] ?? defaultValue(parameter, now);
    if (value === undefined) {
      if (parameter.required) missing[parameter.name] = 'Informe um valor; o parâmetro é obrigatório e não tem padrão.';
      continue;
    }
    const error = valueError(parameter, value);
    if (error) invalid[parameter.name] = error;
    else values[parameter.name] = value as ParameterValue;
  }
  if (Object.keys(invalid).length > 0) return { ok: false, problem: { ...EXAMPLES.InvalidParameter, fields: invalid } };
  if (Object.keys(missing).length > 0) return { ok: false, problem: { ...EXAMPLES.MissingParameter, fields: missing } };
  return { ok: true, values };
}

// --- Binding the definition ------------------------------------------------------------------------------------------

/** A value of each type for the analysis, which only checks the types (the run binds the real ones). */
function sampleValue(parameter: Parameter): ParameterValue {
  const scalar: Record<Parameter['type'], ParameterValue> = {
    text: 'a',
    integer: '0',
    decimal: '0',
    date: '2026-01-01',
    datetime: '2026-01-01T00:00:00Z',
    boolean: true,
    period: { start: '2026-01-01', end: '2026-01-31' },
  };
  const value = scalar[parameter.type];
  return parameter.list && typeof value === 'string' ? [value] : value;
}

/** The literal of a scalar value in the formula language (E4-3). */
function literalOf(type: Parameter['type'], value: ParameterValue): string {
  if (typeof value === 'boolean') return value ? 'verdadeiro' : 'falso';
  if (typeof value !== 'string') return '0';
  if (type === 'text') return `"${value.replace(/"/g, '""')}"`;
  if (type === 'date' || type === 'period') {
    const [year, month, day] = value.split('-').map(Number);
    return `DATA(${year}, ${month}, ${day})`;
  }
  return value;
}

/** The literals a reference stands for (a list gives one per value); `null` when the reference is unknown. */
function referenceLiterals(declared: readonly Parameter[], values: ParameterValues, name: string, part: string | undefined): string[] | null {
  const parameter = declared.find((each) => each.name === name);
  const value = values[name];
  if (!parameter || value === undefined) return null;
  if (parameter.type === 'period') {
    if (typeof value !== 'object' || Array.isArray(value) || typeof value === 'boolean') return null;
    return [literalOf('date', part === 'fim' ? value.end : value.start)];
  }
  if (Array.isArray(value)) return value.map((each) => literalOf(parameter.type, each));
  return [literalOf(parameter.type, value)];
}

/** A formula with each reference bound (an unknown one becomes `0`: the analysis reports it apart). */
function bindFormula(text: string, declared: readonly Parameter[], values: ParameterValues): string {
  return text.replace(REFERENCE, (_whole, name: string, part: string | undefined) => referenceLiterals(declared, values, name, part)?.join(', ') ?? '0');
}

/** The values of a filter with each `@` value bound (a list expands into its values). */
function bindValues(list: readonly string[], declared: readonly Parameter[], values: ParameterValues): string[] {
  return list.flatMap((value) => {
    const match = /^@([a-z][a-z0-9_]{0,62})(?:\.(inicio|fim))?$/.exec(value.trim());
    if (!match) return [value];
    return referenceLiterals(declared, values, match[1]!, match[2]) ?? [value];
  });
}

function bindNode(node: WorkflowNode, declared: readonly Parameter[], values: ParameterValues): WorkflowNode {
  switch (node.type) {
    case 'calculation':
      return {
        ...node,
        expression: bindFormula(node.expression, declared, values),
        default_value: node.default_value === null ? null : bindFormula(node.default_value, declared, values),
      };
    case 'decision_table':
      return {
        ...node,
        conditions: node.conditions.map((condition) => ({ ...condition, expression: bindFormula(condition.expression, declared, values) })),
        rules: node.rules.map((rule) => ({
          when: rule.when.map((cell) => bindFormula(cell, declared, values)),
          then: rule.then.map((cell) => bindFormula(cell, declared, values)),
        })),
      };
    case 'source':
      return { ...node, filters: node.filters.map((filter) => ({ ...filter, values: bindValues(filter.values, declared, values) })) };
    case 'group':
      return { ...node, nodes: node.nodes.map((inner) => bindNode(inner, declared, values)) };
  }
}

/** Whether a date passes a date filter. */
function datePasses(date: string, operator: FilterOperator, bounds: readonly (string | null)[]): boolean {
  const [first, second] = bounds;
  if (operator === 'is_null') return false;
  if (operator === 'is_not_null') return true;
  if (operator === 'in') return bounds.includes(date);
  if (!first) return false;
  switch (operator) {
    case '=':
      return date === first;
    case '<>':
      return date !== first;
    case '>':
      return date > first;
    case '>=':
      return date >= first;
    case '<':
      return date < first;
    case '<=':
      return date <= first;
    case 'between':
      return second !== null && second !== undefined && date >= first && date <= second;
  }
}

/** Binds a whole definition for the epic 5 engine (see the header). With `sample`, every parameter gets a sample value. */
export function bindDefinition(definition: Definition, values: ParameterValues, sample = false): Definition {
  const declared = definition.parameters ?? [];
  const bound: ParameterValues = sample ? Object.fromEntries(declared.map((parameter) => [parameter.name, sampleValue(parameter)])) : values;
  const source = definition.root.batch_source;
  let batch = source ?? null;
  if (source) {
    const items = [...variablesOf(ITEMS), ITEMS_DATE_VARIABLE];
    const mapped = source.outputs.map((output) => {
      const defect = DEFECTS_VARIABLES.find((variable) => variable.id === output.variable_id);
      return defect ? { ...output, variable_id: items.find((item) => item.column === defect.column)?.id ?? output.variable_id } : output;
    });
    const outputs = mapped.filter((output) => output.variable_id !== ITEMS_DATE_VARIABLE.id);
    const dateName = mapped.find((output) => output.variable_id === ITEMS_DATE_VARIABLE.id)?.name;
    const invoiceName = outputs.find((output) => output.variable_id === variableId(ITEMS, 'nota_id'))?.name ?? 'nota_id';
    const filters = source.filters.flatMap((filter) => {
      if (filter.variable !== dateName) return [{ ...filter, values: bindValues(filter.values, declared, bound) }];
      // The sample analysis does not read: the date filter only goes away.
      if (sample) return [];
      const dates = bindValues(filter.values, declared, bound).map(dateOfLiteral);
      const invoices = [...INVOICE_DATES].filter(([, date]) => datePasses(date, filter.operator, dates)).map(([id]) => id);
      return [{ variable: invoiceName, operator: 'in' as const, values: invoices }];
    });
    batch = { ...source, dataset_id: source.dataset_id === DEFECTS.id ? ITEMS.id : source.dataset_id, outputs, filters };
  }
  return {
    ...definition,
    root: { ...definition.root, batch_source: batch, nodes: definition.root.nodes.map((node) => bindNode(node, declared, bound)) },
  };
}

// --- Analysis ----------------------------------------------------------------------------------------------------------

const parameterProblem = (code: Problem['code'], message: string, path: string, nodeId: string | null, suggestion: string | null = null): Problem => ({
  code,
  message,
  path,
  node_id: nodeId,
  start: null,
  end: null,
  suggestion,
});

/** The problems of the references: an unknown name (`unknown_parameter`) and a period without its part (`period_without_part`). */
function referenceProblems(definition: Definition): Problem[] {
  const declared = definition.parameters ?? [];
  const problems: Problem[] = [];
  const check = (text: string, path: string, nodeId: string | null) => {
    for (const match of text.matchAll(REFERENCE)) {
      const name = match[1]!;
      const parameter = declared.find((each) => each.name === name);
      if (!parameter) problems.push(parameterProblem('unknown_parameter', `@${name} não existe entre os parâmetros.`, path, nodeId));
      else if (parameter.type === 'period' && !match[2]) {
        problems.push(parameterProblem('period_without_part', `Use @${name}.inicio ou @${name}.fim: o período tem duas datas.`, path, nodeId));
      }
    }
  };
  definition.root.batch_source?.filters.forEach((filter, index) =>
    filter.values.forEach((value, at) => check(value, `root.batch_source.filters[${index}].values[${at}]`, null)),
  );
  const walk = (nodes: readonly WorkflowNode[], base: string) =>
    nodes.forEach((node, index) => {
      const path = `${base}[${index}]`;
      if (node.type === 'group') walk(node.nodes, `${path}.nodes`);
      else if (node.type === 'source') node.filters.forEach((filter, at) => filter.values.forEach((value, v) => check(value, `${path}.filters[${at}].values[${v}]`, node.id)));
      else if (node.type === 'calculation') {
        check(node.expression, `${path}.expression`, node.id);
        if (node.default_value !== null) check(node.default_value, `${path}.default_value`, node.id);
      } else {
        node.conditions.forEach((condition, at) => check(condition.expression, `${path}.conditions[${at}].expression`, node.id));
        node.rules.forEach((rule, row) => {
          rule.when.forEach((cell, at) => check(cell, `${path}.rules[${row}].when[${at}]`, node.id));
          rule.then.forEach((cell, at) => check(cell, `${path}.rules[${row}].then[${at}]`, node.id));
        });
      }
    });
  walk(definition.root.nodes, 'root.nodes');
  return problems;
}

/** The analysis of a draft with parameters: the epic 5 one over the bound definition, plus the reference problems. */
export function analyzeDefinition(definition: Definition): Analysis {
  const analysis = analyze(bindDefinition(definition, {}, true));
  const symbols = [...analysis.symbols];
  const date = definition.root.batch_source?.outputs.find((output) => output.variable_id === ITEMS_DATE_VARIABLE.id || output.variable_id === DEFECTS_DATE_VARIABLE_ID);
  if (date) {
    symbols.push({ name: date.name, type: 'date', scale: null, cardinality: 'linear', list: null, origin: 'batch_source', node_id: null, group_id: null });
  }
  return { ...analysis, problems: [...referenceProblems(definition), ...analysis.problems], symbols };
}

// --- Preview, "Calcular" and the batch ----------------------------------------------------------------------------------

/** `POST …/draft/previews` with the parameter values. */
export function previewWith(definition: Definition, values: ParameterValues, sampleSize: number): Preview {
  const bound = bindDefinition(definition, values);
  return preview(bound, analyze(bound), sampleSize);
}

/** `POST …/draft/unit-runs` by key with the parameter values; `null` when no record has the key. */
export function runKeyWith(definition: Definition, values: ParameterValues, key: Readonly<Record<string, unknown>>): UnitRunTrace | null {
  const bound = bindDefinition(definition, values);
  const record = findRecord(bound, key);
  return record ? runRecord(bound, analyze(bound), record) : null;
}

/** One record of a batch: what the records list, the trace and the CSV say about it. */
export interface BatchRecord {
  recordKey: Record<string, string | null>;
  /** The `result_key` (SHA-256 of `[tenant, workflow, record_key]`); null in the key errors, which have no trace. */
  resultKey: string | null;
  status: Schemas['UnitRunStatus'];
  errorNodeId: string | null;
  errorCode: RecordFailureCode | null;
  trace: UnitRunTrace | null;
}

/** The result key of the CSV and of the trace (Contratos, `GET …/output`). */
export function resultKeyOf(tenantId: string, workflowId: string, key: Readonly<Record<string, string>>): string {
  const canonical = Object.fromEntries(Object.keys(key).sort().map((name) => [name, key[name]]));
  return createHash('sha256').update(JSON.stringify([tenantId, workflowId, canonical]), 'utf8').digest('hex');
}

/**
 * The whole batch, in the reading order (the key, as the campaign's ordering): the records outside the batch source
 * filters are not read; a null key is `null_record_key` and a repeated key, after the first, `duplicate_record_key` (E6-9).
 */
export function runBatch(definition: Definition, values: ParameterValues, tenantId: string, workflowId: string): BatchRecord[] {
  const source = definition.root.batch_source;
  if (!source) return [];
  const bound = bindDefinition(definition, values);
  const analysis = analyze(bound);
  const dataset = source.dataset_id === DEFECTS.id ? DEFECTS : ITEMS;
  const variables = source.dataset_id === DEFECTS.id ? DEFECTS_VARIABLES : variablesOf(ITEMS);
  const columnOf = (name: string) => variables.find((variable) => variable.id === source.outputs.find((output) => output.name === name)?.variable_id)?.column ?? name;
  const number = (value: unknown) => (value === null || value === undefined ? Number.POSITIVE_INFINITY : Number(value));
  const rows = [...dataset.rows].sort((a, b) => {
    for (const name of source.key) {
      const compared = number(a[columnOf(name)]) - number(b[columnOf(name)]);
      if (compared !== 0) return compared;
    }
    return 0;
  });
  const seen = new Set<string>();
  const records: BatchRecord[] = [];
  for (const row of rows) {
    const recordKey = Object.fromEntries(source.key.map((name) => {
      const cell = row[columnOf(name)];
      return [name, cell === null || cell === undefined ? null : String(cell)];
    }));
    const keyError = (code: RecordFailureCode): BatchRecord => ({ recordKey, resultKey: null, status: 'error', errorNodeId: null, errorCode: code, trace: null });
    if (Object.values(recordKey).some((value) => value === null)) {
      records.push(keyError('null_record_key'));
      continue;
    }
    const key = recordKey as Record<string, string>;
    const record = findRecord(bound, key);
    if (!record?.kept) continue;
    const id = JSON.stringify(key);
    if (seen.has(id)) {
      records.push(keyError('duplicate_record_key'));
      continue;
    }
    seen.add(id);
    const trace = runRecord(bound, analysis, record);
    records.push({
      recordKey,
      resultKey: resultKeyOf(tenantId, workflowId, key),
      status: trace.status,
      errorNodeId: trace.error?.node_id ?? null,
      errorCode: (trace.error?.code as RecordFailureCode | undefined) ?? null,
      trace,
    });
  }
  return records;
}
