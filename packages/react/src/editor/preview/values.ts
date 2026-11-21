// Helpers of the "Prévia" tab. The formatting of a value is in `../values` (ADR 0057).
import type { Schemas } from '../../api';
import type { WorkflowDefinition } from '../draft';

type DataType = Schemas['DataType'];
export type Value = Schemas['Value'];
export type RecordKey = Schemas['RecordKey'];
type DefinitionNode = WorkflowDefinition['root']['nodes'][number];

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
