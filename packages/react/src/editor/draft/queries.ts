import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { dataOrError, useApiClient, type ApiClient, type Schemas } from '../../api';
import { WORKFLOW_LISTS_KEY, workflowDraftKey, workflowKey } from '../../workflows';

/** The draft of a workflow, with the problems and the symbols (generated from the contract). */
export type Draft = Schemas['Draft'];
/** The workflow definition kept in the draft (generated from the contract). */
export type WorkflowDefinition = Schemas['WorkflowDefinition'];
/** A problem of the definition (generated from the contract). */
export type WorkflowProblem = Schemas['WorkflowProblem'];
/** A variable the definition offers (generated from the contract). */
export type DraftSymbol = Schemas['Symbol'];
/** The problems and the symbols of a definition (generated from the contract). */
export type Analysis = Schemas['Analysis'];

/**
 * The editor's saves still running, per QueryClient and workflow. Reading the draft waits for them: an editor reopened
 * right after closing (its last save still on the way) would otherwise read the revision before that save and get a
 * `409 draft_conflict` against its own save.
 */
const savesInFlight = new WeakMap<QueryClient, Map<string, Set<Promise<unknown>>>>();

/** Registers a save of the editor (the whole run, retries included) until it settles. */
export function trackDraftSave(queryClient: QueryClient, workflowId: string, saving: Promise<unknown>): void {
  const byWorkflow = savesInFlight.get(queryClient) ?? new Map<string, Set<Promise<unknown>>>();
  savesInFlight.set(queryClient, byWorkflow);
  const saves = byWorkflow.get(workflowId) ?? new Set<Promise<unknown>>();
  byWorkflow.set(workflowId, saves);
  saves.add(saving);
  const done = () => {
    saves.delete(saving);
    if (saves.size === 0 && byWorkflow.get(workflowId) === saves) byWorkflow.delete(workflowId);
  };
  saving.then(done, done);
}

/** Resolves when no save of the workflow is running (a save that starts meanwhile is waited for too). */
export async function draftSavesSettled(queryClient: QueryClient, workflowId: string): Promise<void> {
  for (;;) {
    const saves = savesInFlight.get(queryClient)?.get(workflowId);
    if (!saves || saves.size === 0) return;
    await Promise.allSettled([...saves]);
  }
}

async function readDraft(queryClient: QueryClient, client: ApiClient, workflowId: string, signal: AbortSignal): Promise<Draft> {
  await draftSavesSettled(queryClient, workflowId);
  return dataOrError(client.GET('/v1/workflows/{id}/draft', { params: { path: { id: workflowId } }, signal }));
}

/**
 * The draft of a workflow (`GET /v1/workflows/{id}/draft`), under `['workflows', id, 'draft']` (ADR 0038). Always read
 * again when the editor opens (`refetchOnMount: 'always'`), after the saves of that workflow still running: the editor
 * starts from the fresh draft, never from the cache alone (see `isFetchedAfterMount`).
 */
export function useDraft(workflowId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useQuery({
    queryKey: workflowDraftKey(workflowId),
    queryFn: ({ signal }) => readDraft(queryClient, client, workflowId, signal),
    refetchOnMount: 'always',
    // The editor keeps its own copy of the definition: a refetch on focus would only spend the network.
    refetchOnWindowFocus: false,
  });
}

/**
 * Fetches the draft again, ignoring the cache ("Recarregar rascunho" after a `draft_conflict`), after the saves of the
 * workflow still running. The answer goes to the cache, under the draft key.
 */
export function fetchDraftAgain(queryClient: QueryClient, client: ApiClient, workflowId: string): Promise<Draft> {
  return queryClient.fetchQuery({
    queryKey: workflowDraftKey(workflowId),
    queryFn: ({ signal }) => readDraft(queryClient, client, workflowId, signal),
    staleTime: 0,
  });
}

/**
 * Saves the draft over `revision` (`PUT /v1/workflows/{id}/draft`). It is not a `useMutation`: the editor saves by itself,
 * one save at a time, and also when it closes, after the screen is gone. On success the draft goes to the cache, the
 * workflow (its draft summary) and the lists are fetched again when someone shows them. Errors are `ApiError`, such as
 * `409 draft_conflict` (with `current_revision`), `422 invalid_data` and `413 definition_too_large`.
 */
export async function saveDraft(
  queryClient: QueryClient,
  client: ApiClient,
  workflowId: string,
  body: Schemas['DraftUpdate'],
): Promise<Draft> {
  const draft = await dataOrError(client.PUT('/v1/workflows/{id}/draft', { params: { path: { id: workflowId } }, body }));
  queryClient.setQueryData(workflowDraftKey(workflowId), draft);
  // `exact`: only the workflow itself, not the draft just written under it.
  void queryClient.invalidateQueries({ queryKey: workflowKey(workflowId), exact: true });
  void queryClient.invalidateQueries({ queryKey: WORKFLOW_LISTS_KEY });
  return draft;
}

/** What to analyze: the definition at a given local version of the editor. */
export interface AnalysisTarget {
  version: number;
  definition: WorkflowDefinition;
}

/**
 * The analysis of a definition (`POST /v1/workflows/{id}/draft/analysis`): problems and symbols, nothing saved. A POST
 * without effect is a query (ADR 0025). The key carries the editor's local version, not the definition, and the result
 * leaves the cache as soon as nobody reads it (`gcTime: 0`): each version is analyzed once and never kept.
 */
export function useDraftAnalysis(workflowId: string, target: AnalysisTarget | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: [...workflowDraftKey(workflowId), 'analysis', target?.version ?? null] as const,
    queryFn: ({ signal }) =>
      dataOrError(
        client.POST('/v1/workflows/{id}/draft/analysis', {
          params: { path: { id: workflowId } },
          body: { definition: target!.definition },
          signal,
        }),
      ),
    enabled: target !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}

/** The API client and the QueryClient, for the saves that run outside the render (the timers and the save on close). */
export function useDraftClients() {
  return { client: useApiClient(), queryClient: useQueryClient() };
}
