// The free names of a new item, one rule for the whole editor: a new block takes the first free id of its kind (`calc_1`,
// `td_1`) and a new output or result column takes the first free `resultado_N` among every variable the workflow
// already declares (E4-10: one name, one variable). The canvas and the Decision Table grid both use it.
import type { WorkflowDefinition } from './queries';

/** Every variable name the definition already declares: inputs, list fields, block outputs and result columns (E4-10). */
export function usedNames(definition: WorkflowDefinition): Set<string> {
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

/** The first `<prefix>_N` (N from 1) that is not in `used`, with its number. */
export function firstFree(prefix: string, used: ReadonlySet<string>): { name: string; number: number } {
  for (let number = 1; ; number++) {
    const name = `${prefix}_${number}`;
    if (!used.has(name)) return { name, number };
  }
}

/** The first free `resultado_N` of the workflow: the output of a new block or a new result column. */
export function freeResultName(definition: WorkflowDefinition): string {
  return firstFree('resultado', usedNames(definition)).name;
}

/** The first free block id with the prefix (`calc_1`, `td_1`), with its number (for the name "Cálculo 1"). */
export function freeBlockId(definition: WorkflowDefinition, prefix: string): { name: string; number: number } {
  return firstFree(prefix, new Set(definition.root.nodes.map((node) => node.id)));
}
