import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { ApiError, dataOrError, useApiClient } from '../../api';
import { isSameSessionData, sessionDataMark } from '../../session';
import { EXECUTION_LISTS_KEY, executionKey, type Execution } from './queries';
import { isRunning } from './status';

/** While the execution has not reached a final state, the panel asks the API again every 2 s (E6-21). */
export const PANEL_REFRESH_MS = 2000;

/**
 * One execution (`GET /v1/executions/{id}`), under `['executions', id]` (the same key the trigger fills, ADR 0063). It is
 * fetched again every 2 s until a final state; then it stops. It also stops after a failed fetch (`403`, `404`, network),
 * even with older data in the cache: the panel says the update failed and offers "Tentar de novo", which starts it again.
 * Errors are `ApiError`: `404 not_found`, `403 no_permission`.
 */
export function useExecution(id: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: executionKey(id),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/executions/{id}', { params: { path: { id } }, signal })),
    refetchInterval: (query) => {
      if (query.state.status === 'error') return false;
      const execution = query.state.data;
      return execution && isRunning(execution.status) ? PANEL_REFRESH_MS : false;
    },
  });
}

/**
 * Asks to cancel the execution (`POST /v1/executions/{id}/cancel`, 202 with the execution as it is now: `cancelled` at
 * once from `pending`; otherwise with `cancel_requested_at`). The answer goes to the cache and the lists are fetched again.
 * `409 execution_finished`: it finished before the request; the execution is fetched again.
 */
export function useCancelExecution(id: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => dataOrError(client.POST('/v1/executions/{id}/cancel', { params: { path: { id } } })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (execution, _variables, mark) => {
      // An answer that arrives after the session data was cleared writes nothing (ADR 0015).
      if (!isSameSessionData(queryClient, mark)) return;
      queryClient.setQueryData<Execution>(executionKey(id), execution);
      void queryClient.invalidateQueries({ queryKey: EXECUTION_LISTS_KEY });
    },
    onError: (error, _variables, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      if (error instanceof ApiError && error.code === 'execution_finished') {
        void queryClient.invalidateQueries({ queryKey: executionKey(id), exact: true });
      }
    },
  });
}

/** The file the browser saves: the CSV and the name the back gave it. */
export interface ExecutionOutputFile {
  blob: Blob;
  fileName: string;
}

/** The name the back uses (`execution-<id>.csv`), when the `Content-Disposition` header is missing or has no name. */
export function fallbackFileName(id: string): string {
  return `execution-${id}.csv`;
}

/**
 * The file name of `Content-Disposition` (`attachment; filename="execution-<id>.csv"`, or `filename*=UTF-8''…`), without
 * any folder in it. The back exposes the header to the browser (B154), so the embedded app reads it too. Without the header or without a name: the fallback.
 */
export function outputFileName(header: string | null, id: string): string {
  if (header) {
    const extended = /filename\*\s*=\s*(?:UTF-8|utf-8)''([^;]+)/.exec(header);
    let name: string | undefined;
    if (extended?.[1]) {
      try {
        name = decodeURIComponent(extended[1].trim());
      } catch {
        name = undefined;
      }
    }
    if (!name) {
      const plain = /filename\s*=\s*(?:"([^"]*)"|([^;]+))/.exec(header);
      name = (plain?.[1] ?? plain?.[2] ?? '').trim();
    }
    const base = name.split(/[\\/]/).pop()?.trim() ?? '';
    if (base !== '' && base !== '.' && base !== '..') return base;
  }
  return fallbackFileName(id);
}

/**
 * Downloads the delivered CSV (`GET /v1/executions/{id}/output`): an action of the person, not a cached query. Resolves
 * with the file and the name of `Content-Disposition`. `410 output_expired` and `404 output_not_available` mean the
 * execution on screen is out of date: it is fetched again (the button then shows why there is no file).
 */
export function useDownloadExecutionOutput(id: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    // The file is handed to the browser once; it is not kept in the mutation cache (the default keeps it for 5 min).
    gcTime: 0,
    mutationFn: async (): Promise<ExecutionOutputFile> => {
      const call = client.GET('/v1/executions/{id}/output', { params: { path: { id } }, parseAs: 'blob' });
      const blob = await dataOrError(call);
      const { response } = await call;
      return { blob, fileName: outputFileName(response.headers.get('Content-Disposition'), id) };
    },
    onMutate: () => sessionDataMark(queryClient),
    onError: (error, _variables, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      if (error instanceof ApiError && (error.code === 'output_expired' || error.code === 'output_not_available')) {
        void queryClient.invalidateQueries({ queryKey: executionKey(id), exact: true });
      }
    },
  });
}
