// The problems of a list row (a filter, a link, an ordering item, an output): the analysis points each one by `path`
// (`root.nodes[2].filters[0].values[1]`). A field shows the problems of its own path; the row shows the ones under it that
// match none of its fields, so none is hidden.
import type { WorkflowProblem } from '../../draft';

/** Whether `path` is `prefix` or a part of it (`root.nodes[1].links[0]` is under `root.nodes[1]`; `…links[0]x` is not). */
export function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

/** The problems under `prefix` whose path is none of `fields`. */
export function rowProblems(problems: readonly WorkflowProblem[], prefix: string | null, fields: readonly (string | null)[]): WorkflowProblem[] {
  if (prefix === null) return [];
  const shown = new Set(fields.filter((field): field is string => field !== null));
  return problems.filter((problem) => problem.path !== null && isUnder(problem.path, prefix) && !shown.has(problem.path));
}

/** `${at}.${field}`, or `null` while the item was not analysed yet. */
export function fieldPath(at: string | null, field: string): string | null {
  return at === null ? null : `${at}.${field}`;
}

/**
 * The accessible name of a control that repeats (one "Operador" per filter): the label and, in parentheses, the item it
 * belongs to. The visible text starts the same, so it stays in the name.
 */
export function scopedName(label: string, scope: string | undefined): string {
  return scope ? `${label} (${scope})` : label;
}
