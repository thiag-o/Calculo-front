import type { ReactNode } from 'react';
import { useDraftEditor } from '../draft';
import { CalculationProperties } from './CalculationProperties';
import type { DecisionTableNode } from './definition';
import { InputsProperties } from './InputsProperties';
import { OutputProperties } from './OutputProperties';
import { WorkflowProperties } from './workflow';

export interface PropertiesPanelProps {
  /** The properties of a Decision Table (they belong to the grid, F54). Without it, a selected table shows nothing. */
  decisionTable?: (node: DecisionTableNode) => ReactNode;
}

/**
 * The Propriedades panel: the form of the selected item. Nothing selected shows the workflow settings; the inputs, the
 * output and each Calculation have their own form.
 */
export function PropertiesPanel({ decisionTable }: PropertiesPanelProps) {
  const { definition, selection } = useDraftEditor();
  const { item } = selection;
  if (item.type === 'inputs') return <InputsProperties />;
  if (item.type === 'output') return <OutputProperties />;
  if (item.type === 'node') {
    const node = definition.root.nodes.find((candidate) => candidate.id === item.id);
    if (node?.type === 'calculation') return <CalculationProperties key={node.id} node={node} />;
    if (node?.type === 'decision_table') return <>{decisionTable?.(node) ?? null}</>;
  }
  return <WorkflowProperties />;
}
