import { useInfiniteQuery } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas, type operations } from '../../api';
import { untilParam, sinceParam } from './period';

/** An access audit event (generated from the contract). */
export type AccessEvent = Schemas['AccessEvent'];

type AccessEventsQuery = NonNullable<operations['list_access_events']['parameters']['query']>;

/** The filters applied to the list. `from` and `until` are days (`yyyy-mm-dd`) or empty; a null `type` is "todos os tipos". */
export interface AccessEventFilters {
  type: string | null;
  from: string;
  until: string;
}

export const NO_FILTERS: AccessEventFilters = { type: null, from: '', until: '' };

/**
 * Cache keys, under `['audit', …]`. They do not carry the tenant: switching tenant resets the cache (ADR 0015). Each
 * filter combination is a list of its own, starting from the first page.
 */
export const ACCESS_EVENTS_KEY = ['audit', 'access-events'] as const;

export function accessEventsListKey(filters: AccessEventFilters) {
  return [...ACCESS_EVENTS_KEY, filters] as const;
}

/** The `GET /v1/audit/access-events` parameters for the filters and the page cursor. */
export function buildQuery(filters: AccessEventFilters, cursor: string | null): AccessEventsQuery {
  const query: AccessEventsQuery = {};
  if (filters.type) query.type = [filters.type];
  const since = sinceParam(filters.from);
  if (since) query.since = since;
  const until = untilParam(filters.until);
  if (until) query.until = until;
  if (cursor) query.cursor = cursor;
  return query;
}

/** The tenant access events (`GET /v1/audit/access-events`), from newest to oldest, paginated by cursor. */
export function useAccessEventList(filters: AccessEventFilters) {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: accessEventsListKey(filters),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(client.GET('/v1/audit/access-events', { params: { query: buildQuery(filters, pageParam) }, signal })),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((pageResponse) => pageResponse.items),
  });
}
