// The analysis, the unit run by record and the preview of the epic 5 simulation (pnpm e2e), over the formula reader of
// the epic 4 simulation: the definition in schema 2 (batch source, Fonte blocks in the Linear and Filtro modes, groups),
// read against the reference campaign catalog (campaign.ts), like the backend's engine (../backend/docs/plano.md,
// Contratos, "Fontes, grupos e execução unitária com trace"). Test support, not the product: the front never evaluates.
//
// What the simulation decides where the contract does not say (only the simulated mode depends on it; the real mode reads
// the backend's answers):
// - in the preview, a record stops at the first block that ends it (error, `ignored`, `filtered`): the blocks after it
//   do not count it;
// - a batch source record outside its filters, asked for by the key, comes back `filtered` with every block `not_run`;
// - the messages of the warnings and errors are this simulation's (the tests check only their codes in real mode).
import { createHash } from 'node:crypto';
import type { Schemas } from '../../support/contract';
import {
  EvaluationFailure,
  FormulaSyntaxError,
  cellExpressions,
  cellMatches,
  checkExpression,
  evaluate,
  formatDecimal,
  isDecimal,
  parseCell,
  parseDecimal,
  parseFormula,
  readNames,
  roundTo,
  type Expression,
  type FormulaProblem,
  type RuntimeValue,
  type Scope,
} from '../../epic-4/support/formula';
import { CATALOG, variablesOf, type CatalogColumn, type CatalogDataset, type CellValue } from './campaign';

type Definition = Schemas['WorkflowDefinition'];
type WorkflowNode = Definition['root']['nodes'][number];
type GroupNode = Extract<WorkflowNode, { type: 'group' }>;
type SourceNode = Extract<WorkflowNode, { type: 'source' }>;
type FormulaNode = Extract<WorkflowNode, { type: 'calculation' | 'decision_table' }>;
type Symbol = Schemas['Symbol'];
type Problem = Schemas['WorkflowProblem'];
type Value = Schemas['Value'];
type DataType = Schemas['DataType'];
type Message = Schemas['Message'];
type TraceMessage = Schemas['TraceMessage'];
type TraceNode = Schemas['UnitRunTrace']['nodes'][number];
type RecordKey = Schemas['RecordKey'];
export type Analysis = Schemas['Analysis'];
export type UnitRunTrace = Schemas['UnitRunTrace'];
export type Preview = Schemas['Preview'];

/** How many records of the batch source the preview reads (E5-11). */
const PREVIEW_RECORDS = 500;
const EXAMPLE_KEYS = 5;

// --- Catalog ---------------------------------------------------------------------------------------------------------

/** A catalog variable with its dataset and column. */
interface CatalogVariable {
  id: string;
  name: string;
  dataset: CatalogDataset;
  column: CatalogColumn;
}

const VARIABLES = new Map<string, CatalogVariable>(
  CATALOG.flatMap((dataset) =>
    variablesOf(dataset).map((each) => {
      const column = dataset.columns.find((candidate) => candidate.name === each.column) as CatalogColumn;
      return [each.id, { id: each.id, name: each.name, dataset, column }] as const;
    }),
  ),
);

export function catalogDataset(id: string): CatalogDataset | undefined {
  return CATALOG.find((dataset) => dataset.id === id);
}

function catalogVariable(id: string): CatalogVariable | undefined {
  return VARIABLES.get(id);
}

// --- Walking the definition ------------------------------------------------------------------------------------------

/** A node with where it is: its path in the document and the group it is in (`null`: the root). */
interface Placed {
  node: WorkflowNode;
  path: string;
  groupId: string | null;
}

function placedNodes(nodes: readonly WorkflowNode[], base: string, groupId: string | null): Placed[] {
  return nodes.flatMap((node, index) => {
    const path = `${base}[${index}]`;
    const here: Placed = { node, path, groupId };
    return node.type === 'group' ? [here, ...placedNodes(node.nodes, `${path}.nodes`, node.id)] : [here];
  });
}

function allPlaced(definition: Definition): Placed[] {
  return placedNodes(definition.root.nodes, 'root.nodes', null);
}

/** The names a node gives to its scope: the outputs of a Linear Fonte, a Calculation, a Table, or a group's Output. */
function producedNames(node: WorkflowNode): string[] {
  switch (node.type) {
    case 'calculation':
      return [node.output.name];
    case 'decision_table':
      return node.results.map((result) => result.name);
    case 'source':
      return node.mode === 'linear' ? node.outputs.map((output) => output.name) : [];
    case 'group':
      return [...node.outputs];
  }
}

// --- Analysis --------------------------------------------------------------------------------------------------------

function symbolsOf(definition: Definition): Symbol[] {
  const symbols: Symbol[] = [];
  const add = (symbol: Symbol) => {
    if (!symbols.some((known) => known.name === symbol.name)) symbols.push(symbol);
  };
  const base = { cardinality: 'linear' as const, list: null };
  for (const output of definition.root.batch_source?.outputs ?? []) {
    const found = catalogVariable(output.variable_id);
    add({ ...base, name: output.name, type: found?.column.type ?? null, scale: found?.column.scale ?? null, origin: 'batch_source', node_id: null, group_id: null });
  }
  for (const input of definition.root.inputs) {
    if (input.cardinality === 'linear') {
      add({ ...base, name: input.name, type: input.type, scale: input.scale ?? null, origin: 'input', node_id: null, group_id: null });
    }
  }
  for (const { node, groupId } of allPlaced(definition)) {
    if (node.type === 'source' && node.mode === 'linear') {
      for (const output of node.outputs) {
        const found = catalogVariable(output.variable_id);
        add({ ...base, name: output.name, type: found?.column.type ?? null, scale: found?.column.scale ?? null, origin: 'source', node_id: node.id, group_id: groupId });
      }
    } else if (node.type === 'calculation') {
      add({ ...base, name: node.output.name, type: node.output.type, scale: node.output.scale ?? null, origin: 'calculation', node_id: node.id, group_id: groupId });
    } else if (node.type === 'decision_table') {
      for (const result of node.results) {
        add({ ...base, name: result.name, type: result.type, scale: result.scale ?? null, origin: 'decision_table', node_id: node.id, group_id: groupId });
      }
    }
  }
  return symbols;
}

/** The groups by id, with the parent of each one. */
function groupTree(definition: Definition): { groups: Map<string, GroupNode>; parent: Map<string, string | null> } {
  const groups = new Map<string, GroupNode>();
  const parent = new Map<string, string | null>();
  for (const { node, groupId } of allPlaced(definition)) {
    if (node.type !== 'group') continue;
    groups.set(node.id, node);
    parent.set(node.id, groupId);
  }
  return { groups, parent };
}

/** A variable produced in a group is seen inside it (and the groups inside it) and, through its Output, in its parent. */
function visibleIn(definition: Definition, symbols: readonly Symbol[], scope: string | null): Symbol[] {
  const { groups, parent } = groupTree(definition);
  const within = (inner: string | null, outer: string | null): boolean => {
    for (let at = inner; ; at = parent.get(at) ?? null) {
      if (at === outer) return true;
      if (at === null) return false;
    }
  };
  return symbols.filter((symbol) => {
    let at = symbol.group_id;
    for (;;) {
      if (at === null || within(scope, at)) return true;
      if (!groups.get(at)?.outputs.includes(symbol.name)) return false;
      at = parent.get(at) ?? null;
    }
  });
}

interface NodeFormula {
  path: string;
  source: string;
  kind: 'formula' | 'cell';
  required: boolean;
}

function formulasOf(node: FormulaNode, base: string): NodeFormula[] {
  if (node.type === 'calculation') {
    const formulas: NodeFormula[] = [{ path: `${base}.expression`, source: node.expression, kind: 'formula', required: true }];
    if (node.default_value !== null) formulas.push({ path: `${base}.default_value`, source: node.default_value, kind: 'formula', required: false });
    return formulas;
  }
  return [
    ...node.conditions.map((condition, column) => ({ path: `${base}.conditions[${column}].expression`, source: condition.expression, kind: 'formula' as const, required: true })),
    ...node.rules.flatMap((rule, row) => [
      ...rule.when.map((cell, column) => ({ path: `${base}.rules[${row}].when[${column}]`, source: cell, kind: 'cell' as const, required: false })),
      ...rule.then.map((cell, column) => ({ path: `${base}.rules[${row}].then[${column}]`, source: cell, kind: 'formula' as const, required: false })),
    ]),
  ];
}

function read(formula: NodeFormula): { expressions: Expression[]; problem?: FormulaProblem } {
  if (formula.source.trim() === '') {
    return formula.required ? { expressions: [], problem: { code: 'formula_empty', message: 'A fórmula está vazia.', start: 0, end: 0 } } : { expressions: [] };
  }
  try {
    return { expressions: formula.kind === 'cell' ? cellExpressions(parseCell(formula.source)) : [parseFormula(formula.source)] };
  } catch (error) {
    if (!(error instanceof FormulaSyntaxError)) throw error;
    return { expressions: [], problem: { code: 'syntax_error', message: error.message, start: error.start, end: error.end } };
  }
}

const problem = (code: Problem['code'], message: string, path: string, nodeId: string | null): Problem => ({
  code,
  message,
  path,
  node_id: nodeId,
  start: null,
  end: null,
  suggestion: null,
});

/**
 * A name the formula cannot see that exists inside a group is `not_visible` (Contratos, E5-5), with the backend's text:
 * "pontos existe, mas não é visível aqui. Ela está dentro do grupo Pontuação.".
 */
function hidden(definition: Definition, symbols: readonly Symbol[], source: string, found: FormulaProblem): FormulaProblem {
  if (found.code !== 'unknown_variable' || found.start === null || found.end === null) return found;
  const name = Array.from(source).slice(found.start, found.end).join('');
  const symbol = symbols.find((each) => each.name === name);
  if (!symbol || symbol.group_id === null) return found;
  const group = groupTree(definition).groups.get(symbol.group_id);
  return { ...found, code: 'not_visible', message: `${name} existe, mas não é visível aqui. Ela está dentro do grupo ${group?.name ?? symbol.group_id}.` };
}

/** The names each node reads (a group: the names its blocks read from outside, its derived Input). */
function readsOf(definition: Definition, symbols: readonly Symbol[], problems: Problem[]): Map<string, Set<string>> {
  const reads = new Map<string, Set<string>>();
  for (const { node, path, groupId } of allPlaced(definition)) {
    if (node.type === 'group') continue;
    const names = new Set<string>();
    if (node.type === 'source') {
      for (const link of node.links) names.add(link.variable);
      if (node.mode === 'linear' && node.order_by.length === 0) {
        problems.push(problem('missing_order_by', `${node.name} precisa de uma ordenação.`, `${path}.order_by`, node.id));
      }
    } else {
      const visible = visibleIn(definition, symbols, groupId);
      for (const formula of formulasOf(node, path)) {
        const { expressions, problem: syntax } = read(formula);
        const found: FormulaProblem[] = syntax ? [syntax] : [];
        for (const expression of expressions) {
          readNames(expression, names);
          found.push(...checkExpression(expression, visible).problems.map((each) => hidden(definition, symbols, formula.source, each)));
        }
        for (const each of found) problems.push({ ...each, path: formula.path, node_id: node.id, suggestion: null });
      }
      if (node.type === 'decision_table' && (node.rules.length === 0 || node.results.length === 0)) {
        problems.push(problem('empty_decision_table', `${node.name} precisa de pelo menos uma regra e uma coluna de resultado.`, path, node.id));
      }
    }
    reads.set(node.id, names);
  }
  // The derived Input of each group: what its blocks (at any depth) read and is not produced inside it.
  const groups = allPlaced(definition).filter((placed): placed is Placed & { node: GroupNode } => placed.node.type === 'group');
  for (const { node, path } of groups.reverse()) {
    const inside = placedNodes(node.nodes, 'x', node.id).map((placed) => placed.node);
    const produced = new Set(inside.flatMap((each) => (each.type === 'group' ? [] : producedNames(each))));
    const derived = new Set<string>();
    for (const each of node.nodes) for (const name of reads.get(each.id) ?? []) if (!produced.has(name)) derived.add(name);
    reads.set(node.id, derived);
    if (node.outputs.length === 0) problems.push(problem('empty_group_output', `${node.name} precisa de pelo menos uma variável no Output.`, `${path}.outputs`, node.id));
  }
  return reads;
}

/** The order of the nodes of one scope: topological by the names read, the tie broken by the position; empty with a cycle. */
function scopeOrder(nodes: readonly WorkflowNode[], reads: ReadonlyMap<string, ReadonlySet<string>>): string[] {
  const producer = new Map<string, string>();
  for (const node of nodes) for (const name of producedNames(node)) if (!producer.has(name)) producer.set(name, node.id);
  const needs = new Map(
    nodes.map((node) => [node.id, new Set([...(reads.get(node.id) ?? [])].map((name) => producer.get(name)).filter((id): id is string => id !== undefined && id !== node.id))]),
  );
  const done: string[] = [];
  while (done.length < nodes.length) {
    const next = nodes.find((node) => !done.includes(node.id) && [...(needs.get(node.id) ?? [])].every((need) => done.includes(need)));
    if (!next) return [];
    done.push(next.id);
  }
  return done;
}

/** Problems, symbols, dependencies, order and the groups' interfaces (`POST .../draft/analysis` and the draft). */
export function analyze(definition: Definition): Analysis {
  const symbols = symbolsOf(definition);
  const known = new Set(symbols.map((symbol) => symbol.name));
  const problems: Problem[] = [];
  const source = definition.root.batch_source;
  if (source) {
    const names = new Set(source.outputs.map((output) => output.name));
    if (source.key.length === 0 || source.key.some((name) => !names.has(name))) {
      problems.push(problem('missing_batch_source_key', 'Escolha a chave da fonte do lote entre as variáveis trazidas.', 'root.batch_source.key', null));
    }
    if (source.order_by.length === 0) problems.push(problem('missing_order_by', 'A fonte do lote precisa de uma ordenação.', 'root.batch_source.order_by', null));
    if (definition.root.inputs.length > 0) {
      problems.push(problem('inputs_with_batch_source', 'Com a fonte do lote, o workflow não tem entradas declaradas.', 'root.inputs', null));
    }
  }
  const reads = readsOf(definition, symbols, problems);
  const dependencies = allPlaced(definition).map(({ node }) => ({ node_id: node.id, reads: [...(reads.get(node.id) ?? [])].filter((name) => known.has(name)).sort() }));
  const groups = allPlaced(definition)
    .map((placed) => placed.node)
    .filter((node): node is GroupNode => node.type === 'group')
    .map((group) => ({
      node_id: group.id,
      inputs: [...(reads.get(group.id) ?? [])].filter((name) => known.has(name)).sort(),
      outputs: [...group.outputs],
      order: scopeOrder(group.nodes, reads),
    }));
  return { problems, symbols, dependencies, order: scopeOrder(definition.root.nodes, reads), groups };
}

// --- Values ----------------------------------------------------------------------------------------------------------

/** A cell of the source as the formulas see it. */
function runtimeOf(value: CellValue, type: DataType): RuntimeValue {
  if (value === null) return null;
  if ((type === 'integer' || type === 'decimal') && typeof value === 'string') return parseDecimal(value);
  return value;
}

/** A cell of the source as the API sends it: numbers as text with the column's places. */
function apiOf(value: CellValue, column: CatalogColumn): Value {
  if (value === null) return null;
  if (column.type === 'decimal' && typeof value === 'string') {
    const number = parseDecimal(value);
    return number ? formatDecimal(number, column.scale ?? 0) : value;
  }
  return value;
}

/** The text of a value in a key: `"10"`, `"P01"`. */
function keyTextOf(value: Value): string {
  return value === null ? '' : typeof value === 'object' ? JSON.stringify(value) : String(value);
}

/** -1, 0 or 1; nulls last. */
function compareRuntime(a: RuntimeValue, b: RuntimeValue): number {
  if (a === null || b === null) return a === b ? 0 : a === null ? 1 : -1;
  if (isDecimal(a) && isDecimal(b)) return a.units === b.units ? 0 : a.units < b.units ? -1 : 1;
  if (typeof a === 'boolean' && typeof b === 'boolean') return a === b ? 0 : a ? 1 : -1;
  if (typeof a === 'string' && typeof b === 'string') return a === b ? 0 : a < b ? -1 : 1;
  return 0;
}

const EMPTY_SCOPE: Scope = { linear: new Map(), lists: new Map(), fieldList: new Map() };

/** A literal of a filter (formula language, E4-3) as a value. */
function literal(text: string): RuntimeValue {
  return evaluate(parseFormula(text), EMPTY_SCOPE);
}

function passes(value: RuntimeValue, operator: Schemas['FilterOperator'], values: readonly string[]): boolean {
  if (operator === 'is_null') return value === null;
  if (operator === 'is_not_null') return value !== null;
  if (value === null) return false;
  const [first, second] = values.map(literal);
  const compared = compareRuntime(value, first ?? null);
  switch (operator) {
    case '=':
      return compared === 0;
    case '<>':
      return compared !== 0;
    case '>':
      return compared > 0;
    case '>=':
      return compared >= 0;
    case '<':
      return compared < 0;
    case '<=':
      return compared <= 0;
    case 'between':
      return compared >= 0 && compareRuntime(value, second ?? null) <= 0;
    case 'in':
      return values.some((each) => compareRuntime(value, literal(each)) === 0);
  }
}

function columnOf(dataset: CatalogDataset, variableId: string): CatalogColumn | undefined {
  const found = catalogVariable(variableId);
  return found && found.dataset.id === dataset.id ? found.column : undefined;
}

// --- Batch source ----------------------------------------------------------------------------------------------------

type Row = Readonly<Record<string, CellValue>>;

interface BatchRecord {
  key: RecordKey;
  row: Row;
  /** Passes the batch source filters. */
  kept: boolean;
}

function batchColumn(definition: Definition, dataset: CatalogDataset, name: string): CatalogColumn | undefined {
  const output = definition.root.batch_source?.outputs.find((each) => each.name === name);
  return output ? columnOf(dataset, output.variable_id) : undefined;
}

/** Every row of the batch source, in its order, with the key and whether it passes the filters. */
function batchRecords(definition: Definition): BatchRecord[] {
  const source = definition.root.batch_source;
  const dataset = source ? catalogDataset(source.dataset_id) : undefined;
  if (!source || !dataset) return [];
  const columns = (name: string) => batchColumn(definition, dataset, name);
  const value = (row: Row, name: string) => {
    const column = columns(name);
    return column ? runtimeOf(row[column.name] ?? null, column.type) : null;
  };
  const records = dataset.rows.map((row) => ({
    row,
    key: Object.fromEntries(source.key.map((name) => {
      const column = columns(name);
      return [name, column ? keyTextOf(apiOf(row[column.name] ?? null, column)) : ''];
    })),
    kept: source.filters.every((filter) => passes(value(row, filter.variable), filter.operator, filter.values)),
  }));
  const order = [...source.order_by, ...source.key.map((variable) => ({ variable, direction: 'asc' as const }))];
  return records.sort((a, b) => {
    for (const { variable, direction } of order) {
      const compared = compareRuntime(value(a.row, variable), value(b.row, variable));
      if (compared !== 0) return direction === 'asc' ? compared : -compared;
    }
    return 0;
  });
}

/** The record of the key (`null`: no record has it, `404 record_not_found`). */
export function findRecord(definition: Definition, key: Readonly<Record<string, unknown>>): BatchRecord | null {
  const names = definition.root.batch_source?.key ?? [];
  if (names.length === 0 || Object.keys(key).length !== names.length) return null;
  return batchRecords(definition).find((record) => names.every((name) => record.key[name] === key[name])) ?? null;
}

// --- Unit run --------------------------------------------------------------------------------------------------------

/** What a Fonte block found for a record (the preview counts it). */
export interface SourceOutcome {
  node: SourceNode;
  rows: number;
  /** The row brought (Linear) or the linked values (Filtro), by name; null when none. */
  brought: Record<string, Value> | null;
  passed: boolean;
}

interface Run {
  definition: Definition;
  analysis: Analysis;
  runtime: Map<string, RuntimeValue>;
  api: Map<string, Value>;
  inputs: Schemas['TraceInput'][];
  warnings: TraceMessage[];
  /** What ended the record, if anything. */
  end: { status: 'error' | 'ignored' | 'filtered'; error: TraceMessage | null } | null;
  observe?: (outcome: SourceOutcome) => void;
}

function scopeOf(run: Run): Scope {
  return { linear: run.runtime, lists: new Map(), fieldList: new Map() };
}

function notRun(node: WorkflowNode): TraceNode {
  switch (node.type) {
    case 'group':
      return { type: 'group', node_id: node.id, status: 'not_run', inputs: {}, outputs: {}, nodes: [] };
    case 'source':
      return { type: 'source', node_id: node.id, status: 'not_run', values: {}, rows_found: 0, warnings: [], error: null };
    default:
      return { type: node.type, node_id: node.id, status: 'not_run', values: {}, matched_rule: null, warnings: [], error: null };
  }
}

function warn(run: Run, nodeId: string, message: Message, values: Record<string, Value> = {}): void {
  run.warnings.push({ node_id: nodeId, ...message, values });
}

function fail(run: Run, nodeId: string, message: Message, values: Record<string, Value> = {}): void {
  run.end = { status: 'error', error: { node_id: nodeId, ...message, values } };
}

function setValue(run: Run, name: string, value: Value): void {
  run.api.set(name, value);
  run.runtime.set(name, typeof value === 'string' ? (parseDecimal(value) ?? value) : Array.isArray(value) ? null : (value as RuntimeValue));
}

function runSource(run: Run, node: SourceNode): TraceNode {
  const dataset = catalogDataset(node.dataset_id);
  const linked = Object.fromEntries(node.links.map((link) => [link.variable, run.api.get(link.variable) ?? null]));
  const linkText = node.links.map((link) => `${link.variable} ${keyTextOf(linked[link.variable] ?? null)}`).join(', ');
  const rows = (dataset?.rows ?? []).filter((row) => {
    const filtered = node.filters.every((filter) => {
      const column = dataset && columnOf(dataset, filter.variable_id);
      return column ? passes(runtimeOf(row[column.name] ?? null, column.type), filter.operator, filter.values) : false;
    });
    return (
      filtered &&
      node.links.every((link) => {
        const column = dataset && columnOf(dataset, link.column_variable_id);
        const value = run.runtime.get(link.variable) ?? null;
        return column !== undefined && value !== null && compareRuntime(runtimeOf(row[column.name] ?? null, column.type), value) === 0;
      })
    );
  });

  if (node.mode === 'filter') {
    const passed = node.exists ? rows.length > 0 : rows.length === 0;
    run.observe?.({ node, rows: rows.length, brought: linked, passed });
    if (!passed) run.end = { status: 'filtered', error: null };
    return { type: 'source', node_id: node.id, status: 'ok', values: {}, rows_found: rows.length, warnings: [], error: null };
  }

  const outputs = node.outputs.map((output) => ({ output, column: dataset && columnOf(dataset, output.variable_id) }));
  const sortBy = [
    ...node.order_by.map((order) => ({ column: dataset && columnOf(dataset, order.variable_id), direction: order.direction })),
    ...outputs.map(({ column }) => ({ column, direction: 'asc' as const })),
  ];
  const sorted = [...rows].sort((a, b) => {
    for (const { column, direction } of sortBy) {
      if (!column) continue;
      const compared = compareRuntime(runtimeOf(a[column.name] ?? null, column.type), runtimeOf(b[column.name] ?? null, column.type));
      if (compared !== 0) return direction === 'asc' ? compared : -compared;
    }
    return 0;
  });
  const warnings: Message[] = [];
  const result = (status: Schemas['NodeRunStatus'], values: Record<string, Value>, error: Message | null = null): TraceNode => ({
    type: 'source',
    node_id: node.id,
    status,
    values,
    rows_found: rows.length,
    warnings,
    error,
  });
  const nulls = Object.fromEntries(node.outputs.map((output) => [output.name, null]));

  const first = sorted[0];
  if (!first) {
    run.observe?.({ node, rows: 0, brought: null, passed: false });
    if (node.no_match === 'error') {
      const message = { code: 'no_match' as const, message: `${node.name} não achou linha para ${linkText}.` };
      fail(run, node.id, message, linked);
      return result('error', nulls, message);
    }
    if (node.no_match === 'discard') {
      const message = { code: 'no_match' as const, message: `${node.name} não achou linha para ${linkText}; o registro foi ignorado, como pede a política do bloco.` };
      warnings.push(message);
      warn(run, node.id, message, linked);
      run.end = { status: 'ignored', error: null };
      return result('warning', nulls);
    }
    const message = { code: 'no_match' as const, message: `${node.name} não achou linha para ${linkText}; as saídas ficaram vazias.` };
    warnings.push(message);
    warn(run, node.id, message, linked);
    for (const output of node.outputs) setValue(run, output.name, null);
    return result('warning', nulls);
  }
  if (sorted.length > 1 && node.multiple_rows === 'error') {
    run.observe?.({ node, rows: sorted.length, brought: null, passed: false });
    const message = { code: 'multiple_rows' as const, message: `${node.name} achou ${sorted.length} linhas para ${linkText}.` };
    fail(run, node.id, message, linked);
    return result('error', nulls, message);
  }
  if (sorted.length > 1) {
    const message = { code: 'multiple_rows' as const, message: `${node.name} achou ${sorted.length} linhas para ${linkText}; valeu a primeira pela ordenação.` };
    warnings.push(message);
    warn(run, node.id, message, linked);
  }
  const values: Record<string, Value> = {};
  // A block with no link (a parameters table) reads a row without key: `row_key` null (TraceOrigin), as the backend.
  const rowKey = node.links.length > 0 ? Object.fromEntries(Object.entries(linked).map(([name, value]) => [name, keyTextOf(value)])) : null;
  for (const { output, column } of outputs) {
    const value = column ? apiOf(first[column.name] ?? null, column) : null;
    values[output.name] = value;
    setValue(run, output.name, value);
    if (dataset && column) {
      run.inputs.push({ variable: output.name, value, origin: { connection: dataset.connection, dataset: dataset.name, column: column.name, row_key: rowKey } });
    }
  }
  run.observe?.({ node, rows: sorted.length, brought: values, passed: true });
  return result(warnings.length > 0 ? 'warning' : 'ok', values);
}

/** A node's output value, rounded to the declared places by the node's mode (or the workflow's), as the API sends it. */
function outputValue(value: RuntimeValue, type: DataType, scale: number | null | undefined, mode: Schemas['RoundingMode']): Value {
  if (value === null || Array.isArray(value)) return null;
  if (isDecimal(value)) {
    const places = type === 'integer' ? 0 : (scale ?? 0);
    return formatDecimal(roundTo(value, places, mode), places);
  }
  return value;
}

function runFormula(run: Run, node: FormulaNode): TraceNode {
  const scope = scopeOf(run);
  const mode = node.rounding_mode ?? run.definition.settings.rounding.mode;
  const policy = node.error_policy ?? run.definition.settings.error_policy;
  const warnings: Message[] = [];
  const base = { node_id: node.id, warnings, error: null };
  try {
    if (node.type === 'calculation') {
      let value = outputValue(evaluate(parseFormula(node.expression), scope), node.output.type, node.output.scale, mode);
      if (value === null) {
        const message = { code: 'null_result' as const, message: `O resultado de ${node.name} ficou nulo.` };
        if (policy === 'error') throw new EvaluationFailure(message.code, message.message);
        if (policy === 'default_value' && node.default_value !== null) {
          value = outputValue(evaluate(parseFormula(node.default_value), scope), node.output.type, node.output.scale, mode);
          message.message = `O resultado de ${node.name} ficou nulo; valeu o valor padrão.`;
        }
        warnings.push(message);
        warn(run, node.id, message);
      }
      setValue(run, node.output.name, value);
      return { ...base, type: 'calculation', status: warnings.length > 0 ? 'warning' : 'ok', values: { [node.output.name]: value }, matched_rule: null };
    }
    const conditions = node.conditions.map((condition) => evaluate(parseFormula(condition.expression), scope));
    const matched = node.rules
      .map((rule, index) => ({ rule, number: index + 1 }))
      .filter(({ rule }) => rule.when.every((cell, column) => cellMatches(parseCell(cell), conditions[column] ?? null, scope)));
    if (matched.length === 0) throw new EvaluationFailure('no_rule_matched', `Nenhuma regra de ${node.name} casou.`);
    if (node.hit_policy === 'unique' && matched.length > 1) {
      throw new EvaluationFailure('multiple_rules_matched', `As regras ${matched.map(({ number }) => number).join(' e ')} casaram.`);
    }
    const chosen = matched[0] as (typeof matched)[number];
    const values: Record<string, Value> = {};
    node.results.forEach((result, column) => {
      const cell = chosen.rule.then[column] ?? '';
      values[result.name] = outputValue(cell.trim() === '' ? null : evaluate(parseFormula(cell), scope), result.type, result.scale, mode);
    });
    for (const [name, value] of Object.entries(values)) setValue(run, name, value);
    return { ...base, type: 'decision_table', status: 'ok', values, matched_rule: chosen.number };
  } catch (error) {
    if (!(error instanceof EvaluationFailure)) throw error;
    const message = { code: error.code, message: error.message };
    const names = node.type === 'calculation' ? [node.output.name] : node.results.map((result) => result.name);
    fail(run, node.id, message);
    return { ...base, type: node.type, status: 'error', values: Object.fromEntries(names.map((name) => [name, null])), matched_rule: null, error: message };
  }
}

function runGroup(run: Run, node: GroupNode): TraceNode {
  const face = run.analysis.groups.find((group) => group.node_id === node.id);
  const inputs = Object.fromEntries((face?.inputs ?? []).map((name) => [name, run.api.get(name) ?? null]));
  const before = run.warnings.length;
  const nodes = runScope(run, node.nodes, face?.order ?? node.nodes.map((each) => each.id));
  const failed = nodes.some((each) => each.status === 'error');
  const outputs = run.end ? {} : Object.fromEntries(node.outputs.map((name) => [name, run.api.get(name) ?? null]));
  const status = failed ? 'error' : run.warnings.length > before ? 'warning' : 'ok';
  return { type: 'group', node_id: node.id, status, inputs, outputs, nodes };
}

function runScope(run: Run, nodes: readonly WorkflowNode[], order: readonly string[]): TraceNode[] {
  const ordered = order.map((id) => nodes.find((node) => node.id === id)).filter((node): node is WorkflowNode => node !== undefined);
  return ordered.map((node) => {
    if (run.end) return notRun(node);
    if (node.type === 'source') return runSource(run, node);
    if (node.type === 'group') return runGroup(run, node);
    return runFormula(run, node);
  });
}

/** SHA-256 of the canonical JSON (keys in order, numbers as text). */
function hashOf(values: Readonly<Record<string, Value>>): string {
  const canonical = JSON.stringify(Object.fromEntries(Object.keys(values).sort().map((name) => [name, values[name]])));
  return `sha256:${createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

/** Runs one record of the batch source (`POST .../draft/unit-runs` with `record_key`) over a draft without problems. */
export function runRecord(definition: Definition, analysis: Analysis, record: BatchRecord, observe?: (outcome: SourceOutcome) => void): UnitRunTrace {
  const run: Run = { definition, analysis, runtime: new Map(), api: new Map(), inputs: [], warnings: [], end: null, observe };
  const source = definition.root.batch_source;
  const dataset = source ? catalogDataset(source.dataset_id) : undefined;
  for (const output of source?.outputs ?? []) {
    const column = dataset && columnOf(dataset, output.variable_id);
    const value = column ? apiOf(record.row[column.name] ?? null, column) : null;
    setValue(run, output.name, value);
    if (dataset && column) {
      run.inputs.push({ variable: output.name, value, origin: { connection: dataset.connection, dataset: dataset.name, column: column.name, row_key: record.key } });
    }
  }
  if (!record.kept) run.end = { status: 'filtered', error: null };
  const nodes = runScope(run, definition.root.nodes, analysis.order);
  const inputHash = hashOf(Object.fromEntries(run.inputs.map((input) => [input.variable, input.value])));
  if (run.end) {
    return { status: run.end.status, record_key: record.key, inputs: run.inputs, nodes, outputs: {}, input_hash: inputHash, output_hash: null, error: run.end.error, warnings: run.warnings };
  }
  const outputs = Object.fromEntries(definition.root.output.fields.map((field) => [field.name, run.api.get(field.variable) ?? null]));
  return {
    status: run.warnings.length > 0 ? 'ok_with_warnings' : 'ok',
    record_key: record.key,
    inputs: run.inputs,
    nodes,
    outputs,
    input_hash: inputHash,
    output_hash: hashOf(outputs),
    error: null,
    warnings: run.warnings,
  };
}

// --- Preview ---------------------------------------------------------------------------------------------------------

/** The Fonte blocks in the run order, the ones inside groups where the group runs. */
function sourcesInOrder(nodes: readonly WorkflowNode[], order: readonly string[], analysis: Analysis): SourceNode[] {
  return order.flatMap((id) => {
    const node = nodes.find((each) => each.id === id);
    if (!node) return [];
    if (node.type === 'source') return [node];
    if (node.type !== 'group') return [];
    const face = analysis.groups.find((group) => group.node_id === node.id);
    return sourcesInOrder(node.nodes, face?.order ?? [], analysis);
  });
}

function groupsInOrder(nodes: readonly WorkflowNode[], order: readonly string[], analysis: Analysis): GroupNode[] {
  return order.flatMap((id) => {
    const node = nodes.find((each) => each.id === id);
    if (node?.type !== 'group') return [];
    const face = analysis.groups.find((group) => group.node_id === node.id);
    return [node, ...groupsInOrder(node.nodes, face?.order ?? [], analysis)];
  });
}

function findTraceGroup(nodes: readonly TraceNode[], id: string): Extract<TraceNode, { type: 'group' }> | undefined {
  for (const node of nodes) {
    if (node.type !== 'group') continue;
    if (node.node_id === id) return node;
    const inner = findTraceGroup(node.nodes, id);
    if (inner) return inner;
  }
  return undefined;
}

/** `POST .../draft/previews`: the first 500 records of the batch source, the counts per Fonte block and the samples. */
export function preview(definition: Definition, analysis: Analysis, sampleSize: number): Preview {
  const records = batchRecords(definition).filter((record) => record.kept).slice(0, PREVIEW_RECORDS);
  const sources = sourcesInOrder(definition.root.nodes, analysis.order, analysis);
  const counts = new Map(
    sources.map((node) => [
      node.id,
      { found: 0, noMatch: 0, multiple: 0, maxRows: 0, kept: 0, filtered: 0, noMatchKeys: [] as RecordKey[], multipleKeys: [] as RecordKey[], rows: [] as Record<string, Value>[] },
    ]),
  );
  const traces = records.map((record) => {
    const trace = runRecord(definition, analysis, record, ({ node, rows, brought, passed }) => {
      const count = counts.get(node.id);
      if (!count) return;
      count.maxRows = Math.max(count.maxRows, rows);
      if (node.mode === 'filter') {
        if (passed) count.kept += 1;
        else count.filtered += 1;
      } else if (rows === 0) {
        count.noMatch += 1;
        if (count.noMatchKeys.length < EXAMPLE_KEYS) count.noMatchKeys.push(record.key);
      } else if (rows > 1) {
        count.multiple += 1;
        if (count.multipleKeys.length < EXAMPLE_KEYS) count.multipleKeys.push(record.key);
      } else {
        count.found += 1;
      }
      if (brought && count.rows.length < sampleSize) count.rows.push(brought);
    });
    return { record, trace };
  });
  const sample = traces.slice(0, sampleSize);
  const source = definition.root.batch_source;
  const batchNames = source?.outputs.map((output) => output.name) ?? [];
  const groups: Schemas['PreviewGroup'][] = [
    {
      node_id: null,
      records: sample.map(({ trace }) => ({
        record_key: trace.record_key ?? {},
        status: trace.status,
        inputs: Object.fromEntries(trace.inputs.filter((input) => batchNames.includes(input.variable)).map((input) => [input.variable, input.value])),
        outputs: trace.outputs,
      })),
    },
    ...groupsInOrder(definition.root.nodes, analysis.order, analysis).map((group) => ({
      node_id: group.id,
      records: sample.flatMap(({ trace }) => {
        const node = findTraceGroup(trace.nodes, group.id);
        if (!node || node.status === 'not_run') return [];
        return [{ record_key: trace.record_key ?? {}, status: trace.status, inputs: node.inputs, outputs: node.outputs }];
      }),
    })),
  ];
  return {
    counted_records: records.length,
    total_known: false,
    sources: sources.map((node) => {
      const count = counts.get(node.id)!;
      const linear = node.mode === 'linear';
      return {
        node_id: node.id,
        mode: node.mode,
        found: linear ? count.found : null,
        no_match: linear ? count.noMatch : null,
        multiple_rows: linear ? count.multiple : null,
        max_rows: linear ? count.maxRows : null,
        no_match_keys: linear ? count.noMatchKeys : [],
        multiple_rows_keys: linear ? count.multipleKeys : [],
        kept: linear ? null : count.kept,
        filtered: linear ? null : count.filtered,
        rows: count.rows,
      };
    }),
    groups,
    error: null,
  };
}
