import { useQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../../api';
import { workflowDraftKey } from '../../workflows';
import type { DraftSymbol, WorkflowDefinition } from '../draft';
import type { RecordKey } from './recordKey';
import type { Value } from './values';

/** The result of a unit run (generated from the contract). */
export type UnitRun = Schemas['UnitRunTrace'];
export type UnitRunNode = UnitRun['nodes'][number];

interface RequestBase {
  /** Grows on each "Calcular": two runs with the same values are two runs. */
  id: number;
  revision: number;
  definition: WorkflowDefinition;
  /** The symbols of the analysis when it ran: the types of the variables of the batch source and of the Source blocks. */
  symbols?: readonly DraftSymbol[];
}

/**
 * One "Calcular": the saved revision, the definition it ran (to name blocks and types) and either the values typed
 * (`inputs`, a workflow without a batch source) or the key of a real record (`recordKey`, with a batch source, E5-12).
 */
export type UnitRunRequest = RequestBase & ({ inputs: Record<string, Value>; recordKey?: never } | { recordKey: RecordKey; inputs?: never });

/**
 * Runs the saved draft for one record (`POST /v1/workflows/{id}/draft/unit-runs`, E4-14). Nothing is saved, so it is a
 * query (ADR 0025): the key carries the run number, not the values, and the result leaves the cache as soon as nobody
 * reads it (`gcTime: 0`). Errors are `ApiError`: `409 draft_conflict`, `422 draft_has_problems` (with `problems`) and
 * `422 invalid_inputs` (with `fields` by input); with a record key, `404 record_not_found`.
 */
export function useUnitRun(workflowId: string, request: UnitRunRequest | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: [...workflowDraftKey(workflowId), 'unit-run', request?.id ?? null] as const,
    queryFn: ({ signal }) =>
      dataOrError(
        client.POST('/v1/workflows/{id}/draft/unit-runs', {
          params: { path: { id: workflowId } },
          body: request!.recordKey
            ? { revision: request!.revision, record_key: request!.recordKey }
            : { revision: request!.revision, inputs: request!.inputs ?? {} },
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
