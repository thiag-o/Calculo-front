import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, EmptyState, Menu, Table, Text, type TableColumn } from '../../design-system';
import { useAuthorizedDomainList, type AuthorizedDomain } from './queries';
import { day } from './dates';
import { NewAuthorizedDomainDialog } from './NewAuthorizedDomainDialog';
import { DeleteAuthorizedDomainDialog } from './DeleteAuthorizedDomainDialog';
import { GlobeIcon, MoreActionsIcon } from './icons';
import { queryErrorMessage } from './messages';
import './integration.css';

const ACTIONS_ATTRIBUTE = 'data-fc-authorized-domain-actions';

type OpenDialog = { type: 'new' } | { type: 'delete'; authorizedDomain: AuthorizedDomain };

function summary(total: number): string {
  return total === 1 ? '1 domínio' : `${total.toLocaleString('pt-BR')} domínios`;
}

/**
 * Integration › Authorized domains: the origins that may use the embedded module from the browser; register (with
 * origin validation) and delete with confirmation. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function AuthorizedDomains() {
  const titleId = useId();
  const list = useAuthorizedDomainList();
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
      dialog?.type === 'delete'
        ? section.current?.querySelector<HTMLElement>(`[${ACTIONS_ATTRIBUTE}="${dialog.authorizedDomain.id}"]`)
        : null;
    return row ?? newButton.current;
  }

  const authorizedDomains = list.data;
  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
  const newAuthorizedDomain = (size: 'small' | 'default', variant: 'primary' | 'secondary', ref?: typeof newButton) => (
    <Button ref={ref} variant={variant} size={size} onClick={() => setDialog({ type: 'new' })}>
      Novo domínio
    </Button>
  );

  const columns: readonly TableColumn<AuthorizedDomain>[] = [
    {
      key: 'origin',
      title: 'Origem',
      skeletonWidth: 220,
      cell: (authorizedDomain) => (
        <Text variant="mono-13" medium className="fc-integration-wrap">
          {authorizedDomain.origin}
        </Text>
      ),
    },
    {
      key: 'registered',
      title: 'Cadastrado',
      width: '120px',
      skeletonWidth: 80,
      cell: (authorizedDomain) => (
        <Text variant="label-14" className="fc-integration-number">
          {day(authorizedDomain.created_at)}
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
      cell: (authorizedDomain) => (
        <Menu
          trigger={
            <Button
              iconOnly
              variant="ghost"
              size="small"
              label={`Mais ações para ${authorizedDomain.origin}`}
              icon={<MoreActionsIcon />}
              data-fc-authorized-domain-actions={authorizedDomain.id}
            />
          }
          items={[{ label: 'Remover domínio', danger: true, onSelect: () => setDialog({ type: 'delete', authorizedDomain }) }]}
        />
      ),
    },
  ];

  return (
    <section ref={section} className="fc-integration-section" aria-labelledby={titleId}>
      <header className="fc-integration-top">
        <div className="fc-integration-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Domínios autorizados
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {authorizedDomains ? summary(authorizedDomains.length) : 'Origens que podem usar o módulo incorporado pelo navegador'}
          </Text>
        </div>
        {newAuthorizedDomain('default', 'primary', newButton)}
      </header>

      <Table
        caption="Domínios autorizados do tenant"
        columns={columns}
        rows={authorizedDomains}
        rowKey={(authorizedDomain) => authorizedDomain.id}
        loading={list.isPending}
        loadingRows={2}
        error={
          list.isError && authorizedDomains === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar os domínios autorizados"
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
            icon={<GlobeIcon />}
            title="Nenhum domínio autorizado ainda"
            description="Autorize a origem do sistema hospedeiro para o módulo incorporado funcionar nela."
            action={newAuthorizedDomain('small', 'secondary')}
          />
        }
      />

      {list.isError && authorizedDomains !== undefined ? (
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

      {dialog?.type === 'new' ? <NewAuthorizedDomainDialog onClose={close} focusOnClose={focusOnClose} /> : null}
      {dialog?.type === 'delete' ? (
        <DeleteAuthorizedDomainDialog key={dialog.authorizedDomain.id} authorizedDomain={dialog.authorizedDomain} onClose={close} focusOnClose={focusOnClose} />
      ) : null}
    </section>
  );
}
