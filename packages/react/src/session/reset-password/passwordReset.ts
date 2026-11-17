import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../../api';

/** What the screen knows about the link before the change: the minimum password and the deadline (generated from the contract). */
export type VerifiedLink = Schemas['LinkVerificado'];

/** Link token and the new password (generated from the contract). */
export type NewPassword = Schemas['NovaSenha'];

/**
 * Verifies the reset link (`POST /v1/redefinicao/verificacao`, public route) without consuming it. The token goes in the
 * body, not in the URL, so it does not show in logs. Without a token, nothing is queried. Unknown, used or expired token:
 * `ApiError` `link_invalido` (4xx, no retry).
 */
export function useVerifyLink(token: string): UseQueryResult<VerifiedLink> {
  const client = useApiClient();
  return useQuery({
    queryKey: ['password-reset', token],
    queryFn: ({ signal }) => dataOrError(client.POST('/v1/redefinicao/verificacao', { body: { token }, signal })),
    enabled: token !== '',
    // The link does not change by itself; if it expires while the person types, the submit answers `link_invalido`.
    staleTime: Infinity,
  });
}

/**
 * Replaces the password through the link (`POST /v1/redefinicao`, public route, `204`). Creates no session: the person signs in afterwards.
 * Errors arrive as `ApiError` (decide by `code`: `link_invalido`, `senha_invalida`, `dados_invalidos`…).
 */
export function useResetPassword(): UseMutationResult<void, Error, NewPassword> {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (body: NewPassword) => {
      await dataOrError(client.POST('/v1/redefinicao', { body: body }));
    },
  });
}
