import { keepPreviousData, useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas, type operations } from '../../api';
import { isSameSessionData, sessionDataMark } from '../../session';
import { isRunning, type ExecutionMode, type ExecutionStatus } from './status';

/** A batch execution (generated from the contract). */
export type Execution = Schemas['Execution'];
/** Body of the trigger of a batch execution (generated from the contract). */
export type NewExecution = Schemas['NewExecution'];

type ExecutionListQuery = NonNullable<operations['list_executions']['parameters']['query']>;

/** Filter of the execution list. Empty: every execution of the tenant. */
export interface ExecutionListFilter {
  /** Only the executions of this workflow. */
  workflowId?: string;
  /** Only the executions in these states (none: all of them). */
  statuses?: readonly ExecutionStatus[];
  /** Only the batches or only the simulations (none: both). */
  mode?: ExecutionMode;
}

/** While an execution on the loaded pages is still running, the list asks the API again every 5 s (E6-20). */
export const LIST_REFRESH_MS = 5000;

/**
 * Cache keys, under `['executions', …]`. They do not carry the tenant: switching tenant resets the cache (ADR 0015).
 * Each filter is a list of its own, from the first page; one execution sits under its id (the panel, F102).
 */
export const EXECUTIONS_KEY = ['executions'] as const;
export const EXECUTION_LISTS_KEY = [...EXECUTIONS_KEY, 'list'] as const;

/** The normalized filter: the same choice always gives the same key (statuses without repetition, in order). */
function normalizedFilter(filter: ExecutionListFilter): ExecutionListFilter {
  const statuses = [...new Set(filter.statuses ?? [])].sort();
  return {
    ...(filter.workflowId ? { workflowId: filter.workflowId } : {}),
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(filter.mode ? { mode: filter.mode } : {}),
  };
}

export function executionListKey(filter: ExecutionListFilter = {}) {
  return [...EXECUTION_LISTS_KEY, normalizedFilter(filter)] as const;
}

export function executionKey(id: string) {
  return [...EXECUTIONS_KEY, id] as const;
}

/** The `GET /v1/executions` parameters for the filter and the page cursor. */
export function buildListQuery(filter: ExecutionListFilter, cursor: string | null): ExecutionListQuery {
  const query: ExecutionListQuery = {};
  if (filter.workflowId) query.workflow_id = filter.workflowId;
  if (filter.statuses && filter.statuses.length > 0) query.status = [...filter.statuses];
  if (filter.mode) query.mode = filter.mode;
  if (cursor) query.cursor = cursor;
  return query;
}

/**
 * The tenant executions (`GET /v1/executions`), newest first, paginated by cursor: `fetchNextPage` brings the next
 * page. While an execution on the loaded pages runs, every page is fetched again every 5 s; it stops once all of them
 * reached a final state, or once a fetch failed (the list says so and offers "Tentar de novo", which starts it again). While a new filter loads, the previous result stays on screen (`isPlaceholderData`).
 */
export function useExecutionList(filter: ExecutionListFilter = {}) {
  const client = useApiClient();
  const query = normalizedFilter(filter);
  return useInfiniteQuery({
    queryKey: executionListKey(query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(client.GET('/v1/executions', { params: { query: buildListQuery(query, pageParam) }, signal })),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    placeholderData: keepPreviousData,
    refetchInterval: (current) => {
      if (current.state.status === 'error') return false;
      const pages = current.state.data?.pages ?? [];
      return pages.some((page) => page.items.some((execution) => isRunning(execution.status))) ? LIST_REFRESH_MS : false;
    },
  });
}

/**
 * Triggers the batch execution of the saved draft (`POST /v1/workflows/{id}/executions`). The new execution (`pending`)
 * goes to the cache under its id and the lists are fetched again. Errors are `ApiError`: `409 draft_conflict` (with
 * `current_revision`), `409 draft_has_problems` (with `problems`), `409 no_batch_source`, and `422 missing_parameter` or
 * `invalid_parameter` (by parameter in `fields`).
 */
export function useTriggerExecution(workflowId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewExecution) =>
      dataOrError(client.POST('/v1/workflows/{id}/executions', { params: { path: { id: workflowId } }, body })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (execution, _body, mark) => {
      // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) writes nothing (ADR 0015).
      if (!isSameSessionData(queryClient, mark)) return;
      queryClient.setQueryData(executionKey(execution.id), execution);
      // Not awaited: the panel of the new execution opens without waiting for the lists.
      void queryClient.invalidateQueries({ queryKey: EXECUTION_LISTS_KEY });
    },
  });
}
