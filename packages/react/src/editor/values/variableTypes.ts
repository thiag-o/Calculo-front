// The types of the variables of a workflow, for showing their values (the preview, the "Calcular" result and the canvas).
// Only the API types are used here: this sub-vertical is a leaf and imports nothing from the rest of the editor (ADR 0057).
import type { Schemas } from '../../api';

type DataType = Schemas['DataType'];
type Definition = Schemas['Draft']['definition'];
type DefinitionNode = Definition['root']['nodes'][number];
type Symbol = Schemas['Draft']['symbols'][number];

/** Every node of the definition, the ones inside groups too, in the order of the definition. */
export function allNodes(definition: Definition): DefinitionNode[] {
  const nodes: DefinitionNode[] = [];
  const visit = (list: readonly DefinitionNode[]) => {
    for (const node of list) {
      nodes.push(node);
      if (node.type === 'group') visit(node.nodes);
    }
  };
  visit(definition.root.nodes);
  return nodes;
}

/**
 * The type of each linear variable: from the symbols of the analysis (the batch source and the Source blocks, whose types
 * come from the catalog), then from the definition itself (inputs, Calculation outputs and Decision Table results, the
 * ones inside groups too), which wins.
 */
export function variableTypes(definition: Definition, symbols: readonly Symbol[] = []): Map<string, DataType> {
  const types = new Map<string, DataType>();
  for (const symbol of symbols) if (symbol.cardinality === 'linear' && symbol.type !== null) types.set(symbol.name, symbol.type);
  for (const input of definition.root.inputs) if (input.cardinality === 'linear') types.set(input.name, input.type);
  for (const node of allNodes(definition)) {
    if (node.type === 'calculation') types.set(node.output.name, node.output.type);
    else if (node.type === 'decision_table') for (const result of node.results) types.set(result.name, result.type);
  }
  return types;
}
