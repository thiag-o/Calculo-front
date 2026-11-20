import { useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../../api';
import { isSameSessionData, sessionDataMark } from '../../session';

/** A user as a member of the current tenant (generated from the contract). */
export type User = Schemas['User'];
/** A tenant role (generated from the contract). */
export type Role = Schemas['Role'];
/** Body for creating a user (generated from the contract). */
export type NewUser = Schemas['NewUser'];
/** Body for updating a user (generated from the contract). */
export type UserUpdate = Schemas['UserUpdate'];
/** The reset link, shown only once (generated from the contract). */
export type ResetLink = Schemas['ResetLink'];

/**
 * Cache keys. They do not carry the tenant: switching tenant resets the cache (ADR 0015).
 * The roles sit under `users` so that invalidating the whole screen also refreshes them; the key belongs
 * to this screen, so it does not share the cache with the roles screen.
 */
export const USERS_KEY = ['admin', 'users'] as const;
export const USER_LIST_KEY = [...USERS_KEY, 'list'] as const;
export const AVAILABLE_ROLES_KEY = [...USERS_KEY, 'roles'] as const;

/** The tenant users (`GET /v1/users`), paginated by cursor; `fetchNextPage` brings the next page. */
export function useUserList() {
  const client = useApiClient();
  return useInfiniteQuery({
    queryKey: USER_LIST_KEY,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      dataOrError(client.GET('/v1/users', { params: { query: pageParam ? { cursor: pageParam } : {} }, signal })),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
    select: (data) => data.pages.flatMap((pageResponse) => pageResponse.items),
  });
}

/** The tenant roles (`GET /v1/roles`), to pick in the form. Only fetches while `active`. */
export function useAvailableRoles(active: boolean) {
  const client = useApiClient();
  return useQuery({
    queryKey: AVAILABLE_ROLES_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/roles', { signal })),
    select: (data) => data.items,
    enabled: active,
  });
}

/** Creates a user in the tenant (`POST /v1/users`). On success, the list is fetched again. */
export function useCreateUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: NewUser) => dataOrError(client.POST('/v1/users', { body })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (_data, _body, mark) => (isSameSessionData(queryClient, mark) ? queryClient.invalidateQueries({ queryKey: USER_LIST_KEY }) : undefined),
    onError: (error, _body, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      // A chosen role is gone: the role list is fetched again.
      if (errorWithCode(error, ['unknown_role'])) void queryClient.invalidateQueries({ queryKey: AVAILABLE_ROLES_KEY });
    },
  });
}

/** Updates a user's name, roles and status (`PUT /v1/users/{id}`). On success, the list is fetched again. */
export function useUpdateUser() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: UserUpdate }) =>
      dataOrError(client.PUT('/v1/users/{id}', { params: { path: { id } }, body })),
    onMutate: () => sessionDataMark(queryClient),
    onSuccess: (_data, _vars, mark) => (isSameSessionData(queryClient, mark) ? queryClient.invalidateQueries({ queryKey: USER_LIST_KEY }) : undefined),
    onError: (error, _vars, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      if (errorWithCode(error, ['unknown_role'])) void queryClient.invalidateQueries({ queryKey: AVAILABLE_ROLES_KEY });
      if (errorWithCode(error, ['not_found'])) void queryClient.invalidateQueries({ queryKey: USER_LIST_KEY });
    },
  });
}

/**
 * Generates a user's password reset link (`POST /v1/users/{id}/password-reset`).
 * The link lives only in the mutation result, never in the query cache: the caller calls `reset()` when closing the dialog.
 */
export function useGenerateResetLink() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.POST('/v1/users/{id}/password-reset', { params: { path: { id } } })),
    // Without an observer (after `reset()` or on unmount), the mutation leaves the cache right away, taking the link with it.
    gcTime: 0,
    onMutate: () => sessionDataMark(queryClient),
    onError: (error, _id, mark) => {
      if (!isSameSessionData(queryClient, mark)) return;
      // The list was stale (user deactivated, deleted or external): fetch again.
      if (errorWithCode(error, STALE_LIST_CODES)) void queryClient.invalidateQueries({ queryKey: USER_LIST_KEY });
    },
  });
}

const STALE_LIST_CODES = ['inactive_user', 'external_user', 'not_found'];

function errorWithCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}
