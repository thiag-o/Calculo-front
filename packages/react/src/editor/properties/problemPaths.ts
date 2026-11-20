import type { WorkflowDefinition, WorkflowProblem } from '../draft';

/**
 * The problems are found in the analysed definition, and their `path` (`root.nodes[2].expression`) points into it. The
 * properties show each problem beside the field with that `path`; the ones of the item that match no field on screen show
 * at the top of the panel.
 */

export const SETTINGS_PATH = 'settings';
export const INPUTS_PATH = 'root.inputs';
export const OUTPUT_PATH = 'root.output';

export function inputPath(index: number): string {
  return `${INPUTS_PATH}[${index}]`;
}

export function outputFieldPath(index: number): string {
  return `${OUTPUT_PATH}.fields[${index}]`;
}

export function nodePathAt(index: number): string {
  return `root.nodes[${index}]`;
}

/**
 * Where the block `id` was in the analysed definition (`root.nodes[i]`), so its problems are found even after blocks
 * were added, removed or moved while the analysis of the latest change was on the way. `null` if it was not there yet.
 */
export function analyzedNodePath(analyzed: WorkflowDefinition, id: string): string | null {
  const index = analyzed.root.nodes.findIndex((node) => node.id === id);
  return index < 0 ? null : nodePathAt(index);
}

/** The problems of exactly this field. */
export function problemsAt(problems: readonly WorkflowProblem[], path: string | null): WorkflowProblem[] {
  if (path === null) return [];
  return problems.filter((problem) => problem.path === path);
}

/** Whether `path` is `prefix` or a part of it (`root.inputs[1]` is under `root.inputs`, `root.inputsx` is not). */
export function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

/**
 * The problems under `prefix` that match none of the `shown` fields: they show at the top of the item, so none is
 * hidden. `includeLoose` also takes the problems without `path` nor block (the workflow ones).
 */
export function otherProblems(
  problems: readonly WorkflowProblem[],
  prefix: string | null,
  shown: ReadonlySet<string>,
  includeLoose = false,
): WorkflowProblem[] {
  return problems.filter((problem) => {
    if (problem.path === null) return includeLoose && problem.node_id === null;
    if (prefix === null || !isUnder(problem.path, prefix)) return false;
    return !shown.has(problem.path);
  });
}

/**
 * The indexed parts of a path, from the outside in: `root.inputs[2].fields[5].name` gives `root.inputs[2]` and
 * `root.inputs[2].fields[5]`.
 */
export function indexedPrefixes(path: string): string[] {
  const prefixes: string[] = [];
  for (const match of path.matchAll(/\[\d+\]/g)) prefixes.push(path.slice(0, match.index + match[0].length));
  return prefixes;
}

/**
 * The problems whose items are still on screen. `present` has the analysed path of each item on screen (`root.inputs[2]`,
 * `root.inputs[2].fields[0]`): the problem of an item removed after the analysis goes away with it, instead of passing to
 * the neighbour (ADR 0044).
 */
export function ofPresentItems(problems: readonly WorkflowProblem[], present: ReadonlySet<string>): WorkflowProblem[] {
  return problems.filter((problem) => problem.path === null || indexedPrefixes(problem.path).every((prefix) => present.has(prefix)));
}

/** The messages of the problems, for the field's error text. */
export function problemText(problems: readonly WorkflowProblem[]): string | undefined {
  if (problems.length === 0) return undefined;
  return problems.map((problem) => problem.message).join(' ');
}
