// Sub-vertical "sources/batch-source" of the "editor" vertical (ADR 0003, E5-16): the batch source of the workflow (E5-17),
// with its properties (dataset, variables brought, key, filters and order) and the Fonte do lote bar of the canvas. It
// reads and changes the draft only through useDraftEditor (ADR 0042) and the catalog only through catalog/index.ts.
export { BatchSourceFields } from './BatchSourceFields';
export type { BatchSourceFieldsProps, BatchSourceFiltersProps, FilterVariable } from './BatchSourceFields';
export { BatchSourceProperties } from './BatchSourceProperties';
export type { BatchSourcePropertiesProps } from './BatchSourceProperties';
export { BatchSourceBar } from './BatchSourceBar';
export type { BatchSourceBarProps } from './BatchSourceBar';
export { DatasetSearch } from './DatasetSearch';
export type { DatasetSearchProps } from './DatasetSearch';
export {
  BATCH_SOURCE_PATH,
  INPUTS_PATH,
  batchSourceBarRows,
  isBatchSourceCode,
  withBatchSource,
  withoutBatchSource,
} from './batchSource';
export type { BatchSource, BatchSourceBarRow, BatchSourceFilter, BatchSourceOrder, SourceOutput } from './batchSource';
export {
  BATCH_SOURCE_NOTE,
  BATCH_SOURCE_TITLE,
  CHOOSE_DATASET_NOTE,
  DECLARED_INPUTS_NOTE,
  inputsCount,
  variablesCount,
} from './messages';
