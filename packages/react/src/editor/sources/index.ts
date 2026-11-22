// Sub-vertical "sources" of the "editor" vertical (ADR 0003; E5-16): the properties of the batch source (F63) and of the
// Source block (F64). They read the catalog (datasets and variables) through catalog/index.ts and the draft only through
// useDraftEditor (ADR 0042).

// The properties of a Source block (E5-18), for the Propriedades panel (F69).
export { SourceBlockProperties } from './source-block/SourceBlockProperties';
export type { SourceBlockPropertiesProps } from './source-block/SourceBlockProperties';
export { findSourceNode, locateNode, updateSourceNode } from './source-block/sourceNode';
export type { SourceNode, NodePlace } from './source-block/sourceNode';
// The defaults of a new Linear Fonte (the first variable as the ordering, the dataset variables as the outputs, "Gerar erro"
// in both policies), used by the canvas to include a block (ADR 0059).
export { defaultOutputs, defaultOrder, toLinearMode } from './source-block/sourceNode';

// The filters of a source, also used by the batch source (F63): operator by the variable's type, value in the Brazilian
// pattern, ENTRE with two fields, EM with a list and `@` with the epic 6 notice.
export { FilterList, newFilter, variableOptionLabel } from './filters/FilterList';
export type { FilterListProps, FilterEntry, FilterVariable } from './filters/FilterList';
export {
  FILTER_OPERATORS,
  FILTERS_MAX,
  OPERATOR_LABELS,
  PARAMETER_NOTICE,
  operatorsFor,
  valuesFor,
  toLiteral,
  fromLiteral,
} from './filters/filterRules';
export type { FilterOperator } from './filters/filterRules';
