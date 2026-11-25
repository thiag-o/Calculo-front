import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { ApiError, dataOrError, isCancellation, useApiClient, type Schemas } from '../../api';
import { EXECUTION_LISTS_KEY, executionKey } from '../../executions';
import { isSameSessionData, sessionDataMark } from '../../session';

/** A reference file of a workflow, with its last comparison (generated from the contract). */
export type ReferenceFile = Schemas['ReferenceFile'];
/** The saved draft the simulation runs (generated from the contract). */
export type SavedDraft = Schemas['Draft'];
/** The body of a simulation (generated from the contract). */
export type NewSimulation = Schemas['NewSimulation'];
/** The simulation created (`mode` `simulation`), as any execution (generated from the contract). */
export type Simulation = Schemas['Execution'];

/** Permission to upload and remove reference files (E7-14). */
export const TEST_CASES_EDIT = 'test_cases.edit';
/** Permission to simulate with a reference file (E7-14). */
export const SIMULATIONS_RUN = 'simulations.run';

/** How much of the file went to the server. */
export interface UploadProgress {
  loaded: number;
  total: number;
}

/**
 * Cache keys, all under `['test-cases', …]` (as ADRs 0020, 0033, 0038 and 0063): the reference files of a workflow
 * (`['test-cases', workflowId, 'reference-files']`) and the saved draft the simulation runs
 * (`['test-cases', 'saved-draft', workflowId]`, its own copy, read again at each opening of the dialog). They do not carry
 * the tenant: switching tenant resets the cache (ADR 0015).
 */
export const TEST_CASES_KEY = ['test-cases'] as const;

export function referenceFilesKey(workflowId: string) {
  return [...TEST_CASES_KEY, workflowId, 'reference-files'] as const;
}

export function savedDraftKey(workflowId: string) {
  return [...TEST_CASES_KEY, 'saved-draft', workflowId] as const;
}

function refreshReferenceFiles(queryClient: QueryClient, workflowId: string) {
  return queryClient.invalidateQueries({ queryKey: referenceFilesKey(workflowId) });
}

/** The reference files of a workflow (`GET /v1/workflows/{id}/reference-files`), newest first, whole (at most 20). */
export function useReferenceFiles(workflowId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: referenceFilesKey(workflowId),
    queryFn: ({ signal }) =>
      dataOrError(client.GET('/v1/workflows/{id}/reference-files', { params: { path: { id: workflowId } }, signal })),
    select: (data) => data.items,
  });
}

/**
 * Uploads a reference file (`POST /v1/workflows/{id}/reference-files`, `multipart/form-data` with the `file` field, ADR
 * 0035) and follows how much of it went out: `progress` is `null` before the first upload and is reset on each new one.
 * `cancel` aborts the upload in progress and goes back to the start, with no error.
 */
export function useUploadReferenceFile(workflowId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  const [progress, setProgress] = useState<UploadProgress | null>(null);
  const controller = useRef<AbortController | null>(null);
  // Leaving the screen (or switching the workflow, which remounts it) aborts the upload in progress: nobody is left to
  // follow it, retry it or cancel it. The cancellation reads the list again, in case the file reached the server.
  useEffect(
    () => () => {
      controller.current?.abort();
      controller.current = null;
    },
    [],
  );
  const mutation = useMutation({
    mutationFn: (file: File) => {
      const body = new FormData();
      body.append('file', file);
      setProgress({ loaded: 0, total: file.size });
      controller.current = new AbortController();
      return client.upload('/v1/workflows/{id}/reference-files', body, {
        pathParams: { id: workflowId },
        signal: controller.current.signal,
        onProgress: setProgress,
      });
    },
    onMutate: () => sessionDataMark(queryClient),
    // An answer that arrives after the session data was cleared (sign-out, 401, tenant switch) writes nothing (ADR 0015).
    onSuccess: (_file, _chosen, mark) => (isSameSessionData(queryClient, mark) ? refreshReferenceFiles(queryClient, workflowId) : undefined),
    // A cancelled upload may have reached the server before the cancel: the list is read again, so it shows the truth.
    onError: (error, _chosen, mark) =>
      isSameSessionData(queryClient, mark) && isCancellation(error) ? refreshReferenceFiles(queryClient, workflowId) : undefined,
  });
  const { reset } = mutation;
  function cancel() {
    controller.current?.abort();
    controller.current = null;
    reset();
    setProgress(null);
  }
  return { ...mutation, progress, cancel };
}

/** Removes a reference file (`DELETE /v1/workflows/{id}/reference-files/{file_id}`); the simulations made with it stay. */
export function useDeleteReferenceFile(workflowId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (fileId: string) =>
      dataOrError(
        client.DELETE('/v1/workflows/{id}/reference-files/{file_id}', { params: { path: { id: workflowId, file_id: fileId } } }),
      ),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (_data, _fileId, mark) => (isSameSessionData(queryClient, mark) ? refreshReferenceFiles(queryClient, workflowId) : undefined),
    // Someone else removed it first: the list is read again, without it.
    onError: (error, _fileId, mark) =>
      isSameSessionData(queryClient, mark) && error instanceof ApiError && error.code === 'not_found'
        ? refreshReferenceFiles(queryClient, workflowId)
        : undefined,
  });
}

/**
 * The saved draft the simulation runs (`GET /v1/workflows/{id}/draft`): revision, parameters and problems. Its own key under
 * `test-cases` (never the editor's `['workflows', id, 'draft']`, ADR 0038), read again at every opening (`gcTime: 0`).
 */
export function useSavedDraft(workflowId: string) {
  const client = useApiClient();
  return useQuery({
    queryKey: savedDraftKey(workflowId),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/workflows/{id}/draft', { params: { path: { id: workflowId } }, signal })),
    gcTime: 0,
    staleTime: 0,
  });
}

/**
 * Simulates the saved draft and compares it with a reference file (`POST /v1/workflows/{id}/reference-files/{file_id}/
 * simulations`, E7-11). The new execution goes to its key in `executions` (the panel opens with it), and the execution
 * lists and the reference files (their last comparison) are read again.
 */
export function useSimulate(workflowId: string, fileId: string) {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewSimulation) =>
      dataOrError(
        client.POST('/v1/workflows/{id}/reference-files/{file_id}/simulations', {
          params: { path: { id: workflowId, file_id: fileId } },
          body,
        }),
      ),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (simulation, _body, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      queryClient.setQueryData(executionKey(simulation.id), simulation);
      // Not awaited: the panel of the simulation opens without waiting for the lists.
      void queryClient.invalidateQueries({ queryKey: EXECUTION_LISTS_KEY });
      void refreshReferenceFiles(queryClient, workflowId);
    },
  });
}
