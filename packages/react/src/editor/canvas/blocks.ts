// The canvas edits of the definition: include, move and remove a block. Pure functions that keep the same objects for
// everything that did not change (ADR 0044): the problem marks of the other blocks stay on them while the analysis of
// the edit is on the way.
import type { WorkflowDefinition } from '../draft';
import { BLOCK_WIDTH, type Block, type BlockKind } from './graph';

export interface Position {
  x: number;
  y: number;
}

/** The id prefix and the name of a new block of each kind (`calc_1` "Cálculo 1", `td_1` "Tabela de Decisão 1"). */
const NEW_BLOCK: Readonly<Record<BlockKind, { prefix: string; name: string }>> = {
  calculation: { prefix: 'calc', name: 'Cálculo' },
  decision_table: { prefix: 'td', name: 'Tabela de Decisão' },
};

/** Grid of the canvas dots (estilos §8): new blocks snap to it. */
export const GRID = 16;
/** A new block over another one goes this far down and right, until it lands on a free place. */
const CASCADE = 24;
/** Approximate height of a new block, to center it on the visible area. */
const NEW_BLOCK_HEIGHT = 80;

/** Every variable name the definition already declares: inputs, list fields, block outputs and result columns (E4-10). */
function usedNames(definition: WorkflowDefinition): Set<string> {
  const names = new Set<string>();
  for (const input of definition.root.inputs) {
    names.add(input.name);
    if (input.cardinality === 'multiple') for (const field of input.fields) names.add(field.name);
  }
  for (const node of definition.root.nodes) {
    if (node.type === 'calculation') names.add(node.output.name);
    else for (const result of node.results) names.add(result.name);
  }
  return names;
}

function firstFree(prefix: string, used: ReadonlySet<string>): { name: string; number: number } {
  for (let number = 1; ; number++) {
    const name = `${prefix}_${number}`;
    if (!used.has(name)) return { name, number };
  }
}

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
 * A new block at `position`, with a free id (`calc_1`, `td_1`…) and a free output name (`resultado_1`…). A Calculation
 * starts with an empty formula and a `decimal` output with the workflow's scale; a Decision Table starts with one result
 * column of that type and no condition nor rule (the grid includes them).
 */
export function newBlock(definition: WorkflowDefinition, kind: BlockKind, position: Position): Block {
  const id = firstFree(NEW_BLOCK[kind].prefix, new Set(definition.root.nodes.map((node) => node.id)));
  const output = firstFree('resultado', usedNames(definition)).name;
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

/** The definition with the block at the end of `root.nodes`. */
export function addBlock(definition: WorkflowDefinition, block: Block): WorkflowDefinition {
  return { ...definition, root: { ...definition.root, nodes: [...definition.root.nodes, block] } };
}

/** The definition with the blocks of `positions` moved (by id); the same definition when nothing moved. */
export function moveBlocks(definition: WorkflowDefinition, positions: ReadonlyMap<string, Position>): WorkflowDefinition {
  let moved = false;
  const nodes = definition.root.nodes.map((node) => {
    const position = positions.get(node.id);
    if (!position || (position.x === node.position.x && position.y === node.position.y)) return node;
    moved = true;
    return { ...node, position: { x: position.x, y: position.y } };
  });
  return moved ? { ...definition, root: { ...definition.root, nodes } } : definition;
}

/** The definition without the block; the same definition when it is not there. */
export function removeBlock(definition: WorkflowDefinition, id: string): WorkflowDefinition {
  if (!definition.root.nodes.some((node) => node.id === id)) return definition;
  return { ...definition, root: { ...definition.root, nodes: definition.root.nodes.filter((node) => node.id !== id) } };
}
