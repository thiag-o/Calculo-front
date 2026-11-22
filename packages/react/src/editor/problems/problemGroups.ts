import { useMemo } from 'react';
import { useDraftEditor, type EditorItem, type WorkflowDefinition, type WorkflowProblem } from '../draft';

/** What a group of problems belongs to: a block (by its type), the inputs, the output or the workflow settings. */
export type ProblemOwnerKind = 'calculation' | 'decision_table' | 'inputs' | 'output' | 'workflow';

export interface ProblemGroup {
  /** Stable key of the group (`node:calc_pontos`, `inputs`, `parameter:1`…). */
  key: string;
  item: EditorItem;
  kind: ProblemOwnerKind;
  /** The block name, or "Entradas", "Saída", "Workflow" and "Parâmetro periodo". */
  title: string;
  problems: WorkflowProblem[];
}

/** How many problems each part of the draft has, for the counter, the canvas and the layers. */
export interface ProblemCounts {
  total: number;
  /** By block id; a block without problems is not in the map. */
  byNode: ReadonlyMap<string, number>;
  inputs: number;
  output: number;
  workflow: number;
}

type DefinitionNode = WorkflowDefinition['root']['nodes'][number];

/** `root.nodes[1]` and, inside groups at any level, `.nodes[0].nodes[2]`… */
const NODE_PATH = /^root\.nodes\[(\d+)\]((?:\.nodes\[\d+\])*)/;
const BATCH_SOURCE_CODES: ReadonlySet<string> = new Set(['missing_batch_source_key', 'missing_order_by']);

/** The block a `root.nodes[i].nodes[k]…` path points to, or `undefined` when the path leads nowhere. */
function nodeAtPath(path: string, definition: WorkflowDefinition): DefinitionNode | undefined {
  const match = NODE_PATH.exec(path);
  if (!match) return undefined;
  const indexes = [match[1]!, ...[...(match[2] ?? '').matchAll(/\[(\d+)\]/g)].map((part) => part[1]!)].map(Number);
  let node: DefinitionNode | undefined = definition.root.nodes[indexes[0]!];
  for (const index of indexes.slice(1)) node = node?.type === 'group' ? node.nodes[index] : undefined;
  return node;
}

/** A block by id, the ones inside groups (at any level) included. */
function findNode(nodes: readonly DefinitionNode[], id: string): DefinitionNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const inside = node.type === 'group' ? findNode(node.nodes, id) : undefined;
    if (inside) return inside;
  }
  return undefined;
}

/**
 * The item a problem belongs to: the block of `node_id` (or of the `root.nodes[i]` of the path, also `.nodes[k]` inside groups, when the API sends no
 * id), the inputs (`root.inputs…`, and the batch source problems, when the definition has one: they belong to the batch source bar), the output (`root.output…`) or, otherwise, the workflow. `definition` is the one the
 * problem was found in (`analyzedDefinition`): while a newer analysis is on the way, the blocks may have moved and
 * `root.nodes[i]` of the current definition may be another block.
 */
export function problemItem(problem: WorkflowProblem, definition: WorkflowDefinition): EditorItem {
  if (problem.node_id) return { type: 'node', id: problem.node_id };
  const path = problem.path ?? '';
  const node = nodeAtPath(path, definition);
  if (node) return { type: 'node', id: node.id };
  if (definition.root.batch_source && (BATCH_SOURCE_CODES.has(problem.code) || path.startsWith('root.batch_source'))) return { type: 'inputs' };
  if (path.startsWith('root.inputs')) return { type: 'inputs' };
  if (path.startsWith('root.output')) return { type: 'output' };
  return { type: 'workflow' };
}

function itemKey(item: EditorItem): string {
  return item.type === 'node' ? `node:${item.id}` : item.type;
}

/** `parameters[1]` and anything under it (`parameters[1].default`, `parameters[1].allowed_values[0]`). */
const PARAMETER_PATH = /^parameters\[(\d+)\](?:$|[.[])/;

/**
 * The parameter a problem belongs to, by the index of its `path` in the definition the problem was found in, or `null`. A
 * parameter has no item of its own in the selection: it is part of the workflow panel (F98), which focuses the field of
 * the `path`; in the Problems tab its problems get a group of their own, named after it.
 */
function problemParameter(problem: WorkflowProblem, definition: WorkflowDefinition): { index: number; name: string } | null {
  if (problem.node_id) return null;
  const match = PARAMETER_PATH.exec(problem.path ?? '');
  if (!match) return null;
  const index = Number(match[1]);
  const parameter = definition.parameters?.[index];
  return parameter ? { index, name: parameter.name } : null;
}

/**
 * The problems grouped by block (and inputs, output, workflow, and each run parameter on its own), in the order the API sends them (by `path`). The owner of
 * each problem comes from `analyzedDefinition` (where it was found); the block name and type, from `currentDefinition`
 * when the block is still there.
 */
export function groupProblems(
  problems: readonly WorkflowProblem[],
  analyzedDefinition: WorkflowDefinition,
  currentDefinition: WorkflowDefinition = analyzedDefinition,
): ProblemGroup[] {
  const groups = new Map<string, ProblemGroup>();
  for (const problem of problems) {
    const item = problemItem(problem, analyzedDefinition);
    const parameter = item.type === 'workflow' ? problemParameter(problem, analyzedDefinition) : null;
    const key = parameter ? `parameter:${parameter.index}` : itemKey(item);
    let group = groups.get(key);
    if (!group) {
      const named = parameter ? { kind: 'workflow' as const, title: `Parâmetro ${parameter.name}` } : owner(item, currentDefinition, analyzedDefinition);
      group = { key, item, ...named, problems: [] };
      groups.set(key, group);
    }
    group.problems.push(problem);
  }
  return [...groups.values()];
}

function owner(item: EditorItem, current: WorkflowDefinition, analyzed: WorkflowDefinition): Pick<ProblemGroup, 'kind' | 'title'> {
  switch (item.type) {
    case 'inputs':
      return { kind: 'inputs', title: 'Entradas' };
    case 'output':
      return { kind: 'output', title: 'Saída' };
    case 'workflow':
      return { kind: 'workflow', title: 'Workflow' };
    case 'node': {
      const find = (definition: WorkflowDefinition) => findNode(definition.root.nodes, item.id);
      const node = find(current) ?? find(analyzed);
      return { kind: node?.type === 'decision_table' ? 'decision_table' : 'calculation', title: node?.name || item.id };
    }
  }
}

/** `definition`: the one the problems were found in (see `problemItem`). */
export function countProblems(problems: readonly WorkflowProblem[], definition: WorkflowDefinition): ProblemCounts {
  const byNode = new Map<string, number>();
  let inputs = 0;
  let output = 0;
  let workflow = 0;
  for (const problem of problems) {
    const item = problemItem(problem, definition);
    if (item.type === 'node') byNode.set(item.id, (byNode.get(item.id) ?? 0) + 1);
    else if (item.type === 'inputs') inputs += 1;
    else if (item.type === 'output') output += 1;
    else workflow += 1;
  }
  return { total: problems.length, byNode, inputs, output, workflow };
}

/**
 * The problem counts of the draft being edited (for the canvas and the layers: the red icon and the number per block).
 * Blocks by id, resolved in the definition the problems were found in.
 */
export function useProblemCounts(): ProblemCounts {
  const { problems, analyzedDefinition } = useDraftEditor();
  return useMemo(() => countProblems(problems, analyzedDefinition), [problems, analyzedDefinition]);
}

/** "1 problema", "3 problemas". */
export function problemCountText(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}
