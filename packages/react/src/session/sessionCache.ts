import { notifyManager, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useCallback, useSyncExternalStore } from 'react';
import type { Schemas } from '../api';

/** The signed-in user's session, in the current tenant (generated from the contract, `GET /v1/session`). */
export type Session = Schemas['Session'];

/** Session key in the TanStack Query cache. The vertical's mutations write the new session here. */
export const SESSION_KEY = ['session'] as const;

/** Are both sessions of the same person in the same tenant? Then the cached data stays valid. */
export function sameIdentity(a: Session, b: Session): boolean {
  return a.user.id === b.user.id && a.current_tenant.id === b.current_tenant.id;
}

/** The session in the cache, if any (outside the render: e.g. a save that fails after its screen is gone). */
export function currentSession(queryClient: QueryClient): Session | undefined {
  return queryClient.getQueryData<Session>(SESSION_KEY);
}

/**
 * Told when the data of an identity or tenant leaves the module: `undefined` after sign-out or `401 no_session`, the new
 * session after a tenant switch, a sign-in or another person's token.
 */
export type SessionDataListener = (next: Session | undefined) => void;

interface SessionData {
  listeners: Set<SessionDataListener>;
  /**
   * How many times the data of an identity or tenant left the module (sign-out, 401, switch, another person). Grows
   * synchronously, before the cache is cleared: an answer that started under a previous count is not written.
   */
  clears: number;
  /** Grows each time another identity or tenant takes over: the screens mounted under the previous one start over. */
  generation: number;
  generationListeners: Set<() => void>;
}

/** One per QueryClient, like the cache. */
const sessionData = new WeakMap<QueryClient, SessionData>();

function dataOf(queryClient: QueryClient): SessionData {
  let data = sessionData.get(queryClient);
  if (!data) {
    data = { listeners: new Set(), clears: 0, generation: 0, generationListeners: new Set() };
    sessionData.set(queryClient, data);
  }
  return data;
}

/**
 * Registers a memory kept outside the TanStack Query cache (ADR 0045, e.g. the changes the editor could not save): it is
 * told, synchronously, when the cache of the previous identity or tenant is cleared, and must forget what it holds.
 * Returns the function that removes the listener.
 */
export function onSessionDataCleared(queryClient: QueryClient, listener: SessionDataListener): () => void {
  const { listeners } = dataOf(queryClient);
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

/**
 * A mark of the session data in the module: it changes each time the data of the previous identity or tenant leaves it
 * (sign-out, `401 no_session`, tenant switch, another person). Whoever writes to the cache after a request (a save, a
 * mutation's `onSuccess`) takes the mark before the request and writes only if it is still the same
 * (`sameSessionData`): an answer of the previous person or tenant never fills the cache of the next one.
 */
export function sessionDataMark(queryClient: QueryClient): number {
  return dataOf(queryClient).clears;
}

/** Whether the session data is still the one of `mark` (taken with `sessionDataMark` before the request). */
export function sameSessionData(queryClient: QueryClient, mark: number): boolean {
  return sessionDataMark(queryClient) === mark;
}

function tellCleared(queryClient: QueryClient, next: Session | undefined) {
  const data = dataOf(queryClient);
  data.clears += 1;
  for (const listener of [...data.listeners]) listener(next);
}

/** The mutations already settled (their variables may carry the previous identity's data) leave the cache. */
function removeSettledMutations(queryClient: QueryClient) {
  const mutations = queryClient.getMutationCache();
  for (const mutation of mutations.getAll()) {
    if (mutation.state.status !== 'pending') mutations.remove(mutation);
  }
}

/**
 * The session ended (sign-out, `401 no_session`): moves `sessionDataMark` on, cancels the running queries, clears the
 * whole cache (queries and mutations, `queryClient.clear()`) and the memories registered with `onSessionDataCleared`.
 * Nothing of the previous user stays in the module. The caller makes sure no screen of that user stays on screen (ADR 0019).
 */
export function clearSessionData(queryClient: QueryClient): void {
  // The mark moves first: an answer that arrives from here on is not written.
  tellCleared(queryClient, undefined);
  void queryClient.cancelQueries();
  // A running mutation still settles and calls its callbacks after leaving the cache (they check `sameSessionData`).
  queryClient.clear();
}

/**
 * The session now belongs to another identity (sign-in, another person's token) or to another tenant (switch). Nothing from the
 * previous cache may show on screen or come back from a late request (ADR 0015):
 * - cancels the running queries (their response would be from the previous identity or tenant), once before and once
 *   inside the batch;
 * - moves `sessionDataMark` on, before anything else and again inside the batch: a save or a mutation of the previous
 *   one that answers later writes nothing;
 * - forgets the memories registered with `onSessionDataCleared`;
 * - removes the queries nobody shows and the settled mutations; the queries on screen lose their data and fetch again,
 *   already in the new tenant (removing them would leave the mounted screens reading a query out of the cache);
 * - writes the new session, which the API already returned;
 * - moves `useSessionGeneration` on, in the same render: the screens start over, without the previous one's local state.
 */
export async function replaceSessionInCache(queryClient: QueryClient, session: Session): Promise<void> {
  const data = dataOf(queryClient);
  data.clears += 1;
  await queryClient.cancelQueries();
  const notSession = (query: { queryKey: readonly unknown[] }) => query.queryKey[0] !== SESSION_KEY[0];
  // In a single batch: the screen never renders the new session next to the old data.
  notifyManager.batch(() => {
    tellCleared(queryClient, session);
    // Again, synchronously: a fetch that started while the first cancel was awaited is from the previous identity too.
    void queryClient.cancelQueries();
    const queries = queryClient.getQueryCache();
    for (const query of queries.getAll()) {
      if (notSession(query) && query.getObserversCount() === 0) queries.remove(query);
    }
    removeSettledMutations(queryClient);
    queryClient.setQueryData(SESSION_KEY, session);
    // No await: the mutation ends already with the new session; the reset queries fetch in parallel.
    void queryClient.resetQueries({ predicate: notSession });
    // Scheduled like the query notifications: the screens start over in the render that shows the new session.
    notifyManager.schedule(() => {
      data.generation += 1;
      for (const listener of [...data.generationListeners]) listener();
    });
  });
}

/**
 * A number that changes each time another identity or tenant takes over the module (`replaceSessionInCache`). The
 * layouts use it as the `key` of the screen area: the screens mount again, without the local state (forms, the editor)
 * of the previous person or tenant, and read their data again.
 */
export function useSessionGeneration(): number {
  const data = dataOf(useQueryClient());
  const subscribe = useCallback(
    (listener: () => void) => {
      data.generationListeners.add(listener);
      return () => {
        data.generationListeners.delete(listener);
      };
    },
    [data],
  );
  return useSyncExternalStore(subscribe, () => data.generation);
}
