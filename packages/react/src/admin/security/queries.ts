import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../../api';

/** The five tenant session and password parameters, each with value, default and bounds (generated from the contract). */
export type SecuritySettings = Schemas['ConfiguracaoSeguranca'];
/** A parameter: `valor` in force, `padrao` and the inclusive bounds `minimo` and `maximo` (generated from the contract). */
export type SecurityParameter = Schemas['ParametroSeguranca'];
/** Update body: the five values, in the units of the name (generated from the contract). */
export type SecuritySettingsUpdate = Schemas['AlteracaoConfiguracaoSeguranca'];

/**
 * Cache key, under `admin` (ADR 0020). It does not carry the tenant: switching tenant resets the cache (ADR 0015).
 * No other Admin tab shows these parameters, so saving only updates this key.
 */
export const SECURITY_KEY = ['admin', 'security'] as const;

/** The security parameters of the current tenant (`GET /v1/configuracoes/seguranca`). */
export function useSecuritySettings() {
  const client = useApiClient();
  return useQuery({
    queryKey: SECURITY_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/configuracoes/seguranca', { signal })),
  });
}

/**
 * Replaces the five parameters (`PUT /v1/configuracoes/seguranca`). The response is the GET body and goes straight
 * to the cache. Out of range (`valor_fora_do_limite`), the bounds are fetched again: the ones the screen had
 * were stale.
 */
export function useUpdateSecuritySettings() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: SecuritySettingsUpdate) => dataOrError(client.PUT('/v1/configuracoes/seguranca', { body: body })),
    onSuccess: (data) => queryClient.setQueryData(SECURITY_KEY, data),
    onError: (error) => {
      if (error instanceof ApiError && error.code === 'valor_fora_do_limite') {
        void queryClient.invalidateQueries({ queryKey: SECURITY_KEY });
      }
    },
  });
}
