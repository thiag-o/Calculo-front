import { useQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../../api';
import { EXECUTIONS_KEY } from '../api';

/** The saved draft of a workflow (generated from the contract). */
export type SavedDraft = Schemas['Draft'];

/**
 * The saved draft the trigger dialog runs, under `['executions', 'saved-draft', workflowId]`: its own key, apart from the
 * editor's `['workflows', id, 'draft']` (ADR 0038), because the dialog reads what is saved, never what the editor still
 * holds. Read again at every opening (`gcTime: 0`) and kept only while the dialog is open.
 */
export function savedDraftKey(workflowId: string) {
  return [...EXECUTIONS_KEY, 'saved-draft', workflowId] as const;
}

/** The saved draft (`GET /v1/workflows/{id}/draft`): revision, parameters and problems. */
export function useSavedDraft(workflowId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: savedDraftKey(workflowId),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/workflows/{id}/draft', { params: { path: { id: workflowId } }, signal })),
    gcTime: 0,
    staleTime: 0,
  });
}
