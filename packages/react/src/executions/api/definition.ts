import { useQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../../api';
import { executionKey } from './queries';

/** The frozen definition of an execution and the draft revision it came from (generated from the contract). */
export type ExecutionDefinition = Schemas['ExecutionDefinition'];

/** The frozen definition of the execution: `['executions', id, 'definition']`. */
export function executionDefinitionKey(id: string) {
  return [...executionKey(id), 'definition'] as const;
}

/**
 * The definition the execution ran, frozen (`GET /v1/executions/{id}/definition`, `traces.view`): it names the blocks and
 * gives the type of each value in the trace, even if the draft changed afterwards. It never changes, so it is not fetched
 * again. Without `enabled` nothing is asked.
 */
export function useExecutionDefinition(id: string, enabled = true) {
  const client = useApiClient();
  return useQuery({
    queryKey: executionDefinitionKey(id),
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/executions/{id}/definition', { params: { path: { id } }, signal })),
    enabled,
    staleTime: Infinity,
  });
}
