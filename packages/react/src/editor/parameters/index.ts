// Sub-vertical "parameters" of the "editor" vertical (ADR 0003; E6-16, E6-17, E7-23): the declaration of the run parameters
// (with the allowed values as a list or as a query to a catalog dataset) and the run settings of the workflow (error limit,
// alert of empty fields of the pre-validation and trace level), shown in the workflow panel (properties/workflow). It reads
// and changes the draft only through useDraftEditor (ADR 0042), uses the fields of properties/index.ts (ADR 0047), and, for
// the query, the filters of sources/index.ts and the dataset search of sources/batch-source/index.ts.
export { ParametersSection } from './ParametersSection';
export { ExecutionSection } from './ExecutionSection';
