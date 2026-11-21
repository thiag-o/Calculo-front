// What the canvas draws, derived from the draft: the blocks with their ports, the inputs and output bars, and the links.
// The links never come from the formulas: what a block reads comes from the `dependencies` of the analysis, and who
// produces each name comes from the `symbols` (E4-9, D15). Pure functions, tested without React Flow.
import type { Dependency, DraftSymbol, WorkflowDefinition } from '../draft';

type DefinitionNode = WorkflowDefinition['root']['nodes'][number];
/** The blocks the canvas draws today: Calculation and Decision Table. Source and Group blocks come with the epic 5 tasks. */
export type Block = Extract<DefinitionNode, { type: 'calculation' | 'decision_table' }>;

/** Whether a definition node is a block the canvas draws (Calculation or Decision Table). */
export function isBlock(node: DefinitionNode): node is Block {
  return node.type === 'calculation' || node.type === 'decision_table';
}
export type BlockKind = Block['type'];
type DeclaredInput = WorkflowDefinition['root']['inputs'][number];
type DataType = NonNullable<DraftSymbol['type']>;

/** React Flow id of the inputs bar. Block ids are `^[a-z][a-z0-9_]*$`, so `@` never clashes with one. */
export const INPUTS_ID = '@inputs';
/** React Flow id of the output bar. */
export const OUTPUT_ID = '@output';

/** Width the blocks are laid out with (estilos §8: 150 to 200px). */
export const BLOCK_WIDTH = 200;
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

export interface BlockView {
  block: Block;
  /** What the block reads, from its `dependencies` entry (empty until the analysis sees a new block). */
  reads: Port[];
  /** What the block produces: the output of a Calculation, the result columns of a Decision Table. */
  outputs: Port[];
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
  blocks: BlockView[];
  inputs: InputRow[];
  output: OutputRow[];
  links: Link[];
  /** Where the bars stand: left of the leftmost block and right of the rightmost one, at the height of the top one. */
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

function outputFieldHandle(index: number): string {
  return `field:${index}`;
}

/** The names a block produces in the current definition. */
export function producedNames(block: Block): string[] {
  return block.type === 'calculation' ? [block.output.name] : block.results.map((result) => result.name);
}

function blockOutputs(block: Block): Port[] {
  if (block.type === 'calculation') {
    return [{ handle: outputHandle(block.output.name), label: block.output.name, type: typeCode(block.output.type, block.output.scale) }];
  }
  return block.results.map((result) => ({ handle: outputHandle(result.name), label: result.name, type: typeCode(result.type, result.scale) }));
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

/** A name as a port reads it: `[]` on a list and on a list field, and the type the analysis gives it. */
function readPort(name: string, symbol: DraftSymbol | undefined): Port {
  if (!symbol) return { handle: readHandle(name), label: name, type: null };
  if (symbol.cardinality === 'multiple' && symbol.list === null) return { handle: readHandle(name), label: `${name}[]`, type: LIST_TYPE };
  const type = symbol.type === null ? null : typeCode(symbol.type, symbol.scale);
  return { handle: readHandle(name), label: symbol.list === null ? name : `${name}[]`, type };
}

/** The node and handle that produce a name, by its symbol: an input (or a list field) or the output of a block. */
function producerOf(symbol: DraftSymbol): { node: string; handle: string } | null {
  if (symbol.origin === 'input') {
    return { node: INPUTS_ID, handle: symbol.list === null ? inputHandle(symbol.name) : fieldHandle(symbol.list, symbol.name) };
  }
  return symbol.node_id ? { node: symbol.node_id, handle: outputHandle(symbol.name) } : null;
}

function barPositions(blocks: readonly Block[]): Pick<CanvasGraph, 'inputsPosition' | 'outputPosition'> {
  if (blocks.length === 0) return { inputsPosition: { x: 0, y: 0 }, outputPosition: { x: BAR_WIDTH + 2 * BAR_GAP + BLOCK_WIDTH, y: 0 } };
  const xs = blocks.map((block) => block.position.x);
  const top = Math.min(...blocks.map((block) => block.position.y));
  return {
    inputsPosition: { x: Math.min(...xs) - BAR_GAP - BAR_WIDTH, y: top },
    outputPosition: { x: Math.max(...xs) + BLOCK_WIDTH + BAR_GAP, y: top },
  };
}

function samePort(a: Port, b: Port): boolean {
  return a.handle === b.handle && a.label === b.label && a.type === b.type;
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

/**
 * The canvas of a definition: the blocks in the order of `root.nodes`, the bars and the links.
 *
 * - A block's left ports are the `reads` of its `dependencies` entry; its right ports are its outputs.
 * - A link goes from the producer of each name read (found by the `symbols`) to the reader, and from the producer of the
 *   variable of each output field to the output bar.
 * - `symbols` and `dependencies` refer to the analyzed definition: a link whose ends are no longer in the current one
 *   (a block removed, an output renamed) is left out until the next analysis.
 * - With the `previous` graph, everything that shows the same keeps the same object (a block view, its ports, the rows
 *   of the bars, a link, and each list when nothing in it changed). Moving one block then gives a new view only for it,
 *   and the canvas draws again only that block (ADR 0044).
 */
export function canvasGraph(
  definition: WorkflowDefinition,
  symbols: readonly DraftSymbol[],
  dependencies: readonly Dependency[],
  previous?: CanvasGraph | null,
): CanvasGraph {
  const blocks = definition.root.nodes.filter(isBlock);
  const byName = symbolsByName(symbols);
  const readsByNode = new Map<string, readonly string[]>();
  for (const dependency of dependencies) if (!readsByNode.has(dependency.node_id)) readsByNode.set(dependency.node_id, dependency.reads);
  const previousViews = new Map<string, BlockView>();
  for (const view of previous?.blocks ?? []) previousViews.set(view.block.id, view);

  const views = keepList(
    previous?.blocks,
    blocks.map((block) => {
      const before = previousViews.get(block.id);
      const reads = keepList(before?.reads, (readsByNode.get(block.id) ?? []).map((name) => readPort(name, byName.get(name))), samePort);
      const outputs = keepList(before?.outputs, blockOutputs(block), samePort);
      if (before && before.block === block && before.reads === reads && before.outputs === outputs) return before;
      return { block, reads, outputs };
    }),
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

  // The handles that exist on screen now: a link only goes between two of them.
  const sources = new Set<string>(inputs.map((row) => `${INPUTS_ID}|${row.handle}`));
  for (const view of views) for (const port of view.outputs) sources.add(`${view.block.id}|${port.handle}`);

  const previousLinks = new Map<string, Link>();
  for (const link of previous?.links ?? []) previousLinks.set(link.id, link);
  const found: Link[] = [];
  const seen = new Set<string>();
  const link = (name: string, target: string, targetHandle: string) => {
    const symbol = byName.get(name);
    const producer = symbol ? producerOf(symbol) : null;
    if (!producer || producer.node === target || !sources.has(`${producer.node}|${producer.handle}`)) return;
    const id = `${producer.node}|${producer.handle}->${target}|${targetHandle}`;
    if (seen.has(id)) return;
    seen.add(id);
    const next: Link = { id, source: producer.node, sourceHandle: producer.handle, target, targetHandle, name };
    const before = previousLinks.get(id);
    found.push(before && sameLink(before, next) ? before : next);
  };
  for (const view of views) for (const name of readsByNode.get(view.block.id) ?? []) link(name, view.block.id, readHandle(name));
  definition.root.output.fields.forEach((field, index) => link(field.variable, OUTPUT_ID, outputFieldHandle(index)));
  const links = keepList(previous?.links, found, Object.is);

  const bars = barPositions(blocks);
  return {
    blocks: views,
    inputs,
    output,
    links,
    inputsPosition: keepPoint(previous?.inputsPosition, bars.inputsPosition),
    outputPosition: keepPoint(previous?.outputPosition, bars.outputPosition),
  };
}

/**
 * How many other blocks read what the block produces (the count of the Delete confirmation), by the `dependencies`. The
 * names produced are those of the current definition and, while an analysis is on the way, those the `symbols` still
 * give to the block.
 */
export function readersOf(
  blockId: string,
  definition: WorkflowDefinition,
  symbols: readonly DraftSymbol[],
  dependencies: readonly Dependency[],
): number {
  const block = definition.root.nodes.filter(isBlock).find((candidate) => candidate.id === blockId);
  const names = new Set<string>(block ? producedNames(block) : []);
  for (const symbol of symbols) if (symbol.node_id === blockId) names.add(symbol.name);
  const present = new Set(definition.root.nodes.map((candidate) => candidate.id));
  const readers = new Set<string>();
  for (const dependency of dependencies) {
    if (dependency.node_id === blockId || !present.has(dependency.node_id)) continue;
    if (dependency.reads.some((name) => names.has(name))) readers.add(dependency.node_id);
  }
  return readers.size;
}
