// Sub-vertical "properties" of the "editor" vertical (ADR 0003): the Propriedades panel, with the form of the selected item
// (workflow settings, declared inputs, output fields and Calculation). Every change goes to the draft through
// useDraftEditor().change (ADR 0042); each problem shows beside its field, by `path`.
export { PropertiesPanel } from './PropertiesPanel';
export type { PropertiesPanelProps } from './PropertiesPanel';
export { CalculationProperties } from './CalculationProperties';
export type { CalculationPropertiesProps } from './CalculationProperties';
export { InputsProperties } from './InputsProperties';
export { OutputProperties } from './OutputProperties';
export { WorkflowProperties } from './WorkflowProperties';

// The pieces the other block forms reuse (the Decision Table's, F54): the frame with the read-only reason, the fields bound
// to the definition, the policy selects with "Herdar do workflow", the segmented control and the problem paths.
export {
  PropertiesFrame,
  CommitTextField,
  PathSelect,
  RoundingModeField,
  ErrorPolicyField,
  SegmentedControl,
  useFocusOnSelection,
  useFieldsState,
  parseScale,
} from './fields';
export type { PropertiesFrameProps, PropertiesCategory, CommitTextFieldProps, PathSelectProps, SegmentedControlProps, SegmentedOption } from './fields';
export { analyzedNodePath, problemsAt, otherProblems, problemText } from './problemPaths';
export {
  INHERIT_LABEL,
  ERROR_POLICY_LABELS,
  ROUNDING_MODE_LABELS,
  NAME_RULE_MESSAGE,
  NAME_TOOLTIP,
} from './labels';
export { NAME_PATTERN, withType } from './definition';
