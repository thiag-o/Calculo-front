import type { ReactNode } from 'react';
import { useDraftEditor } from '../draft';
import { CalculationProperties } from './CalculationProperties';
import { locateNode, type DecisionTableNode, type GroupNode, type SourceBlockNode } from './definition';
import { InputsProperties } from './InputsProperties';
import { OutputProperties } from './OutputProperties';
import { WorkflowProperties, type WorkflowPropertiesProps } from './workflow';

export interface PropertiesPanelProps extends WorkflowPropertiesProps {
  /** The properties of a Decision Table (they belong to the grid, F54). Without it, a selected table shows nothing. */
  decisionTable?: (node: DecisionTableNode) => ReactNode;
  /** The properties of a Source block (F64). Without it, a selected Fonte shows nothing. */
  sourceBlock?: (node: SourceBlockNode) => ReactNode;
  /** The properties of a group (F65). Without it, a selected group shows nothing. */
  group?: (node: GroupNode) => ReactNode;
  /**
   * The properties of the batch source, for the Fonte do lote bar (it takes the place of the Entradas bar, E5-17). Without
   * it, the bar shows the declared inputs form, which is empty.
   */
  batchSource?: () => ReactNode;
}

/**
 * The Propriedades panel: the form of the selected item, wherever the node is (also inside groups). Nothing selected shows
 * the workflow settings; the inputs, the output, each Calculation, Decision Table, Fonte and group have their own form.
 * With a batch source, the Entradas item is the Fonte do lote bar and shows its properties.
 */
export function PropertiesPanel({ decisionTable, sourceBlock, group, batchSource, renderFilters }: PropertiesPanelProps) {
  const { definition, selection } = useDraftEditor();
  const { item } = selection;
  if (item.type === 'inputs') {
    if (definition.root.batch_source && batchSource) return <>{batchSource()}</>;
    return <InputsProperties />;
  }
  if (item.type === 'output') return <OutputProperties />;
  if (item.type === 'node') {
    const node = locateNode(definition, item.id)?.node;
    if (node?.type === 'calculation') return <CalculationProperties key={node.id} node={node} />;
    if (node?.type === 'decision_table') return <>{decisionTable?.(node) ?? null}</>;
    if (node?.type === 'source') return <>{sourceBlock?.(node) ?? null}</>;
    if (node?.type === 'group') return <>{group?.(node) ?? null}</>;
  }
  return <WorkflowProperties renderFilters={renderFilters} />;
}
