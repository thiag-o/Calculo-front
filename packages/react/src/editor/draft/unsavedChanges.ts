import { useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { Session } from '../../session';
import { ApiError } from '../../api';
import { workflowKey, type Workflow } from '../../workflows';
import type { WorkflowDefinition } from './queries';

/**
 * A change the editor could not save when it closed (the save on close failed). It stays in the module's memory, never
 * in `localStorage` nor `sessionStorage`: the next screen says so with "Voltar ao editor", and the editor reopened on
 * that workflow starts from it and saves it again.
 */
export interface UnsavedDraftChange {
  workflowId: string;
  /** The workflow name when the save failed (from the cache), for the notice. */
  workflowName: string | null;
  /** Who was editing (user and tenant, `draftOwner`): the change is only offered back to them. */
  owner: string;
  /** The definition that was not saved. */
  definition: WorkflowDefinition;
  /** The draft revision the change was made over: saving again over it keeps the conflict check. */
  revision: number;
  /** Why the save failed. */
  error: unknown;
  /**
   * Whether saving again may work (`isRecoverableSaveError`): no connection, a server error (5xx) or the conflict. If
   * not (invalid definition, no permission, workflow removed), the next screen tells why, without "Voltar ao editor".
   */
  recoverable: boolean;
}

/**
 * Whether a save that failed with this error may work later: no answer (network), a server error (5xx) or the
 * `409 draft_conflict` (the reopened editor shows the conflict and "Recarregar rascunho"). An invalid definition (422),
 * no permission (403) or a removed workflow (404) would fail again.
 */
export function isRecoverableSaveError(error: unknown): boolean {
  if (!(error instanceof ApiError)) return true;
  return error.status === 0 || error.status >= 500 || error.code === 'draft_conflict';
}

interface Store {
  changes: Map<string, UnsavedDraftChange>;
  /** The current list, a new array on each change (for `useSyncExternalStore`). */
  snapshot: readonly UnsavedDraftChange[];
  listeners: Set<() => void>;
}

/** One store per QueryClient: the module's memory, like its cache. Gone when the module is. */
const stores = new WeakMap<QueryClient, Store>();

function storeOf(queryClient: QueryClient): Store {
  let store = stores.get(queryClient);
  if (!store) {
    store = { changes: new Map(), snapshot: [], listeners: new Set() };
    stores.set(queryClient, store);
  }
  return store;
}

function publish(store: Store) {
  store.snapshot = [...store.changes.values()];
  for (const listener of store.listeners) listener();
}

/** Who is editing: the user and the tenant. A change of another user or tenant is never shown nor applied. */
export function draftOwner(session: Session | undefined): string {
  return session ? `${session.user.id}:${session.current_tenant.id}` : '';
}

/**
 * Keeps a change the save on close could not save (replaces an older one of the same workflow). Without an owner (the
 * session is not known) nothing is kept: nobody could be given it back.
 */
export function keepUnsavedChange(
  queryClient: QueryClient,
  change: Omit<UnsavedDraftChange, 'workflowName' | 'recoverable'> & { workflowName?: string | null },
): UnsavedDraftChange | null {
  if (change.owner === '') return null;
  const workflowName = change.workflowName ?? queryClient.getQueryData<Workflow>(workflowKey(change.workflowId))?.name ?? null;
  const store = storeOf(queryClient);
  const kept: UnsavedDraftChange = { ...change, workflowName, recoverable: isRecoverableSaveError(change.error) };
  store.changes.set(change.workflowId, kept);
  publish(store);
  return kept;
}

/** The change kept for a workflow, if it is of this owner and saving it again may work (an empty owner gets nothing). */
export function findUnsavedChange(queryClient: QueryClient, workflowId: string, owner: string): UnsavedDraftChange | null {
  if (owner === '') return null;
  const change = storeOf(queryClient).changes.get(workflowId);
  return change && change.owner === owner && change.recoverable ? change : null;
}

/**
 * Drops a kept change once it was saved by the reopened editor, discarded by "Recarregar rascunho", or told on a screen
 * that is gone (only that one: a newer change of the workflow stays).
 */
export function dropUnsavedChange(queryClient: QueryClient, change: UnsavedDraftChange): void {
  const store = storeOf(queryClient);
  if (store.changes.get(change.workflowId) !== change) return;
  store.changes.delete(change.workflowId);
  publish(store);
}

/** The changes kept for this owner (none without an owner), updated as saves on close fail and editors save them. */
export function useUnsavedDraftChanges(owner: string): readonly UnsavedDraftChange[] {
  const queryClient = useQueryClient();
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
  const all = useSyncExternalStore(subscribe, () => store.snapshot);
  return owner === '' ? [] : all.filter((change) => change.owner === owner);
}
