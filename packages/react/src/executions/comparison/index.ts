// Sub-vertical "comparison" of "executions" (E7-26): the comparison of a simulation with its reference file, at the top
// of the panel (`detail/`): the summary, the counts by outcome and the diff by record with the trace drawer of `records/`.
export { ReferenceComparison } from './ReferenceComparison';
export type { ReferenceComparisonProps } from './ReferenceComparison';
export { comparisonListsKey, comparisonRecordsKey, useComparisonRecords } from './queries';
export type { ComparisonField, ComparisonOutcome, ComparisonRecord, ComparisonSummary } from './queries';
