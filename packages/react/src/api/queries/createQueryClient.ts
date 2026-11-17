import { QueryClient } from '@tanstack/react-query';
import { ApiError } from '../client/apiError';

/** How many times a query is retried after the first failure, when a retry is worth it. */
const MAX_RETRIES = 3;

/**
 * Retries the query only when the failure may be transient (network, 5xx).
 * A 4xx error is a definitive API answer (no session, no permission, invalid data...): retrying changes nothing.
 */
export function shouldRetryQuery(failures: number, error: unknown): boolean {
  if (error instanceof ApiError && error.status >= 400 && error.status < 500) return false;
  return failures < MAX_RETRIES;
}

/**
 * The `QueryClient` with the product defaults:
 * - queries: retried up to 3 times only on transient failure (network, 5xx), never on 4xx;
 * - mutations: never retried (they are not idempotent).
 * The rest follows the TanStack Query defaults.
 */
export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: shouldRetryQuery },
      mutations: { retry: false },
    },
  });
}
