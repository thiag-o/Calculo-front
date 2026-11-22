// The nodes of a definition as a tree (E5-5): a group holds nodes with the same shape as the root's, groups inside groups
// up to 5 levels. Pure functions over the whole tree, that keep the same objects for everything that did not change
// (ADR 0044), so the canvas and the layers draw again only what an edit touched.
import { declaredVariableNames, producedNames, type DefinitionNode, type GroupNode } from '../definition';
import type { WorkflowDefinition } from '../draft';

export { producedNames };
export type { DefinitionNode, GroupNode };

/** One node of the tree, with where it sits. */
export interface TreeEntry {
  node: DefinitionNode;
  /** The group it is directly inside; `null` in the root group. */
  parent: string | null;
  /** 0 in the root group, 1 inside a group of the root, and so on. */
  depth: number;
  /** Its `path` in the definition, as the problems point to it: `root.nodes[2]`, `root.nodes[2].nodes[0]`. */
  path: string;
}

export function isGroup(node: DefinitionNode): node is GroupNode {
  return node.type === 'group';
}

/** Every node of the definition, depth first: a group comes right before the nodes inside it. */
export function treeEntries(definition: WorkflowDefinition): TreeEntry[] {
  const entries: TreeEntry[] = [];
  const visit = (nodes: readonly DefinitionNode[], parent: string | null, depth: number, prefix: string) => {
    nodes.forEach((node, index) => {
      const path = `${prefix}[${index}]`;
      entries.push({ node, parent, depth, path });
      if (isGroup(node)) visit(node.nodes, node.id, depth + 1, `${path}.nodes`);
    });
  };
  visit(definition.root.nodes, null, 0, 'root.nodes');
  return entries;
}

/** The entry of a node anywhere in the tree. */
export function findEntry(definition: WorkflowDefinition, id: string): TreeEntry | undefined {
  return treeEntries(definition).find((entry) => entry.node.id === id);
}

/** A node anywhere in the tree. */
export function findNode(definition: WorkflowDefinition, id: string): DefinitionNode | undefined {
  return findEntry(definition, id)?.node;
}

/** A group anywhere in the tree. */
export function findGroup(definition: WorkflowDefinition, id: string): GroupNode | undefined {
  const node = findNode(definition, id);
  return node && isGroup(node) ? node : undefined;
}

/** The nodes directly inside a group (`null`: the root group). */
export function scopeNodes(definition: WorkflowDefinition, scope: string | null): readonly DefinitionNode[] {
  if (scope === null) return definition.root.nodes;
  return findGroup(definition, scope)?.nodes ?? [];
}

/** The ids of the groups that hold the node, from its own group out to the root's child. */
export function ancestorsOf(definition: WorkflowDefinition, id: string): string[] {
  const parents = new Map<string, string | null>();
  for (const entry of treeEntries(definition)) parents.set(entry.node.id, entry.parent);
  const chain: string[] = [];
  let current = parents.get(id) ?? null;
  while (current !== null) {
    chain.push(current);
    current = parents.get(current) ?? null;
  }
  return chain;
}

/** Every node inside a group, at any depth. */
export function descendantsOf(group: GroupNode): DefinitionNode[] {
  const found: DefinitionNode[] = [];
  const visit = (nodes: readonly DefinitionNode[]) => {
    for (const node of nodes) {
      found.push(node);
      if (isGroup(node)) visit(node.nodes);
    }
  };
  visit(group.nodes);
  return found;
}

/** The definition with the nodes of a scope replaced (the same definition when `update` gives the same list). */
export function updateScope(
  definition: WorkflowDefinition,
  scope: string | null,
  update: (nodes: DefinitionNode[]) => DefinitionNode[],
): WorkflowDefinition {
  if (scope === null) {
    const nodes = update([...definition.root.nodes]);
    return sameItems(nodes, definition.root.nodes) ? definition : { ...definition, root: { ...definition.root, nodes } };
  }
  return updateNodes(definition, (node) => {
    if (node.id !== scope || !isGroup(node)) return node;
    const nodes = update([...node.nodes]);
    return sameItems(nodes, node.nodes) ? node : { ...node, nodes };
  });
}

/**
 * The definition with each node passed through `update`, at any depth (inner nodes first, so a group sees its updated
 * inner nodes). What `update` gives back as the same object stays the same, up to the definition itself.
 */
export function updateNodes(definition: WorkflowDefinition, update: (node: DefinitionNode) => DefinitionNode): WorkflowDefinition {
  const visit = (nodes: readonly DefinitionNode[]): readonly DefinitionNode[] => {
    let changed = false;
    const next = nodes.map((node) => {
      let current = node;
      if (isGroup(node)) {
        const inner = visit(node.nodes);
        if (inner !== node.nodes) current = { ...node, nodes: [...inner] };
      }
      const updated = update(current);
      if (updated !== node) changed = true;
      return updated;
    });
    return changed ? next : nodes;
  };
  const nodes = visit(definition.root.nodes);
  return nodes === definition.root.nodes ? definition : { ...definition, root: { ...definition.root, nodes: [...nodes] } };
}

/** The definition with one node changed, wherever it is. */
export function updateNode(definition: WorkflowDefinition, id: string, update: (node: DefinitionNode) => DefinitionNode): WorkflowDefinition {
  return updateNodes(definition, (node) => (node.id === id ? update(node) : node));
}

/** The definition without the node (and, for a group, without everything inside it). */
export function removeNode(definition: WorkflowDefinition, id: string): WorkflowDefinition {
  const entry = findEntry(definition, id);
  if (!entry) return definition;
  return updateScope(definition, entry.parent, (nodes) => nodes.filter((node) => node.id !== id));
}

/** The nodes of the same group as `id`, in order, with `id` among them (the neighbours of a removal). */
export function siblingsOf(definition: WorkflowDefinition, id: string): readonly DefinitionNode[] {
  const entry = findEntry(definition, id);
  return entry ? scopeNodes(definition, entry.parent) : [];
}

function sameItems<T>(a: readonly T[], b: readonly T[]): boolean {
  return a.length === b.length && a.every((item, index) => item === b[index]);
}

/**
 * Every variable name the definition already declares, at any depth (E4-10: one name, one variable): the declared
 * inputs and their fields, the fields of the batch source, and what each Calculation, Decision Table and Fonte
 * produces. A group's Output repeats names declared inside it, so it adds nothing.
 */
export function declaredNames(definition: WorkflowDefinition): Set<string> {
  return new Set(declaredVariableNames(definition));
}

/** The first `<prefix>_N` (N from 1) not in `used`, with its number. */
export function firstFree(prefix: string, used: ReadonlySet<string>): { name: string; number: number } {
  for (let number = 1; ; number++) {
    const name = `${prefix}_${number}`;
    if (!used.has(name)) return { name, number };
  }
}

/** The first free node id with the prefix among the nodes at any depth (`calc_1`, `grp_1`), with its number. */
export function freeNodeId(definition: WorkflowDefinition, prefix: string): { name: string; number: number } {
  return firstFree(prefix, new Set(treeEntries(definition).map((entry) => entry.node.id)));
}
