// Sub-vertical "parameters" of the "editor" vertical (ADR 0003; E6-16, E6-17): the declaration of the run parameters and
// the run settings of the workflow (error limit and trace level), shown in the workflow panel (properties/workflow). It
// reads and changes the draft only through useDraftEditor (ADR 0042) and uses the fields of properties/index.ts (ADR 0047).
export { ParametersSection } from './ParametersSection';
export { ExecutionSection } from './ExecutionSection';
