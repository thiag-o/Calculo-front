import { useIsMutating, useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError, dataOrError, isCancellation, useApiClient, type Schemas } from '../../api';

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

const UPLOAD_KEY = [...FILES_KEY, 'upload'] as const;
const UPLOAD_OUTCOME_KEY = [...UPLOAD_KEY, 'outcome'] as const;

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
 * How an upload ended when nobody was looking: the person left the Arquivos tab while it went on (the upload is not
 * cancelled by that) and the area was not on screen when it ended.
 */
export type UploadOutcome =
  | { status: 'success'; file: ExcelFile }
  | { status: 'error'; fileName: string; error: unknown };

/**
 * The result of an upload that ended while the upload area was not on screen, to say it when the person comes back, and
 * whether another upload is still going on. `dismiss` forgets the result (it was read, or a new upload started).
 */
export function useUploadAwayOutcome() {
  const queryClient = useQueryClient();
  const outcome = useQuery({
    queryKey: UPLOAD_OUTCOME_KEY,
    queryFn: () => Promise.resolve<UploadOutcome | null>(null),
    enabled: false,
    staleTime: Infinity,
    gcTime: Infinity,
  });
  const running = useIsMutating({ mutationKey: UPLOAD_KEY });
  return {
    outcome: outcome.data ?? null,
    /** How many uploads run (this area's own one counts, when there is one). */
    running,
    dismiss: () => queryClient.setQueryData(UPLOAD_OUTCOME_KEY, null),
  };
}

/**
 * Uploads an Excel file (`POST /v1/excel-files`, `multipart/form-data` with the `file` field) and follows how much of it
 * went out: `progress` is `null` before the first upload and is reset on each new one.
 */
export function useUploadExcelFile() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  // The callbacks of the mutation itself still run after the area leaves the screen; the ones of `mutate` do not.
  const mounted = useRef(true);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  const mutation = useMutation({
    mutationKey: UPLOAD_KEY,
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      setProgress({ loaded: 0, total: file.size });
      controller.current = new AbortController();
      return client.upload('/v1/excel-files', body, { onProgress: setProgress, signal: controller.current.signal });
    },
    onSuccess: (excelFile) => {
      queryClient.setQueryData(fileKey(excelFile.id), excelFile);
      if (!mounted.current) queryClient.setQueryData(UPLOAD_OUTCOME_KEY, { status: 'success', file: excelFile } satisfies UploadOutcome);
      return refreshCatalog(queryClient, fileKey(excelFile.id));
    },
    // A cancelled upload may have reached the server before the cancel: the list is fetched again, so it shows the truth
    // (a file only appears in it after the API stored it whole).
    onError: (error, file) => {
      if (isCancellation(error)) return refreshCatalog(queryClient);
      if (!mounted.current) queryClient.setQueryData(UPLOAD_OUTCOME_KEY, { status: 'error', fileName: file.name, error } satisfies UploadOutcome);
      return undefined;
    },
  });
  const { reset } = mutation;
  /** Cancels the upload in progress: the request is aborted and the screen goes back to the start, with no error. */
  function cancel() {
    controller.current?.abort();
    controller.current = null;
    reset();
    setProgress(null);
  }
  return { ...mutation, progress, cancel };
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
    // The detail is gone: it leaves the cache (a later visit would otherwise show the deleted file for a moment) and is not
    // fetched again, which would only give 404.
    onSuccess: (_data, id) => {
      const key = fileKey(id);
      const refreshed = refreshCatalog(queryClient, key);
      queryClient.removeQueries({ queryKey: key });
      return refreshed;
    },
  });
}
