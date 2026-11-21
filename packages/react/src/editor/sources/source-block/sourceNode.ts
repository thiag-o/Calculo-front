// The Source block in the definition (E5-1, E5-18): where it is (also inside groups), how it changes, and the shape the
// contract asks of each mode, so the draft is never saved with a shape error (`422 invalid_data`, ADR 0046):
// - Linear: 0 to 10 links (none is a parameter table), 1 to 10 ordering items, 1 to 100 outputs, `no_match`,
//   `multiple_rows` and `exists: null`;
// - Filtro: 1 to 10 links and `exists` (EXISTE / NÃO EXISTE), without ordering, outputs, `no_match` nor `multiple_rows`.
import type { Schemas } from '../../../api';
import type { DraftSymbol, WorkflowDefinition } from '../../draft';

/** The types of the contract used by the Source block (generated, ADR 0005). */
export type SourceNode = Schemas['SourceNode'];
export type LinearSourceNode = Schemas['LinearSourceNode'];
export type FilterSourceNode = Schemas['FilterSourceNode'];
export type SourceLink = Schemas['SourceLink'];
export type SourceFilter = Schemas['SourceFilter'];
export type SourceOrder = Schemas['SourceOrder'];
export type SourceOutput = Schemas['SourceOutput'];
export type SourceMode = Schemas['SourceMode'];
export type NoMatchPolicy = Schemas['NoMatchPolicy'];
export type MultipleRowsPolicy = Schemas['MultipleRowsPolicy'];
export type SortDirection = Schemas['SortDirection'];
export type DataType = Schemas['DataType'];
export type Dataset = Schemas['Dataset'];
/** A business variable of the catalog, over a column of the dataset. */
export type CatalogVariable = Schemas['Variable'];

type WorkflowNode = WorkflowDefinition['root']['nodes'][number];

/** Limits of the contract (SourceNode). */
export const LINKS_MAX = 10;
export const ORDER_MAX = 10;
export const OUTPUTS_MAX = 100;
export const NODE_NAME_MAX = 200;
export const DESCRIPTION_MAX = 500;
// The variable name rule (Contratos, "Nomes de variável"; E3-10), one copy: the one of the properties.
export { NAME_PATTERN } from '../../properties';

/** Where a node is: its `path` (`root.nodes[2]`, `root.nodes[1].nodes[0]`) and the groups around it, outermost first. */
export interface NodePlace {
  path: string;
  groups: string[];
}

export function locateNode(definition: WorkflowDefinition, id: string): NodePlace | null {
  function search(nodes: readonly WorkflowNode[], prefix: string, groups: string[]): NodePlace | null {
    for (const [index, node] of nodes.entries()) {
      const path = `${prefix}.nodes[${index}]`;
      if (node.id === id) return { path, groups };
      if (node.type === 'group') {
        const found = search(node.nodes, path, [...groups, node.id]);
        if (found) return found;
      }
    }
    return null;
  }
  return search(definition.root.nodes, 'root', []);
}

/** The Source block `id`, wherever it is (also inside groups), or `null`. */
export function findSourceNode(definition: WorkflowDefinition, id: string): SourceNode | null {
  function search(nodes: readonly WorkflowNode[]): SourceNode | null {
    for (const node of nodes) {
      if (node.id === id) return node.type === 'source' ? node : null;
      if (node.type === 'group') {
        const found = search(node.nodes);
        if (found) return found;
      }
    }
    return null;
  }
  return search(definition.root.nodes);
}

/** The definition with the Source block `id` changed (the same definition when it is gone or did not change). */
export function updateSourceNode(definition: WorkflowDefinition, id: string, update: (node: SourceNode) => SourceNode): WorkflowDefinition {
  function inside(nodes: readonly WorkflowNode[]): readonly WorkflowNode[] {
    let changed = false;
    const next = nodes.map((node) => {
      if (node.id === id && node.type === 'source') {
        const updated = update(node);
        if (updated !== node) changed = true;
        return updated;
      }
      if (node.type === 'group') {
        const children = inside(node.nodes);
        if (children !== node.nodes) {
          changed = true;
          return { ...node, nodes: [...children] };
        }
      }
      return node;
    });
    return changed ? next : nodes;
  }
  const nodes = inside(definition.root.nodes);
  return nodes === definition.root.nodes ? definition : { ...definition, root: { ...definition.root, nodes: [...nodes] } };
}

/** The outputs a Linear gets by default: the dataset variables (up to 100), each with its name in the catalog. */
export function defaultOutputs(variables: readonly CatalogVariable[]): SourceOutput[] {
  return variables.slice(0, OUTPUTS_MAX).map((variable) => ({ variable_id: variable.id, name: variable.name }));
}

/** The ordering a Linear gets by default: the first variable of the dataset, ascending. */
export function defaultOrder(variables: readonly CatalogVariable[]): SourceOrder[] {
  const first = variables[0];
  return first ? [{ variable_id: first.id, direction: 'asc' }] : [];
}

/**
 * The block in the Filtro mode: it keeps the dataset, the links and the filters, checks EXISTE and drops what only the
 * Linear has. The caller makes sure there is a link (the Filtro needs one).
 */
export function toFilterMode(node: SourceNode): FilterSourceNode {
  // Built field by field: the Filtro type has no `order_by`, `outputs`, `no_match` nor `multiple_rows`, and the engine
  // refuses them (`422 invalid_data`), so none of them can come along in a spread.
  return {
    id: node.id,
    type: 'source',
    name: node.name,
    description: node.description,
    position: node.position,
    mode: 'filter',
    dataset_id: node.dataset_id,
    links: node.links,
    filters: node.filters,
    exists: true,
  };
}

/** The block as a Linear, or `null` when it is a Filtro (or there is no block). */
export function asLinear(node: SourceNode | null): LinearSourceNode | null {
  return node?.mode === 'linear' ? node : null;
}

/**
 * The block in the Linear mode: it keeps the dataset, the links and the filters, and gets the ordering and the outputs by
 * default (`defaultOrder`, `defaultOutputs`), "Gerar erro" in both policies and no `exists`. `null` when the dataset has
 * no variables (a Linear needs an output).
 */
export function toLinearMode(node: SourceNode, variables: readonly CatalogVariable[]): LinearSourceNode | null {
  if (variables.length === 0) return null;
  return {
    id: node.id,
    type: 'source',
    name: node.name,
    description: node.description,
    position: node.position,
    mode: 'linear',
    dataset_id: node.dataset_id,
    links: node.links,
    filters: node.filters,
    exists: null,
    no_match: 'error',
    multiple_rows: 'error',
    order_by: defaultOrder(variables),
    outputs: defaultOutputs(variables),
  };
}

/** What changing the dataset does to the block. */
export interface DatasetChange {
  /** The block over the new dataset, or `null` when it cannot be a Linear there (the new dataset has no variables). */
  node: SourceNode | null;
  /** Filters, ordering items and outputs whose variable has no namesake of the same type in the new dataset: they leave. */
  dropped: { filters: number; order: number; outputs: number };
  /** Links whose dataset variable has no namesake in the new dataset: they stay, pointing to it, and show a problem. */
  unlinked: number;
}

/**
 * The block over another dataset. Each variable it uses becomes the variable of the same name, type and places in the new
 * dataset; what has no such namesake leaves the block, except the links, which stay (the Filtro needs them, and the analysis points them out).
 * A Linear left without ordering or outputs gets the defaults of the new dataset.
 */
export function withDataset(
  node: SourceNode,
  datasetId: string,
  before: readonly CatalogVariable[],
  after: readonly CatalogVariable[],
): DatasetChange {
  const previous = new Map(before.map((variable) => [variable.id, variable]));
  const byName = new Map(after.map((variable) => [variable.name, variable]));
  // The namesake only counts with the same type and places (D22): another type would change what the block reads.
  const remap = (id: string) => {
    const old = previous.get(id);
    const namesake = old === undefined ? undefined : byName.get(old.name);
    if (!old || !namesake || namesake.type !== old.type || (namesake.scale ?? null) !== (old.scale ?? null)) return undefined;
    return namesake.id;
  };
  let unlinked = 0;
  const links = node.links.map((link) => {
    const id = remap(link.column_variable_id);
    if (id === undefined) {
      unlinked += 1;
      return link;
    }
    return { ...link, column_variable_id: id };
  });
  const dropped = { filters: 0, order: 0, outputs: 0 };
  const filters = node.filters.flatMap((filter) => {
    const id = remap(filter.variable_id);
    if (id === undefined) {
      dropped.filters += 1;
      return [];
    }
    return [{ ...filter, variable_id: id }];
  });
  if (node.mode !== 'linear') return { node: { ...node, dataset_id: datasetId, links, filters }, dropped, unlinked };

  const order = node.order_by.flatMap((item) => {
    const id = remap(item.variable_id);
    if (id === undefined) {
      dropped.order += 1;
      return [];
    }
    return [{ ...item, variable_id: id }];
  });
  const outputs = node.outputs.flatMap((output) => {
    const id = remap(output.variable_id);
    if (id === undefined) {
      dropped.outputs += 1;
      return [];
    }
    return [{ ...output, variable_id: id }];
  });
  if (after.length === 0) return { node: null, dropped, unlinked };
  return {
    node: {
      ...node,
      dataset_id: datasetId,
      links,
      filters,
      order_by: order.length > 0 ? order : defaultOrder(after),
      outputs: outputs.length > 0 ? outputs : defaultOutputs(after),
    },
    dropped,
    unlinked,
  };
}

/** `integer` and `decimal` link by value (Contratos, "Ligação"); any other pair must be the same type. */
export function linkableTypes(a: DataType, b: DataType): boolean {
  const numeric = (type: DataType) => type === 'integer' || type === 'decimal';
  return a === b || (numeric(a) && numeric(b));
}

/** Origins of a variable that is read (E5-4): a link never uses a calculated one (`link_to_calculated`). */
const READ_ORIGINS: ReadonlySet<DraftSymbol['origin']> = new Set(['input', 'batch_source', 'source']);

/**
 * The variables a link of the block can use: linear, read (an input, the batch source or another Source block, never a
 * calculated one) and visible where the block is (produced in the root or in one of the groups around it).
 */
export function linkCandidates(symbols: readonly DraftSymbol[], nodeId: string, groups: readonly string[]): DraftSymbol[] {
  const around = new Set(groups);
  return symbols.filter(
    (symbol) =>
      symbol.cardinality === 'linear' &&
      symbol.type !== null &&
      READ_ORIGINS.has(symbol.origin) &&
      symbol.node_id !== nodeId &&
      (symbol.group_id === null || around.has(symbol.group_id)),
  );
}

/**
 * How many times each variable name is used in the workflow (E4-10): inputs and their fields, the batch source, the
 * outputs of Calculations, Decision Tables and Source blocks, also inside groups. More than once is a duplicate.
 */
export function variableNameCounts(definition: WorkflowDefinition): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);
  for (const input of definition.root.inputs) {
    add(input.name);
    if (input.cardinality === 'multiple') for (const field of input.fields) add(field.name);
  }
  for (const output of definition.root.batch_source?.outputs ?? []) add(output.name);
  function visit(nodes: readonly WorkflowNode[]) {
    for (const node of nodes) {
      if (node.type === 'calculation') add(node.output.name);
      else if (node.type === 'decision_table') for (const result of node.results) add(result.name);
      else if (node.type === 'source') for (const output of node.mode === 'linear' ? node.outputs : []) add(output.name);
      else visit(node.nodes);
    }
  }
  visit(definition.root.nodes);
  return counts;
}
