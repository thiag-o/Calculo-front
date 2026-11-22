// Pure reads of the definition of a workflow, shared by the sub-verticals of the editor (the groups, the properties, the
// sources and the values). Only the contract types and the draft's type: this folder is a leaf and holds no edit, no screen
// and no state; a function that changes the definition belongs to the sub-vertical that owns that edit.
import type { WorkflowDefinition } from '../draft';

/** Any node of the definition, at any depth: a Calculation, a Decision Table, a Fonte or a group. */
export type DefinitionNode = WorkflowDefinition['root']['nodes'][number];
export type GroupNode = Extract<DefinitionNode, { type: 'group' }>;

/** Where a node is: the node, its `path` (`root.nodes[2]`, `root.nodes[1].nodes[0]`) and the groups around it, outermost first. */
export interface NodePlace {
  node: DefinitionNode;
  path: string;
  groups: string[];
}

/** The names a node produces: a Calculation's output, a Decision Table's results, a linear Fonte's outputs, a group's Output. */
export function producedNames(node: DefinitionNode): string[] {
  switch (node.type) {
    case 'calculation':
      return [node.output.name];
    case 'decision_table':
      return node.results.map((result) => result.name);
    case 'source':
      return (node.mode === 'linear' ? node.outputs : []).map((output) => output.name);
    case 'group':
      return [...node.outputs];
  }
}

/** Every node of the definition, at any depth, depth first: a group comes right before the nodes inside it. */
export function allNodes(definition: WorkflowDefinition): DefinitionNode[] {
  const found: DefinitionNode[] = [];
  const visit = (nodes: readonly DefinitionNode[]) => {
    for (const node of nodes) {
      found.push(node);
      if (node.type === 'group') visit(node.nodes);
    }
  };
  visit(definition.root.nodes);
  return found;
}

/**
 * Each name that is a variable of the workflow (E4-10), once per use: inputs, list fields, the batch source and what each
 * Calculation, Decision Table and Fonte produces, in groups too. A group's Output repeats names declared inside it, so it
 * adds nothing.
 */
export function declaredVariableNames(definition: WorkflowDefinition): string[] {
  const names: string[] = [];
  for (const input of definition.root.inputs) {
    names.push(input.name);
    if (input.cardinality === 'multiple') for (const field of input.fields) names.push(field.name);
  }
  for (const output of definition.root.batch_source?.outputs ?? []) names.push(output.name);
  for (const node of allNodes(definition)) if (node.type !== 'group') names.push(...producedNames(node));
  return names;
}

/** How many times each variable name is used: more than once is a duplicate. */
export function variableNameCounts(definition: WorkflowDefinition): Map<string, number> {
  const counts = new Map<string, number>();
  for (const name of declaredVariableNames(definition)) counts.set(name, (counts.get(name) ?? 0) + 1);
  return counts;
}

/** Where a node is, at any depth. `null` when it is not there. */
export function locateNode(definition: WorkflowDefinition, id: string): NodePlace | null {
  const search = (nodes: readonly DefinitionNode[], prefix: string, groups: string[]): NodePlace | null => {
    for (const [index, node] of nodes.entries()) {
      const path = `${prefix}[${index}]`;
      if (node.id === id) return { node, path, groups };
      if (node.type === 'group') {
        const found = search(node.nodes, `${path}.nodes`, [...groups, node.id]);
        if (found) return found;
      }
    }
    return null;
  };
  return search(definition.root.nodes, 'root.nodes', []);
}
