import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type InfiniteData, type QueryClient } from '@tanstack/react-query';
import { ApiError, dataOrError, useApiClient, type Schemas } from '../../api';
import { isSameSessionData, sessionDataMark } from '../../session';
import { EXECUTIONS_KEY } from '../api';

/** A schedule (generated from the contract). */
export type Schedule = Schemas['Schedule'];
/** The body of the creation and of the change of a schedule (generated from the contract). */
export type ScheduleData = Schemas['ScheduleData'];
/** A page of the schedule list (generated from the contract). */
type ScheduleList = Schemas['ScheduleList'];

/** Permission to create, change, turn on or off and remove schedules (E7-14). */
export const SCHEDULE_PERMISSION = 'executions.schedule';
/** Permission to read the schedules (`GET /v1/schedules`). */
export const SCHEDULES_VIEW_PERMISSION = 'executions.view';

/**
 * Cache keys, under `['executions', 'schedules', …]` (ADR 0063): the list of the tenant or of one workflow, from the first
 * page, and the saved draft the schedule dialog reads (its own key, read again at every opening).
 */
export const SCHEDULES_KEY = [...EXECUTIONS_KEY, 'schedules'] as const;
export const SCHEDULE_LISTS_KEY = [...SCHEDULES_KEY, 'list'] as const;

export function scheduleListKey(workflowId?: string) {
  return [...SCHEDULE_LISTS_KEY, workflowId ? { workflowId } : {}] as const;
}

export function scheduleDraftKey(workflowId: string) {
  return [...SCHEDULES_KEY, 'saved-draft', workflowId] as const;
}

/**
 * The schedules of the tenant (`GET /v1/schedules`) or of one workflow (`workflowId`), in name order, 50 per page:
 * `fetchNextPage` brings the next page.
 */
export function useScheduleList(workflowId?: string, options: { enabled?: boolean } = {}) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: scheduleListKey(workflowId),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(
        client.GET('/v1/schedules', {
          params: { query: { ...(workflowId ? { workflow_id: workflowId } : {}), ...(pageParam ? { cursor: pageParam } : {}) } },
          signal,
        }),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled: options.enabled ?? true,
  });
}

/**
 * The saved draft (`GET /v1/workflows/{id}/draft`) the schedule dialog freezes: its revision, the declared parameters and
 * the problems. Read again at every opening (`gcTime: 0`), because a schedule runs what is saved, never what the editor
 * still holds.
 */
export function useScheduleDraft(workflowId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: scheduleDraftKey(workflowId),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/workflows/{id}/draft', { params: { path: { id: workflowId } }, signal })),
    gcTime: 0,
    staleTime: 0,
    // The dialog that reads it is open on the revision it showed: a refresh on focus would change it under the person's hands.
    refetchOnWindowFocus: false,
  });
}

/** Puts the schedule the API returned in every loaded list that has it, in place. */
function replaceInLists(queryClient: QueryClient, schedule: Schedule) {
  queryClient.setQueriesData<InfiniteData<ScheduleList>>({ queryKey: SCHEDULE_LISTS_KEY }, (data) =>
    data
      ? {
          ...data,
          pages: data.pages.map((page) => ({
            ...page,
            items: page.items.map((item) => (item.id === schedule.id ? schedule : item)),
          })),
        }
      : data,
  );
}

/**
 * Creates a schedule of the workflow (`POST /v1/workflows/{id}/schedules`); the lists are fetched again. Errors are
 * `ApiError`: `409 schedule_name_taken`, `too_many_schedules`, `draft_conflict` (with `current_revision`),
 * `draft_has_problems` (with `problems`), `no_batch_source`, `workflow_busy`; `422 missing_parameter`,
 * `invalid_parameter` (by parameter in `fields`) and `invalid_data` (by field).
 */
export function useCreateSchedule(workflowId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: ScheduleData) =>
      dataOrError(client.POST('/v1/workflows/{id}/schedules', { params: { path: { id: workflowId } }, body })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (_schedule, _body, mark) => {
      // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) writes nothing (ADR 0015).
      if (!isSameSessionData(queryClient, mark)) return;
      void queryClient.invalidateQueries({ queryKey: SCHEDULE_LISTS_KEY });
    },
  });
}

/** The errors of a change that say the schedule the screen holds is out of date. */
const REFRESH_LISTS_CODES: ReadonlySet<string> = new Set(['not_found', 'draft_conflict', 'draft_has_problems', 'schedule_name_taken']);

/**
 * Changes a schedule (`PUT /v1/schedules/{id}`), replacing every field: the dialog, the "Ativo" switch and "Usar a revisão
 * atual" all send the whole body. The schedule returned goes into the loaded lists in place, and they are fetched again.
 * Errors as in the creation, plus `404 not_found` (the schedule was removed: the lists are fetched again).
 */
export function useUpdateSchedule() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: ScheduleData }) =>
      dataOrError(client.PUT('/v1/schedules/{id}', { params: { path: { id } }, body })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (schedule, _variables, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      replaceInLists(queryClient, schedule);
      void queryClient.invalidateQueries({ queryKey: SCHEDULE_LISTS_KEY });
    },
    onError: (error, _variables, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      // The schedule on screen is older than the one in the API (removed, re-frozen or renamed by someone else): the lists are
      // read again, and what shows the schedule takes it from them, so sending it again does not repeat the conflict.
      if (error instanceof ApiError && REFRESH_LISTS_CODES.has(error.code)) void queryClient.invalidateQueries({ queryKey: SCHEDULE_LISTS_KEY });
    },
  });
}

/**
 * Removes a schedule (`DELETE /v1/schedules/{id}`). The executions it already triggered stay, with the name it had. A
 * `404` means it was already removed: the lists are fetched again either way.
 */
export function useDeleteSchedule() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/schedules/{id}', { params: { path: { id } } })),
    onMutate: () => sessionDataMark(queryClient),
    onSettled: (_data, error, _id, mark) => {
      if (!isSameSessionData(queryClient, mark)) return undefined;
      if (error && !(error instanceof ApiError && error.code === 'not_found')) return undefined;
      return queryClient.invalidateQueries({ queryKey: SCHEDULE_LISTS_KEY });
    },
  });
}

/** The body that keeps a schedule as it is (the frozen revision included), with the changes given. */
export function scheduleBody(schedule: Schedule, changes: Partial<ScheduleData> = {}): ScheduleData {
  return {
    revision: schedule.draft_revision,
    name: schedule.name,
    enabled: schedule.enabled,
    recurrence: schedule.recurrence,
    parameters: schedule.parameters,
    ...changes,
  };
}
