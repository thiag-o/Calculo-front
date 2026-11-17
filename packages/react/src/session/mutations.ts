import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../api';
import { SESSION_KEY, replaceSessionInCache, type Session } from './sessionCache';

/** Sign-in e-mail and password (generated from the contract). */
export type LoginCredentials = Schemas['LoginCredentials'];

const NO_TENANT_ACCESS = 'no_tenant_access';

/**
 * Sign-in with e-mail and password (`POST /v1/session`, cookie mode). On success, the returned session becomes the current session
 * and the cache of any previous identity is discarded. Errors arrive as `ApiError` (decide by `code`:
 * `invalid_credentials`, `login_locked`, `too_many_attempts`, `invalid_data`…).
 */
export function useSignIn(): UseMutationResult<Session, Error, LoginCredentials> {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => dataOrError(client.POST('/v1/session', { body: credentials })),
    onSuccess: (session) => replaceSessionInCache(queryClient, session),
  });
}

/**
 * Sign-out (`DELETE /v1/session`). On success, cancels the queries and deletes the whole user cache.
 * The caller decides where to go next (in the shell, the sign-in screen), in the `onSuccess` of `mutate`.
 */
export function useSignOut(): UseMutationResult<void, Error, void> {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await dataOrError(client.DELETE('/v1/session'));
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries();
    },
  });
}

/**
 * Switches the session's current tenant (`PUT /v1/session/tenant`); the variable is the tenant id.
 * On success, the returned session (permissions of the new tenant) becomes the current session and the data of the previous tenant
 * leaves the cache. On `403 no_tenant_access`, the session is fetched again, because the tenant list changed.
 */
export function useSwitchTenant(): UseMutationResult<Session, Error, string> {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => dataOrError(client.PUT('/v1/session/tenant', { body: { tenant_id: tenantId } })),
    onSuccess: (session) => replaceSessionInCache(queryClient, session),
    onError: (error) => {
      if (error instanceof ApiError && error.code === NO_TENANT_ACCESS) {
        void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      }
    },
  });
}
