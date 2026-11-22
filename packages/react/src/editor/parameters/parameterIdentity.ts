// Who is who in the list of parameters, by object and not by position (ADR 0044, the same pattern as the properties'
// itemIdentity, which ADR 0047 keeps private there). An edited parameter passes its key to the object that replaces it, so
// a parameter keeps its React key, its problems (found in the analysed definition) and its merge key while the analysis of
// the latest change is on the way.
import type { WorkflowDefinition } from '../draft';
import type { WorkflowParameter } from './parameterRules';

const keys = new WeakMap<object, number>();
let lastKey = 0;

/** The key of the parameter: the same for the object and for every edited version of it. */
export function parameterKey(parameter: WorkflowParameter): number {
  let key = keys.get(parameter);
  if (key === undefined) {
    lastKey += 1;
    key = lastKey;
    keys.set(parameter, key);
  }
  return key;
}

/** Where the parameter is in `list`: the same object or an edited version of it. `-1` when it is not there. */
export function indexOfParameter(list: readonly WorkflowParameter[] | undefined, parameter: WorkflowParameter): number {
  if (!list) return -1;
  const same = list.indexOf(parameter);
  if (same >= 0) return same;
  const key = keys.get(parameter);
  if (key === undefined) return -1;
  return list.findIndex((candidate) => keys.get(candidate) === key);
}

/** The definition with the parameters changed by `apply`. */
export function updateParameters(
  definition: WorkflowDefinition,
  apply: (parameters: readonly WorkflowParameter[]) => WorkflowParameter[],
): WorkflowDefinition {
  return { ...definition, parameters: apply(definition.parameters) };
}

/** The definition with `parameter` (found by its key) replaced by what `apply` gives; the new object keeps the key. */
export function updateParameter(
  definition: WorkflowDefinition,
  parameter: WorkflowParameter,
  apply: (current: WorkflowParameter, definition: WorkflowDefinition) => WorkflowParameter,
): WorkflowDefinition {
  const index = indexOfParameter(definition.parameters, parameter);
  if (index < 0) return definition;
  const current = definition.parameters[index]!;
  const next = apply(current, definition);
  if (next === current) return definition;
  if (!keys.has(next)) keys.set(next, parameterKey(current));
  return updateParameters(definition, (all) => all.map((item, at) => (at === index ? next : item)));
}

/** The list without `parameter`. */
export function withoutParameter(parameters: readonly WorkflowParameter[], parameter: WorkflowParameter): WorkflowParameter[] {
  const index = indexOfParameter(parameters, parameter);
  return parameters.filter((_, at) => at !== index);
}
