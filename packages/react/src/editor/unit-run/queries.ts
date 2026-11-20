import { useQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../../api';
import { workflowDraftKey } from '../../workflows';
import type { WorkflowDefinition } from '../draft';
import type { Value } from './values';

/** The result of a unit run (generated from the contract). */
export type UnitRun = Schemas['UnitRun'];
export type UnitRunNode = Schemas['UnitRunNode'];

/** One "Calcular": the saved revision, the values and the definition they were read from (to name blocks and types). */
export interface UnitRunRequest {
  /** Grows on each "Calcular": two runs with the same values are two runs. */
  id: number;
  revision: number;
  inputs: Record<string, Value>;
  definition: WorkflowDefinition;
}

/**
 * Runs the saved draft for one record (`POST /v1/workflows/{id}/draft/unit-runs`, E4-14). Nothing is saved, so it is a
 * query (ADR 0025): the key carries the run number, not the values, and the result leaves the cache as soon as nobody
 * reads it (`gcTime: 0`). Errors are `ApiError`: `409 draft_conflict`, `422 draft_has_problems` (with `problems`) and
 * `422 invalid_inputs` (with `fields` by input).
 */
export function useUnitRun(workflowId: string, request: UnitRunRequest | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: [...workflowDraftKey(workflowId), 'unit-run', request?.id ?? null] as const,
    queryFn: ({ signal }) =>
      dataOrError(
        client.POST('/v1/workflows/{id}/draft/unit-runs', {
          params: { path: { id: workflowId } },
          body: { revision: request!.revision, inputs: request!.inputs },
          signal,
        }),
      ),
    enabled: request !== null,
    staleTime: Infinity,
    gcTime: 0,
    retry: false,
    refetchOnWindowFocus: false,
  });
}
