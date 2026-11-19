import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../api';
import { Notice, Button, Card, Loading, Menu, Text, textClasses, type MenuItem } from '../../design-system';
import { useSession } from '../../session';
import { CredentialDialog } from './CredentialDialog';
import { DeleteConnectionDialog } from './DeleteConnectionDialog';
import { dateTime, TYPE_LABELS } from './format';
import { BackIcon, MoreActionsIcon } from './icons';
import { isNotFoundError } from '../errors';
import { NO_PERMISSION_MESSAGE, formError, isConnectionChanged, isCredentialUnreadable, queryErrorMessage } from './messages';
import { ReloadNotice } from './ReloadNotice';
import { RenameConnectionDialog } from './RenameConnectionDialog';
import { CONNECTIONS_MANAGE, CREDENTIALS_MANAGE, useConnection, useTestConnection, type Connection } from './queries';
import { TestResult, TestStatus } from './TestStatus';
import './connections.css';

type OpenDialog = 'rename' | 'credential' | 'delete';

export interface ConnectionDetailProps {
  /** Id (UUID) of the connection. */
  connectionId: string;
  /** Back to the list ("Voltar para Conexões" and after deleting the connection). */
  onBack: () => void;
  /** Puts the focus on the title when the detail opens from the list (keyboard and screen reader land on it). */
  focusTitle?: boolean;
}

/**
 * Catalog › Conexões › one connection: type, last test and, only for whoever has `credentials.manage`, the target (host, port,
 * database and user; never the password). With `connections.manage`: "Testar" (the saved connection), rename and delete
 * with confirmation; with `credentials.manage`: "Trocar credencial". Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function ConnectionDetail({ connectionId, onBack, focusTitle = false }: ConnectionDetailProps) {
  const query = useConnection(connectionId);
  const connection = query.data;

  if (!connection) {
    if (query.isError) {
      const notFound = isNotFoundError(query.error, true);
      const noPermission = query.error instanceof ApiError && query.error.code === 'no_permission';
      return (
        <DetailFrame onBack={onBack}>
          <Notice
            type="error"
            title="Não foi possível abrir a conexão"
            actions={
              notFound ? (
                <Button size="small" onClick={onBack}>
                  Voltar para Conexões
                </Button>
              ) : noPermission ? undefined : (
                <Button size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
                  Tentar de novo
                </Button>
              )
            }
          >
            {queryErrorMessage(query.error, NO_PERMISSION_MESSAGE, true)}
          </Notice>
        </DetailFrame>
      );
    }
    return (
      <DetailFrame onBack={onBack}>
        <Loading label="Carregando a conexão" rows={4} />
      </DetailFrame>
    );
  }

  return <LoadedDetail
      connection={connection}
      onBack={onBack}
      focusTitle={focusTitle}
      refetchError={query.isError ? query.error : null}
      onReload={() => query.refetch()}
    />;
}

/** The "Voltar para Conexões" button above the detail, in every state. */
function DetailFrame({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <section className="fc-connections" aria-label="Conexão">
      <div>
        <Button variant="ghost" size="small" icon={<BackIcon size={14} />} onClick={onBack}>
          Voltar para Conexões
        </Button>
      </div>
      {children}
    </section>
  );
}

interface LoadedDetailProps {
  connection: Connection;
  onBack: () => void;
  focusTitle: boolean;
  refetchError: Error | null;
  /** Fetches the connection again (the "Recarregar" of a version conflict). */
  onReload: () => Promise<unknown>;
}

function LoadedDetail({ connection, onBack, focusTitle, refetchError, onReload }: LoadedDetailProps) {
  const titleId = useId();
  const session = useSession();
  const test = useTestConnection(connection.id);
  const title = useRef<HTMLHeadingElement>(null);
  const moreButton = useRef<HTMLButtonElement>(null);
  const [dialog, setDialog] = useState<OpenDialog | null>(null);
  const canManage = session.hasPermission(CONNECTIONS_MANAGE);
  const canManageCredentials = session.hasPermission(CREDENTIALS_MANAGE);

  useEffect(() => {
    if (focusTitle) title.current?.focus();
  }, [focusTitle]);

  const items: MenuItem[] = [];
  if (canManage) items.push({ label: 'Renomear conexão', onSelect: () => setDialog('rename') });
  if (canManageCredentials) items.push({ label: 'Trocar credencial', onSelect: () => setDialog('credential') });
  if (canManage) items.push({ type: 'separator' }, { label: 'Remover conexão', danger: true, onSelect: () => setDialog('delete') });

  const close = () => setDialog(null);
  // After a version conflict: the connection is fetched again and the dialog closes, so it opens again with the current data.
  const reloadAndClose = async () => {
    await onReload();
    close();
  };
  const target = canManageCredentials ? connection.target : null;
  const lastTest = connection.last_test;

  return (
    <section className="fc-connections" aria-labelledby={titleId}>
      <div>
        <Button variant="ghost" size="small" icon={<BackIcon size={14} />} onClick={onBack}>
          Voltar para Conexões
        </Button>
      </div>
      <header className="fc-connections-top">
        <div className="fc-connections-title">
          <h2 id={titleId} ref={title} tabIndex={-1} className={`fc-text fc-connections-wrap ${textClasses({ variant: 'heading-16' })}`}>
            {connection.name}
          </h2>
          <Text as="p" variant="label-14" emphasis="secondary">
            {TYPE_LABELS[connection.type]}
          </Text>
        </div>
        {canManage || items.length > 0 ? (
          <div className="fc-connections-actions">
            {canManage ? (
              <Button loading={test.isPending} onClick={() => test.mutate()}>
                Testar
              </Button>
            ) : null}
            {items.length > 0 ? (
              <Menu
                trigger={
                  <Button ref={moreButton} iconOnly variant="secondary" label={`Mais ações para ${connection.name}`} icon={<MoreActionsIcon />} />
                }
                items={items}
              />
            ) : null}
          </div>
        ) : null}
      </header>

      {refetchError ? <Notice type="error" title="Não foi possível atualizar a conexão">{queryErrorMessage(refetchError, NO_PERMISSION_MESSAGE, true)}</Notice> : null}

      <div aria-live="polite">{test.data ? <TestResult result={test.data} /> : null}</div>
      {test.error && isConnectionChanged(test.error) ? (
        <ReloadNotice
          message={formError(test.error).message ?? ''}
          onReload={async () => {
            await onReload();
            test.reset();
          }}
        />
      ) : test.error ? (
        <Notice
          type="error"
          actions={
            isCredentialUnreadable(test.error) && canManageCredentials ? (
              <Button size="small" onClick={() => setDialog('credential')}>
                Trocar credencial
              </Button>
            ) : undefined
          }
        >
          {formError(test.error).message}
        </Notice>
      ) : null}

      <Card as="div">
        <dl className="fc-connections-pairs">
          <Pair label="Último teste">
            <span className="fc-connections-stack">
              <TestStatus test={lastTest} />
              {lastTest?.error ? (
                <Text variant="label-13" emphasis="secondary">
                  {lastTest.error.message}
                </Text>
              ) : null}
            </span>
          </Pair>
          {target ? (
            <>
              <Pair label="Host" mono>
                {target.host}
              </Pair>
              <Pair label="Porta" mono>
                {String(target.port)}
              </Pair>
              <Pair label="Banco" mono>
                {target.database}
              </Pair>
              <Pair label="Usuário" mono>
                {target.username}
              </Pair>
            </>
          ) : null}
          <Pair label="Criada em">{dateTime(connection.created_at) || '—'}</Pair>
          <Pair label="Alterada em">{dateTime(connection.updated_at) || '—'}</Pair>
        </dl>
      </Card>

      {dialog === 'rename' ? <RenameConnectionDialog connection={connection} onClose={close} onReload={reloadAndClose} focusOnClose={moreButton} /> : null}
      {dialog === 'credential' && canManageCredentials ? (
        <CredentialDialog connection={connection} canTest={canManage} onClose={close} onReload={reloadAndClose} focusOnClose={moreButton} />
      ) : null}
      {dialog === 'delete' ? (
        <DeleteConnectionDialog connection={connection} onClose={close} onDeleted={onBack} focusOnClose={moreButton} />
      ) : null}
    </section>
  );
}

/** A label/value pair of the detail (estilos.md §7.6): secondary label-13 label and the value below it. */
function Pair({ label, mono = false, children }: { label: string; mono?: boolean; children: ReactNode }) {
  return (
    <div className="fc-connections-pair">
      <dt className={textClasses({ variant: 'label-13', emphasis: 'secondary' })}>{label}</dt>
      <dd className={`fc-connections-wrap fc-connections-number ${textClasses({ variant: mono ? 'mono-13' : 'label-14' })}`}>
        {children}
      </dd>
    </div>
  );
}
