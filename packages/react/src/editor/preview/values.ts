// Values of the "Prévia" tab on screen (estilos.md §3): numbers in the Brazilian pattern, dates as dd/mm/aaaa, null as "—".
// Only text is handled: a value of the API never becomes a floating-point `number` (E4-4).
import type { Schemas } from '../../api';
import type { DraftSymbol, WorkflowDefinition } from '../draft';

type DataType = Schemas['DataType'];
export type Value = Schemas['Value'];
export type RecordKey = Schemas['RecordKey'];
type DefinitionNode = WorkflowDefinition['root']['nodes'][number];

/** Empty values on screen (estilos.md §1.2). */
export const NO_VALUE = '—';

// Local copies of the number and date formatters of editor/unit-run (D25): the preview never imports ../unit-run, because
// the unit run depends on the preview (useLastPreview, F67). F94 moves both to editor/values/ and removes these copies.

/** Shows a number of the API (`"1500.00"`, `"-3"`) in the Brazilian pattern (`1.500,00`, `-3`), keeping every decimal. */
export function formatApiNumber(value: string): string {
  const match = /^(-?)(\d+)(?:\.(\d+))?$/.exec(value);
  if (!match) return value;
  const [, sign = '', whole = '', decimals] = match;
  const grouped = whole.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  return `${sign}${grouped}${decimals === undefined ? '' : `,${decimals}`}`;
}

function two(value: number): string {
  return String(value).padStart(2, '0');
}

/** `2026-11-20` → `20/11/2026`, without going through a date (no time zone shift). */
function formatDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  return match ? `${match[3]}/${match[2]}/${match[1]}` : value;
}

/** ISO 8601 → `20/11/2026 10:30:00`, in the browser's time zone. */
function formatDateTime(value: string): string {
  const moment = new Date(value);
  if (Number.isNaN(moment.getTime())) return value;
  const date = `${two(moment.getDate())}/${two(moment.getMonth() + 1)}/${moment.getFullYear()}`;
  return `${date} ${two(moment.getHours())}:${two(moment.getMinutes())}:${two(moment.getSeconds())}`;
}

/** A value of the preview on screen. `type` is the variable's type, when known (from the symbols of the analysis). */
export function formatValue(value: Value | undefined, type: DataType | null | undefined): string {
  if (value === null || value === undefined) return NO_VALUE;
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
      return value === '' ? NO_VALUE : value;
  }
}

/** A count in the Brazilian pattern (`1.480`). */
export function formatCount(count: number): string {
  return count.toLocaleString('pt-BR');
}

/** The key of a record, as `nf_id 10 · item_seq 1` (the variables of the key in their order). */
export function recordKeyText(key: RecordKey): string {
  return Object.entries(key)
    .map(([name, value]) => `${name} ${value}`)
    .join(' · ');
}

/** The type of each linear variable of the workflow, by name, from the symbols of the analysis. */
export function variableTypes(symbols: readonly DraftSymbol[]): Map<string, DataType | null> {
  const types = new Map<string, DataType | null>();
  for (const symbol of symbols) if (symbol.cardinality === 'linear' && !types.has(symbol.name)) types.set(symbol.name, symbol.type);
  return types;
}

/** The type of each output field of the workflow (the Output of the root group), by the field name. */
export function outputFieldTypes(definition: WorkflowDefinition, types: ReadonlyMap<string, DataType | null>): Map<string, DataType | null> {
  return new Map(definition.root.output.fields.map((field) => [field.name, types.get(field.variable) ?? null]));
}

/** Every node of the definition, the ones inside groups too, by id. */
export function nodesById(definition: WorkflowDefinition): Map<string, DefinitionNode> {
  const nodes = new Map<string, DefinitionNode>();
  const visit = (list: readonly DefinitionNode[]) => {
    for (const node of list) {
      nodes.set(node.id, node);
      if (node.type === 'group') visit(node.nodes);
    }
  };
  visit(definition.root.nodes);
  return nodes;
}

/** The names of the columns of some rows, in the order they first appear. */
export function columnsOf(rows: readonly Readonly<Record<string, unknown>>[]): string[] {
  const columns = new Set<string>();
  for (const row of rows) for (const name of Object.keys(row)) columns.add(name);
  return [...columns];
}
