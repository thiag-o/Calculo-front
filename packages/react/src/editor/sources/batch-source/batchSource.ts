// The batch source of the workflow (E5-2, E5-17): the dataset whose rows are the records, the variables it brings (with the
// name in the workflow), the record key, the filters and the order. Pure functions over the definition: each edit keeps the
// same objects for what did not change (ADR 0044), and never writes a shape the contract refuses (ADR 0046).
import type { Schemas } from '../../../api';
import type { DraftSymbol, WorkflowDefinition, WorkflowProblem } from '../../draft';

/** The types of the contract (generated, ADR 0005). */
export type BatchSource = Schemas['BatchSource'];
export type BatchSourceFilter = Schemas['BatchSourceFilter'];
export type BatchSourceOrder = Schemas['BatchSourceOrder'];
export type SourceOutput = Schemas['SourceOutput'];
export type SortDirection = Schemas['SortDirection'];
export type DataType = Schemas['DataType'];

/** Where the batch source is in the definition, and the start of the `path` of its problems. */
export const BATCH_SOURCE_PATH = 'root.batch_source';
export const DATASET_PATH = `${BATCH_SOURCE_PATH}.dataset_id`;
export const KEY_PATH = `${BATCH_SOURCE_PATH}.key`;
export const FILTERS_PATH = `${BATCH_SOURCE_PATH}.filters`;
export const ORDER_PATH = `${BATCH_SOURCE_PATH}.order_by`;
export const OUTPUTS_PATH = `${BATCH_SOURCE_PATH}.outputs`;
/** The declared inputs: `inputs_with_batch_source` points here. */
export const INPUTS_PATH = 'root.inputs';

/** The batch source of a dataset, still without variables, key, filters or order. */
export function emptyBatchSource(datasetId: string): BatchSource {
  return { dataset_id: datasetId, key: [], filters: [], order_by: [], outputs: [] };
}

/**
 * The workflow fed by the batch source of `datasetId` (E5-2): the declared inputs leave (with the batch source, `inputs`
 * must be empty). The version written is the one of the save (`saveDraft`), not of this edit.
 */
export function withBatchSource(definition: WorkflowDefinition, datasetId: string): WorkflowDefinition {
  return {
    ...definition,
    root: { ...definition.root, inputs: [], batch_source: emptyBatchSource(datasetId) },
  };
}

/** The workflow back to the declared inputs (typed in "Calcular"): the batch source leaves. */
export function withoutBatchSource(definition: WorkflowDefinition): WorkflowDefinition {
  if (!definition.root.batch_source) return definition;
  return { ...definition, root: { ...definition.root, batch_source: null } };
}

/** The definition with the batch source changed; the same definition when there is none or nothing changed. */
export function updateBatchSource(definition: WorkflowDefinition, update: (source: BatchSource) => BatchSource): WorkflowDefinition {
  const current = definition.root.batch_source;
  if (!current) return definition;
  const next = update(current);
  if (next === current) return definition;
  return { ...definition, root: { ...definition.root, batch_source: next } };
}

/**
 * Another dataset: the variables of the old one do not exist in it, so the variables, the key, the filters and the order
 * start over. The same dataset changes nothing.
 */
export function withDataset(source: BatchSource, datasetId: string): BatchSource {
  return source.dataset_id === datasetId ? source : emptyBatchSource(datasetId);
}

/** Whether changing the dataset drops something already set up (variables, key, filters or order). */
export function hasSetup(source: BatchSource): boolean {
  return source.outputs.length > 0 || source.key.length > 0 || source.filters.length > 0 || source.order_by.length > 0;
}

/** A catalog variable, as the batch source brings it. */
export interface CatalogVariable {
  id: string;
  name: string;
}

/**
 * The batch source bringing `variable`, named in the workflow after its name in the catalog (Contratos, "Nomes"). Already
 * brought: the same source.
 */
export function withOutput(source: BatchSource, variable: CatalogVariable): BatchSource {
  if (source.outputs.some((output) => output.variable_id === variable.id)) return source;
  return { ...source, outputs: [...source.outputs, { variable_id: variable.id, name: variable.name }] };
}

/**
 * The batch source without `output`. The key, the filters and the order point to the variables by their name in the
 * workflow: what pointed to it leaves too (unless another output still has that name).
 */
export function withoutOutput(source: BatchSource, output: SourceOutput): BatchSource {
  if (!source.outputs.includes(output)) return source;
  const outputs = source.outputs.filter((candidate) => candidate !== output);
  if (outputs.some((candidate) => candidate.name === output.name)) return { ...source, outputs };
  const gone = (name: string) => name === output.name;
  return {
    ...source,
    outputs,
    key: keepIfSame(source.key, source.key.filter((name) => !gone(name))),
    filters: keepIfSame(source.filters, source.filters.filter((filter) => !gone(filter.variable))),
    order_by: keepIfSame(source.order_by, source.order_by.filter((order) => !gone(order.variable))),
  };
}

/**
 * The batch source with `output` named `name` in the workflow. The key, the filters and the order follow the new name
 * (they point to the variable by it), unless another output still has the old name.
 */
export function withOutputName(source: BatchSource, output: SourceOutput, name: string): BatchSource {
  const index = source.outputs.indexOf(output);
  if (index < 0 || output.name === name) return source;
  const outputs = [...source.outputs];
  outputs[index] = { ...output, name };
  const old = output.name;
  if (outputs.some((candidate) => candidate.name === old)) return { ...source, outputs };
  return {
    ...source,
    outputs,
    key: source.key.includes(old) ? source.key.map((item) => (item === old ? name : item)) : source.key,
    filters: source.filters.some((filter) => filter.variable === old)
      ? source.filters.map((filter) => (filter.variable === old ? { ...filter, variable: name } : filter))
      : source.filters,
    order_by: source.order_by.some((order) => order.variable === old)
      ? source.order_by.map((order) => (order.variable === old ? { ...order, variable: name } : order))
      : source.order_by,
  };
}

/** The key with or without the variable `name` (a new one goes last: the key keeps the order it was set up in). */
export function withKey(source: BatchSource, name: string, inKey: boolean): BatchSource {
  const has = source.key.includes(name);
  if (has === inKey) return source;
  return { ...source, key: inKey ? [...source.key, name] : source.key.filter((item) => item !== name) };
}

/**
 * The order with a new criterion: the first variable brought that is not in the order yet (or the first one), ascending.
 * Without variables, the same source.
 */
export function withNewOrder(source: BatchSource): BatchSource {
  const used = new Set(source.order_by.map((order) => order.variable));
  const variable = source.outputs.find((output) => !used.has(output.name))?.name ?? source.outputs[0]?.name;
  if (variable === undefined) return source;
  return { ...source, order_by: [...source.order_by, { variable, direction: 'asc' }] };
}

/** The order with the criterion `order` (found by object) replaced. */
export function withOrderChanged(source: BatchSource, order: BatchSourceOrder, next: BatchSourceOrder): BatchSource {
  const index = source.order_by.indexOf(order);
  if (index < 0 || (next.variable === order.variable && next.direction === order.direction)) return source;
  const order_by = [...source.order_by];
  order_by[index] = next;
  return { ...source, order_by };
}

/** The order with the criterion `order` swapped with its neighbour (`-1` up, `+1` down). */
export function withOrderMoved(source: BatchSource, order: BatchSourceOrder, offset: -1 | 1): BatchSource {
  const index = source.order_by.indexOf(order);
  const target = index + offset;
  if (index < 0 || target < 0 || target >= source.order_by.length) return source;
  const order_by = [...source.order_by];
  [order_by[index], order_by[target]] = [order_by[target]!, order_by[index]!];
  return { ...source, order_by };
}

/** The order without the criterion `order`. */
export function withoutOrder(source: BatchSource, order: BatchSourceOrder): BatchSource {
  if (!source.order_by.includes(order)) return source;
  return { ...source, order_by: source.order_by.filter((candidate) => candidate !== order) };
}

/** The batch source with these filters. */
export function withFilters(source: BatchSource, filters: readonly BatchSourceFilter[]): BatchSource {
  return filters === source.filters ? source : { ...source, filters: [...filters] };
}

/** `next` when it differs from `list`; otherwise `list` itself, so an untouched list stays the same object (ADR 0044). */
function keepIfSame<T>(list: T[], next: T[]): T[] {
  return next.length === list.length ? list : next;
}

/**
 * Where `output` was in the analysed batch source (`root.batch_source.outputs[2]`): found by the catalog variable, not by
 * the position on screen, so its problems follow it while the analysis of a change is on the way (ADR 0044).
 */
export function analyzedOutputPath(analyzed: WorkflowDefinition, output: SourceOutput): string | null {
  const index = analyzed.root.batch_source?.outputs.findIndex((candidate) => candidate.variable_id === output.variable_id) ?? -1;
  return index < 0 ? null : `${OUTPUTS_PATH}[${index}]`;
}

/**
 * Where the criterion was in the analysed order (`root.batch_source.order_by[1]`): the same object when it did not change,
 * or the criterion of the same variable. `null` when it was not analysed yet.
 */
export function analyzedOrderPath(analyzed: WorkflowDefinition, order: BatchSourceOrder): string | null {
  const list = analyzed.root.batch_source?.order_by ?? [];
  let index = list.indexOf(order);
  if (index < 0) index = list.findIndex((candidate) => candidate.variable === order.variable);
  return index < 0 ? null : `${ORDER_PATH}[${index}]`;
}

/** Whether `path` is `prefix` or a part of it (`root.batch_source.key[0]` is under `root.batch_source.key`). */
export function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

/** The problems at `prefix` or inside it. */
export function problemsUnder(problems: readonly WorkflowProblem[], prefix: string | null): WorkflowProblem[] {
  if (prefix === null) return [];
  return problems.filter((problem) => problem.path !== null && isUnder(problem.path, prefix));
}

/**
 * The problems of the record key: `missing_batch_source_key` by its code, wherever its `path` points (or without one; the
 * `path`, when it comes, only says which field to bring into view), and the other problems inside `root.batch_source.key`.
 */
export function keyProblems(problems: readonly WorkflowProblem[]): WorkflowProblem[] {
  return problems.filter((problem) => problem.code === 'missing_batch_source_key' || (problem.path !== null && isUnder(problem.path, KEY_PATH)));
}

/**
 * The problems of the order as a whole: `missing_order_by` by its code, wherever its `path` points (or without one), and
 * the other problems at `root.batch_source.order_by` itself (a criterion's own problems show on its row).
 */
export function orderProblems(problems: readonly WorkflowProblem[]): WorkflowProblem[] {
  return problems.filter((problem) => problem.code === 'missing_order_by' || problem.path === ORDER_PATH);
}

/** The problems the batch source shows by their code, wherever (or whether) their `path` points. */
export function isBatchSourceCode(problem: WorkflowProblem): boolean {
  return problem.code === 'missing_batch_source_key' || problem.code === 'missing_order_by';
}

/** The type as the canvas ports show it: `decimal(2)`, `text`. */
export function typeCode(type: DataType, scale?: number | null): string {
  return type === 'decimal' && typeof scale === 'number' ? `decimal(${scale})` : type;
}

/** A variable of the Fonte do lote bar: the name in the workflow, its type and whether it is part of the key. */
export interface BatchSourceBarRow {
  name: string;
  /** `decimal(2)`, `text`; `null` while the analysis does not know the variable. */
  type: string | null;
  key: boolean;
}

/**
 * The rows of the Fonte do lote bar on the canvas: the variables brought, in the order of `outputs`, with the type the
 * analysis gives them (`symbols` of origin `batch_source`) and the key ones marked.
 */
export function batchSourceBarRows(source: BatchSource, symbols: readonly DraftSymbol[]): BatchSourceBarRow[] {
  const types = new Map<string, string>();
  for (const symbol of symbols) {
    if (symbol.origin !== 'batch_source' || symbol.type === null || types.has(symbol.name)) continue;
    types.set(symbol.name, typeCode(symbol.type, symbol.scale));
  }
  const key = new Set(source.key);
  return source.outputs.map((output) => ({ name: output.name, type: types.get(output.name) ?? null, key: key.has(output.name) }));
}
