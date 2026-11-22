import { useInfiniteQuery, useQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas, type operations } from '../../api';
import { executionKey } from './queries';

/** A record of the execution, in the list (generated from the contract). */
export type ExecutionRecordSummary = Schemas['ExecutionRecordSummary'];
/** A record as the execution kept it, with its trace (generated from the contract). */
export type ExecutionRecord = Schemas['ExecutionRecord'];
/** The trace of one record: the format of the unit run (generated from the contract). */
export type ExecutionRecordTrace = Schemas['UnitRunTrace'];
/** The status of a record (generated from the contract). */
export type RecordStatus = Schemas['UnitRunStatus'];
/** The error code of a record (generated from the contract). */
export type RecordFailureCode = Schemas['RecordFailureCode'];

type RecordListQuery = NonNullable<operations['list_execution_records']['parameters']['query']>;

/** Filter of the records of an execution. Empty: every record. */
export interface ExecutionRecordFilter {
  /** Only the records in these states. */
  statuses?: readonly RecordStatus[];
  /** Only the records with the error in this node. */
  nodeId?: string;
  /** Only the records with this error code. */
  code?: RecordFailureCode;
}

/** The normalized filter: the same choice always gives the same key. */
function normalizedFilter(filter: ExecutionRecordFilter): ExecutionRecordFilter {
  const statuses = [...new Set(filter.statuses ?? [])].sort();
  return {
    ...(statuses.length > 0 ? { statuses } : {}),
    ...(filter.nodeId ? { nodeId: filter.nodeId } : {}),
    ...(filter.code ? { code: filter.code } : {}),
  };
}

/** Every record list of the execution, whatever the filter: `['executions', id, 'records']`. */
export function executionRecordListsKey(id: string) {
  return [...executionKey(id), 'records'] as const;
}

export function executionRecordsKey(id: string, filter: ExecutionRecordFilter = {}) {
  return [...executionRecordListsKey(id), normalizedFilter(filter)] as const;
}

/** One record with its trace: `['executions', id, 'record', resultKey]`. */
export function executionRecordKey(id: string, resultKey: string) {
  return [...executionKey(id), 'record', resultKey] as const;
}

/** The `GET /v1/executions/{id}/records` parameters for the filter and the page cursor. */
export function buildRecordsQuery(filter: ExecutionRecordFilter, cursor: string | null): RecordListQuery {
  const query: RecordListQuery = {};
  if (filter.statuses && filter.statuses.length > 0) query.status = [...filter.statuses];
  if (filter.nodeId) query.node_id = filter.nodeId;
  if (filter.code) query.code = filter.code;
  if (cursor) query.cursor = cursor;
  return query;
}

/**
 * The records of the execution (`GET /v1/executions/{id}/records`, `traces.view`), 50 per page in the reading order,
 * paginated by cursor. Without `enabled` (no `traces.view`) nothing is asked.
 */
export function useExecutionRecords(id: string, filter: ExecutionRecordFilter = {}, enabled = true) {
  const client = useApiClient();
  const query = normalizedFilter(filter);
  return useInfiniteQuery({
    queryKey: executionRecordsKey(id, query),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(
        client.GET('/v1/executions/{id}/records', { params: { path: { id }, query: buildRecordsQuery(query, pageParam) }, signal }),
      ),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((page) => page.items),
    enabled,
  });
}

/**
 * One record and its trace (`GET /v1/executions/{id}/records/{result_key}`, `traces.view`). The stored trace never
 * changes, so it is not fetched again. `404 record_not_found`: the execution has no such record.
 */
export function useExecutionRecord(id: string, resultKey: string | null) {
  const client = useApiClient();
  return useQuery({
    queryKey: executionRecordKey(id, resultKey ?? ''),
    queryFn: ({ signal }) =>
      dataOrError(
        client.GET('/v1/executions/{id}/records/{result_key}', { params: { path: { id, result_key: resultKey! } }, signal }),
      ),
    enabled: resultKey !== null,
    staleTime: Infinity,
  });
}
