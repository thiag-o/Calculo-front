import { useMutation, useQuery, useQueryClient, type QueryClient } from '@tanstack/react-query';
import { dataOrError, ApiError, useApiClient, type Schemas } from '../../api';

/** A tenant role (generated from the contract). */
export type Role = Schemas['Papel'];
/** A catalog permission (generated from the contract). */
export type Permission = Schemas['Permissao'];
/** Code of a catalog permission (generated from the contract). */
export type PermissionCode = Schemas['CodigoPermissao'];
/** Body for creating and updating a role (generated from the contract). */
export type RoleData = Schemas['DadosPapel'];

/**
 * Cache keys. They do not carry the tenant: switching tenant resets the cache (ADR 0015).
 * Everything from the Admin sits under `admin`; this screen only uses `admin/roles`.
 */
const ADMIN_KEY = ['admin'] as const;
export const ROLES_KEY = [...ADMIN_KEY, 'roles'] as const;
export const ROLE_LIST_KEY = [...ROLES_KEY, 'list'] as const;
export const PERMISSION_CATALOG_KEY = [...ROLES_KEY, 'permissions'] as const;

/** The tenant roles (`GET /v1/papeis`), including the Admin (`fixo`). The list comes whole, without pagination. */
export function useRoleList() {
  const client = useApiClient();
  return useQuery({
    queryKey: ROLE_LIST_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/papeis', { signal })),
    select: (data) => data.itens,
  });
}

/** The permission catalog (`GET /v1/permissoes`), for the role form. Only fetches while `active`. */
export function usePermissionCatalog(active: boolean) {
  const client = useApiClient();
  return useQuery({
    queryKey: PERMISSION_CATALOG_KEY,
    queryFn: ({ signal }) => dataOrError(client.GET('/v1/permissoes', { signal })),
    select: (data) => data.itens,
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

/** Creates a custom role (`POST /v1/papeis`). */
export function useCreateRole() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: RoleData) => dataOrError(client.POST('/v1/papeis', { body: body })),
    onSuccess: () => refreshAdmin(queryClient),
  });
}

/** Updates the name and permissions of a role (`PUT /v1/papeis/{id}`); the body replaces everything. */
export function useUpdateRole() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, body }: { id: string; body: RoleData }) =>
      dataOrError(client.PUT('/v1/papeis/{id}', { params: { path: { id } }, body: body })),
    onSuccess: () => refreshAdmin(queryClient),
    onError: (error) => {
      // The list was stale (role deleted, or it is the Admin): fetch again.
      if (errorWithCode(error, ['nao_encontrado', 'papel_fixo'])) void queryClient.invalidateQueries({ queryKey: ROLE_LIST_KEY });
    },
  });
}

/** Deletes a role (`DELETE /v1/papeis/{id}`). */
export function useDeleteRole() {
  const client = useApiClient();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => dataOrError(client.DELETE('/v1/papeis/{id}', { params: { path: { id } } })),
    onSuccess: () => refreshAdmin(queryClient),
    onError: (error) => {
      // The list was stale (the role got users, was already deleted, or it is the Admin): fetch again.
      if (errorWithCode(error, ['papel_em_uso', 'nao_encontrado', 'papel_fixo'])) {
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

/** Groups the catalog by `grupo`, in the order each group first appears. */
export function groupPermissions(permissionCatalog: readonly Permission[]): PermissionGroup[] {
  const groups = new Map<string, Permission[]>();
  for (const permission of permissionCatalog) {
    const items = groups.get(permission.grupo);
    if (items) items.push(permission);
    else groups.set(permission.grupo, [permission]);
  }
  return Array.from(groups, ([group, permissions]) => ({ group, permissions }));
}
