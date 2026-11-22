import { useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { dataOrError, useApiClient, type Schemas } from '../../api';
import { isSameSessionData, onSessionDataCleared, sessionDataMark, useSession } from '../../session';
import { workflowDraftKey } from '../../workflows';
import type { ParameterValue } from '../../executions';
import type { WorkflowDefinition } from '../draft';

/** The preview of the saved draft (generated from the contract). */
export type Preview = Schemas['Preview'];
export type PreviewSource = Schemas['PreviewSource'];
export type PreviewGroup = Schemas['PreviewGroup'];
export type PreviewRecord = Schemas['PreviewRecord'];

/** The sample size asked for (design §6: 20 by default). */
export const PREVIEW_SAMPLE_SIZE = 20;

/** One "Rodar prévia": the saved revision and the definition it was saved from (to name the blocks). */
export interface PreviewRequest {
  /** Grows on each "Rodar prévia": two runs of the same revision are two runs. */
  id: number;
  revision: number;
  definition: WorkflowDefinition;
  /** The `parameters` of the run, read from the parameters form (E6-22). */
  parameters: Record<string, ParameterValue>;
}

/** The last preview of a workflow, kept while the module is open (the "Calcular" tab chooses a record from its sample). */
export interface LastPreview {
  revision: number;
  /** The definition that ran: the names of the blocks and groups are read from it. */
  definition: WorkflowDefinition;
  /** The `parameters` the preview ran with: a change only in the form makes the result out of date (D42). */
  parameters: Record<string, ParameterValue>;
  preview: Preview;
}

/**
 * The last preview of each workflow, only in memory (design §1, principle 3: nothing in `localStorage`): it lives with the
 * module's QueryClient, under the person and the tenant, and is forgotten when the session data leaves the module
 * (`onSessionDataCleared`). Like the values of "Calcular", it survives the tab closing (only the open tab is mounted).
 */
interface Store {
  previews: Map<string, LastPreview>;
  listeners: Set<() => void>;
}

const stores = new WeakMap<QueryClient, Store>();

function storeOf(queryClient: QueryClient): Store {
  let store = stores.get(queryClient);
  if (!store) {
    const created: Store = { previews: new Map(), listeners: new Set() };
    stores.set(queryClient, created);
    onSessionDataCleared(queryClient, () => {
      created.previews.clear();
      for (const listener of [...created.listeners]) listener();
    });
    store = created;
  }
  return store;
}

function keep(store: Store, key: string, preview: LastPreview) {
  store.previews.set(key, preview);
  for (const listener of [...store.listeners]) listener();
}

function usePreviewKey(workflowId: string): string {
  const session = useSession();
  return `${session.data?.user.id ?? ''}:${session.data?.current_tenant?.id ?? ''}:${workflowId}`;
}

/** The last preview of the workflow run in this module (by this person, in this tenant), or `null`. */
export function useLastPreview(workflowId: string): LastPreview | null {
  const queryClient = useQueryClient();
  const key = usePreviewKey(workflowId);
  const store = storeOf(queryClient);
  const subscribe = useCallback(
    (listener: () => void) => {
      store.listeners.add(listener);
      return () => {
        store.listeners.delete(listener);
      };
    },
    [store],
  );
  return useSyncExternalStore(subscribe, () => store.previews.get(key) ?? null);
}

/**
 * Runs the preview of the saved draft (`POST /v1/workflows/{id}/draft/previews`, E5-11). Nothing is saved on the server,
 * so it is a query (ADR 0025): the key carries the run number and the result leaves the cache as soon as nobody reads it
 * (`gcTime: 0`); the answer is kept as the workflow's last preview (`useLastPreview`). Errors are `ApiError`:
 * `409 draft_conflict`, `draft_has_problems`, the `422` of a parameter (`missing_parameter`, `invalid_parameter`), `no_batch_source`, `connection_credential_unreadable` and the `422` of the
 * connection. A read error (`schema_drift`, `source_read_denied`, `parameter_table_rows`) is a `200` with `error`.
 */
export function usePreview(workflowId: string, request: PreviewRequest | null) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const key = usePreviewKey(workflowId);
  return useQuery({
    queryKey: [...workflowDraftKey(workflowId), 'preview', request?.id ?? null] as const,
    queryFn: async ({ signal }) => {
      const mark = sessionDataMark(queryClient);
      const preview = await dataOrError(
        client.POST('/v1/workflows/{id}/draft/previews', {
          params: { path: { id: workflowId } },
          body: { revision: request!.revision, sample_size: PREVIEW_SAMPLE_SIZE, parameters: request!.parameters },
          signal,
        }),
      );
      // An answer of the previous person or tenant is never kept for the next one.
      if (isSameSessionData(queryClient, mark)) keep(storeOf(queryClient), key, { revision: request!.revision, definition: request!.definition, parameters: request!.parameters, preview });
      return preview;
    },
    enabled: request !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
