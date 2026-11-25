import { useQueryClient } from '@tanstack/react-query';
import { useId, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Button, EmptyState, Notice, Select, Status, Table, Text, type SelectOption, type TableColumn } from '../../design-system';
import { useSession } from '../../session';
import {
  STATUS_CHOICES,
  STATUS_PRESENTATION,
  executionListKey,
  useExecutionList,
  type Execution,
  type ExecutionListFilter,
} from '../api';
import { TRIGGER_PERMISSION, TriggerExecution } from '../trigger';
import { dateTime, executionDuration, parametersSummary, recordsSummary } from './format';
import { EmptyFilterIcon, PlayIcon } from './icons';
import { filterError, listErrorMessage, listSummary } from './messages';
import { useWorkflowOptions } from './queries';
import { useNarrowModule } from './useNarrowModule';
import './execution-list.css';

/** Value of "Todos" in the filters (Radix Select does not accept an empty value). */
const ALL = 'all';

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: ALL, label: 'Todos os status' },
  ...STATUS_CHOICES.map((choice) => ({ value: choice.value, label: choice.label })),
];

/** The first 8 characters of the id, as the execution is told apart in the list (mono, estilos.md §7.6). */
function shortId(id: string): string {
  return id.slice(0, 8);
}

export interface ExecutionListProps {
  /**
   * The list of one workflow (`/workflows/:id/executions`): the workflow filter is fixed and hidden, and "Executar lote"
   * (with `executions.trigger`) triggers it. Without it, the tenant list (`/executions`), with the workflow filter.
   */
  workflowId?: string;
  /**
   * Opens the panel of an execution (`/executions/:id` in the module). With it, the workflow name of each row opens it,
   * and an execution triggered from the list opens right away. Without it, the rows are plain text.
   */
  onOpenExecution?: (id: string) => void;
  /** Opens the Problemas tab of the editor, from the "Executar lote" dialog (see `TriggerExecutionDialogProps`). */
  onOpenProblems?: () => void;
}

/**
 * Execuções (E6-20): the batch executions, newest first, in a table (workflow, status, who triggered, start, duration,
 * records and parameters), with the status filter (one label at a time) and, in the tenant list, the workflow filter;
 * "Carregar mais execuções" by cursor. While an execution on screen still runs, the list is fetched again every 5 s.
 * Below 1180px of module width, the records column goes away (estilos.md §15). Needs `ApiProvider`, `QueryClientProvider`
 * and `FluxoRoot` (portal of the filter lists and of the dialog).
 */
export function ExecutionList({ workflowId, onOpenExecution, onOpenProblems }: ExecutionListProps = {}) {
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const statusFilter = useRef<HTMLButtonElement>(null);
  const queryClient = useQueryClient();
  const session = useSession();
  const narrow = useNarrowModule(section);
  const [status, setStatus] = useState(ALL);
  const [chosenWorkflow, setChosenWorkflow] = useState(ALL);
  const scoped = workflowId !== undefined;
  const workflows = useWorkflowOptions(!scoped);

  const filter: ExecutionListFilter = {
    ...(scoped ? { workflowId } : chosenWorkflow !== ALL ? { workflowId: chosenWorkflow } : {}),
    ...(status !== ALL ? { statuses: STATUS_CHOICES.find((choice) => choice.value === status)?.statuses ?? [] } : {}),
  };
  const list = useExecutionList(filter);
  const executions = list.data;
  const filtered = status !== ALL || (!scoped && chosenWorkflow !== ALL);
  const noDataError = list.isError && executions === undefined ? list.error : null;
  const noPermission = noDataError instanceof ApiError && noDataError.code === 'no_permission';
  const invalidCursor = list.error instanceof ApiError && list.error.code === 'invalid_cursor';
  const now = new Date();

  const workflowOptions = useMemo<readonly SelectOption[]>(
    () => [{ value: ALL, label: 'Todos os workflows' }, ...(workflows.data?.items ?? []).map((item) => ({ value: item.id, label: item.name }))],
    [workflows.data],
  );

  function clearFilters() {
    setStatus(ALL);
    setChosenWorkflow(ALL);
    // The action goes away with the new list: focus goes to the first filter.
    statusFilter.current?.focus();
  }

  const allColumns: readonly TableColumn<Execution>[] = [
    {
      key: 'workflow',
      title: 'Workflow',
      skeletonWidth: 180,
      cell: (execution) => (
        <span className="fc-executions-what">
          {onOpenExecution ? (
            <button
              type="button"
              className="fc-executions-link"
              aria-label={`${execution.workflow_name}, execução ${shortId(execution.id)}`}
              onClick={() => onOpenExecution(execution.id)}
            >
              {execution.workflow_name}
            </button>
          ) : (
            <Text variant="label-14" className="fc-executions-wrap">
              {execution.workflow_name}
            </Text>
          )}
          <Text variant="mono-13" emphasis="secondary">
            {shortId(execution.id)}
          </Text>
        </span>
      ),
    },
    {
      key: 'status',
      title: 'Status',
      skeletonWidth: 96,
      cell: (execution) => {
        const presentation = STATUS_PRESENTATION[execution.status];
        return (
          <Status tone={presentation.tone} pulsing={presentation.pulsing} className="fc-executions-nowrap">
            {presentation.label}
          </Status>
        );
      },
    },
    {
      key: 'who',
      title: 'Disparado por',
      skeletonWidth: 120,
      cell: (execution) => (
        <Text variant="label-14" className="fc-executions-wrap">
          {execution.triggered_by?.name ?? 'Agendada'}
        </Text>
      ),
    },
    {
      key: 'start',
      title: 'Início',
      skeletonWidth: 128,
      cell: (execution) => {
        const when = dateTime(execution.started_at);
        return when ? (
          <Text variant="label-14" className="fc-executions-number">
            {when}
          </Text>
        ) : null;
      },
    },
    {
      key: 'duration',
      title: 'Duração',
      align: 'end',
      skeletonWidth: 56,
      cell: (execution) => {
        const duration = executionDuration(execution, now);
        return duration ? (
          <Text variant="label-14" className="fc-executions-number">
            {duration}
          </Text>
        ) : null;
      },
    },
    {
      key: 'records',
      title: 'Registros',
      align: 'end',
      skeletonWidth: 120,
      cell: (execution) => {
        const records = recordsSummary(execution.totals);
        return records ? (
          <Text variant="label-14" className="fc-executions-number">
            {records}
          </Text>
        ) : null;
      },
    },
    {
      key: 'parameters',
      title: 'Parâmetros',
      skeletonWidth: 160,
      cell: (execution) => {
        const summary = parametersSummary(execution.parameters);
        return summary ? (
          <Text variant="label-13" emphasis="secondary" className="fc-executions-wrap">
            {summary}
          </Text>
        ) : null;
      },
    },
  ];
  // The result column goes away below 1180px (estilos.md §15).
  const columns = narrow ? allColumns.filter((column) => column.key !== 'records') : allColumns;

  const trigger =
    scoped && workflowId ? (
      <TriggerExecution
        workflowId={workflowId}
        variant="primary"
        onOpenProblems={onOpenProblems}
        onTriggered={(execution) => onOpenExecution?.(execution.id)}
      />
    ) : null;
  const emptyTrigger =
    scoped && workflowId ? (
      <TriggerExecution
        workflowId={workflowId}
        size="small"
        onOpenProblems={onOpenProblems}
        onTriggered={(execution) => onOpenExecution?.(execution.id)}
      />
    ) : null;
  const canTrigger = session.hasPermission(TRIGGER_PERMISSION);

  const clearButton = (
    <Button size="small" onClick={clearFilters}>
      Limpar filtros
    </Button>
  );

  return (
    <section ref={section} className="fc-executions" aria-labelledby={titleId}>
      <header className="fc-executions-top">
        <div className="fc-executions-title">
          <Text as="h1" variant="heading-24" id={titleId}>
            Execuções
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {executions && executions.length > 0 && !list.isPlaceholderData
              ? listSummary(executions.length, list.hasNextPage, filtered)
              : scoped
                ? 'As execuções em lote deste workflow, da mais nova para a mais antiga'
                : 'As execuções em lote do tenant, da mais nova para a mais antiga'}
          </Text>
        </div>
        {trigger}
      </header>

      <div className="fc-executions-filters" role="group" aria-label="Filtros das execuções">
        <Select
          ref={statusFilter}
          className="fc-executions-filter"
          label="Status"
          options={STATUS_OPTIONS}
          value={status}
          onValueChange={setStatus}
        />
        {!scoped && !workflows.isError ? (
          <Select
            className="fc-executions-filter"
            label="Workflow"
            tooltip={workflows.data?.more ? 'Mostra os 200 workflows alterados mais recentemente.' : undefined}
            options={workflowOptions}
            value={chosenWorkflow}
            disabled={workflows.isPending}
            onValueChange={setChosenWorkflow}
          />
        ) : null}
      </div>

      {/* While a new filter loads, the previous rows stay on screen: the region says it is about to change. */}
      <div className="fc-executions-results" aria-busy={list.isPlaceholderData || undefined}>
        <Table
          caption={scoped ? 'Execuções do workflow' : 'Execuções do tenant'}
          className="fc-executions-table"
          columns={columns}
          rows={executions}
          rowKey={(execution) => execution.id}
          loading={list.isPending}
          loadingRows={5}
          error={
            noDataError ? (
              <Notice
                type="error"
                title="Não foi possível carregar as execuções"
                actions={
                  noPermission ? undefined : filterError(noDataError) ? (
                    clearButton
                  ) : (
                    <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
                      Tentar de novo
                    </Button>
                  )
                }
              >
                {listErrorMessage(noDataError)}
              </Notice>
            ) : undefined
          }
          empty={
            filtered ? (
              <EmptyState
                icon={<EmptyFilterIcon />}
                title="Nenhuma execução com esses filtros"
                description="Mude o status ou o workflow, ou limpe os filtros para ver todas as execuções."
                action={clearButton}
              />
            ) : (
              <EmptyState
                icon={<PlayIcon />}
                title="Nenhuma execução ainda"
                description={
                  scoped
                    ? canTrigger
                      ? 'Execute o lote para ver a primeira execução deste workflow aqui.'
                      : 'Quem executa lotes no tenant ainda não executou este workflow.'
                    : 'As execuções em lote dos workflows do tenant aparecem aqui.'
                }
                action={emptyTrigger}
              />
            )
          }
        />
      </div>

      {list.isError && executions !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais execuções' : 'Não foi possível atualizar a lista'}
          actions={
            invalidCursor ? (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void queryClient.resetQueries({ queryKey: executionListKey(filter), exact: true })}
              >
                Recarregar lista
              </Button>
            ) : (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void (list.isFetchNextPageError ? list.fetchNextPage() : list.refetch())}
              >
                Tentar de novo
              </Button>
            )
          }
        >
          {listErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage && !list.isPlaceholderData ? (
        <div className="fc-executions-more">
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Carregar mais execuções
          </Button>
        </div>
      ) : null}
    </section>
  );
}
