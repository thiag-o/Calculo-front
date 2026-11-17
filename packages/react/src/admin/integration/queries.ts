import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../../api';

/** A tenant API key, without the full key (generated from the contract). */
export type ApiKey = Schemas['ChaveApi'];
/** The newly created key, with the full `chave`, shown only once (generated from the contract). */
export type CreatedApiKey = Schemas['ChaveApiCriada'];
/** Body for creating an API key (generated from the contract). */
export type NewApiKey = Schemas['NovaChaveApi'];
/** A tenant authorized domain, with the normalized origin (generated from the contract). */
export type AuthorizedDomain = Schemas['DominioAutorizado'];
/** Body for registering an authorized domain (generated from the contract). */
export type NewAuthorizedDomain = Schemas['NovoDominioAutorizado'];

/**
 * Cache keys, under `['admin', …]` (ADR 0020). They do not carry the tenant: switching tenant resets the cache
 * (ADR 0015). The full API key never goes into a query key or into query data (ADR 0021).
 */
export const INTEGRATION_KEY = ['admin', 'integration'] as const;
export const API_KEY_LIST_KEY = [...INTEGRATION_KEY, 'api-keys'] as const;
export const AUTHORIZED_DOMAIN_LIST_KEY = [...INTEGRATION_KEY, 'authorized-domains'] as const;

export function errorWithCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}

/** The tenant API keys (`GET /v1/chaves-api`), including the revoked ones, paginated by cursor. */
export function useApiKeyList() {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: API_KEY_LIST_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(client.GET('/v1/chaves-api', { params: { query: pageParam ? { cursor: pageParam } : {} }, signal })),
    getNextPageParam: (last) => last.proximo_cursor ?? undefined,
    select: (data) => data.pages.flatMap((pageResponse) => pageResponse.itens),
  });
}

/**
 * Creates an API key (`POST /v1/chaves-api`). The response carries the full key, which only exists in this
 * mutation's result (ADR 0021): `gcTime: 0` drops the mutation from the cache as soon as the dialog using it unmounts. On success, the list
 * is fetched again (it only has the prefix).
 */
export function useCreateApiKey() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewApiKey) => dataOrError(client.POST('/v1/chaves-api', { body: body })),
    gcTime: 0,
    // Without waiting for the list: the key shows as soon as the API answers.
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: API_KEY_LIST_KEY });
    },
  });
}

/** Revokes a key (`DELETE /v1/chaves-api/{id}`). It stays in the list, with `revogada_em`. */
export function useRevokeApiKey() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/chaves-api/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: API_KEY_LIST_KEY }),
    onError: (error) => {
      // The list was stale (the key no longer exists): fetch again.
      if (errorWithCode(error, ['nao_encontrado'])) void queryClient.invalidateQueries({ queryKey: API_KEY_LIST_KEY });
    },
  });
}

/** The tenant authorized domains (`GET /v1/dominios-autorizados`). The list comes whole, without pagination. */
export function useAuthorizedDomainList() {
  const client = useApiClient();
  return useQuery({
    queryKey: AUTHORIZED_DOMAIN_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/dominios-autorizados', { signal })),
    select: (data) => data.itens,
  });
}

/** Registers an authorized domain (`POST /v1/dominios-autorizados`); the API returns the normalized origin. */
export function useCreateAuthorizedDomain() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewAuthorizedDomain) => dataOrError(client.POST('/v1/dominios-autorizados', { body: body })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTHORIZED_DOMAIN_LIST_KEY }),
    onError: (error) => {
      // The origin was already registered (maybe by someone else): the list is fetched again to show it.
      if (errorWithCode(error, ['dominio_existente'])) void queryClient.invalidateQueries({ queryKey: AUTHORIZED_DOMAIN_LIST_KEY });
    },
  });
}

/** Deletes an authorized domain for good (`DELETE /v1/dominios-autorizados/{id}`). */
export function useDeleteAuthorizedDomain() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/dominios-autorizados/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: AUTHORIZED_DOMAIN_LIST_KEY }),
    onError: (error) => {
      if (errorWithCode(error, ['nao_encontrado'])) void queryClient.invalidateQueries({ queryKey: AUTHORIZED_DOMAIN_LIST_KEY });
    },
  });
}
