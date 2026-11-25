import { useInfiniteQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas, type operations } from '../../api';
import { executionKey } from '../api';

/** The summary of the comparison with the reference file (generated from the contract). */
export type ComparisonSummary = Schemas['ComparisonSummary'];
/** One compared record, with the different fields (generated from the contract). */
export type ComparisonRecord = Schemas['ComparisonRecord'];
/** The result of one record in the comparison (generated from the contract). */
export type ComparisonOutcome = Schemas['ComparisonOutcome'];
/** A different field, with the expected value (from the file) and the obtained one (generated from the contract). */
export type ComparisonField = Schemas['ComparisonField'];

type ComparisonQuery = NonNullable<operations['list_comparison_records']['parameters']['query']>;

/** The outcomes asked, sorted and without repeats: the same choice always gives the same key. Empty: every outcome. */
function normalizedOutcomes(outcomes: readonly ComparisonOutcome[]): ComparisonOutcome[] {
  return [...new Set(outcomes)].sort();
}

/** Every page of the diff of the execution, whatever the filter: `['executions', id, 'comparison']`. */
export function comparisonListsKey(id: string) {
  return [...executionKey(id), 'comparison'] as const;
}

/** The diff with the outcome filter: `['executions', id, 'comparison', {outcomes}]` (ADR 0063 and 0066). */
export function comparisonRecordsKey(id: string, outcomes: readonly ComparisonOutcome[] = []) {
  return [...comparisonListsKey(id), { outcomes: normalizedOutcomes(outcomes) }] as const;
}

/** The `GET /v1/executions/{id}/comparison/records` parameters for the outcomes and the page cursor. */
export function buildComparisonQuery(outcomes: readonly ComparisonOutcome[], cursor: string | null): ComparisonQuery {
  const query: ComparisonQuery = {};
  if (outcomes.length > 0) query.outcome = normalizedOutcomes(outcomes);
  if (cursor) query.cursor = cursor;
  return query;
}

/**
 * The diff of a simulation with its reference file (`GET /v1/executions/{id}/comparison/records`, `simulations.run` or
 * `traces.view`), 50 per page, paginated by cursor. It exists only once the `comparing` ended (before that, `404
 * comparison_not_available`), and it never changes afterwards. Without `enabled` nothing is asked.
 */
export function useComparisonRecords(id: string, outcomes: readonly ComparisonOutcome[], enabled: boolean) {
  const client = useApiClient();
  const asked = normalizedOutcomes(outcomes);
  return useInfiniteQuery({
    queryKey: comparisonRecordsKey(id, asked),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(
        client.GET('/v1/executions/{id}/comparison/records', {
          params: { path: { id }, query: buildComparisonQuery(asked, pageParam) },
          signal,
        }),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled,
    staleTime: Infinity,
  });
}
