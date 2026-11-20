import { hashKey, useQueryClient, type QueryCacheNotifyEvent, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import { currentSession, onSessionDataCleared, sessionDataMark, type Session } from '../../session';
import { ApiError } from '../../api';
import { workflowDraftKey, workflowKey, type Workflow } from '../../workflows';
import type { WorkflowDefinition } from './queries';

/**
 * A change the editor could not save when it closed (the save on close failed). It stays in the module's memory, never
 * in `localStorage` nor `sessionStorage`: the next screen says so with "Voltar ao editor", and the editor reopened on
 * that workflow starts from it and saves it again. The memory is emptied on sign-out, on `401 no_session`, on a tenant
 * switch and when another person takes over the module (`onSessionDataCleared`), and loses a workflow's change once a
 * save of that workflow by its owner works.
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

/** The save was refused because the person can no longer edit the workflow (`403 no_permission`). */
function lostEditPermission(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'no_permission';
}

/**
 * Whether the change stays in memory until sign-out or tenant switch, even on a screen that cannot offer it back: saving
 * it again may work, or the person lost the permission to edit (the save got `403 no_permission`, or the session no
 * longer has `workflows.edit`). Losing the permission must not lose the change. The others (invalid definition, removed
 * workflow) are told once and leave with the screen that told them.
 */
export function keptUntilSignOut(change: UnsavedDraftChange): boolean {
  return change.recoverable || lostEditPermission(change.error);
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
    const created: Store = { changes: new Map(), snapshot: [], listeners: new Set() };
    stores.set(queryClient, created);
    // Sign-out, 401, tenant switch or another person: nothing of the previous one stays (lives as long as the module).
    onSessionDataCleared(queryClient, () => {
      if (created.changes.size === 0) return;
      created.changes.clear();
      publish(created);
    });
    queryClient.getQueryCache().subscribe((event) => forgetSavedChange(queryClient, created, event));
    store = created;
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
 * A save of the draft worked (`saveDraft` writes the answer to the cache with `setQueryData`, the only manual write under
 * the draft key): the change kept for that workflow and for the owner of the session leaves the memory, so no screen says
 * "Não deu para salvar" about something already saved. A read of the draft (`GET`) is not a save and changes nothing.
 */
function forgetSavedChange(queryClient: QueryClient, store: Store, event: QueryCacheNotifyEvent) {
  if (event.type !== 'updated' || event.action.type !== 'success' || event.action.manual !== true) return;
  const workflowId = event.query.queryKey[1];
  if (typeof workflowId !== 'string' || event.query.queryHash !== hashKey(workflowDraftKey(workflowId))) return;
  const change = store.changes.get(workflowId);
  if (!change || change.owner !== draftOwner(currentSession(queryClient))) return;
  store.changes.delete(workflowId);
  publish(store);
}

/**
 * Keeps a change the save on close could not save (replaces an older one of the same workflow). Nothing is kept without
 * an owner (the session is not known: nobody could be given it back), nor for an owner that is no longer the session of
 * the module: the save of an editor closed by a sign-out, a 401 or a tenant switch fails after the memory was emptied,
 * and must not bring the change back.
 */
export function keepUnsavedChange(
  queryClient: QueryClient,
  change: Omit<UnsavedDraftChange, 'workflowName' | 'recoverable'> & { workflowName?: string | null },
): UnsavedDraftChange | null {
  if (change.owner === '') return null;
  const store = storeOf(queryClient);
  const session = currentSession(queryClient);
  // Without a session in the cache, a module whose session data was ever cleared (`sessionDataMark`, kept by the session
  // and not by this store, which may be created later) keeps nothing: the failing save is of the previous one.
  if (session ? draftOwner(session) !== change.owner : sessionDataMark(queryClient) > 0) return null;
  const workflowName = change.workflowName ?? queryClient.getQueryData<Workflow>(workflowKey(change.workflowId))?.name ?? null;
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
 * that is gone when it is not `keptUntilSignOut` (only that one: a newer change of the workflow stays).
 */
export function dropUnsavedChange(queryClient: QueryClient, change: UnsavedDraftChange): void {
  const store = storeOf(queryClient);
  if (store.changes.get(change.workflowId) !== change) return;
  store.changes.delete(change.workflowId);
  publish(store);
}

/**
 * Calls `listener` synchronously each time the memory of this module changes (a change kept, saved, dropped or cleared
 * with the session). Returns the function that stops it.
 */
export function subscribeUnsavedChanges(queryClient: QueryClient, listener: () => void): () => void {
  const store = storeOf(queryClient);
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

/** The changes kept for this owner (none without an owner), updated as saves on close fail and editors save them. */
export function useUnsavedDraftChanges(owner: string): readonly UnsavedDraftChange[] {
  const queryClient = useQueryClient();
  const store = storeOf(queryClient);
  const subscribe = useCallback((listener: () => void) => subscribeUnsavedChanges(queryClient, listener), [queryClient]);
  const all = useSyncExternalStore(subscribe, () => store.snapshot);
  return owner === '' ? [] : all.filter((change) => change.owner === owner);
}
