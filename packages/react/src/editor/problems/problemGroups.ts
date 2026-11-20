import { useMemo } from 'react';
import { useDraftEditor, type EditorItem, type WorkflowDefinition, type WorkflowProblem } from '../draft';

/** What a group of problems belongs to: a block (by its type), the inputs, the output or the workflow settings. */
export type ProblemOwnerKind = 'calculation' | 'decision_table' | 'inputs' | 'output' | 'workflow';

export interface ProblemGroup {
  /** Stable key of the group (`node:calc_pontos`, `inputs`…). */
  key: string;
  item: EditorItem;
  kind: ProblemOwnerKind;
  /** The block name, or "Entradas", "Saída" and "Workflow". */
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

const NODE_PATH = /^root\.nodes\[(\d+)\]/;

/**
 * The item a problem belongs to: the block of `node_id` (or of the `root.nodes[i]` of the path, when the API sends no id),
 * the inputs (`root.inputs…`), the output (`root.output…`) or, otherwise, the workflow. `definition` is the one the
 * problem was found in (`analyzedDefinition`): while a newer analysis is on the way, the blocks may have moved and
 * `root.nodes[i]` of the current definition may be another block.
 */
export function problemItem(problem: WorkflowProblem, definition: WorkflowDefinition): EditorItem {
  if (problem.node_id) return { type: 'node', id: problem.node_id };
  const path = problem.path ?? '';
  const index = NODE_PATH.exec(path)?.[1];
  const node = index === undefined ? undefined : definition.root.nodes[Number(index)];
  if (node) return { type: 'node', id: node.id };
  if (path.startsWith('root.inputs')) return { type: 'inputs' };
  if (path.startsWith('root.output')) return { type: 'output' };
  return { type: 'workflow' };
}

function itemKey(item: EditorItem): string {
  return item.type === 'node' ? `node:${item.id}` : item.type;
}

/**
 * The problems grouped by block (and inputs, output, workflow), in the order the API sends them (by `path`). The owner of
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
    const key = itemKey(item);
    let group = groups.get(key);
    if (!group) {
      group = { key, item, ...owner(item, currentDefinition, analyzedDefinition), problems: [] };
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
      const find = (definition: WorkflowDefinition) => definition.root.nodes.find((candidate) => candidate.id === item.id);
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
