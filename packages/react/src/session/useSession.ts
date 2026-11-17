import { useQuery, useQueryClient, type QueryClient, type UseQueryResult } from '@tanstack/react-query';
import { useCallback, useEffect, useRef } from 'react';
import { dataOrError, useApiClient, type ApiClient } from '../api';
import { SESSION_KEY, sameIdentity, replaceSessionInCache, type Session } from './sessionCache';

export { SESSION_KEY } from './sessionCache';
export type { Session } from './sessionCache';

/**
 * Does the user have the `code` permission (e.g. `workflows.ver`) in the current tenant?
 * Without a session (loading, error or signed out), the answer is always `false`.
 */
export function hasPermission(session: Session | undefined, code: string): boolean {
  return session?.permissoes.includes(code) ?? false;
}

export type SessionResult = UseQueryResult<Session> & {
  /** Does the user have the `code` permission in the current tenant? `false` while there is no session. */
  hasPermission: (code: string) => boolean;
};

/** The latest client of each QueryClient: a check for a token that was already changed again is discarded. */
const currentClient = new WeakMap<QueryClient, ApiClient>();
/** The check of each client, done only once, however many `useSession` are mounted. */
const checks = new WeakMap<ApiClient, Promise<void>>();

/**
 * The API client changed (the host app passed another token). The new token may be another person's or another tenant's:
 * fetches the session with it and, if the identity changed, discards the previous token's cache as in a tenant switch
 * (ADR 0015); if it is the same, only writes the new session (the roles may have changed) and keeps the data.
 * Token already expired: the client notifies `onSessionExpired` (401 `sem_sessao`). Other failure: the session stays as is.
 */
function checkClientSession(queryClient: QueryClient, client: ApiClient): Promise<void> {
  const existing = checks.get(client);
  if (existing) return existing;
  const check = (async () => {
    const previous = queryClient.getQueryData<Session>(SESSION_KEY);
    if (previous === undefined) {
      // Without a session in the cache, nothing to compare: the query (maybe running with the previous token) restarts with the new one.
      await queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      return;
    }
    await queryClient.cancelQueries({ queryKey: SESSION_KEY });
    const fresh = await dataOrError(client.GET('/v1/sessao'));
    if (currentClient.get(queryClient) !== client) return;
    if (sameIdentity(previous, fresh)) queryClient.setQueryData(SESSION_KEY, fresh);
    else await replaceSessionInCache(queryClient, fresh);
  })().catch(() => undefined);
  checks.set(client, check);
  return check;
}

/**
 * The current session (`GET /v1/sessao`): user, tenants, current tenant and permissions.
 * - **Cookie mode** (shell): the cookie session.
 * - **Token mode** (embedded): the token session, with `Authorization: Bearer`. When the host app passes another
 *   token, the session is checked again; if the new token is another person's or another tenant's, the previous one's cache
 *   is discarded.
 *
 * Without a valid session (expired session, expired token), the query fails with `ApiError` `sem_sessao` (no retry, being
 * 4xx) and the client notifies the provider's `onSessionExpired`.
 */
export function useSession(): SessionResult {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: SESSION_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/sessao', { signal })),
  });

  const mountClient = useRef(client);
  useEffect(() => {
    if (mountClient.current === client) return;
    mountClient.current = client;
    currentClient.set(queryClient, client);
    void checkClientSession(queryClient, client);
  }, [client, queryClient]);

  const permissions = query.data;
  const verify = useCallback((code: string) => hasPermission(permissions, code), [permissions]);
  return { ...query, hasPermission: verify };
}
