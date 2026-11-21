// The group edits (E5-19): Agrupar, Desagrupar, "Mover para o grupo…", "Tirar do grupo", recolher e expandir and the
// group Output. Pure functions; a block only changes group through them, never by dragging, because the group decides
// what each formula sees.
import type { Dependency, DraftSymbol, WorkflowDefinition } from '../draft';
import { BLOCK_HEIGHT, GROUP_CONTENT, GROUP_GAP, groupSizes } from './layout';
import {
  ancestorsOf,
  findEntry,
  findGroup,
  freeNodeId,
  isGroup,
  producedNames,
  scopeNodes,
  treeEntries,
  updateNode,
  updateScope,
  type DefinitionNode,
  type GroupNode,
} from './tree';
import { GROUP_NAME, NOTHING_TO_GROUP_REASON, SAME_GROUP_REASON } from './messages';

/** Why the nodes cannot be grouped together, or `null` when they can (one or more, all directly in the same group). */
export function groupReason(definition: WorkflowDefinition, ids: readonly string[]): string | null {
  if (ids.length === 0) return NOTHING_TO_GROUP_REASON;
  const parents = new Set<string | null>();
  for (const id of ids) {
    const entry = findEntry(definition, id);
    if (!entry) return NOTHING_TO_GROUP_REASON;
    parents.add(entry.parent);
  }
  return parents.size === 1 ? null : SAME_GROUP_REASON;
}

/** The ids of every node inside `nodes`, at any depth, with the nodes themselves. */
function idsWithin(nodes: readonly DefinitionNode[]): Set<string> {
  const ids = new Set<string>();
  const visit = (list: readonly DefinitionNode[]) => {
    for (const node of list) {
      ids.add(node.id);
      if (isGroup(node)) visit(node.nodes);
    }
  };
  visit(nodes);
  return ids;
}

/**
 * The names the nodes produce that something outside them reads (by the `dependencies` of the analysis, the workflow
 * Saída and the Output of the group that holds them): the Output a new group needs so no formula outside it loses sight
 * of a variable that went in.
 */
function readOutside(definition: WorkflowDefinition, moved: readonly DefinitionNode[], dependencies: readonly Dependency[], scope: string | null): string[] {
  const inside = idsWithin(moved);
  const read = new Set<string>();
  for (const dependency of dependencies) if (!inside.has(dependency.node_id)) for (const name of dependency.reads) read.add(name);
  for (const field of definition.root.output.fields) read.add(field.variable);
  if (scope !== null) for (const name of findGroup(definition, scope)?.outputs ?? []) read.add(name);
  const names: string[] = [];
  for (const node of moved) for (const name of producedNames(node)) if (read.has(name) && !names.includes(name)) names.push(name);
  return names;
}

export interface Grouped {
  definition: WorkflowDefinition;
  group: GroupNode;
}

/**
 * Agrupar: the nodes (all directly in the same group) go into a new group, in their order, where the first of them was.
 * Nothing moves on screen: the group is placed so that each node keeps its place. The Output starts with what they
 * produce that is read outside them, so grouping alone changes no formula. `null` when they cannot be grouped.
 */
export function groupNodes(definition: WorkflowDefinition, ids: readonly string[], dependencies: readonly Dependency[]): Grouped | null {
  if (groupReason(definition, ids) !== null) return null;
  const scope = findEntry(definition, ids[0]!)!.parent;
  const wanted = new Set(ids);
  const siblings = scopeNodes(definition, scope);
  const moved = siblings.filter((node) => wanted.has(node.id));
  const left = Math.min(...moved.map((node) => node.position.x));
  const top = Math.min(...moved.map((node) => node.position.y));
  const id = freeNodeId(definition, 'grp');
  const group: GroupNode = {
    id: id.name,
    type: 'group',
    name: `${GROUP_NAME} ${id.number}`,
    description: null,
    position: { x: left - GROUP_CONTENT.x, y: top - GROUP_CONTENT.y },
    collapsed: false,
    nodes: moved.map((node) => ({ ...node, position: { x: node.position.x - left, y: node.position.y - top } })),
    outputs: readOutside(definition, moved, dependencies, scope),
  };
  const first = siblings.findIndex((node) => wanted.has(node.id));
  const next = updateScope(definition, scope, (nodes) => {
    const kept = nodes.filter((node) => !wanted.has(node.id));
    const at = nodes.slice(0, first).filter((node) => !wanted.has(node.id)).length;
    return [...kept.slice(0, at), group, ...kept.slice(at)];
  });
  return { definition: next, group };
}

/** Desagrupar: the nodes of the group go back to the group that held it, in its place, each one where it was on screen. */
export function ungroup(definition: WorkflowDefinition, groupId: string): WorkflowDefinition {
  const entry = findEntry(definition, groupId);
  if (!entry || !isGroup(entry.node)) return definition;
  const group = entry.node;
  const origin = { x: group.position.x + GROUP_CONTENT.x, y: group.position.y + GROUP_CONTENT.y };
  const freed = group.nodes.map((node) => ({ ...node, position: { x: origin.x + node.position.x, y: origin.y + node.position.y } }));
  return updateScope(definition, entry.parent, (nodes) => nodes.flatMap((node) => (node.id === groupId ? freed : [node])));
}

/** The groups a node can go into with "Mover para o grupo…": not its own group, not itself and not one inside it. */
export function moveTargets(definition: WorkflowDefinition, nodeId: string): { id: string; label: string }[] {
  const entry = findEntry(definition, nodeId);
  if (!entry) return [];
  const names = new Map<string, string>();
  for (const { node } of treeEntries(definition)) names.set(node.id, node.name || node.id);
  return treeEntries(definition)
    .filter(({ node }) => isGroup(node) && node.id !== nodeId && node.id !== entry.parent && !ancestorsOf(definition, node.id).includes(nodeId))
    .map(({ node }) => {
      const path = [...ancestorsOf(definition, node.id)].reverse().map((id) => names.get(id) ?? id);
      return { id: node.id, label: [...path, names.get(node.id) ?? node.id].join(' › ') };
    });
}

/**
 * The definition without the names the node produces in the Output of the groups it leaves (every group that held it
 * and does not hold `destination`): a group only gives out what is produced inside it.
 */
function leaveOutputs(definition: WorkflowDefinition, node: DefinitionNode, left: readonly string[]): WorkflowDefinition {
  const names = new Set(producedNames(node));
  let next = definition;
  for (const id of left) {
    next = updateNode(next, id, (group) => {
      if (!isGroup(group) || !group.outputs.some((name) => names.has(name))) return group;
      return { ...group, outputs: group.outputs.filter((name) => !names.has(name)) };
    });
  }
  return next;
}

function withPosition(node: DefinitionNode, position: { x: number; y: number }): DefinitionNode {
  return { ...node, position };
}

/**
 * "Mover para o grupo…": the node goes to the end of the group, below what is already there. The groups it leaves stop
 * giving out what it produces. The formulas that read it from outside may stop seeing it: the analysis says where.
 */
export function moveToGroup(definition: WorkflowDefinition, nodeId: string, groupId: string): WorkflowDefinition {
  const entry = findEntry(definition, nodeId);
  const target = findGroup(definition, groupId);
  if (!entry || !target || !moveTargets(definition, nodeId).some((candidate) => candidate.id === groupId)) return definition;
  const sizes = groupSizes(target.nodes, (group) => ({ inputs: 0, outputs: group.outputs.length }));
  const bottom = Math.max(0, ...target.nodes.map((node) => node.position.y + (sizes.get(node.id)?.height ?? BLOCK_HEIGHT) + GROUP_GAP));
  const moved = withPosition(entry.node, { x: 0, y: target.nodes.length === 0 ? 0 : bottom });
  const destination = new Set([groupId, ...ancestorsOf(definition, groupId)]);
  const left = ancestorsOf(definition, nodeId).filter((id) => !destination.has(id));
  let next = updateScope(definition, entry.parent, (nodes) => nodes.filter((node) => node.id !== nodeId));
  next = updateScope(next, groupId, (nodes) => [...nodes, moved]);
  return leaveOutputs(next, entry.node, left);
}

/**
 * "Tirar do grupo": the node goes to the group that holds its group, right after it, beside the group on screen and at
 * the same height it had. Its group stops giving out what it produces.
 */
export function takeOutOfGroup(definition: WorkflowDefinition, nodeId: string): WorkflowDefinition {
  const entry = findEntry(definition, nodeId);
  if (!entry || entry.parent === null) return definition;
  const group = findEntry(definition, entry.parent)!;
  if (!isGroup(group.node)) return definition;
  const holder = group.node;
  const width = groupSizes([holder], (candidate) => ({ inputs: 0, outputs: candidate.outputs.length })).get(holder.id)!.width;
  const moved = withPosition(entry.node, {
    x: holder.position.x + width + GROUP_GAP,
    y: holder.position.y + GROUP_CONTENT.y + entry.node.position.y,
  });
  let next = updateScope(definition, holder.id, (nodes) => nodes.filter((node) => node.id !== nodeId));
  next = updateScope(next, group.parent, (nodes) => nodes.flatMap((node) => (node.id === holder.id ? [node, moved] : [node])));
  return leaveOutputs(next, entry.node, [holder.id]);
}

/** Recolher e expandir: `collapsed` of the group, saved in the draft. */
export function setCollapsed(definition: WorkflowDefinition, groupId: string, collapsed: boolean): WorkflowDefinition {
  return updateNode(definition, groupId, (node) => (isGroup(node) && node.collapsed !== collapsed ? { ...node, collapsed } : node));
}

/** The group's Output (the names it gives out, in this order). */
export function setGroupOutputs(definition: WorkflowDefinition, groupId: string, outputs: readonly string[]): WorkflowDefinition {
  return updateNode(definition, groupId, (node) => {
    if (!isGroup(node)) return node;
    const same = node.outputs.length === outputs.length && node.outputs.every((name, index) => name === outputs[index]);
    return same ? node : { ...node, outputs: [...outputs] };
  });
}

/**
 * What the group's Output can give out: the linear variables produced inside it, by the `symbols` of the analysis
 * (produced directly in it, or given out by a group directly inside it), in the order of the analysis.
 */
export function outputCandidates(definition: WorkflowDefinition, symbols: readonly DraftSymbol[], groupId: string): DraftSymbol[] {
  const group = findGroup(definition, groupId);
  if (!group) return [];
  const fromInner = new Set<string>();
  for (const node of group.nodes) if (isGroup(node)) for (const name of node.outputs) fromInner.add(name);
  const seen = new Set<string>();
  return symbols.filter((symbol) => {
    if (symbol.cardinality !== 'linear' || seen.has(symbol.name)) return false;
    if (symbol.group_id !== groupId && !fromInner.has(symbol.name)) return false;
    seen.add(symbol.name);
    return true;
  });
}
