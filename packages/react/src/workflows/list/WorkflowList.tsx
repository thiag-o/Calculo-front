import { useEffect, useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Button, Card, EmptyState, Loading, Notice, Skeleton, Text, TextField } from '../../design-system';
import { useSession } from '../../session';
import { useWorkflowList, type Workflow } from '../queries';
import { NewWorkflowDialog } from './NewWorkflowDialog';
import { WorkflowCard } from './WorkflowCard';
import { PlusIcon, WorkflowIcon } from './icons';
import { listErrorMessage } from './messages';
import { useCardColumns } from './useCardColumns';
import './workflow-list.css';

/** How long the filter waits after the last key before asking the API (ms). */
export const FILTER_DELAY_MS = 300;

/** Permission to create and change workflows. */
export const EDIT_PERMISSION = 'workflows.edit';

export interface WorkflowListProps {
  /**
   * Opens a workflow's Overview (`/workflows/:id` in the module). With it, the cards open the Overview and a new workflow
   * opens right after it is saved. Without it, the cards are plain text.
   */
  onOpenWorkflow?: (id: string) => void;
}

function count(total: number, hasMore: boolean): string {
  if (hasMore) return `Mais de ${total.toLocaleString('pt-BR')} workflows`;
  return total === 1 ? '1 workflow' : `${total.toLocaleString('pt-BR')} workflows`;
}

/**
 * Workflows (`/workflows`): the tenant workflows in cards, the most recently changed first, with "Filtrar por nome" and
 * "Carregar mais". With `workflows.edit`, "Novo workflow" creates one. Needs `ApiProvider`, `QueryClientProvider` and
 * `FluxoRoot` (dialog portal and the module width).
 */
export function WorkflowList({ onOpenWorkflow }: WorkflowListProps = {}) {
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const newButton = useRef<HTMLButtonElement>(null);
  const emptyNewButton = useRef<HTMLButtonElement>(null);
  const session = useSession();
  const columns = useCardColumns(section);
  const [typed, setTyped] = useState('');
  const [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false);
  const list = useWorkflowList({ name: search });

  // The API is asked only after a pause in typing.
  useEffect(() => {
    const timer = setTimeout(() => setSearch(typed.trim()), FILTER_DELAY_MS);
    return () => clearTimeout(timer);
  }, [typed]);

  const canEdit = session.hasPermission(EDIT_PERMISSION);
  const workflows = list.data;
  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';
  const invalidCursor = list.error instanceof ApiError && list.error.code === 'invalid_cursor';
  const neverCreated = workflows !== undefined && workflows.length === 0 && search === '' && typed.trim() === '';
  const now = new Date();

  const newWorkflow = (place: 'top' | 'empty') =>
    canEdit ? (
      <Button
        ref={place === 'top' ? newButton : emptyNewButton}
        variant={place === 'top' ? 'primary' : 'secondary'}
        size={place === 'top' ? 'default' : 'small'}
        icon={<PlusIcon size={place === 'top' ? 16 : 14} />}
        onClick={() => setCreating(true)}
      >
        Novo workflow
      </Button>
    ) : null;

  function created(workflow: Workflow) {
    setCreating(false);
    onOpenWorkflow?.(workflow.id);
  }

  let content;
  if (list.isPending) {
    content = (
      <Loading label="Carregando workflows">
        <div className="fc-workflows-cards" data-columns={columns}>
          {Array.from({ length: columns }, (_, index) => (
            <Card key={index} className="fc-workflows-card">
              <div className="fc-workflows-card-head">
                <span className="fc-workflows-card-icon" />
                <div className="fc-workflows-card-title">
                  <Skeleton width="70%" />
                  <Skeleton width="45%" />
                </div>
              </div>
              <Skeleton width="60%" />
            </Card>
          ))}
        </div>
      </Loading>
    );
  } else if (list.isError && workflows === undefined) {
    content = (
      <Notice
        type="error"
        title="Não foi possível carregar os workflows"
        actions={
          noPermission ? undefined : (
            <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          )
        }
      >
        {listErrorMessage(list.error)}
      </Notice>
    );
  } else if (neverCreated) {
    content = (
      <Card>
        <EmptyState
          icon={<WorkflowIcon />}
          title="Nenhum workflow ainda"
          description={
            canEdit ? 'Crie o primeiro workflow para montar o cálculo.' : 'Quem edita workflows no tenant ainda não criou nenhum.'
          }
          action={newWorkflow('empty')}
        />
      </Card>
    );
  } else if (!workflows || workflows.length === 0) {
    content = (
      <Text as="p" variant="label-14" emphasis="secondary" className="fc-workflows-none">
        {`Nenhum workflow com “${search}” no nome.`}
      </Text>
    );
  } else {
    content = (
      <ul
        className="fc-workflows-cards"
        data-columns={columns}
        aria-labelledby={titleId}
        aria-busy={list.isPlaceholderData || list.isFetchingNextPage || undefined}
      >
        {workflows.map((workflow) => (
          <WorkflowCard key={workflow.id} workflow={workflow} onOpen={onOpenWorkflow} now={now} />
        ))}
      </ul>
    );
  }

  return (
    <section ref={section} className="fc-workflows" aria-labelledby={titleId}>
      <header className="fc-workflows-top">
        <div className="fc-workflows-title">
          <Text as="h1" variant="heading-24" id={titleId}>
            Workflows
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {workflows && workflows.length > 0 && !list.isPlaceholderData
              ? count(workflows.length, list.hasNextPage)
              : 'Os cálculos do tenant, do mais recente para o mais antigo'}
          </Text>
        </div>
        {newWorkflow('top')}
      </header>

      {neverCreated ? null : (
        <TextField
          type="search"
          label="Filtrar por nome"
          className="fc-workflows-filter"
          autoComplete="off"
          value={typed}
          onChange={(event) => setTyped(event.target.value)}
          onKeyDown={(event) => {
            // Enter filters right away.
            if (event.key === 'Enter') setSearch(typed.trim());
          }}
        />
      )}

      {content}

      {list.isError && workflows !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais workflows' : 'Não foi possível atualizar a lista'}
          actions={
            <Button
              size="small"
              loading={list.isFetching}
              onClick={() => void (list.isFetchNextPageError && !invalidCursor ? list.fetchNextPage() : list.refetch())}
            >
              {invalidCursor ? 'Carregar a lista de novo' : 'Tentar de novo'}
            </Button>
          }
        >
          {listErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage && !list.isPlaceholderData ? (
        <div className="fc-workflows-more">
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Carregar mais
          </Button>
        </div>
      ) : null}

      {creating ? (
        <NewWorkflowDialog
          focusOnClose={() => newButton.current ?? emptyNewButton.current}
          onClose={() => setCreating(false)}
          onCreated={created}
        />
      ) : null}
    </section>
  );
}
