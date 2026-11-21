import type { Schemas } from '../../api';
import type { WorkflowDefinition } from '../draft';
import { indexOfItem, replaced } from './itemIdentity';

/** The types of the contract used by the properties (generated, ADR 0005). */
export type DataType = Schemas['DataType'];
export type ErrorPolicy = Schemas['ErrorPolicy'];
export type RoundingMode = Schemas['RoundingMode'];
export type LinearInput = Schemas['LinearInput'];
export type MultipleInput = Schemas['MultipleInput'];
export type DeclaredInput = LinearInput | MultipleInput;
export type InputField = Schemas['InputField'];
export type CalculationNode = Schemas['CalculationNode'];
export type DecisionTableNode = Schemas['DecisionTableNode'];
export type WorkflowNode = CalculationNode | DecisionTableNode;
export type OutputField = Schemas['OutputField'];
export type NodeOutput = Schemas['NodeOutput'];

/** The variable name rule (Contratos, "Nomes de variável"; E3-10), checked as typed, like the API. */
export const NAME_PATTERN = /^[a-z][a-z0-9_]{0,62}$/;
/** Decimal places of a `decimal` in the engine (E4-4). */
export const SCALE_MIN = 0;
export const SCALE_MAX = 18;
/** Limits of the definition (E4-12). */
export const NODE_NAME_MAX = 200;
export const DESCRIPTION_MAX = 500;
export const INPUTS_MAX = 100;
export const INPUT_FIELDS_MAX = 50;

/** Something with a type and, only in the `decimal`, decimal places. */
interface Typed {
  type: DataType;
  scale?: number | null;
}

/**
 * The type with the places it needs: `scale` is required in the `decimal` and only in it (E4-12). A `decimal` keeps the
 * places it had or gets `defaultScale` (the workflow's); any other type drops them.
 */
export function withType<T extends Typed>(item: T, type: DataType, defaultScale: number): T {
  const { scale, ...rest } = item;
  if (type !== 'decimal') return { ...rest, type } as T;
  return { ...rest, type, scale: typeof scale === 'number' ? scale : defaultScale } as T;
}

/** The names that are variables of the workflow (E4-10): inputs, list fields and block outputs. */
export function variableNames(definition: WorkflowDefinition): Set<string> {
  const names = new Set<string>();
  for (const input of definition.root.inputs) {
    names.add(input.name);
    if (input.cardinality === 'multiple') for (const field of input.fields) names.add(field.name);
  }
  for (const node of definition.root.nodes) {
    if (node.type === 'calculation') names.add(node.output.name);
    else if (node.type === 'decision_table') for (const result of node.results) names.add(result.name);
  }
  return names;
}

/** How many times each variable name is used (inputs, list fields and block outputs): more than once is a duplicate. */
export function variableNameCounts(definition: WorkflowDefinition): Map<string, number> {
  const counts = new Map<string, number>();
  const add = (name: string) => counts.set(name, (counts.get(name) ?? 0) + 1);
  for (const input of definition.root.inputs) {
    add(input.name);
    if (input.cardinality === 'multiple') for (const field of input.fields) add(field.name);
  }
  for (const node of definition.root.nodes) {
    if (node.type === 'calculation') add(node.output.name);
    else if (node.type === 'decision_table') for (const result of node.results) add(result.name);
  }
  return counts;
}

/** `prefix_1`, `prefix_2`…: the first one not in `taken`. */
export function freeName(prefix: string, taken: ReadonlySet<string>): string {
  for (let number = 1; ; number++) {
    const name = `${prefix}_${number}`;
    if (!taken.has(name)) return name;
  }
}

/** The list with the item at `index` swapped with its neighbour (`-1` up, `+1` down). Out of bounds: the same list. */
export function move<T>(items: readonly T[], index: number, offset: -1 | 1): T[] {
  const target = index + offset;
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) return [...items];
  const next = [...items];
  [next[index], next[target]] = [next[target]!, next[index]!];
  return next;
}

/**
 * The list with `item` (found by object, ADR 0044) replaced by `update(item)`, which takes its key. The other items stay
 * the same objects. The same list when the item is gone or did not change.
 */
export function replaceItem<T extends object>(items: readonly T[], item: T, update: (current: T) => T): readonly T[] {
  const index = indexOfItem(items, item);
  if (index < 0) return items;
  const current = items[index]!;
  const next = update(current);
  if (next === current) return items;
  const list = [...items];
  list[index] = replaced(current, next);
  return list;
}

/** The list without `item` (found by object). */
export function removeItem<T extends object>(items: readonly T[], item: T): T[] {
  const index = indexOfItem(items, item);
  return items.filter((_, position) => position !== index);
}

/** The list with `item` (found by object) swapped with its neighbour. */
export function moveItem<T extends object>(items: readonly T[], item: T, offset: -1 | 1): T[] {
  return move(items, indexOfItem(items, item), offset);
}

export function updateRoot(
  definition: WorkflowDefinition,
  update: (root: WorkflowDefinition['root']) => WorkflowDefinition['root'],
): WorkflowDefinition {
  return { ...definition, root: update(definition.root) };
}

/** The definition with the Calculation `id` changed (nothing changes if it is gone, e.g. removed meanwhile). */
export function updateCalculation(
  definition: WorkflowDefinition,
  id: string,
  update: (node: CalculationNode) => CalculationNode,
): WorkflowDefinition {
  return updateRoot(definition, (root) => ({
    ...root,
    nodes: root.nodes.map((node) => (node.id === id && node.type === 'calculation' ? update(node) : node)),
  }));
}

export function updateInputs(
  definition: WorkflowDefinition,
  update: (inputs: readonly DeclaredInput[]) => readonly DeclaredInput[],
): WorkflowDefinition {
  const inputs = update(definition.root.inputs);
  if (inputs === definition.root.inputs) return definition;
  return updateRoot(definition, (root) => ({ ...root, inputs: [...inputs] }));
}

/** The definition with `input` (found by object) changed; `update` gets the current definition too. */
export function updateInput(
  definition: WorkflowDefinition,
  input: DeclaredInput,
  update: (current: DeclaredInput, definition: WorkflowDefinition) => DeclaredInput,
): WorkflowDefinition {
  return updateInputs(definition, (inputs) => replaceItem(inputs, input, (current) => update(current, definition)));
}

/** The fields of the Múltiplo `input` changed (nothing changes if it is no longer a Múltiplo). */
export function updateInputFields(
  definition: WorkflowDefinition,
  input: DeclaredInput,
  update: (fields: readonly InputField[], definition: WorkflowDefinition) => readonly InputField[],
): WorkflowDefinition {
  return updateInput(definition, input, (current) => {
    if (current.cardinality !== 'multiple') return current;
    const fields = update(current.fields, definition);
    return fields === current.fields ? current : { ...current, fields: [...fields] };
  });
}

export function updateOutputFields(
  definition: WorkflowDefinition,
  update: (fields: readonly OutputField[]) => readonly OutputField[],
): WorkflowDefinition {
  const fields = update(definition.root.output.fields);
  if (fields === definition.root.output.fields) return definition;
  return updateRoot(definition, (root) => ({ ...root, output: { ...root.output, fields: [...fields] } }));
}

/**
 * The input as Linear or Múltiplo. A Múltiplo needs at least one field (E4-12): the linear one becomes its first field,
 * with a free name and the same type; back to Linear, the input takes the type of the first field.
 */
export function withCardinality(definition: WorkflowDefinition, input: DeclaredInput, cardinality: DeclaredInput['cardinality']): DeclaredInput {
  if (input.cardinality === cardinality) return input;
  const defaultScale = definition.settings.rounding.scale;
  if (input.cardinality === 'linear') {
    const name = freeName('campo', variableNames(definition));
    const field = withType<InputField>({ name, type: input.type, scale: input.scale ?? null }, input.type, defaultScale);
    return { name: input.name, cardinality: 'multiple', fields: [field] };
  }
  const first = input.fields[0];
  const type = first?.type ?? 'decimal';
  return withType<LinearInput>({ name: input.name, cardinality: 'linear', type, scale: first?.scale ?? null }, type, defaultScale);
}

/** A new linear `decimal` input, with a free name and the workflow's places. */
export function newInput(definition: WorkflowDefinition): LinearInput {
  return {
    name: freeName('entrada', variableNames(definition)),
    cardinality: 'linear',
    type: 'decimal',
    scale: definition.settings.rounding.scale,
  };
}

/** A new `decimal` field of a Múltiplo, with a free name and the workflow's places. */
export function newInputField(definition: WorkflowDefinition): InputField {
  return { name: freeName('campo', variableNames(definition)), type: 'decimal', scale: definition.settings.rounding.scale };
}

/**
 * A new output field for `variable`: named after it, or `variable_2`, `variable_3`… when that name is already a field of
 * the output.
 */
export function newOutputField(fields: readonly OutputField[], variable: string): OutputField {
  const taken = new Set(fields.map((field) => field.name));
  if (!taken.has(variable)) return { name: variable, variable };
  for (let number = 2; ; number++) {
    const name = `${variable}_${number}`.slice(0, 63);
    if (!taken.has(name)) return { name, variable };
  }
}
