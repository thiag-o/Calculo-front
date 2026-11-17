import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, EmptyState, Menu, Status, Table, Text, type TableColumn } from '../../design-system';
import { useApiKeyList, type ApiKey } from './queries';
import { day, dateTime } from './dates';
import { NewApiKeyDialog } from './NewApiKeyDialog';
import { RevokeApiKeyDialog } from './RevokeApiKeyDialog';
import { KeyIcon, MoreActionsIcon } from './icons';
import { queryErrorMessage } from './messages';
import './integration.css';

/** Why "Revogar chave" is disabled on an already revoked key. */
export function revokedApiKeyReason(apiKey: ApiKey): string {
  const when = apiKey.revoked_at ? day(apiKey.revoked_at) : '';
  return when ? `A chave já foi revogada em ${when}` : 'A chave já foi revogada';
}

const ACTIONS_ATTRIBUTE = 'data-fc-api-key-actions';

type OpenDialog = { type: 'new' } | { type: 'revoke'; apiKey: ApiKey };

function summary(apiKeys: readonly ApiKey[], hasMore: boolean): string {
  if (hasMore) return `Mais de ${apiKeys.length.toLocaleString('pt-BR')} chaves`;
  const total = apiKeys.length === 1 ? '1 chave' : `${apiKeys.length.toLocaleString('pt-BR')} chaves`;
  const revoked = apiKeys.filter((apiKey) => apiKey.revoked_at !== null).length;
  if (revoked === 0) return total;
  return `${total} · ${revoked === 1 ? '1 revogada' : `${revoked.toLocaleString('pt-BR')} revogadas`}`;
}

/**
 * Integration › API keys: list (name and prefix, created, last use and status), create (the key shows once,
 * with "Copiar") and revoke with confirmation. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function ApiKeys() {
  const titleId = useId();
  const list = useApiKeyList();
  const section = useRef<HTMLElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);

  function close() {
    setDialog(null);
  }

  // The dialog comes from the row menu, whose trigger goes away on close: focus goes back to the row's "…" or, if the row is gone (or the
  // dialog was the create one), to the main button. Looked up only inside the section (ADR 0002).
  function focusOnClose() {
    const row =
      dialog?.type === 'revoke'
        ? section.current?.querySelector<HTMLElement>(`[${ACTIONS_ATTRIBUTE}="${dialog.apiKey.id}"]`)
        : null;
    return row ?? newButton.current;
  }

  const apiKeys = list.data;
  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
  const newApiKey = (size: 'small' | 'default', variant: 'primary' | 'secondary', ref?: typeof newButton) => (
    <Button ref={ref} variant={variant} size={size} onClick={() => setDialog({ type: 'new' })}>
      Nova chave de API
    </Button>
  );

  const columns: readonly TableColumn<ApiKey>[] = [
    {
      key: 'key',
      title: 'Chave',
      skeletonWidth: 180,
      cell: (apiKey) => (
        <div className="fc-integration-two-lines">
          <Text variant="label-14" medium className="fc-integration-wrap">
            {apiKey.name}
          </Text>
          <Text variant="mono-13" emphasis="secondary" className="fc-integration-wrap">
            {`${apiKey.prefix}…`}
          </Text>
        </div>
      ),
    },
    {
      key: 'created',
      title: 'Criada',
      width: '120px',
      skeletonWidth: 80,
      cell: (apiKey) => (
        <Text variant="label-14" className="fc-integration-number">
          {day(apiKey.created_at)}
        </Text>
      ),
    },
    {
      key: 'last-used',
      title: 'Último uso',
      width: '180px',
      skeletonWidth: 120,
      cell: (apiKey) =>
        apiKey.last_used_at ? (
          <Text variant="label-14" className="fc-integration-number">
            {dateTime(apiKey.last_used_at)}
          </Text>
        ) : (
          <Text variant="label-14" emphasis="secondary">
            Nunca usada
          </Text>
        ),
    },
    {
      key: 'status',
      title: 'Situação',
      width: '140px',
      skeletonWidth: 60,
      cell: (apiKey) =>
        apiKey.revoked_at ? (
          <div className="fc-integration-two-lines">
            <Status tone="gray">Revogada</Status>
            <Text variant="label-13" emphasis="secondary" className="fc-integration-number">
              {`em ${day(apiKey.revoked_at)}`}
            </Text>
          </div>
        ) : (
          <Status tone="green">Ativa</Status>
        ),
    },
    {
      key: 'actions',
      title: 'Ações',
      hiddenTitle: true,
      align: 'end',
      width: '56px',
      skeletonWidth: 20,
      cell: (apiKey) => (
        <Menu
          trigger={
            <Button
              iconOnly
              variant="ghost"
              size="small"
              label={`Mais ações para a chave ${apiKey.name}`}
              icon={<MoreActionsIcon />}
              data-fc-api-key-actions={apiKey.id}
            />
          }
          items={[
            {
              label: 'Revogar chave',
              danger: true,
              onSelect: () => setDialog({ type: 'revoke', apiKey }),
              disabledReason: apiKey.revoked_at ? revokedApiKeyReason(apiKey) : undefined,
            },
          ]}
        />
      ),
    },
  ];

  return (
    <section ref={section} className="fc-integration-section" aria-labelledby={titleId}>
      <header className="fc-integration-top">
        <div className="fc-integration-title">
          <Text as="h2" variant="heading-24" id={titleId}>
            Chaves de API
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {apiKeys ? summary(apiKeys, list.hasNextPage) : 'Para o backend do sistema hospedeiro pedir tokens de incorporação'}
          </Text>
        </div>
        {newApiKey('default', 'primary', newButton)}
      </header>

      <Table
        caption="Chaves de API do tenant"
        columns={columns}
        rows={apiKeys}
        rowKey={(apiKey) => apiKey.id}
        loading={list.isPending}
        error={
          list.isError && apiKeys === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar as chaves de API"
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
            icon={<KeyIcon />}
            title="Nenhuma chave de API ainda"
            description="Crie uma chave para o sistema hospedeiro incorporar o módulo."
            action={newApiKey('small', 'secondary')}
          />
        }
      />

      {list.isError && apiKeys !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais chaves' : 'Não foi possível atualizar a lista'}
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
          {queryErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage ? (
        <div className="fc-integration-more">
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Carregar mais chaves
          </Button>
        </div>
      ) : null}

      {dialog?.type === 'new' ? <NewApiKeyDialog onClose={close} focusOnClose={focusOnClose} /> : null}
      {dialog?.type === 'revoke' ? (
        <RevokeApiKeyDialog key={dialog.apiKey.id} apiKey={dialog.apiKey} onClose={close} focusOnClose={focusOnClose} />
      ) : null}
    </section>
  );
}
