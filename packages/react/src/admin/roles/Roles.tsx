import { useId, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, EmptyState, Menu, Badge, Table, Text, type TableColumn } from '../../design-system';
import { useRoleList, type Role } from './queries';
import { RoleDialog } from './RoleDialog';
import { DeleteRoleDialog } from './DeleteRoleDialog';
import { LockIcon, ShieldIcon, MoreActionsIcon } from './icons';
import { queryErrorMessage } from './messages';
import './roles.css';

/** Why the Admin has no actions: shown on its row. */
export const FIXED_ROLE_REASON = 'Tem todas as permissões e não pode ser editado nem removido';

/** Why "Remover papel" is disabled on a role someone uses. */
export function roleInUseReason(userCount: number): string {
  return `Em uso por ${count(userCount, 'usuário', 'usuários')}: tire o papel deles em Usuários antes de remover`;
}

type OpenDialog = { type: 'new' } | { type: 'edit'; role: Role } | { type: 'delete'; role: Role };

function count(total: number, singular: string, plural: string): string {
  return `${total.toLocaleString('pt-BR')} ${total === 1 ? singular : plural}`;
}

function permissionsSummary(role: Role): string {
  if (role.permissions.length === 0) return 'Nenhuma permissão';
  return count(role.permissions.length, 'permissão', 'permissões');
}

/**
 * Admin › Roles: list of the tenant roles, create and edit with the permission catalog and delete with
 * confirmation. The Admin (`fixed`) shows locked, with the reason, and offers neither edit nor delete.
 * Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals of dialogs and menus).
 */
export function Roles() {
  const titleId = useId();
  const list = useRoleList();
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const close = () => setDialog(null);

  const roles = list.data;
  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
  const newRole = (size: 'small' | 'default', variant: 'primary' | 'secondary') => (
    <Button variant={variant} size={size} onClick={() => setDialog({ type: 'new' })}>
      Novo papel
    </Button>
  );

  const columns: readonly TableColumn<Role>[] = [
    {
      key: 'role',
      title: 'Role',
      skeletonWidth: 180,
      cell: (role) => (
        <div className="fc-roles-role">
          <span className="fc-roles-name">
            <Text variant="label-14" medium>
              {role.name}
            </Text>
            {role.fixed ? <Badge>Fixo</Badge> : null}
          </span>
          {role.fixed ? (
            <Text variant="label-13" emphasis="secondary" className="fc-roles-reason">
              <LockIcon size={14} />
              {FIXED_ROLE_REASON}
            </Text>
          ) : (
            <Text variant="label-13" emphasis="secondary">
              {permissionsSummary(role)}
            </Text>
          )}
        </div>
      ),
    },
    {
      key: 'users',
      title: 'Usuários',
      align: 'end',
      width: '120px',
      skeletonWidth: 40,
      cell: (role) => (
        <Text variant="label-14" className="fc-roles-number">
          {role.user_count.toLocaleString('pt-BR')}
        </Text>
      ),
    },
    {
      key: 'actions',
      title: 'Ações',
      hiddenTitle: true,
      align: 'end',
      width: '56px',
      skeletonWidth: 20,
      cell: (role) =>
        role.fixed ? (
          // No menu: the Admin offers neither edit nor delete. The lock takes the place of the "…".
          <span className="fc-roles-locked" role="img" aria-label={`${role.name} travado`}>
            <LockIcon />
          </span>
        ) : (
          <Menu
            trigger={
              <Button iconOnly variant="ghost" size="small" label={`Mais ações para ${role.name}`} icon={<MoreActionsIcon />} />
            }
            items={[
              { label: 'Editar papel', onSelect: () => setDialog({ type: 'edit', role }) },
              {
                label: 'Remover papel',
                danger: true,
                onSelect: () => setDialog({ type: 'delete', role }),
                disabledReason: role.user_count > 0 ? roleInUseReason(role.user_count) : undefined,
              },
            ]}
          />
        ),
    },
  ];

  return (
    <section className="fc-roles" aria-labelledby={titleId}>
      <header className="fc-roles-top">
        <div className="fc-roles-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Papéis
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {roles ? count(roles.length, 'papel', 'papéis') : 'Conjuntos de permissões dados aos usuários do tenant'}
          </Text>
        </div>
        {newRole('default', 'primary')}
      </header>

      <Table
        caption="Papéis do tenant"
        columns={columns}
        rows={roles}
        rowKey={(role) => role.id}
        loading={list.isPending}
        error={
          list.isError && roles === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar os papéis"
              actions={
                noPermission ? undefined : (
                  <Button size="small" onClick={() => void list.refetch()} loading={list.isFetching}>
                    Tentar de novo
                  </Button>
                )
              }
            >
              {queryErrorMessage(list.error)}
            </Notice>
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<ShieldIcon />}
            title="Nenhum papel ainda"
            description="Crie um papel com as permissões que um grupo de usuários precisa."
            action={newRole('small', 'secondary')}
          />
        }
      />

      {list.isError && roles !== undefined ? (
        <Notice
          type="error"
          title="Não foi possível atualizar a lista"
          actions={
            <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          {queryErrorMessage(list.error)}
        </Notice>
      ) : null}

      {dialog?.type === 'new' ? <RoleDialog onClose={close} /> : null}
      {dialog?.type === 'edit' ? <RoleDialog key={dialog.role.id} role={dialog.role} onClose={close} /> : null}
      {dialog?.type === 'delete' ? <DeleteRoleDialog key={dialog.role.id} role={dialog.role} onClose={close} /> : null}
    </section>
  );
}
