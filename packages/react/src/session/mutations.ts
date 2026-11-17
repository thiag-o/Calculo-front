import { useMutation, useQueryClient, type UseMutationResult } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../api';
import { SESSION_KEY, replaceSessionInCache, type Session } from './sessionCache';

/** Sign-in e-mail and password (generated from the contract). */
export type LoginCredentials = Schemas['Credenciais'];

const NO_TENANT_ACCESS = 'sem_acesso_ao_tenant';

/**
 * Sign-in with e-mail and password (`POST /v1/sessao`, cookie mode). On success, the returned session becomes the current session
 * and the cache of any previous identity is discarded. Errors arrive as `ApiError` (decide by `code`:
 * `credenciais_invalidas`, `login_bloqueado`, `muitas_tentativas`, `dados_invalidos`…).
 */
export function useSignIn(): UseMutationResult<Session, Error, LoginCredentials> {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (credentials: LoginCredentials) => dataOrError(client.POST('/v1/sessao', { body: credentials })),
    onSuccess: (session) => replaceSessionInCache(queryClient, session),
  });
}

/**
 * Sign-out (`DELETE /v1/sessao`). On success, cancels the queries and deletes the whole user cache.
 * The caller decides where to go next (in the shell, the sign-in screen), in the `onSuccess` of `mutate`.
 */
export function useSignOut(): UseMutationResult<void, Error, void> {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await dataOrError(client.DELETE('/v1/sessao'));
    },
    onSuccess: async () => {
      await queryClient.cancelQueries();
      queryClient.removeQueries();
    },
  });
}

/**
 * Switches the session's current tenant (`PUT /v1/sessao/tenant`); the variable is the tenant id.
 * On success, the returned session (permissions of the new tenant) becomes the current session and the data of the previous tenant
 * leaves the cache. On `403 sem_acesso_ao_tenant`, the session is fetched again, because the tenant list changed.
 */
export function useSwitchTenant(): UseMutationResult<Session, Error, string> {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (tenantId: string) => dataOrError(client.PUT('/v1/sessao/tenant', { body: { tenant_id: tenantId } })),
    onSuccess: (session) => replaceSessionInCache(queryClient, session),
    onError: (error) => {
      if (error instanceof ApiError && error.code === NO_TENANT_ACCESS) {
        void queryClient.invalidateQueries({ queryKey: SESSION_KEY });
      }
    },
  });
}
