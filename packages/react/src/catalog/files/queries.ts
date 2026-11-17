import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { ApiError, dataOrError, useApiClient, type Schemas } from '../../api';

/** An uploaded Excel file, with the sheets and the columns read (generated from the contract). */
export type ExcelFile = Schemas['ExcelFile'];
/** A sheet of an Excel file (generated from the contract). */
export type Sheet = Schemas['Sheet'];
/** A dataset (generated from the contract). */
export type Dataset = Schemas['Dataset'];

/** Permission to upload and delete files and to create datasets (contract: the scope of those routes). */
export const DATASETS_MANAGE = 'datasets.manage';

/** How much of the file went to the server. */
export interface UploadProgress {
  loaded: number;
  total: number;
}

/**
 * Cache keys, under `['catalog', …]` (ADR 0033). This sub-vertical only uses `catalog/files`. They do not carry the
 * tenant: switching tenant resets the cache (ADR 0015).
 */
const CATALOG_KEY = ['catalog'] as const;
export const FILES_KEY = [...CATALOG_KEY, 'files'] as const;
export const FILE_LIST_KEY = [...FILES_KEY, 'list'] as const;

export function fileKey(id: string) {
  return [...FILES_KEY, 'detail', id] as const;
}

export function errorWithCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}

/** The tenant Excel files (`GET /v1/excel-files`), whole, without pagination. */
export function useExcelFileList() {
  const client = useApiClient();
  return useQuery({
    queryKey: FILE_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/excel-files', { signal })),
    select: (data) => data.items,
  });
}

/** One Excel file (`GET /v1/excel-files/{id}`), with the sheets and the columns. */
export function useExcelFile(id: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: fileKey(id),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/excel-files/{id}', { params: { path: { id } }, signal })),
  });
}

/**
 * After a change, everything the catalog kept is fetched again (the other catalog screens show the files and the
 * datasets), except what `keep` says (ADR 0033).
 */
function refreshCatalog(queryClient: QueryClient, keep?: readonly unknown[]) {
  return queryClient.invalidateQueries({
    queryKey: CATALOG_KEY,
    predicate: keep ? (query) => !keep.every((part, index) => query.queryKey[index] === part) : undefined,
  });
}

/**
 * Uploads an Excel file (`POST /v1/excel-files`, `multipart/form-data` with the `file` field) and follows how much of it
 * went out: `progress` is `null` before the first upload and is reset on each new one.
 */
export function useUploadExcelFile() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const mutation = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      setProgress({ loaded: 0, total: file.size });
      return client.upload('/v1/excel-files', body, { onProgress: setProgress });
    },
    onSuccess: (excelFile) => {
      queryClient.setQueryData(fileKey(excelFile.id), excelFile);
      return refreshCatalog(queryClient, fileKey(excelFile.id));
    },
  });
  return { ...mutation, progress };
}

/** Creates a dataset from a sheet (`POST /v1/datasets` with `type: excel`). */
export function useCreateSheetDataset() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ fileId, sheet, name }: { fileId: string; sheet: string; name: string }) =>
      dataOrError(client.POST('/v1/datasets', { body: { type: 'excel', excel_file_id: fileId, sheet, name } })),
    // The new dataset shows on the Datasets tab; the file itself does not change.
    onSuccess: () => refreshCatalog(queryClient, FILES_KEY),
  });
}

/** Deletes an Excel file (`DELETE /v1/excel-files/{id}`); a file used by a dataset gives `409 excel_file_in_use`. */
export function useDeleteExcelFile() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/excel-files/{id}', { params: { path: { id } } })),
    // The detail is gone: fetching it again would only give 404. A later visit fetches it on mount.
    onSuccess: (_data, id) => refreshCatalog(queryClient, fileKey(id)),
  });
}
