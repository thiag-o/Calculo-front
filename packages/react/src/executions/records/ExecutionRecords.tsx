import { useQueryClient } from '@tanstack/react-query';
import { forwardRef, useEffect, useId, useMemo, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Button, EmptyState, Notice, Select, Status, Table, Text, textClasses, type SelectOption, type TableColumn } from '../../design-system';
import {
  executionRecordListsKey,
  executionRecordsKey,
  useExecutionRecords,
  type Execution,
  type ExecutionRecordFilter,
  type ExecutionRecordSummary,
  type RecordFailureCode,
  type RecordStatus,
} from '../api';
import { EmptyFilterIcon, ListIcon } from './icons';
import { RECORD_STATUS, RECORD_STATUS_CHOICES, nodelessName, recordKeyText } from './labels';
import { recordsErrorMessage, recordsSummary } from './messages';
import { RecordTraceDrawer, type RenderRecordTrace } from './RecordTraceDrawer';
import './records.css';

/** Value of "Todos" in the status filter (Radix Select does not accept an empty value). */
const ALL = 'all';

const STATUS_OPTIONS: readonly SelectOption[] = [
  { value: ALL, label: 'Todos os status' },
  ...RECORD_STATUS_CHOICES.map((choice) => ({ value: choice.value, label: choice.label })),
];

/** An error group chosen in the panel: the records with the error in that node and code. */
export interface ErrorGroupFilter {
  /** The node; `null` in the batch source and in the key errors (then only the code filters, D40). */
  nodeId: string | null;
  code: RecordFailureCode;
  /** How the group reads ("calc_pontos" or "Fonte do lote"). */
  label: string;
}

/** The filter of the records table: one status at a time and, optionally, an error group. */
export interface RecordsFilter {
  status: RecordStatus | null;
  group: ErrorGroupFilter | null;
}

export const NO_RECORDS_FILTER: RecordsFilter = { status: null, group: null };

/** The API filter of the table filter. A group without a node filters only by the code until the B154 (D40). */
export function apiRecordFilter(filter: RecordsFilter): ExecutionRecordFilter {
  return {
    ...(filter.status ? { statuses: [filter.status] } : {}),
    ...(filter.group?.nodeId ? { nodeId: filter.group.nodeId } : {}),
    ...(filter.group ? { code: filter.group.code } : {}),
  };
}

export interface ExecutionRecordsProps {
  execution: Execution;
  filter: RecordsFilter;
  onFilterChange: (filter: RecordsFilter) => void;
  /** The trace of a record in the drawer (the component of the editor, wired by the module, ADR 0062). */
  renderRecordTrace?: RenderRecordTrace;
}

/**
 * Registros (E6-21, `traces.view`): the records of the execution in the reading order, with status, key and error, the
 * status filter and the error group chosen in the panel; "Carregar mais registros" by cursor. The key of a calculated
 * record opens its trace in the side drawer. While the execution runs, the list is read again at each new chunk.
 */
export const ExecutionRecords = forwardRef<HTMLHeadingElement, ExecutionRecordsProps>(function ExecutionRecords(
  { execution, filter, onFilterChange, renderRecordTrace },
  headingRef,
) {
  const titleId = useId();
  const queryClient = useQueryClient();
  const statusFilter = useRef<HTMLButtonElement>(null);
  const [openKey, setOpenKey] = useState<string | null>(null);
  const opener = useRef<HTMLElement | null>(null);
  const apiFilter = apiRecordFilter(filter);
  const list = useExecutionRecords(execution.id, apiFilter);
  const records = list.data;
  // A record without `result_key` (failed before it had one) is told apart by its place in the list: two of them can
  // share the record key and the error code.
  const positions = useMemo(() => new Map((records ?? []).map((record, index) => [record, index])), [records]);
  const filtered = filter.status !== null || filter.group !== null;
  const noDataError = list.isError && records === undefined ? list.error : null;
  const invalidCursor = list.error instanceof ApiError && list.error.code === 'invalid_cursor';

  // A new chunk (or the final state) brings new records: every list of this execution is read again.
  const progressMark = `${execution.progress.chunks_done}:${execution.status}`;
  const lastMark = useRef(progressMark);
  useEffect(() => {
    if (lastMark.current === progressMark) return;
    lastMark.current = progressMark;
    void queryClient.invalidateQueries({ queryKey: executionRecordListsKey(execution.id) });
  }, [progressMark, execution.id, queryClient]);

  function clearFilters() {
    onFilterChange(NO_RECORDS_FILTER);
    // The action goes away with the new list: focus goes to the status filter.
    statusFilter.current?.focus();
  }

  const columns: readonly TableColumn<ExecutionRecordSummary>[] = [
    {
      key: 'status',
      title: 'Status',
      skeletonWidth: 80,
      cell: (record) => {
        const status = RECORD_STATUS[record.status];
        return (
          <Status tone={status.tone} className="fc-records-nowrap">
            {status.word}
          </Status>
        );
      },
    },
    {
      key: 'key',
      title: 'Registro',
      skeletonWidth: 200,
      cell: (record) => {
        const key = recordKeyText(record.record_key);
        const resultKey = record.result_key;
        return resultKey ? (
          <button
            type="button"
            className="fc-records-key"
            aria-label={`Abrir o trace de ${key}`}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setOpenKey(resultKey);
            }}
          >
            {key}
          </button>
        ) : (
          <span className="fc-records-what">
            <Text variant="mono-13" className="fc-records-wrap">
              {key}
            </Text>
            <Text variant="label-12" emphasis="secondary">
              Sem trace: o registro não foi calculado
            </Text>
          </span>
        );
      },
    },
    {
      key: 'error',
      title: 'Erro',
      skeletonWidth: 220,
      cell: (record) =>
        record.error_code ? (
          <span className="fc-records-what">
            <Text variant="mono-13" className="fc-records-wrap">
              {record.error_node_id ?? nodelessName(record.error_code)}
            </Text>
            <Text variant="mono-12" emphasis="secondary" className="fc-records-wrap">
              {record.error_code}
            </Text>
          </span>
        ) : null,
    },
  ];

  const clearButton = (
    <Button size="small" onClick={clearFilters}>
      Limpar filtros
    </Button>
  );

  return (
    <section className="fc-records" aria-labelledby={titleId}>
      <div className="fc-records-top">
        <h2 id={titleId} ref={headingRef} tabIndex={-1} className={`fc-text ${textClasses({ variant: 'heading-16' })} fc-records-title`}>
          Registros
        </h2>
        <Text as="p" variant="label-13" emphasis="secondary">
          {records && records.length > 0 ? recordsSummary(records.length, list.hasNextPage, filtered) : 'Na ordem de leitura do lote'}
        </Text>
      </div>

      <div className="fc-records-filters" role="group" aria-label="Filtros dos registros">
        <Select
          ref={statusFilter}
          className="fc-records-filter"
          label="Status"
          options={STATUS_OPTIONS}
          value={filter.status ?? ALL}
          onValueChange={(value) => onFilterChange({ ...filter, status: value === ALL ? null : (value as RecordStatus) })}
        />
        {filter.group ? (
          <div className="fc-records-group" role="status">
            <Text variant="label-13" emphasis="secondary">
              Erro
            </Text>
            <Text variant="mono-13">{filter.group.label}</Text>
            <Text variant="mono-12" emphasis="secondary">
              {filter.group.code}
            </Text>
            <Button size="small" variant="ghost" onClick={() => onFilterChange({ ...filter, group: null })}>
              Limpar filtro do erro
            </Button>
          </div>
        ) : null}
      </div>

      <Table
        caption="Registros da execução"
        columns={columns}
        rows={records}
        rowKey={(record) => record.result_key ?? `row:${positions.get(record) ?? -1}:${JSON.stringify(record.record_key)}`}
        loading={list.isPending}
        loadingRows={5}
        error={
          noDataError ? (
            <Notice
              type="error"
              title="Não foi possível carregar os registros"
              actions={
                <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
                  Tentar de novo
                </Button>
              }
            >
              {recordsErrorMessage(noDataError)}
            </Notice>
          ) : undefined
        }
        empty={
          filtered ? (
            <EmptyState
              icon={<EmptyFilterIcon />}
              title="Nenhum registro com esse filtro"
              description="Mude o status ou limpe os filtros para ver todos os registros."
              action={clearButton}
            />
          ) : (
            <EmptyState
              icon={<ListIcon />}
              title="Nenhum registro ainda"
              description="Os registros aparecem aqui conforme a execução calcula cada parte do lote."
            />
          )
        }
      />

      {list.isError && records !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais registros' : 'Não foi possível atualizar os registros'}
          actions={
            invalidCursor ? (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void queryClient.resetQueries({ queryKey: executionRecordsKey(execution.id, apiFilter), exact: true })}
              >
                Recarregar registros
              </Button>
            ) : (
              <Button size="small" loading={list.isFetching} onClick={() => void (list.isFetchNextPageError ? list.fetchNextPage() : list.refetch())}>
                Tentar de novo
              </Button>
            )
          }
        >
          {recordsErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage ? (
        <div className="fc-records-more">
          <Button loading={list.isFetchingNextPage} onClick={() => void list.fetchNextPage()}>
            Carregar mais registros
          </Button>
        </div>
      ) : null}

      <RecordTraceDrawer
        executionId={execution.id}
        resultKey={openKey}
        onClose={() => setOpenKey(null)}
        renderRecordTrace={renderRecordTrace}
        focusOnClose={() => opener.current}
      />
    </section>
  );
});
