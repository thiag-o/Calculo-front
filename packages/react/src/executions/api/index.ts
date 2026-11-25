// Sub-vertical "api" of "executions" (ADR 0063): the execution routes of the contract, with the cache keys, and the states as people
// see them. Used by the list and the trigger (F101) and by the panel (F102), inside the vertical.
export {
  EXECUTIONS_KEY,
  EXECUTION_LISTS_KEY,
  LIST_REFRESH_MS,
  buildListQuery,
  executionKey,
  executionListKey,
  useExecutionList,
  useTriggerExecution,
} from './queries';
export type { Execution, ExecutionListFilter, NewExecution } from './queries';
export {
  FINAL_STATUSES,
  MODE_CHOICES,
  NO_DELIVERY_PRESENTATION,
  STATUS_CHOICES,
  STATUS_PRESENTATION,
  isRunning,
  statusPresentation,
} from './status';
export type { ExecutionMode, ExecutionStatus, StatusChoice, StatusPresentation } from './status';
// The panel of one execution (F102): the execution refreshed every 2 s until a final state, the cancel, the decision on
// the pre-validation alert (F125) and the CSV download.
export {
  PANEL_REFRESH_MS,
  fallbackFileName,
  outputFileName,
  useCancelExecution,
  useDownloadExecutionOutput,
  useExecution,
  useProceedExecution,
} from './execution';
export type { ExecutionOutputFile } from './execution';
// The records of an execution and the stored trace of each one (F102, `traces.view`).
export {
  buildRecordsQuery,
  executionRecordKey,
  executionRecordListsKey,
  executionRecordsKey,
  useExecutionRecord,
  useExecutionRecords,
} from './records';
export type {
  ExecutionRecord,
  ExecutionRecordFilter,
  ExecutionRecordSummary,
  ExecutionRecordTrace,
  RecordFailureCode,
  RecordStatus,
} from './records';
// The frozen definition of an execution, for the names and types in the trace (F118, `traces.view`).
export { executionDefinitionKey, useExecutionDefinition } from './definition';
export type { ExecutionDefinition } from './definition';
