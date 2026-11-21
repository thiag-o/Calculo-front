// What the canvas draws, derived from the draft: the blocks with their ports, the groups with their Input and Output bars,
// the inputs and output bars of the workflow, and the links. The links never come from the formulas: what a node reads
// comes from the `dependencies` of the analysis, who produces each name comes from the `symbols` (E4-9, D15), and the
// Input of a group comes from the `groups` of the analysis (E5-5). Pure functions, tested without React Flow.
import type { Dependency, DraftSymbol, GroupInterface, WorkflowDefinition } from '../draft';
import {
  BLOCK_WIDTH,
  findEntry,
  groupSizes,
  isGroup,
  producedNames as nodeProducedNames,
  treeEntries,
  type DefinitionNode,
  type GroupNode,
} from '../groups';

export { BLOCK_WIDTH };

/** The blocks the canvas draws as a box with ports: Calculation, Decision Table and Fonte. */
export type Block = Extract<DefinitionNode, { type: 'calculation' | 'decision_table' | 'source' }>;

/** Whether a definition node is a block (not a group). */
export function isBlock(node: DefinitionNode): node is Block {
  return node.type === 'calculation' || node.type === 'decision_table' || node.type === 'source';
}
export type BlockKind = Block['type'];
/** The blocks the toolbar includes. A Fonte needs a dataset, chosen in its properties. */
export type NewBlockKind = Exclude<BlockKind, 'source'>;
type DeclaredInput = WorkflowDefinition['root']['inputs'][number];
type DataType = NonNullable<DraftSymbol['type']>;

/** React Flow id of the inputs bar. Block ids are `^[a-z][a-z0-9_]*$`, so `@` never clashes with one. */
export const INPUTS_ID = '@inputs';
/** React Flow id of the output bar. */
export const OUTPUT_ID = '@output';

/** Width of the inputs and output bars. */
export const BAR_WIDTH = 200;
/** Space between a bar and the nearest block. */
const BAR_GAP = 80;

/** One port: a name the block reads (left) or produces (right), with its type as in the ports (`decimal(2)`). */
export interface Port {
  /** The React Flow handle id, unique in its node. */
  handle: string;
  /** The text of the port: the variable name, with `[]` for a list and a list field (as in the formula). */
  label: string;
  /** `decimal(2)`, `text`, `lista`; `null` when the analysis does not know the name's type. */
  type: string | null;
}

/** A port of a group bar: the handle outside the group and the one inside it, for the same name. */
export interface GroupPort extends Port {
  /** The handle on the inner side of the bar (the Input hands the name on; the Output takes it). */
  inner: string;
}

export interface BlockView {
  block: Block;
  /** The group it is directly inside; `null` in the root group. */
  parent: string | null;
  /** Inside a collapsed group (at any depth): not drawn. */
  hidden: boolean;
  /** What the block reads, from its `dependencies` entry (empty until the analysis sees a new block). */
  reads: Port[];
  /** What the block produces: the output of a Calculation, the result columns of a Decision Table, a Fonte's outputs. */
  outputs: Port[];
}

export interface GroupView {
  group: GroupNode;
  parent: string | null;
  hidden: boolean;
  /** The derived Input, from the `groups` of the analysis (empty until the analysis sees a new group). */
  inputs: GroupPort[];
  /** The Output, as saved in the group. */
  outputs: GroupPort[];
  /** The blocks inside it, at any depth (the count in the header). */
  blockCount: number;
}

/** A row of the inputs bar: a linear input, a multiple input (the list) or one field of it. */
export interface InputRow extends Port {
  kind: 'linear' | 'multiple' | 'field';
}

/** A row of the output bar: an output field and the type of the variable it shows. */
export type OutputRow = Port;

export interface Link {
  id: string;
  source: string;
  sourceHandle: string;
  target: string;
  targetHandle: string;
  /** The variable the link carries. */
  name: string;
}

export interface CanvasGraph {
  /** The blocks at any depth, in the order of the tree (a group's blocks right after it). */
  blocks: BlockView[];
  /** The groups at any depth, in the order of the tree. */
  groups: GroupView[];
  /** Every node id in the order of the tree: what the canvas draws, a group before the nodes inside it. */
  order: string[];
  inputs: InputRow[];
  output: OutputRow[];
  links: Link[];
  /** Where the bars stand: left of the leftmost node and right of the rightmost one, at the height of the top one. */
  inputsPosition: { x: number; y: number };
  outputPosition: { x: number; y: number };
}

/** The type as shown in a port: `decimal(2)` (with the scale), `text`, `integer`. */
export function typeCode(type: DataType, scale?: number | null): string {
  return type === 'decimal' && typeof scale === 'number' ? `decimal(${scale})` : type;
}

/** The type of a list (a multiple input) in a port: it has no data type of its own. */
export const LIST_TYPE = 'lista';

function inputHandle(name: string): string {
  return `var:${name}`;
}

function fieldHandle(list: string, field: string): string {
  return `var:${list}[].${field}`;
}

function readHandle(name: string): string {
  return `in:${name}`;
}

function outputHandle(name: string): string {
  return `out:${name}`;
}

/** Inside a group, the Input bar hands each name on to the nodes that read it. */
function innerInputHandle(name: string): string {
  return `inner-in:${name}`;
}

/** Inside a group, the Output bar takes each name from the node that produces it. */
function innerOutputHandle(name: string): string {
  return `inner-out:${name}`;
}

function outputFieldHandle(index: number): string {
  return `field:${index}`;
}

/** The names a block produces in the current definition. */
export function producedNames(block: Block): string[] {
  return nodeProducedNames(block);
}

function blockOutputs(block: Block, byName: ReadonlyMap<string, DraftSymbol>): Port[] {
  if (block.type === 'calculation') {
    return [{ handle: outputHandle(block.output.name), label: block.output.name, type: typeCode(block.output.type, block.output.scale) }];
  }
  if (block.type === 'decision_table') {
    return block.results.map((result) => ({ handle: outputHandle(result.name), label: result.name, type: typeCode(result.type, result.scale) }));
  }
  // A Fonte's output has the type of its catalog variable, which only the analysis knows.
  return (block.outputs ?? []).map((output) => namePort(output.name, byName.get(output.name), outputHandle(output.name)));
}

function inputRows(inputs: readonly DeclaredInput[]): InputRow[] {
  const rows: InputRow[] = [];
  for (const input of inputs) {
    if (input.cardinality === 'linear') {
      rows.push({ kind: 'linear', handle: inputHandle(input.name), label: input.name, type: typeCode(input.type, input.scale) });
      continue;
    }
    rows.push({ kind: 'multiple', handle: inputHandle(input.name), label: `${input.name}[]`, type: LIST_TYPE });
    for (const field of input.fields) {
      rows.push({ kind: 'field', handle: fieldHandle(input.name, field.name), label: `${field.name}[]`, type: typeCode(field.type, field.scale) });
    }
  }
  return rows;
}

/** The first symbol of each name (a repeated name is already a problem; the first one wins, as in the analysis). */
function symbolsByName(symbols: readonly DraftSymbol[]): Map<string, DraftSymbol> {
  const byName = new Map<string, DraftSymbol>();
  for (const symbol of symbols) if (!byName.has(symbol.name)) byName.set(symbol.name, symbol);
  return byName;
}

/** A name as a port shows it: `[]` on a list and on a list field, and the type the analysis gives it. */
function namePort(name: string, symbol: DraftSymbol | undefined, handle = readHandle(name)): Port {
  if (!symbol) return { handle, label: name, type: null };
  if (symbol.cardinality === 'multiple' && symbol.list === null) return { handle, label: `${name}[]`, type: LIST_TYPE };
  const type = symbol.type === null ? null : typeCode(symbol.type, symbol.scale);
  return { handle, label: symbol.list === null ? name : `${name}[]`, type };
}

function groupPort(name: string, symbol: DraftSymbol | undefined, side: 'input' | 'output'): GroupPort {
  const outer = side === 'input' ? readHandle(name) : outputHandle(name);
  return { ...namePort(name, symbol, outer), inner: side === 'input' ? innerInputHandle(name) : innerOutputHandle(name) };
}

function samePort(a: Port, b: Port): boolean {
  return a.handle === b.handle && a.label === b.label && a.type === b.type;
}

function sameGroupPort(a: GroupPort, b: GroupPort): boolean {
  return samePort(a, b) && a.inner === b.inner;
}

function sameInputRow(a: InputRow, b: InputRow): boolean {
  return a.kind === b.kind && samePort(a, b);
}

function sameLink(a: Link, b: Link): boolean {
  return a.id === b.id && a.name === b.name;
}

/** `previous` when it holds the same items as `next` (by `same`), so an unchanged list keeps its identity. */
function keepList<T>(previous: readonly T[] | undefined, next: T[], same: (a: T, b: T) => boolean): T[] {
  if (!previous || previous.length !== next.length) return next;
  return next.every((item, index) => same(previous[index]!, item)) ? (previous as T[]) : next;
}

function keepPoint(previous: { x: number; y: number } | undefined, next: { x: number; y: number }): { x: number; y: number } {
  return previous && previous.x === next.x && previous.y === next.y ? previous : next;
}

/** Where the workflow bars stand, from the nodes of the root group (a group by its whole width). */
function barPositions(
  nodes: readonly DefinitionNode[],
  widthOf: (node: DefinitionNode) => number,
): Pick<CanvasGraph, 'inputsPosition' | 'outputPosition'> {
  if (nodes.length === 0) return { inputsPosition: { x: 0, y: 0 }, outputPosition: { x: BAR_WIDTH + 2 * BAR_GAP + BLOCK_WIDTH, y: 0 } };
  const top = Math.min(...nodes.map((node) => node.position.y));
  return {
    inputsPosition: { x: Math.min(...nodes.map((node) => node.position.x)) - BAR_GAP - BAR_WIDTH, y: top },
    outputPosition: { x: Math.max(...nodes.map((node) => node.position.x + widthOf(node))) + BAR_GAP, y: top },
  };
}

/** Whether `id` is inside the group `groupId`, at any depth. */
function isInside(id: string, groupId: string, parentOf: ReadonlyMap<string, string | null>): boolean {
  let current = parentOf.get(id) ?? null;
  while (current !== null) {
    if (current === groupId) return true;
    current = parentOf.get(current) ?? null;
  }
  return false;
}

/**
 * The canvas of a definition: the blocks and groups in the order of the tree, the bars and the links.
 *
 * - A block's left ports are the `reads` of its `dependencies` entry; its right ports are its outputs.
 * - A group has two bars: the Input (derived: the `inputs` of its entry in `interfaces`, the `groups` of the analysis)
 *   and the Output (its `outputs`). Each name has a port outside the group and one inside it.
 * - Links go one level at a time, through the bars: in each group (and in the root), a node that reads a name gets it
 *   from the node of the same group that produces it, from the group inside it that gives it out, or, when it comes
 *   from outside, from the group's Input bar (the workflow Entradas, in the root). The Output bar of a group gets each
 *   name it gives out the same way, from inside.
 * - Inside a collapsed group nothing is drawn: only its bars, with the links that come in and go out.
 * - `symbols`, `dependencies` and `interfaces` refer to the analyzed definition: a link whose ends are no longer in the
 *   current one (a block removed, an output renamed) is left out until the next analysis.
 * - With the `previous` graph, everything that shows the same keeps the same object (a view, its ports, the rows of the
 *   bars, a link, and each list when nothing in it changed). Moving one block then gives a new view only for it, and
 *   the canvas draws again only that block (ADR 0044).
 */
export function canvasGraph(
  definition: WorkflowDefinition,
  symbols: readonly DraftSymbol[],
  dependencies: readonly Dependency[],
  previous?: CanvasGraph | null,
  interfaces: readonly GroupInterface[] = [],
): CanvasGraph {
  const entries = treeEntries(definition);
  const byName = symbolsByName(symbols);
  const readsByNode = new Map<string, readonly string[]>();
  for (const dependency of dependencies) if (!readsByNode.has(dependency.node_id)) readsByNode.set(dependency.node_id, dependency.reads);
  const inputsByGroup = new Map<string, readonly string[]>();
  for (const entry of interfaces) if (!inputsByGroup.has(entry.node_id)) inputsByGroup.set(entry.node_id, entry.inputs);

  const parentOf = new Map<string, string | null>();
  const nodeById = new Map<string, DefinitionNode>();
  for (const entry of entries) {
    parentOf.set(entry.node.id, entry.parent);
    nodeById.set(entry.node.id, entry.node);
  }
  // Inside a collapsed group, at any depth (the parents come before the nodes inside them).
  const hiddenIds = new Set<string>();
  for (const entry of entries) {
    const parent = entry.parent === null ? undefined : nodeById.get(entry.parent);
    if (parent && isGroup(parent) && (parent.collapsed || hiddenIds.has(parent.id))) hiddenIds.add(entry.node.id);
  }

  const previousBlocks = new Map<string, BlockView>();
  for (const view of previous?.blocks ?? []) previousBlocks.set(view.block.id, view);
  const previousGroups = new Map<string, GroupView>();
  for (const view of previous?.groups ?? []) previousGroups.set(view.group.id, view);

  const blockViews: BlockView[] = [];
  const groupViews: GroupView[] = [];
  for (const { node, parent } of entries) {
    const hidden = hiddenIds.has(node.id);
    if (isGroup(node)) {
      const before = previousGroups.get(node.id);
      const inputs = keepList(
        before?.inputs,
        (inputsByGroup.get(node.id) ?? []).map((name) => groupPort(name, byName.get(name), 'input')),
        sameGroupPort,
      );
      const outputs = keepList(before?.outputs, node.outputs.map((name) => groupPort(name, byName.get(name), 'output')), sameGroupPort);
      const blockCount = entries.filter((inner) => isBlock(inner.node) && isInside(inner.node.id, node.id, parentOf)).length;
      const same =
        before &&
        before.group === node &&
        before.parent === parent &&
        before.hidden === hidden &&
        before.inputs === inputs &&
        before.outputs === outputs &&
        before.blockCount === blockCount;
      groupViews.push(same ? before : { group: node, parent, hidden, inputs, outputs, blockCount });
    } else if (isBlock(node)) {
      const before = previousBlocks.get(node.id);
      const reads = keepList(before?.reads, (readsByNode.get(node.id) ?? []).map((name) => namePort(name, byName.get(name))), samePort);
      const outputs = keepList(before?.outputs, blockOutputs(node, byName), samePort);
      const same = before && before.block === node && before.parent === parent && before.hidden === hidden && before.reads === reads;
      blockViews.push(same && before.outputs === outputs ? before : { block: node, parent, hidden, reads, outputs });
    }
  }
  const views = keepList(previous?.blocks, blockViews, Object.is);
  const groups = keepList(previous?.groups, groupViews, Object.is);
  const order = keepList(
    previous?.order,
    entries.map((entry) => entry.node.id),
    Object.is,
  );
  const inputs = keepList(previous?.inputs, inputRows(definition.root.inputs), sameInputRow);
  const output = keepList(
    previous?.output,
    definition.root.output.fields.map((field, index) => {
      const symbol = byName.get(field.variable);
      return { handle: outputFieldHandle(index), label: field.name, type: symbol?.type ? typeCode(symbol.type, symbol.scale) : null };
    }),
    samePort,
  );

  // The handles that hand a name on now: a link only starts at one of them. Inside a collapsed group, its Input bar
  // hands nothing on.
  const sources = new Set<string>(inputs.map((row) => `${INPUTS_ID}|${row.handle}`));
  for (const view of views) for (const port of view.outputs) sources.add(`${view.block.id}|${port.handle}`);
  const collapsedGroups = new Set<string>();
  for (const view of groups) {
    for (const port of view.outputs) sources.add(`${view.group.id}|${port.handle}`);
    if (view.group.collapsed) collapsedGroups.add(view.group.id);
    else for (const port of view.inputs) sources.add(`${view.group.id}|${port.inner}`);
  }

  /** Who hands `name` on inside `scope` (a group id, or `null` for the root). */
  const producerIn = (scope: string | null, name: string): { node: string; handle: string } | null => {
    const symbol = byName.get(name);
    if (!symbol) return null;
    const fromOutside = () => (scope === null ? null : { node: scope, handle: innerInputHandle(name) });
    if (symbol.node_id === null) {
      // An input, a list field or a field of the batch source: from the workflow Entradas, through each Input bar.
      if (scope !== null) return fromOutside();
      if (symbol.origin === 'input' && symbol.list !== null) return { node: INPUTS_ID, handle: fieldHandle(symbol.list, symbol.name) };
      return { node: INPUTS_ID, handle: inputHandle(symbol.name) };
    }
    // The node of the scope that holds the producer: the producer itself, or the group of the scope it is inside.
    let holder: string | null = symbol.node_id;
    while (holder !== null && parentOf.has(holder) && parentOf.get(holder) !== scope) holder = parentOf.get(holder) ?? null;
    if (holder === null || !parentOf.has(holder)) return fromOutside();
    return { node: holder, handle: outputHandle(name) };
  };

  const previousLinks = new Map<string, Link>();
  for (const link of previous?.links ?? []) previousLinks.set(link.id, link);
  const found: Link[] = [];
  const seen = new Set<string>();
  const link = (scope: string | null, name: string, target: string, targetHandle: string) => {
    const producer = producerIn(scope, name);
    if (!producer || !sources.has(`${producer.node}|${producer.handle}`)) return;
    // A node never links to itself (and a group's Output only takes what is produced inside it).
    if (producer.node === target) return;
    if (hiddenIds.has(producer.node) || hiddenIds.has(target)) return;
    const id = `${producer.node}|${producer.handle}->${target}|${targetHandle}`;
    if (seen.has(id)) return;
    seen.add(id);
    const next: Link = { id, source: producer.node, sourceHandle: producer.handle, target, targetHandle, name };
    const before = previousLinks.get(id);
    found.push(before && sameLink(before, next) ? before : next);
  };
  for (const id of order) {
    const node = nodeById.get(id)!;
    const scope = parentOf.get(id) ?? null;
    if (isGroup(node)) {
      for (const name of inputsByGroup.get(id) ?? []) link(scope, name, id, readHandle(name));
      if (!collapsedGroups.has(id)) for (const name of node.outputs) link(id, name, id, innerOutputHandle(name));
    } else {
      for (const name of readsByNode.get(id) ?? []) link(scope, name, id, readHandle(name));
    }
  }
  definition.root.output.fields.forEach((field, index) => link(null, field.variable, OUTPUT_ID, outputFieldHandle(index)));
  const links = keepList(previous?.links, found, Object.is);

  const sizes = groupSizes(definition.root.nodes, (group) => ({ inputs: inputsByGroup.get(group.id)?.length ?? 0, outputs: group.outputs.length }));
  const bars = barPositions(definition.root.nodes, (node) => sizes.get(node.id)?.width ?? BLOCK_WIDTH);
  return {
    blocks: views,
    groups,
    order,
    inputs,
    output,
    links,
    inputsPosition: keepPoint(previous?.inputsPosition, bars.inputsPosition),
    outputPosition: keepPoint(previous?.outputPosition, bars.outputPosition),
  };
}

/**
 * How many other nodes read what the node produces (the count of the Delete confirmation), by the `dependencies`. The
 * names produced are those of the current definition (a group's Output) and, while an analysis is on the way, those the
 * `symbols` still give to the node. The nodes inside a group being removed go with it and do not count.
 */
export function readersOf(
  blockId: string,
  definition: WorkflowDefinition,
  symbols: readonly DraftSymbol[],
  dependencies: readonly Dependency[],
): number {
  const entries = treeEntries(definition);
  const entry = findEntry(definition, blockId);
  const names = new Set<string>(entry ? nodeProducedNames(entry.node) : []);
  for (const symbol of symbols) if (symbol.node_id === blockId) names.add(symbol.name);
  const present = new Set(entries.map((candidate) => candidate.node.id));
  const removed = new Set<string>([blockId]);
  if (entry && isGroup(entry.node)) for (const inner of entries) if (inner.path.startsWith(`${entry.path}.`)) removed.add(inner.node.id);
  const readers = new Set<string>();
  for (const dependency of dependencies) {
    if (removed.has(dependency.node_id) || !present.has(dependency.node_id)) continue;
    if (dependency.reads.some((name) => names.has(name))) readers.add(dependency.node_id);
  }
  return readers.size;
}
