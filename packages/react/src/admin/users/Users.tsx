import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, EmptyState, Menu, Badge, Status, Table, Text, type TableColumn } from '../../design-system';
import { useUserList, type User } from './queries';
import { ResetLinkDialog } from './ResetLinkDialog';
import { UserDialog } from './UserDialog';
import { MoreActionsIcon, UsersIcon } from './icons';
import { listErrorMessage } from './messages';
import './users.css';

export const EXTERNAL_LINK_REASON = 'Usuário da incorporação: entra pelo sistema hospedeiro, sem senha';
export const INACTIVE_LINK_REASON = 'Ative o usuário para gerar o link';

type OpenDialog = { type: 'new' } | { type: 'edit'; user: User } | { type: 'link'; user: User };

function summary(total: number, hasMore: boolean): string {
  if (hasMore) return `Mais de ${total} usuários`;
  return total === 1 ? '1 usuário' : `${total} usuários`;
}

/**
 * Admin › Users: the tenant list (name, e-mail, roles and status), create, edit and generate the password reset
 * link. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (dialog portals).
 */
export function Users() {
  const titleId = useId();
  const list = useUserList();
  const section = useRef<HTMLElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  // The dialog comes from the row menu, whose trigger goes away on close: focus goes back to the row's "…" or, if the row is gone (or the
  // dialog was the create one), to "Novo usuário". Looked up only inside the screen (ADR 0002).
  function focusOnClose() {
    const row =
      dialog && dialog.type !== 'new'
        ? section.current?.querySelector<HTMLElement>(`[data-fc-user-actions="${dialog.user.id}"]`)
        : null;
    return row ?? newButton.current;
  }

  function close() {
    setDialog(null);
  }

  const users = list.data;
  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
  const newUser = (size: 'small' | 'default', variant: 'primary' | 'secondary', ref?: typeof newButton) => (
    <Button ref={ref} variant={variant} size={size} onClick={() => setDialog({ type: 'new' })}>
      Novo usuário
    </Button>
  );

  const columns: readonly TableColumn<User>[] = [
    {
      key: 'name',
      title: 'Nome',
      skeletonWidth: 180,
      cell: (user) => (
        <div className="fc-users-person">
          <span className="fc-users-name">
            <Text variant="label-14" medium>
              {user.name}
            </Text>
            {user.external ? <Badge>Incorporação</Badge> : null}
          </span>
          <Text variant="label-13" emphasis="secondary" className="fc-users-email">
            {user.email}
          </Text>
        </div>
      ),
    },
    {
      key: 'roles',
      title: 'Papéis',
      skeletonWidth: 120,
      cell: (user) =>
        user.roles.length === 0 ? null : (
          <ul className="fc-users-role-list" aria-label={`Papéis de ${user.name}`}>
            {user.roles.map((role) => (
              <li key={role.id}>
                <Badge>{role.name}</Badge>
              </li>
            ))}
          </ul>
        ),
    },
    {
      key: 'status',
      title: 'Situação',
      width: '120px',
      skeletonWidth: 60,
      cell: (user) => (user.active ? <Status tone="green">Ativo</Status> : <Status tone="gray">Inativo</Status>),
    },
    {
      key: 'actions',
      title: 'Ações',
      hiddenTitle: true,
      align: 'end',
      width: '56px',
      skeletonWidth: 20,
      cell: (user) => (
        <Menu
          trigger={
            <Button
              iconOnly
              variant="ghost"
              size="small"
              label={`Mais ações para ${user.name}`}
              icon={<MoreActionsIcon />}
              data-fc-user-actions={user.id}
            />
          }
          items={[
            { label: 'Editar usuário', onSelect: () => setDialog({ type: 'edit', user }) },
            {
              label: 'Gerar link de redefinição',
              onSelect: () => setDialog({ type: 'link', user }),
              disabledReason: user.external ? EXTERNAL_LINK_REASON : user.active ? undefined : INACTIVE_LINK_REASON,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <section ref={section} className="fc-users" aria-labelledby={titleId}>
      <header className="fc-users-top">
        <div className="fc-users-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Usuários
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {users ? summary(users.length, list.hasNextPage) : 'Quem acessa este tenant e com quais papéis'}
          </Text>
        </div>
        {newUser('default', 'primary', newButton)}
      </header>

      <Table
        caption="Usuários do tenant"
        columns={columns}
        rows={users}
        rowKey={(user) => user.id}
        loading={list.isPending}
        error={
          list.isError && users === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar os usuários"
              actions={
                noPermission ? undefined : (
                  <Button size="small" onClick={() => void list.refetch()} loading={list.isFetching}>
                    Tentar de novo
                  </Button>
                )
              }
            >
              {listErrorMessage(list.error)}
            </Notice>
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<UsersIcon />}
            title="Nenhum usuário ainda"
            description="Crie o primeiro usuário e gere o link para a pessoa definir a senha."
            action={newUser('small', 'secondary')}
          />
        }
      />

      {list.isError && users !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais usuários' : 'Não foi possível atualizar a lista'}
          actions={
            <Button
              size="small"
              loading={list.isFetching}
              onClick={() => void (list.isFetchNextPageError ? list.fetchNextPage() : list.refetch())}
            >
              Tentar de novo
            </Button>
          }
        >
          {listErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage ? (
        <div className="fc-users-more">
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Carregar mais usuários
          </Button>
        </div>
      ) : null}

      {dialog?.type === 'new' ? <UserDialog onClose={close} focusOnClose={focusOnClose} /> : null}
      {dialog?.type === 'edit' ? <UserDialog key={dialog.user.id} user={dialog.user} onClose={close} focusOnClose={focusOnClose} /> : null}
      {dialog?.type === 'link' ? <ResetLinkDialog key={dialog.user.id} user={dialog.user} onClose={close} focusOnClose={focusOnClose} /> : null}
    </section>
  );
}
