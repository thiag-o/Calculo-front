import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, EmptyState, Table, Text, type TableColumn } from '../../design-system';
import { useSession } from '../../session';
import { TYPE_LABELS } from './format';
import { DatabaseIcon } from './icons';
import { LIST_NO_PERMISSION_MESSAGE, queryErrorMessage } from './messages';
import { NewConnectionDialog } from './NewConnectionDialog';
import { CONNECTIONS_MANAGE, CREDENTIALS_MANAGE, useConnectionList, type Connection } from './queries';
import { TestStatus } from './TestStatus';
import './connections.css';

const LINK_ATTRIBUTE = 'data-fc-connection-link';

function summary(total: number): string {
  return total === 1 ? '1 conexão' : `${total.toLocaleString('pt-BR')} conexões`;
}

export interface ConnectionListProps {
  /** Opens the detail of a connection (the name in each row). */
  onOpen: (id: string) => void;
  /** When the screen comes back from a detail, the focus goes to that connection's name in the list. */
  focusConnectionId?: string;
}

/**
 * Catalog › Conexões: the tenant connections with name, type and last test ("ok", "falhou" or "não testada", with the date).
 * "Nova conexão" shows only with `connections.manage` and `credentials.manage`. Needs `ApiProvider`, `QueryClientProvider`
 * and `FluxoRoot`.
 */
export function ConnectionList({ onOpen, focusConnectionId }: ConnectionListProps) {
  const titleId = useId();
  const session = useSession();
  const list = useConnectionList();
  const section = useRef<HTMLElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const [creating, setCreating] = useState(false);
  const canCreate = session.hasPermission(CONNECTIONS_MANAGE) && session.hasPermission(CREDENTIALS_MANAGE);

  const connections = list.data;
  const loaded = connections !== undefined;
  // Back from a detail: the focus goes to that connection's name, looked up only inside the section (ADR 0002).
  useEffect(() => {
    if (!loaded || !focusConnectionId) return;
    section.current?.querySelector<HTMLElement>(`[${LINK_ATTRIBUTE}="${focusConnectionId}"]`)?.focus();
  }, [loaded, focusConnectionId]);

  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
  const newConnection = (size: 'small' | 'default', variant: 'primary' | 'secondary', ref?: typeof newButton) => (
    <Button ref={ref} variant={variant} size={size} onClick={() => setCreating(true)}>
      Nova conexão
    </Button>
  );

  const columns: readonly TableColumn<Connection>[] = [
    {
      key: 'name',
      title: 'Nome',
      skeletonWidth: 200,
      cell: (connection) => (
        <button
          type="button"
          className="fc-connections-link fc-label-14 fc-text-medium"
          onClick={() => onOpen(connection.id)}
          data-fc-connection-link={connection.id}
        >
          {connection.name}
        </button>
      ),
    },
    {
      key: 'type',
      title: 'Tipo',
      width: '140px',
      skeletonWidth: 80,
      cell: (connection) => <Text variant="label-14">{TYPE_LABELS[connection.type]}</Text>,
    },
    {
      key: 'last-test',
      title: 'Último teste',
      width: '260px',
      skeletonWidth: 160,
      cell: (connection) => <TestStatus test={connection.last_test} />,
    },
  ];

  return (
    <section ref={section} className="fc-connections" aria-labelledby={titleId}>
      <header className="fc-connections-top">
        <div className="fc-connections-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Conexões
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {connections ? summary(connections.length) : 'Bancos do cliente de onde vêm os dados'}
          </Text>
        </div>
        {canCreate ? newConnection('default', 'primary', newButton) : null}
      </header>

      <Table
        caption="Conexões do tenant"
        columns={columns}
        rows={connections}
        rowKey={(connection) => connection.id}
        loading={list.isPending}
        loadingRows={3}
        error={
          list.isError && connections === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar as conexões"
              actions={
                noPermission ? undefined : (
                  <Button size="small" onClick={() => void list.refetch()} loading={list.isFetching}>
                    Tentar de novo
                  </Button>
                )
              }
            >
              {queryErrorMessage(list.error, LIST_NO_PERMISSION_MESSAGE)}
            </Notice>
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<DatabaseIcon />}
            title="Nenhuma conexão ainda"
            description={
              canCreate
                ? 'Cadastre o banco do cliente para criar datasets a partir dele.'
                : 'Peça a quem gerencia as conexões e as credenciais para cadastrar o banco do cliente.'
            }
            action={canCreate ? newConnection('small', 'secondary') : undefined}
          />
        }
      />

      {list.isError && connections !== undefined ? (
        <Notice
          type="error"
          title="Não foi possível atualizar a lista"
          actions={
            <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          {queryErrorMessage(list.error, LIST_NO_PERMISSION_MESSAGE)}
        </Notice>
      ) : null}

      {creating ? <NewConnectionDialog onClose={() => setCreating(false)} focusOnClose={newButton} /> : null}
    </section>
  );
}
