// Where the problems of the parameters and of the run settings show (Contratos do back, "Parâmetro na definição"). The
// `path` points into the analysed definition (`parameters[1].default`, `parameters[2].allowed_values[0]`). The contract does
// not fix how deep the path of `invalid_parameter_default` and `invalid_allowed_value` goes (the default, its value, an item
// of it), so, as with the batch source problems (D21), they are found by their code inside the parameter: the path only
// says which value of the list to mark, when it names one.
import type { WorkflowProblem } from '../draft';

export const PARAMETERS_PATH = 'parameters';
export const ERROR_LIMIT_PATH = 'settings.error_limit_percent';
export const TRACE_LEVEL_PATH = 'settings.trace_level';

export function parameterPath(index: number): string {
  return `${PARAMETERS_PATH}[${index}]`;
}

/** Whether `path` is `prefix` or a part of it (`parameters[1].name` is under `parameters[1]`, `parameters[10]` is not). */
export function isUnder(path: string, prefix: string): boolean {
  return path === prefix || path.startsWith(`${prefix}.`) || path.startsWith(`${prefix}[`);
}

/** A value of the default: one of a list (by index), an end of the period, or the default as a whole. */
export type DefaultSpot = number | 'start' | 'end' | 'whole';

/** Where in the default a problem of the parameter at `at` points. */
export function defaultSpot(path: string | null, at: string): DefaultSpot {
  if (path === null) return 'whole';
  const rest = path.slice(at.length);
  const item = /^\.default(?:\.value)?\[(\d+)\]$/.exec(rest);
  if (item) return Number(item[1]);
  const end = /^\.default(?:\.value)?\.(start|end)$/.exec(rest);
  if (end) return end[1] as 'start' | 'end';
  return 'whole';
}

/** The index of the allowed value a problem of the parameter at `at` points to, or `null` for the list as a whole. */
export function allowedSpot(path: string | null, at: string): number | null {
  if (path === null) return null;
  const item = /^\.allowed_values\[(\d+)\]$/.exec(path.slice(at.length));
  return item ? Number(item[1]) : null;
}

/** The problems of a parameter, by the field they show at. */
export interface ParameterProblems {
  name: WorkflowProblem[];
  type: WorkflowProblem[];
  scale: WorkflowProblem[];
  list: WorkflowProblem[];
  required: WorkflowProblem[];
  description: WorkflowProblem[];
  defaults: { problem: WorkflowProblem; spot: DefaultSpot }[];
  allowed: { problem: WorkflowProblem; spot: number | null }[];
  /** The ones of the parameter that match none of its fields: they show at the top of the parameter. */
  other: WorkflowProblem[];
}

const FIELDS = ['name', 'type', 'scale', 'list', 'required', 'description'] as const;

/** Sorts the problems under `at` (the parameter's path in the analysed definition) by field. */
export function parameterProblems(problems: readonly WorkflowProblem[], at: string | null): ParameterProblems {
  const sorted: ParameterProblems = { name: [], type: [], scale: [], list: [], required: [], description: [], defaults: [], allowed: [], other: [] };
  if (at === null) return sorted;
  for (const problem of problems) {
    const path = problem.path;
    if (path === null || !isUnder(path, at)) continue;
    if (problem.code === 'invalid_parameter_default' || isUnder(path, `${at}.default`)) {
      sorted.defaults.push({ problem, spot: defaultSpot(path, at) });
      continue;
    }
    if (problem.code === 'invalid_allowed_value' || isUnder(path, `${at}.allowed_values`)) {
      sorted.allowed.push({ problem, spot: allowedSpot(path, at) });
      continue;
    }
    const field = FIELDS.find((name) => path === `${at}.${name}`);
    if (field) sorted[field].push(problem);
    else sorted.other.push(problem);
  }
  return sorted;
}

/**
 * The problems of the parameters as a whole (`parameters`, not one of them): they show at the top of the section. The
 * problem of a parameter removed after the analysis goes away with it, instead of passing to the neighbour (ADR 0044).
 */
export function sectionProblems(problems: readonly WorkflowProblem[]): WorkflowProblem[] {
  return problems.filter((problem) => problem.path !== null && isUnder(problem.path, PARAMETERS_PATH) && !/^parameters\[\d+\]/.test(problem.path));
}
