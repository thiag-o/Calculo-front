import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../../api';

/** The five tenant session and password parameters, each with value, default and bounds (generated from the contract). */
export type SecuritySettings = Schemas['SecuritySettings'];
/** A parameter: `value` in force, `default` and the inclusive bounds `min` and `max` (generated from the contract). */
export type SecurityParameter = Schemas['SecurityParameter'];
/** Update body: the five values, in the units of the name (generated from the contract). */
export type SecuritySettingsUpdate = Schemas['SecuritySettingsUpdate'];

/**
 * Cache key, under `admin` (ADR 0020). It does not carry the tenant: switching tenant resets the cache (ADR 0015).
 * No other Admin tab shows these parameters, so saving only updates this key.
 */
export const SECURITY_KEY = ['admin', 'security'] as const;

/** The security parameters of the current tenant (`GET /v1/settings/security`). */
export function useSecuritySettings() {
  const client = useApiClient();
  return useQuery({
    queryKey: SECURITY_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/settings/security', { signal })),
  });
}

/**
 * Replaces the five parameters (`PUT /v1/settings/security`). The response is the GET body and goes straight
 * to the cache. Out of range (`value_out_of_range`), the bounds are fetched again: the ones the screen had
 * were stale.
 */
export function useUpdateSecuritySettings() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SecuritySettingsUpdate) => dataOrError(client.PUT('/v1/settings/security', { body })),
    onSuccess: (data) => queryClient.setQueryData(SECURITY_KEY, data),
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'value_out_of_range') {
        void queryClient.invalidateQueries({ queryKey: SECURITY_KEY });
      }
    },
  });
}
