import { useQueryClient } from '@tanstack/react-query';
import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Button, EmptyState, Notice, Select, Status, Table, Text, type SelectOption, type TableColumn } from '../../design-system';
import { useSession } from '../../session';
import { isRunning, type Execution } from '../api';
import { RecordTraceDrawer, recordKeyText, type RenderRecordTrace } from '../records';
import { EmptyFilterIcon, FileCheckIcon } from './icons';
import {
  COUNTS,
  DIVERGENT_OUTCOMES,
  OUTCOME_PRESENTATION,
  countText,
  expectedStatusText,
  obtainedStatusText,
  summaryText,
  valueText,
} from './labels';
import { comparisonErrorMessage, listedText } from './messages';
import { comparisonRecordsKey, useComparisonRecords, type ComparisonOutcome, type ComparisonRecord, type ComparisonSummary } from './queries';
import './comparison.css';

/** The diff accepts either permission (contract, ADR 0046). */
const DIFF_PERMISSIONS = ['simulations.run', 'traces.view'] as const;

/** The outcome filter: the divergences (default), one outcome, or every compared record. */
type OutcomeFilter = 'divergent' | 'all' | ComparisonOutcome;

const FILTER_OPTIONS: readonly SelectOption[] = [
  { value: 'divergent', label: 'Todas as divergências' },
  { value: 'different', label: 'Diferentes' },
  { value: 'status_differs', label: 'Status diferente' },
  { value: 'missing_from_result', label: 'Fora do resultado' },
  { value: 'missing_from_file', label: 'Fora do arquivo' },
  { value: 'equal', label: 'Iguais' },
  { value: 'all', label: 'Todos os registros' },
];

function outcomesOf(filter: OutcomeFilter): readonly ComparisonOutcome[] {
  if (filter === 'divergent') return DIVERGENT_OUTCOMES;
  if (filter === 'all') return [];
  return [filter];
}

export interface ReferenceComparisonProps {
  /** A simulation with a reference file (`mode` `simulation` and `reference_file`). */
  execution: Execution;
  /** The trace of a record in the drawer (the component of the editor, wired by the module, ADR 0062). */
  renderRecordTrace?: RenderRecordTrace;
}

/**
 * Comparação com o arquivo de referência (E7-26), at the top of the panel of a simulation: the summary with the percent
 * of the API ("98,27% iguais · 57 de 58 registros"), the counts by outcome and, with `simulations.run` or `traces.view`,
 * the diff by record (outcome as dot + word and, for each different field, expected × obtained), filtered by outcome and
 * paginated by cursor. A record that the simulation calculated opens its trace in the side drawer. Until the `comparing`
 * ends there is no summary.
 */
export function ReferenceComparison({ execution, renderRecordTrace }: ReferenceComparisonProps) {
  const titleId = useId();
  const session = useSession();
  const summary = execution.comparison;
  const canViewDiff = DIFF_PERMISSIONS.some((permission) => session.hasPermission(permission));
  return (
    <section className="fc-comparison" aria-labelledby={titleId}>
      <div className="fc-comparison-top">
        <Text as="h2" variant="heading-16" id={titleId}>
          Comparação com o arquivo de referência
        </Text>
        {execution.reference_file ? (
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-comparison-wrap">
            Arquivo <span className="fc-comparison-mono">{execution.reference_file.name}</span>
          </Text>
        ) : null}
      </div>
      {summary ? (
        <>
          <Summary summary={summary} />
          {canViewDiff ? <ComparisonTable execution={execution} renderRecordTrace={renderRecordTrace} /> : null}
        </>
      ) : (
        <Text as="p" variant="label-13" emphasis="secondary">
          {isRunning(execution.status)
            ? 'O resumo aparece quando a simulação terminar de comparar os registros com o arquivo.'
            : 'A simulação parou antes de comparar os registros com o arquivo.'}
        </Text>
      )}
    </section>
  );
}

function Summary({ summary }: { summary: ComparisonSummary }) {
  return (
    <div className="fc-comparison-summary">
      <Text as="p" variant="label-14" medium className="fc-comparison-number">
        {summaryText(summary)}
      </Text>
      <dl className="fc-comparison-counts" aria-label="Contagens da comparação">
        {COUNTS.map((count) => (
          <div key={count.key} className="fc-comparison-count">
            <dt>{count.label}</dt>
            <dd className="fc-comparison-number">{countText(summary[count.key])}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

function ComparisonTable({ execution, renderRecordTrace }: ReferenceComparisonProps) {
  const queryClient = useQueryClient();
  const filterField = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [filter, setFilter] = useState<OutcomeFilter>('divergent');
  const [openKey, setOpenKey] = useState<string | null>(null);
  const outcomes = outcomesOf(filter);
  const list = useComparisonRecords(execution.id, outcomes, true);
  const records = list.data;
  const noDataError = list.isError && records === undefined ? list.error : null;
  const invalidCursor = list.error instanceof ApiError && list.error.code === 'invalid_cursor';

  function chooseFilter(next: OutcomeFilter) {
    setFilter(next);
    // The action of the empty state goes away with the new list: the focus goes to the filter.
    filterField.current?.focus();
  }

  const columns: readonly TableColumn<ComparisonRecord>[] = [
    {
      key: 'outcome',
      title: 'Resultado',
      skeletonWidth: 100,
      cell: (record) => {
        const outcome = OUTCOME_PRESENTATION[record.outcome];
        return (
          <Status tone={outcome.tone} className="fc-comparison-nowrap">
            {outcome.word}
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
        // Only a record of the result has a trace: the one missing from the result was never read by the simulation.
        return record.obtained_status !== null ? (
          <button
            type="button"
            className="fc-comparison-key"
            aria-label={`Abrir o trace de ${key}`}
            onClick={(event) => {
              opener.current = event.currentTarget;
              setOpenKey(record.result_key);
            }}
          >
            {key}
          </button>
        ) : (
          <span className="fc-comparison-what">
            <span className="fc-comparison-mono fc-comparison-wrap">{key}</span>
            <Text variant="label-12" emphasis="secondary">
              Sem trace: o registro não está no resultado
            </Text>
          </span>
        );
      },
    },
    {
      key: 'diff',
      title: 'Esperado × obtido',
      skeletonWidth: 240,
      cell: (record) => <Differences record={record} />,
    },
  ];

  const divergencesButton = (
    <Button size="small" onClick={() => chooseFilter('divergent')}>
      Ver as divergências
    </Button>
  );

  return (
    <div className="fc-comparison-diff">
      <div className="fc-comparison-filters">
        <Select
          ref={filterField}
          className="fc-comparison-filter"
          label="Resultado"
          options={FILTER_OPTIONS}
          value={filter}
          onValueChange={(value) => setFilter(value as OutcomeFilter)}
        />
        {records && records.length > 0 ? (
          <Text as="p" variant="label-13" emphasis="secondary">
            {listedText(records.length, list.hasNextPage)}
          </Text>
        ) : null}
      </div>

      <Table
        caption="Registros comparados com o arquivo"
        columns={columns}
        rows={records}
        rowKey={(record) => record.result_key}
        loading={list.isPending}
        loadingRows={5}
        error={
          noDataError ? (
            <Notice
              type="error"
              title="Não foi possível carregar a comparação"
              actions={
                <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
                  Tentar de novo
                </Button>
              }
            >
              {comparisonErrorMessage(noDataError)}
            </Notice>
          ) : undefined
        }
        empty={
          filter === 'divergent' ? (
            <EmptyState
              icon={<FileCheckIcon />}
              title="Nenhuma divergência"
              description="Todos os registros comparados são iguais ao arquivo."
              action={
                <Button size="small" onClick={() => chooseFilter('all')}>
                  Ver todos os registros
                </Button>
              }
            />
          ) : filter === 'all' ? (
            <EmptyState
              icon={<EmptyFilterIcon />}
              title="Nenhum registro comparado"
              description="A simulação não teve registros em comum com o arquivo nem registros a mais em nenhum dos dois."
            />
          ) : (
            <EmptyState
              icon={<EmptyFilterIcon />}
              title="Nenhum registro com esse resultado"
              description="Escolha outro resultado ou volte para as divergências."
              action={divergencesButton}
            />
          )
        }
      />

      {list.isError && records !== undefined ? (
        <Notice
          type="error"
          title={list.isFetchNextPageError ? 'Não foi possível carregar mais registros' : 'Não foi possível atualizar a comparação'}
          actions={
            invalidCursor ? (
              <Button
                size="small"
                loading={list.isFetching}
                onClick={() => void queryClient.resetQueries({ queryKey: comparisonRecordsKey(execution.id, outcomes), exact: true })}
              >
                Recarregar a comparação
              </Button>
            ) : (
              <Button size="small" loading={list.isFetching} onClick={() => void (list.isFetchNextPageError ? list.fetchNextPage() : list.refetch())}>
                Tentar de novo
              </Button>
            )
          }
        >
          {comparisonErrorMessage(list.error)}
        </Notice>
      ) : list.hasNextPage ? (
        <div className="fc-comparison-more">
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
    </div>
  );
}

/** For each different field, expected × obtained in mono; the status classes when they differ; why the others have none. */
function Differences({ record }: { record: ComparisonRecord }) {
  if (record.outcome === 'missing_from_result') {
    return (
      <Text as="span" variant="label-13" emphasis="secondary">
        A simulação não leu este registro do arquivo.
      </Text>
    );
  }
  if (record.outcome === 'missing_from_file') {
    return (
      <Text as="span" variant="label-13" emphasis="secondary">
        O registro calculado não está no arquivo.
      </Text>
    );
  }
  if (record.outcome === 'status_differs') {
    return (
      <ul className="fc-comparison-fields">
        <Difference name="status" expected={expectedStatusText(record.expected_status)} obtained={obtainedStatusText(record.obtained_status)} />
      </ul>
    );
  }
  if (record.fields.length === 0) return null;
  return (
    <ul className="fc-comparison-fields">
      {record.fields.map((field) => (
        <Difference key={field.name} name={field.name} expected={valueText(field.expected)} obtained={valueText(field.obtained)} />
      ))}
    </ul>
  );
}

function Difference({ name, expected, obtained }: { name: string; expected: string; obtained: string }) {
  return (
    <li className="fc-comparison-field">
      <span className="fc-comparison-mono fc-comparison-field-name">{name}</span>
      <span className="fc-comparison-mono fc-comparison-wrap">
        <span className="fc-visually-hidden">esperado </span>
        {expected}
        <span aria-hidden="true" className="fc-comparison-times">
          {' × '}
        </span>
        <span className="fc-visually-hidden">, obtido </span>
        {obtained}
      </span>
    </li>
  );
}
