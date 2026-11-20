import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, dataOrError, useApiClient, type Schemas } from '../api';
import { sameSessionData, sessionDataMark } from '../session';

/** A workflow in the list, with the draft summary (generated from the contract). */
export type WorkflowSummary = Schemas['WorkflowSummary'];
/** A workflow, with the draft summary and who created it (generated from the contract). */
export type Workflow = Schemas['Workflow'];
/** Body for creating a workflow (generated from the contract). */
export type NewWorkflow = Schemas['NewWorkflow'];
/** Body for changing a workflow's name and objective (generated from the contract). */
export type WorkflowUpdate = Schemas['WorkflowUpdate'];

/** Filter of the workflow list. */
export interface WorkflowListFilter {
  /** Part of the name (the API ignores case). Empty or blank: no filter. */
  name?: string;
  /** Items per page (1 to 200). Without it, the API default. */
  limit?: number;
}

/**
 * Cache keys (plan, "Contrato do épico 4"; ADR 0033 and 0034). They do not carry the tenant: switching tenant resets
 * the cache (ADR 0015). The draft sits under the workflow, so removing the workflow takes the draft along.
 */
export const WORKFLOWS_KEY = ['workflows'] as const;
export const WORKFLOW_LISTS_KEY = [...WORKFLOWS_KEY, 'list'] as const;

/** The normalized filter: the same search always gives the same key. */
function normalizedFilter(filter: WorkflowListFilter): WorkflowListFilter {
  const name = filter.name?.trim() ?? '';
  return { ...(name ? { name } : {}), ...(filter.limit !== undefined ? { limit: filter.limit } : {}) };
}

export function workflowListKey(filter: WorkflowListFilter = {}) {
  return [...WORKFLOW_LISTS_KEY, normalizedFilter(filter)] as const;
}

export function workflowKey(id: string) {
  return [...WORKFLOWS_KEY, id] as const;
}

/** The draft of a workflow, under its key (the editor's queries use it). */
export function workflowDraftKey(id: string) {
  return [...workflowKey(id), 'draft'] as const;
}

/**
 * The tenant workflows (`GET /v1/workflows`), the most recently changed first, paginated by cursor: `fetchNextPage`
 * brings the next page. While a new filter loads, the previous result stays on screen (`isPlaceholderData`).
 */
export function useWorkflowList(filter: WorkflowListFilter = {}) {
  const client = useApiClient();
  const query = normalizedFilter(filter);
  return useInfiniteQuery({
    queryKey: workflowListKey(query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(client.GET('/v1/workflows', { params: { query: { ...query, ...(pageParam ? { cursor: pageParam } : {}) } }, signal })),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    placeholderData: keepPreviousData,
  });
}

/** One workflow (`GET /v1/workflows/{id}`), with the draft summary. */
export function useWorkflow(id: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: workflowKey(id),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/workflows/{id}', { params: { path: { id } }, signal })),
  });
}

/** Creates a workflow with the empty draft (`POST /v1/workflows`). The new one goes to the cache and the lists are fetched again. */
export function useCreateWorkflow() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewWorkflow) => dataOrError(client.POST('/v1/workflows', { body })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (workflow, _vars, mark) => {
      // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) writes nothing (ADR 0015).
      if (mark === undefined || !sameSessionData(queryClient, mark)) return undefined;
      queryClient.setQueryData(workflowKey(workflow.id), workflow);
      return queryClient.invalidateQueries({ queryKey: WORKFLOW_LISTS_KEY });
    },
  });
}

/**
 * Replaces a workflow's name and objective (`PUT /v1/workflows/{id}`). The answer goes to the cache (the draft does not
 * change) and the lists are fetched again. `not_found`: the workflow is gone, so the lists are fetched again too.
 */
export function useUpdateWorkflow() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: WorkflowUpdate }) =>
      dataOrError(client.PUT('/v1/workflows/{id}', { params: { path: { id } }, body })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (workflow, _vars, mark) => {
      // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) writes nothing (ADR 0015).
      if (mark === undefined || !sameSessionData(queryClient, mark)) return undefined;
      queryClient.setQueryData(workflowKey(workflow.id), workflow);
      return queryClient.invalidateQueries({ queryKey: WORKFLOW_LISTS_KEY });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'not_found') void queryClient.invalidateQueries({ queryKey: WORKFLOW_LISTS_KEY });
    },
  });
}

/**
 * Removes a workflow and its draft (`DELETE /v1/workflows/{id}`). On success the workflow and its draft leave the cache
 * (without being fetched again) and the lists are fetched again. The caller leaves the workflow's screens in the
 * `mutate` `onSuccess`.
 */
export function useDeleteWorkflow() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/workflows/{id}', { params: { path: { id } } })),
    onSuccess: (_, id) => {
      queryClient.removeQueries({ queryKey: workflowKey(id) });
      return queryClient.invalidateQueries({ queryKey: WORKFLOW_LISTS_KEY });
    },
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'not_found') void queryClient.invalidateQueries({ queryKey: WORKFLOW_LISTS_KEY });
    },
  });
}
