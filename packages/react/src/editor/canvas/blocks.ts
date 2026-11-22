// The canvas edits of the definition: include, move and remove a block (at any depth of the groups). Pure functions that
// keep the same objects for everything that did not change (ADR 0044): the problem marks of the other blocks stay on
// them while the analysis of the edit is on the way.
import type { WorkflowDefinition } from '../draft';
import { clampInside, declaredNames, findEntry, firstFree, freeNodeId, removeNode, treeEntries, updateNodes } from '../groups';
import { defaultOutputs, toLinearMode } from '../sources';
import { BLOCK_WIDTH, type Block, type NewBlockKind } from './graph';

export interface Position {
  x: number;
  y: number;
}

/** The id prefix and the name of a new block of each kind (`calc_1` "Cálculo 1", `td_1` "Tabela de Decisão 1"). */
const NEW_BLOCK: Readonly<Record<NewBlockKind, { prefix: string; name: string }>> = {
  calculation: { prefix: 'calc', name: 'Cálculo' },
  decision_table: { prefix: 'td', name: 'Tabela de Decisão' },
};

/** Grid of the canvas dots (estilos §8): new blocks snap to it. */
export const GRID = 16;
/** A new block over another one goes this far down and right, until it lands on a free place. */
const CASCADE = 24;
/** Approximate height of a new block, to center it on the visible area. */
const NEW_BLOCK_HEIGHT = 80;

/** Where a new block goes: centered on `center`, on the grid, and moved aside while it would cover another block. */
export function freePosition(definition: WorkflowDefinition, center: Position): Position {
  const snap = (value: number) => Math.round(value / GRID) * GRID;
  let position = { x: snap(center.x - BLOCK_WIDTH / 2), y: snap(center.y - NEW_BLOCK_HEIGHT / 2) };
  const taken = (candidate: Position) =>
    definition.root.nodes.some((node) => Math.abs(node.position.x - candidate.x) < CASCADE && Math.abs(node.position.y - candidate.y) < CASCADE);
  while (taken(position)) position = { x: position.x + CASCADE, y: position.y + CASCADE };
  return position;
}

/**
 * A new block at `position`, with an id (`calc_1`, `td_1`…) and an output name (`resultado_1`…) free among every node and
 * variable of the workflow, inside the groups too (the editor's one rule of free names). A Calculation
 * starts with an empty formula and a `decimal` output with the workflow's scale; a Decision Table starts with one result
 * column of that type and no condition nor rule (the grid includes them).
 */
export function newBlock(definition: WorkflowDefinition, kind: NewBlockKind, position: Position): Block {
  const id = freeNodeId(definition, NEW_BLOCK[kind].prefix);
  const output = firstFree('resultado', declaredNames(definition)).name;
  const scale = definition.settings.rounding.scale;
  const common = {
    id: id.name,
    name: `${NEW_BLOCK[kind].name} ${id.number}`,
    description: null,
    position: { x: position.x, y: position.y },
    rounding_mode: null,
    error_policy: null,
  };
  if (kind === 'calculation') {
    return { ...common, type: 'calculation', expression: '', output: { name: output, type: 'decimal', scale }, default_value: null };
  }
  return {
    ...common,
    type: 'decision_table',
    hit_policy: 'first',
    conditions: [],
    results: [{ name: output, type: 'decimal', scale, default_value: null }],
    rules: [],
  };
}

/**
 * A new Linear Fonte block over a catalog dataset, at `position`: it brings the variables of the dataset (up to 100, each
 * with its catalog name, or a free one when the name is already a variable of the workflow), orders by the first one,
 * has no link (a parameter table) and "Gerar erro" in both policies (the defaults of `sources`). The shape the contract
 * asks (an output and an ordering at least), so the draft is never saved with a shape error (ADR 0046). `null` when the
 * dataset has no variable.
 */
export function newSourceBlock(
  definition: WorkflowDefinition,
  datasetId: string,
  variables: readonly { id: string; name: string }[],
  position: Position,
): Block | null {
  const id = freeNodeId(definition, 'src');
  const linear = toLinearMode(
    {
      id: id.name,
      type: 'source',
      name: `Fonte ${id.number}`,
      description: null,
      position: { x: position.x, y: position.y },
      mode: 'filter',
      dataset_id: datasetId,
      links: [],
      filters: [],
      exists: true,
    },
    variables,
  );
  if (!linear) return null;
  const taken = declaredNames(definition);
  const outputs = defaultOutputs(variables).map((output) => {
    let name = output.name;
    for (let number = 2; taken.has(name); number++) name = `${output.name}_${number}`;
    taken.add(name);
    return { ...output, name };
  });
  return { ...linear, outputs };
}

/** The definition with the block at the end of `root.nodes`. */
export function addBlock(definition: WorkflowDefinition, block: Block): WorkflowDefinition {
  return { ...definition, root: { ...definition.root, nodes: [...definition.root.nodes, block] } };
}

/**
 * The definition with the nodes of `positions` moved (by id, at any depth; a node inside a group never goes above or left
 * of the group's content area); the same definition when nothing moved.
 */
export function moveBlocks(definition: WorkflowDefinition, positions: ReadonlyMap<string, Position>): WorkflowDefinition {
  const parents = new Map(treeEntries(definition).map((entry) => [entry.node.id, entry.parent]));
  return updateNodes(definition, (node) => {
    const wanted = positions.get(node.id);
    if (!wanted) return node;
    const position = parents.get(node.id) ? clampInside(wanted) : wanted;
    if (position.x === node.position.x && position.y === node.position.y) return node;
    return { ...node, position: { x: position.x, y: position.y } };
  });
}

/** The definition without the node (a group goes with everything inside it); the same definition when it is not there. */
export function removeBlock(definition: WorkflowDefinition, id: string): WorkflowDefinition {
  return findEntry(definition, id) ? removeNode(definition, id) : definition;
}
