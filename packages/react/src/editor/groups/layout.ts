// Where a group and the nodes inside it stand on the canvas. A group's `position` is its top left corner in the group that
// holds it; the `position` of a node inside it counts from the group's content area, right of the Input bar and below
// the header (so `{ x: 0, y: 0 }` is the first free place inside it). The container grows with what is inside.
import { isGroup, type DefinitionNode, type GroupNode } from './tree';

/** Width the blocks are laid out with (estilos §8: 150 to 200px). */
export const BLOCK_WIDTH = 200;
/** Height of a block before the canvas measures it. */
export const BLOCK_HEIGHT = 80;

/** Height of the group header (category square, name, count, collapse). */
export const GROUP_HEADER = 40;
/** Space between the group border and the bars, and below the content. */
export const GROUP_PADDING = 12;
/** Width of the Input and Output bars inside the group. */
export const GROUP_BAR_WIDTH = 160;
/** Space between a bar and the content. */
export const GROUP_GAP = 24;
/** Height of the bar title ("Input", "Output") and of each of its rows. */
const BAR_TITLE = 28;
const BAR_ROW = 20;
const BAR_BOTTOM = 8;

/** Where the content area starts inside the group: the origin of the `position` of the nodes inside it. */
export const GROUP_CONTENT = { x: GROUP_PADDING + GROUP_BAR_WIDTH + GROUP_GAP, y: GROUP_HEADER + GROUP_PADDING };

export interface Size {
  width: number;
  height: number;
}

/** Height of a bar with `rows` rows (one row of "Nenhuma" when empty). */
export function barHeight(rows: number): number {
  return BAR_TITLE + Math.max(rows, 1) * BAR_ROW + BAR_BOTTOM;
}

/** The rows of the bars of a group, to size it. */
export interface GroupRows {
  inputs: number;
  outputs: number;
}

/**
 * The size of each group, from the inside out: a collapsed group shows only the header and the two bars side by side;
 * an expanded one holds its nodes (sized by `sizeOf`, or the size of a block before the canvas measures it) and the bars.
 */
export function groupSizes(
  nodes: readonly DefinitionNode[],
  rowsOf: (group: GroupNode) => GroupRows,
  sizeOf: (id: string) => Size | undefined = () => undefined,
): Map<string, Size> {
  const sizes = new Map<string, Size>();
  const measure = (node: DefinitionNode): Size => {
    if (!isGroup(node)) return sizeOf(node.id) ?? { width: BLOCK_WIDTH, height: BLOCK_HEIGHT };
    const inner = node.nodes.map((child) => ({ child, size: measure(child) }));
    const rows = rowsOf(node);
    const bars = GROUP_HEADER + Math.max(barHeight(rows.inputs), barHeight(rows.outputs)) + GROUP_PADDING;
    let size: Size;
    if (node.collapsed) {
      size = { width: 2 * GROUP_PADDING + 2 * GROUP_BAR_WIDTH + GROUP_GAP, height: bars };
    } else {
      const right = Math.max(BLOCK_WIDTH, ...inner.map(({ child, size: own }) => Math.max(0, child.position.x) + own.width));
      const bottom = Math.max(BLOCK_HEIGHT, ...inner.map(({ child, size: own }) => Math.max(0, child.position.y) + own.height));
      size = {
        width: GROUP_CONTENT.x + right + GROUP_GAP + GROUP_BAR_WIDTH + GROUP_PADDING,
        height: Math.max(GROUP_CONTENT.y + bottom + GROUP_PADDING, bars),
      };
    }
    sizes.set(node.id, size);
    return size;
  };
  for (const node of nodes) measure(node);
  return sizes;
}

/** A position inside a group never goes above or left of the content area. */
export function clampInside(position: { x: number; y: number }): { x: number; y: number } {
  return { x: Math.max(0, position.x), y: Math.max(0, position.y) };
}
