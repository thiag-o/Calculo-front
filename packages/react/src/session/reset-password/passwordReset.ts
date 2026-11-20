import { useMutation, useQuery, type UseMutationResult, type UseQueryResult } from '@tanstack/react-query';
import { dataOrError, useApiClient, type Schemas } from '../../api';

/** What the screen knows about the link before the change: the minimum password and the deadline (generated from the contract). */
export type VerifiedLink = Schemas['VerifiedLink'];

/** Link token and the new password (generated from the contract). */
export type NewPassword = Schemas['NewPassword'];

/**
 * Verifies the reset link (`POST /v1/password-reset/verification`, public route) without consuming it. The token goes in the
 * body, not in the URL, so it does not show in logs. Without a token, nothing is queried. Unknown, used or expired token:
 * `ApiError` `invalid_link` (4xx, no retry).
 */
export function useVerifyLink(token: string): UseQueryResult<VerifiedLink> {
  const client = useApiClient();
  return useQuery({
    queryKey: ['password-reset', token],
    queryFn: ({ signal }) => dataOrError(client.POST('/v1/password-reset/verification', { body: { token }, signal })),
    enabled: token !== '',
    // The link does not change by itself; if it expires while the person types, the submit answers `invalid_link`.
    staleTime: Infinity,
  });
}

/**
 * Replaces the password through the link (`POST /v1/password-reset`, public route, `204`). Creates no session: the person signs in afterwards.
 * Errors arrive as `ApiError` (decide by `code`: `invalid_link`, `invalid_password`, `invalid_data`…).
 */
export function useResetPassword(): UseMutationResult<void, Error, NewPassword> {
  const client = useApiClient();
  return useMutation({
    mutationFn: async (body: NewPassword) => {
      await dataOrError(client.POST('/v1/password-reset', { body }));
    },
  });
}
