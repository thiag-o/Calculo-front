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
/** A business variable over a dataset column (generated from the contract). */
export type Variable = Schemas['Variable'];
/** Body for creating a variable (generated from the contract). */
export type NewVariable = Schemas['NewVariable'];
/** Body for changing a variable: name, type and scale (generated from the contract). */
export type VariableUpdate = Schemas['VariableUpdate'];

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

/**
 * The variables of a dataset sit under its detail: deleting, renaming or refreshing the dataset keeps the detail out of
 * the catalog refetch (ADR 0033), and the variables go along (they do not change with those actions).
 */
export function variablesKey(datasetId: string) {
  return [...datasetKey(datasetId), 'variables'] as const;
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

/**
 * Fetches the dataset and, under it, its variables again: the "Recarregar" of a version conflict (`409 dataset_changed` or
 * `variable_changed`). The returned function rejects when the fetch fails, so the dialog that asked keeps what was typed.
 */
export function useReloadDataset(datasetId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.refetchQueries({ queryKey: datasetKey(datasetId) }, { throwOnError: true });
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

/** The variables of a dataset (`GET /v1/datasets/{id}/variables`), whole, without pagination. */
export function useDatasetVariables(datasetId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: variablesKey(datasetId),
    queryFn: ({ signal }) =>
      dataOrError(client.GET('/v1/datasets/{id}/variables', { params: { path: { id: datasetId } }, signal })),
    select: (data) => data.items,
  });
}

type VariableList = Schemas['VariableList'];

/**
 * After a variable change: the list in the cache gets the answer right away (`change`), and the rest of the catalog is
 * fetched again in the background, except the dataset detail and its variables (ADR 0033). It does not wait for that: the
 * dialog closes as soon as the API confirms.
 */
function afterVariableChange(queryClient: QueryClient, datasetId: string, change: (items: Variable[]) => Variable[]) {
  queryClient.setQueryData<VariableList>(variablesKey(datasetId), (list) => (list ? { items: change(list.items) } : list));
  void refreshCatalog(queryClient, datasetKey(datasetId));
}

/**
 * The column or its type changed in the dataset since the screen read it (someone used "Atualizar colunas"): the
 * dataset is fetched again, so the columns and the accepted types are the current ones.
 */
function refreshDatasetOnColumnError(queryClient: QueryClient, datasetId: string, error: unknown) {
  if (errorWithCode(error, ['incompatible_type', 'unknown_column'])) {
    void queryClient.invalidateQueries({ queryKey: datasetKey(datasetId), exact: true });
  }
}

/** Creates a variable over a column of the dataset (`POST /v1/datasets/{id}/variables`). */
export function useCreateVariable(datasetId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewVariable) =>
      dataOrError(client.POST('/v1/datasets/{id}/variables', { params: { path: { id: datasetId } }, body })),
    onSuccess: (variable) => afterVariableChange(queryClient, datasetId, (items) => [...items, variable]),
    onError: (error) => refreshDatasetOnColumnError(queryClient, datasetId, error),
  });
}

/** Changes the name, type and scale of a variable (`PUT /v1/variables/{id}`); the column stays. */
export function useUpdateVariable(datasetId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: VariableUpdate }) =>
      dataOrError(client.PUT('/v1/variables/{id}', { params: { path: { id } }, body })),
    onSuccess: (variable) =>
      afterVariableChange(queryClient, datasetId, (items) => items.map((item) => (item.id === variable.id ? variable : item))),
    onError: (error) => {
      refreshDatasetOnColumnError(queryClient, datasetId, error);
      // The variable is gone (someone deleted it): the list is fetched again.
      if (errorWithCode(error, ['not_found'])) void queryClient.invalidateQueries({ queryKey: variablesKey(datasetId) });
    },
  });
}

/** Deletes a variable (`DELETE /v1/variables/{id}`); the column stays in the dataset. */
export function useDeleteVariable(datasetId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/variables/{id}', { params: { path: { id } } })),
    onSuccess: (_data, id) => afterVariableChange(queryClient, datasetId, (items) => items.filter((item) => item.id !== id)),
    onError: (error) => {
      if (errorWithCode(error, ['not_found'])) void queryClient.invalidateQueries({ queryKey: variablesKey(datasetId) });
    },
  });
}

export function errorWithCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}
