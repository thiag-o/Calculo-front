// The types of the variables of a workflow, for showing their values (the preview, the "Calcular" result and the canvas).
// Only the API types and the pure reads of `../definition` (a leaf too) are used here: this sub-vertical imports nothing else
// from the rest of the editor (ADR 0057).
import type { Schemas } from '../../api';
import { allNodes } from '../definition';

export { allNodes };

type DataType = Schemas['DataType'];
type Definition = Schemas['Draft']['definition'];
type Symbol = Schemas['Draft']['symbols'][number];

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
