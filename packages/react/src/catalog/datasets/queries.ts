import { useInfiniteQuery, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../../api';

/** A dataset, with the columns already read (generated from the contract). */
export type Dataset = Schemas['Dataset'];
/** Body for creating a dataset (generated from the contract). */
export type NewDataset = Schemas['NewDataset'];
/** A table or view of the client database (generated from the contract). */
export type DatabaseObject = Schemas['DatabaseObject'];
/** A connection to a client database, without the credential (generated from the contract). */
export type Connection = Schemas['Connection'];
/** An uploaded Excel file (generated from the contract). */
export type ExcelFile = Schemas['ExcelFile'];

/** How many objects each page of the object browser brings. */
export const OBJECT_PAGE_SIZE = 50;

/**
 * Cache keys. They do not carry the tenant: switching tenant resets the cache (ADR 0015).
 * Everything from the catalog sits under `catalog`; this sub-vertical only uses `catalog/datasets`. The connections and
 * files it reads (for the picker and the origin names) are copies of its own, so they never share a key with the
 * connections (F30) and files (F32) screens.
 */
const CATALOG_KEY = ['catalog'] as const;
export const DATASETS_KEY = [...CATALOG_KEY, 'datasets'] as const;
export const DATASET_LIST_KEY = [...DATASETS_KEY, 'list'] as const;
export const DATASET_CONNECTIONS_KEY = [...DATASETS_KEY, 'connections'] as const;
export const DATASET_EXCEL_FILES_KEY = [...DATASETS_KEY, 'excel-files'] as const;
const OBJECTS_KEY = [...DATASETS_KEY, 'objects'] as const;
const OBJECT_COLUMNS_KEY = [...DATASETS_KEY, 'object-columns'] as const;

export function datasetKey(id: string) {
  return [...DATASETS_KEY, 'detail', id] as const;
}

function objectsKey(connectionId: string, search: string) {
  return [...OBJECTS_KEY, connectionId, search] as const;
}

/** The tenant datasets (`GET /v1/datasets`), whole, without pagination. */
export function useDatasetList() {
  const client = useApiClient();
  return useQuery({
    queryKey: DATASET_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/datasets', { signal })),
    select: (data) => data.items,
  });
}

/** One dataset (`GET /v1/datasets/{id}`), with the columns. */
export function useDataset(id: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: datasetKey(id),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/datasets/{id}', { params: { path: { id } }, signal })),
  });
}

/** The tenant connections (`GET /v1/connections`): the picker of a new dataset and the origin names. Only while `active`. */
export function useDatasetConnections(active = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: DATASET_CONNECTIONS_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/connections', { signal })),
    select: (data) => data.items,
    enabled: active,
  });
}

/** The tenant Excel files (`GET /v1/excel-files`), only for the origin names. Only while `active`. */
export function useDatasetExcelFiles(active: boolean) {
  const client = useApiClient();
  return useQuery({
    queryKey: DATASET_EXCEL_FILES_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/excel-files', { signal })),
    select: (data) => data.items,
    enabled: active,
  });
}

/**
 * The tables and views of a connection (`GET /v1/connections/{id}/objects`), filtered by `search` and paginated by
 * cursor; `fetchNextPage` brings the next page. Only with a connection.
 */
export function useConnectionObjects(connectionId: string, search: string) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: objectsKey(connectionId, search),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(
        client.GET('/v1/connections/{id}/objects', {
          params: {
            path: { id: connectionId },
            query: { limit: OBJECT_PAGE_SIZE, ...(search ? { search } : {}), ...(pageParam ? { cursor: pageParam } : {}) },
          },
          signal,
        }),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled: connectionId !== '',
  });
}

/** The columns of a table or view (`GET /v1/connections/{id}/objects/columns`), to see before creating. */
export function useObjectColumns(connectionId: string, object: Pick<DatabaseObject, 'schema_name' | 'name'> | null) {
  const client = useApiClient();
  const schemaName = object?.schema_name ?? '';
  const name = object?.name ?? '';
  return useQuery({
    queryKey: [...OBJECT_COLUMNS_KEY, connectionId, schemaName, name],
    queryFn: ({ signal }) =>
      dataOrError(
        client.GET('/v1/connections/{id}/objects/columns', {
          params: { path: { id: connectionId }, query: { schema_name: schemaName, name } },
          signal,
        }),
      ),
    select: (data) => data.items,
    enabled: connectionId !== '' && object !== null,
  });
}

/**
 * After changing a dataset, everything the catalog kept is fetched again (the other catalog screens may show the
 * datasets), except what `keep` says.
 */
function refreshCatalog(queryClient: QueryClient, keep?: readonly unknown[]) {
  return queryClient.invalidateQueries({
    queryKey: CATALOG_KEY,
    predicate: keep ? (query) => !startsWith(query.queryKey, keep) : undefined,
  });
}

function startsWith(key: readonly unknown[], prefix: readonly unknown[]) {
  return prefix.every((part, index) => key[index] === part);
}

/** Creates a dataset (`POST /v1/datasets`). */
export function useCreateDataset() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewDataset) => dataOrError(client.POST('/v1/datasets', { body })),
    onSuccess: (dataset) => {
      queryClient.setQueryData(datasetKey(dataset.id), dataset);
      return refreshCatalog(queryClient, datasetKey(dataset.id));
    },
    onError: (error) => {
      // The chosen connection is gone: its list is fetched again.
      if (error instanceof ApiError && error.code === 'invalid_data' && 'connection_id' in error.fields) {
        void queryClient.invalidateQueries({ queryKey: DATASET_CONNECTIONS_KEY });
      }
      // The chosen object is gone: the object browser is fetched again.
      if (errorWithCode(error, ['unknown_object'])) void queryClient.invalidateQueries({ queryKey: OBJECTS_KEY });
    },
  });
}

/** Renames a dataset (`PUT /v1/datasets/{id}`); without `sql` in the body, the SQL stays as it is. */
export function useRenameDataset() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, name }: { id: string; name: string }) =>
      dataOrError(client.PUT('/v1/datasets/{id}', { params: { path: { id } }, body: { name } })),
    onSuccess: (dataset) => {
      queryClient.setQueryData(datasetKey(dataset.id), dataset);
      return refreshCatalog(queryClient, datasetKey(dataset.id));
    },
  });
}

/** Reads the dataset columns again from the source (`POST /v1/datasets/{id}/column-refresh`). */
export function useRefreshDatasetColumns() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.POST('/v1/datasets/{id}/column-refresh', { params: { path: { id } } })),
    onSuccess: (dataset) => {
      queryClient.setQueryData(datasetKey(dataset.id), dataset);
      return refreshCatalog(queryClient, datasetKey(dataset.id));
    },
  });
}

/** Deletes a dataset and its variables (`DELETE /v1/datasets/{id}`). */
export function useDeleteDataset() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/datasets/{id}', { params: { path: { id } } })),
    // The detail is gone: fetching it again would only give 404 (the screen shows the removal by itself). A later visit
    // fetches it again on mount and shows "não existe mais".
    onSuccess: (_data, id) => refreshCatalog(queryClient, datasetKey(id)),
  });
}

export function errorWithCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}
