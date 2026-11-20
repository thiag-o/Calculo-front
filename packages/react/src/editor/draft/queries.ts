import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { dataOrError, useApiClient, type ApiClient, type Schemas } from '../../api';
import { sameSessionData, sessionDataMark } from '../../session';
import { WORKFLOW_LISTS_KEY, workflowDraftKey, workflowKey } from '../../workflows';

/** The draft of a workflow, with the problems and the symbols (generated from the contract). */
export type Draft = Schemas['Draft'];
/** The workflow definition kept in the draft (generated from the contract). */
export type WorkflowDefinition = Schemas['WorkflowDefinition'];
/** A problem of the definition (generated from the contract). */
export type WorkflowProblem = Schemas['WorkflowProblem'];
/** A variable the definition offers (generated from the contract). */
export type DraftSymbol = Schemas['Symbol'];
/** What a node reads in all its formulas (generated from the contract). */
export type Dependency = Schemas['Dependency'];
/** The problems and the symbols of a definition (generated from the contract). */
export type Analysis = Schemas['Analysis'];

/**
 * The editor's saves still running, per QueryClient and workflow. Reading the draft waits for them: an editor reopened
 * right after closing (its last save still on the way) would otherwise read the revision before that save and get a
 * `409 draft_conflict` against its own save.
 */
const savesInFlight = new WeakMap<QueryClient, Map<string, Set<Promise<unknown>>>>();
/** How many saves of each workflow have started, per QueryClient: a read that saw this number change reads again. */
const savesStarted = new WeakMap<QueryClient, Map<string, number>>();

function startedSaves(queryClient: QueryClient, workflowId: string): number {
  return savesStarted.get(queryClient)?.get(workflowId) ?? 0;
}

/** Registers a save of the editor (the whole run, retries included) until it settles. */
export function trackDraftSave(queryClient: QueryClient, workflowId: string, saving: Promise<unknown>): void {
  const started = savesStarted.get(queryClient) ?? new Map<string, number>();
  savesStarted.set(queryClient, started);
  started.set(workflowId, (started.get(workflowId) ?? 0) + 1);
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

/**
 * Reads the draft after the saves of the workflow still running. A read never ends older than what the editor already
 * knows: if a save started while the `GET` was on the way (a prefetch, or the editor opened while another one closed),
 * the draft is read again after it; and an answer with a lower revision than the cached draft (written by a save that
 * finished meanwhile) gives way to the cached one. A read that the session data left meanwhile (sign-out, `401`, tenant
 * switch, another person) is of the previous one: it is read again, now under the session in the module.
 */
async function readDraft(queryClient: QueryClient, client: ApiClient, workflowId: string, signal: AbortSignal): Promise<Draft> {
  for (;;) {
    await draftSavesSettled(queryClient, workflowId);
    const started = startedSaves(queryClient, workflowId);
    const mark = sessionDataMark(queryClient);
    const read = await dataOrError(client.GET('/v1/workflows/{id}/draft', { params: { path: { id: workflowId } }, signal }));
    if (startedSaves(queryClient, workflowId) !== started || !sameSessionData(queryClient, mark)) continue;
    const cached = queryClient.getQueryData<Draft>(workflowDraftKey(workflowId));
    return cached && cached.workflow_id === read.workflow_id && cached.revision > read.revision ? cached : read;
  }
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
 * Starts reading the draft before the editor opens (e.g. while the person points at "Abrir editor"). The editor that opens
 * meanwhile takes this read, which never brings a revision older than the cached one (see `readDraft`).
 */
export function prefetchDraft(queryClient: QueryClient, client: ApiClient, workflowId: string): Promise<void> {
  return queryClient.prefetchQuery({
    queryKey: workflowDraftKey(workflowId),
    queryFn: ({ signal }) => readDraft(queryClient, client, workflowId, signal),
  });
}

/**
 * Saves the draft over `revision` (`PUT /v1/workflows/{id}/draft`). It is not a `useMutation`: the editor saves by itself,
 * one save at a time, and also when it closes, after the screen is gone. On success the draft goes to the cache, the
 * workflow (its draft summary) and the lists are fetched again when someone shows them. Errors are `ApiError`, such as
 * `409 draft_conflict` (with `current_revision`), `422 invalid_data` and `413 definition_too_large`. A save that answers
 * after the session data left the module (sign-out, `401`, tenant switch, another person) writes nothing to the cache:
 * it is of the previous one, and the cache is already the next one's (`sessionDataMark`).
 */
export async function saveDraft(
  queryClient: QueryClient,
  client: ApiClient,
  workflowId: string,
  body: Schemas['DraftUpdate'],
): Promise<Draft> {
  const mark = sessionDataMark(queryClient);
  const draft = await dataOrError(client.PUT('/v1/workflows/{id}/draft', { params: { path: { id: workflowId } }, body }));
  if (!sameSessionData(queryClient, mark)) return draft;
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
