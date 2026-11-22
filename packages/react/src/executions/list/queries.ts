import { useQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient } from '../../api';
import { EXECUTIONS_KEY } from '../api';

/** The most workflows the filter offers: the largest page of `GET /v1/workflows`. */
export const WORKFLOW_OPTIONS_LIMIT = 200;

/**
 * The workflows of the "Workflow" filter (`GET /v1/workflows`, one page of up to 200, the most recently changed first),
 * under `['executions', 'workflow-options']`. Read straight from the API and not through `workflows/index.ts`: the
 * workflow screens will import `executions` (the list and "Executar lote" in the Overview), and the two verticals must not
 * import each other.
 */
export function useWorkflowOptions(enabled: boolean) {
  const client = useApiClient();
  return useQuery({
    queryKey: [...EXECUTIONS_KEY, 'workflow-options'] as const,
    queryFn: ({ signal }) =>
      dataOrError(client.GET('/v1/workflows', { params: { query: { limit: WORKFLOW_OPTIONS_LIMIT } }, signal })),
    select: (data) => ({ items: data.items.map((workflow) => ({ id: workflow.id, name: workflow.name })), more: data.next_cursor !== null }),
    enabled,
  });
}
