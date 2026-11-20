import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../../api';

/** A tenant role (generated from the contract). */
export type Role = Schemas['Role'];
/** A catalog permission (generated from the contract). */
export type Permission = Schemas['Permission'];
/** Code of a catalog permission (generated from the contract). */
export type PermissionCode = Schemas['PermissionCode'];
/** Body for creating and updating a role (generated from the contract). */
export type RoleData = Schemas['RoleData'];

/**
 * Cache keys. They do not carry the tenant: switching tenant resets the cache (ADR 0015).
 * Everything from the Admin sits under `admin`; this screen only uses `admin/roles`.
 */
const ADMIN_KEY = ['admin'] as const;
export const ROLES_KEY = [...ADMIN_KEY, 'roles'] as const;
export const ROLE_LIST_KEY = [...ROLES_KEY, 'list'] as const;
export const PERMISSION_CATALOG_KEY = [...ROLES_KEY, 'permissions'] as const;

/** The tenant roles (`GET /v1/roles`), including the Admin (`fixed`). The list comes whole, without pagination. */
export function useRoleList() {
  const client = useApiClient();
  return useQuery({
    queryKey: ROLE_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/roles', { signal })),
    select: (data) => data.items,
  });
}

/** The permission catalog (`GET /v1/permissions`), for the role form. Only fetches while `active`. */
export function usePermissionCatalog(active: boolean) {
  const client = useApiClient();
  return useQuery({
    queryKey: PERMISSION_CATALOG_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/permissions', { signal })),
    select: (data) => data.items,
    enabled: active,
  });
}

/**
 * After changing a role, everything the Admin kept is fetched again, except the catalog (which does not change):
 * the users screen also shows the role names and offers their list.
 */
function refreshAdmin(queryClient: QueryClient) {
  return queryClient.invalidateQueries({
    queryKey: ADMIN_KEY,
    predicate: (query) => !sameKey(query.queryKey, PERMISSION_CATALOG_KEY),
  });
}

function sameKey(key: readonly unknown[], other: readonly unknown[]) {
  return key.length === other.length && key.every((part, index) => part === other[index]);
}

/** Creates a custom role (`POST /v1/roles`). */
export function useCreateRole() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RoleData) => dataOrError(client.POST('/v1/roles', { body })),
    onSuccess: () => refreshAdmin(queryClient),
  });
}

/** Updates the name and permissions of a role (`PUT /v1/roles/{id}`); the body replaces everything. */
export function useUpdateRole() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RoleData }) =>
      dataOrError(client.PUT('/v1/roles/{id}', { params: { path: { id } }, body })),
    onSuccess: () => refreshAdmin(queryClient),
    onError: (error) => {
      // The list was stale (role deleted, or it is the Admin): fetch again.
      if (errorWithCode(error, ['not_found', 'fixed_role'])) void queryClient.invalidateQueries({ queryKey: ROLE_LIST_KEY });
    },
  });
}

/** Deletes a role (`DELETE /v1/roles/{id}`). */
export function useDeleteRole() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/roles/{id}', { params: { path: { id } } })),
    onSuccess: () => refreshAdmin(queryClient),
    onError: (error) => {
      // The list was stale (the role got users, was already deleted, or it is the Admin): fetch again.
      if (errorWithCode(error, ['role_in_use', 'not_found', 'fixed_role'])) {
        void queryClient.invalidateQueries({ queryKey: ROLE_LIST_KEY });
      }
    },
  });
}

export function errorWithCode(error: unknown, codes: readonly string[]): boolean {
  return error instanceof ApiError && codes.includes(error.code);
}

/** A catalog group, with the permissions in the order the API returns them. */
export interface PermissionGroup {
  group: string;
  permissions: Permission[];
}

/** Groups the catalog by `category`, in the order each group first appears. */
export function groupPermissions(permissionCatalog: readonly Permission[]): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissionCatalog) {
    const items = groups.get(permission.category);
    if (items) items.push(permission);
    else groups.set(permission.category, [permission]);
  }
  return Array.from(groups, ([group, permissions]) => ({ group, permissions }));
}
