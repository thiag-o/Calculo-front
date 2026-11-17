import { notifyManager, type QueryClient } from '@tanstack/react-query';
import type { Schemas } from '../api';

/** The signed-in user's session, in the current tenant (generated from the contract, `GET /v1/session`). */
export type Session = Schemas['Session'];

/** Session key in the TanStack Query cache. The vertical's mutations write the new session here. */
export const SESSION_KEY = ['session'] as const;

/** Are both sessions of the same person in the same tenant? Then the cached data stays valid. */
export function sameIdentity(a: Session, b: Session): boolean {
  return a.user.id === b.user.id && a.current_tenant.id === b.current_tenant.id;
}

/**
 * The session now belongs to another identity (sign-in, another person's token) or to another tenant (switch). Nothing from the
 * previous cache may show on screen or come back from a late request (ADR 0015):
 * - cancels the running queries (their response would be from the previous identity or tenant);
 * - writes the new session, which the API already returned;
 * - resets the other queries: the data goes away and the mounted queries fetch again, already in the new tenant.
 */
export async function replaceSessionInCache(queryClient: QueryClient, session: Session): Promise<void> {
  await queryClient.cancelQueries();
  // In a single batch: the screen never renders the new session next to the old data.
  notifyManager.batch(() => {
    queryClient.setQueryData(SESSION_KEY, session);
    // No await: the mutation ends already with the new session; the reset queries fetch in parallel.
    void queryClient.resetQueries({ predicate: (query) => query.queryKey[0] !== SESSION_KEY[0] });
  });
}
