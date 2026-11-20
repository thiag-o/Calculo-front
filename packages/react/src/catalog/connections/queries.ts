import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { ApiError, dataOrError, useApiClient, type Schemas } from '../../api';
import { sameSessionData, sessionDataMark } from '../../session';

/** A connection to a client database, without the credential (generated from the contract). */
export type Connection = Schemas['Connection'];
/** The database engine of a connection (generated from the contract). */
export type ConnectionType = Connection['type'];
/** Result of a connection test (generated from the contract). */
export type ConnectionTestResult = Schemas['ConnectionTestResult'];
/** The credential sent to the API: written only, never read back (generated from the contract). */
export type Credential = Schemas['Credential'];
/** Body of the connection creation (generated from the contract). */
export type NewConnection = Schemas['NewConnection'];
/** Body of the credential test without saving (generated from the contract). */
export type CredentialTest = Schemas['CredentialTest'];

/** Whether the session data is still the one of `mark`: an answer that arrives after it was cleared writes nothing (ADR 0015). */
function isCurrent(queryClient: QueryClient, mark: number | undefined): mark is number {
  return mark !== undefined && sameSessionData(queryClient, mark);
}

/** Permissions the screen checks (contract: the scope of each route). */
export const CONNECTIONS_VIEW = 'connections.view';
export const CONNECTIONS_MANAGE = 'connections.manage';
export const CREDENTIALS_MANAGE = 'credentials.manage';

/**
 * Cache keys, under `['catalog', …]` (same convention as ADR 0020). They do not carry the tenant: switching tenant resets the
 * cache (ADR 0015). The credential never goes into a key nor into the cached data (design.md §4): the API never returns it.
 */
export const CATALOG_KEY = ['catalog'] as const;
export const CONNECTIONS_KEY = [...CATALOG_KEY, 'connections'] as const;
export const CONNECTION_LIST_KEY = [...CONNECTIONS_KEY, 'list'] as const;
export const connectionKey = (id: string) => [...CONNECTIONS_KEY, 'detail', id] as const;

/** Every catalog query except the detail of connection `id`. */
const exceptDetailOf = (id: string) => (query: { queryKey: readonly unknown[] }) =>
  !(query.queryKey[1] === CONNECTIONS_KEY[1] && query.queryKey[2] === 'detail' && query.queryKey[3] === id);

export function errorWithCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}

/** The tenant connections (`GET /v1/connections`), whole, without pagination. */
export function useConnectionList() {
  const client = useApiClient();
  return useQuery({
    queryKey: CONNECTION_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/connections', { signal })),
    select: (data) => data.items,
  });
}

/** One connection (`GET /v1/connections/{id}`). `target` comes only for whoever has `credentials.manage`. */
export function useConnection(id: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: connectionKey(id),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/connections/{id}', { params: { path: { id } }, signal })),
  });
}

/*
 * The calls that carry the credential (test without saving, creation and credential change) never put it in the TanStack
 * Query cache (design.md §4): the mutation receives no variables (`mutate()`) and reads the body from the form at call time,
 * through `readBody`. With `gcTime: 0`, the mutation itself leaves the cache as soon as the dialog that uses it unmounts
 * (ADR 0021). Their results (`Connection`, `ConnectionTestResult` and the errors) never carry the credential.
 */

/** Tests a credential without saving (`POST /v1/connections/tests`). A test that fails is a `200` with `ok: false`. */
export function useTestCredential(readBody: () => CredentialTest) {
  const client = useApiClient();
  return useMutation({
    mutationFn: () => dataOrError(client.POST('/v1/connections/tests', { body: readBody() })),
    gcTime: 0,
  });
}

/** Creates a connection (`POST /v1/connections`); the API tests the credential before saving and saves nothing if it fails. */
export function useCreateConnection(readBody: () => NewConnection) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataOrError(client.POST('/v1/connections', { body: readBody() })),
    gcTime: 0,
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (connection, _vars, mark) => {
      if (!isCurrent(queryClient, mark)) return;
      queryClient.setQueryData(connectionKey(connection.id), connection);
      void queryClient.invalidateQueries({ queryKey: CONNECTION_LIST_KEY });
    },
    onError: (error) => {
      // The name is taken (maybe by someone else just now): the list is fetched again to show it.
      if (errorWithCode(error, ['connection_already_exists'])) void queryClient.invalidateQueries({ queryKey: CONNECTION_LIST_KEY });
    },
  });
}

/** Changes the credential of a connection (`PUT /v1/connections/{id}/credential`): the five fields, tested before saving. */
export function useUpdateCredential(id: string, readBody: () => Credential) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataOrError(client.PUT('/v1/connections/{id}/credential', { params: { path: { id } }, body: readBody() })),
    gcTime: 0,
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (connection, _vars, mark) => {
      if (!isCurrent(queryClient, mark)) return;
      queryClient.setQueryData(connectionKey(id), connection);
      void queryClient.invalidateQueries({ queryKey: CONNECTION_LIST_KEY });
    },
    onError: (error) => {
      if (errorWithCode(error, ['not_found'])) void queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/**
 * Renames a connection (`PUT /v1/connections/{id}`). Other catalog tabs (datasets) may show the connection name, so the
 * whole `['catalog']` prefix is fetched again (ADR 0020 and 0023).
 */
export function useRenameConnection(id: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => dataOrError(client.PUT('/v1/connections/{id}', { params: { path: { id } }, body: { name } })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (connection, _name, mark) => {
      if (!isCurrent(queryClient, mark)) return;
      queryClient.setQueryData(connectionKey(id), connection);
      void queryClient.invalidateQueries({ queryKey: CATALOG_KEY, predicate: exceptDetailOf(id) });
    },
    onError: (error) => {
      if (errorWithCode(error, ['not_found', 'connection_already_exists'])) {
        void queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
      }
    },
  });
}

/**
 * Tests a saved connection (`POST /v1/connections/{id}/test`); the API stores the result in `last_test`. Without
 * `credentials.manage`, the result comes only with `ok`, `tested_at` and `error`.
 */
export function useTestConnection(id: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataOrError(client.POST('/v1/connections/{id}/test', { params: { path: { id } } })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (result, _vars, mark) => {
      if (!isCurrent(queryClient, mark)) return;
      queryClient.setQueryData<Connection>(connectionKey(id), (connection) =>
        connection ? { ...connection, last_test: result } : connection,
      );
      void queryClient.invalidateQueries({ queryKey: CONNECTION_LIST_KEY });
    },
    onError: (error) => {
      if (errorWithCode(error, ['not_found'])) void queryClient.invalidateQueries({ queryKey: CONNECTIONS_KEY });
    },
  });
}

/**
 * Deletes a connection and its stored credential (`DELETE /v1/connections/{id}`). The whole catalog is fetched again (a dataset
 * tab may show it), except the deleted detail, which would answer `404` while the screen leaves it; it leaves the cache by
 * itself once unmounted (`gcTime`).
 */
export function useDeleteConnection(id: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataOrError(client.DELETE('/v1/connections/{id}', { params: { path: { id } } })),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: CATALOG_KEY, predicate: exceptDetailOf(id) }),
    onError: (error) => {
      if (errorWithCode(error, ['not_found'])) void queryClient.invalidateQueries({ queryKey: CONNECTION_LIST_KEY });
    },
  });
}
