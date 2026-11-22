import { useId, useRef, useState, type ReactNode } from 'react';
import { Button, Loading, Notice, Skeleton, Status, Text } from '../../design-system';
import { useSession } from '../../session';
import { STATUS_PRESENTATION, isRunning, useExecution, type Execution } from '../api';
import { dateTime, executionDuration } from '../list/format';
import {
  ExecutionRecords,
  NO_RECORDS_FILTER,
  nodelessName,
  type ErrorGroupFilter,
  type RecordsFilter,
  type RenderRecordTrace,
} from '../records';
import { TRIGGER_PERMISSION } from '../trigger';
import { CancelExecution } from './CancelExecution';
import { DownloadOutput } from './DownloadOutput';
import {
  PHASE_STATE_WORDS,
  TRACE_LEVEL_LABELS,
  countText,
  executionPhases,
  executionProgress,
  parameterText,
  percentText,
  shortId,
} from './format';
import { CheckIcon, ChevronIcon } from './icons';
import { ABORT_GUIDANCE, canRetryExecution, executionErrorMessage } from './messages';
import './execution-panel.css';

/** The permission of the records table and of the trace (E6-21). */
export const TRACES_PERMISSION = 'traces.view';

export interface ExecutionPanelProps {
  /** The execution (`/executions/:id` in the module). */
  executionId: string;
  /**
   * The trace of a record, in the side drawer: the module passes the trace component of the editor's "Calcular"
   * (exported by `editor/index.ts`), because executions never imports the editor (ADR 0062). Without it, the drawer shows
   * the outputs and the hashes.
   */
  renderRecordTrace?: RenderRecordTrace;
}

/**
 * The panel of one execution (E6-21): status and abort reason, the phases Carga → Cálculo → Entrega with the progress
 * bar, the summary (resolved parameters, the "agora", trace level, error limit, who triggered), the totals, the errors
 * grouped by block and code (a click filters the records) and, with `traces.view`, the records with the trace drawer.
 * "Baixar CSV" (disabled with the reason) and "Cancelar execução" (with `executions.trigger`, while it runs). Asks the API
 * again every 2 s until a final state. Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals).
 */
export function ExecutionPanel({ executionId, renderRecordTrace }: ExecutionPanelProps) {
  const titleId = useId();
  const session = useSession();
  const query = useExecution(executionId);
  const execution = query.data;
  const recordsHeading = useRef<HTMLHeadingElement>(null);
  const [recordsFilter, setRecordsFilter] = useState<RecordsFilter>(NO_RECORDS_FILTER);
  const canViewTraces = session.hasPermission(TRACES_PERMISSION);
  const canCancel = session.hasPermission(TRIGGER_PERMISSION);

  if (!execution) {
    if (query.isPending) {
      return (
        <section className="fc-execution" aria-label="Execução">
          <Loading label="Carregando a execução">
            <div className="fc-execution-skeleton">
              <Skeleton width={280} />
              <Skeleton width={160} />
              <Skeleton width="100%" />
              <Skeleton width="100%" />
              <Skeleton width="60%" />
            </div>
          </Loading>
        </section>
      );
    }
    return (
      <section className="fc-execution" aria-label="Execução">
        <Notice
          type="error"
          title="Não foi possível carregar a execução"
          actions={
            canRetryExecution(query.error) ? (
              <Button size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
                Tentar de novo
              </Button>
            ) : undefined
          }
        >
          {executionErrorMessage(query.error)}
        </Notice>
      </section>
    );
  }

  const presentation = STATUS_PRESENTATION[execution.status];

  function chooseGroup(group: ErrorGroupFilter) {
    setRecordsFilter({ status: null, group });
    // The records are below: the focus goes to their title, so the keyboard and the screen reader follow the filter.
    recordsHeading.current?.focus();
    recordsHeading.current?.scrollIntoView?.({ block: 'start' });
  }

  return (
    <section className="fc-execution" aria-labelledby={titleId}>
      <header className="fc-execution-top">
        <div className="fc-execution-title">
          <Text as="h1" variant="heading-24" id={titleId} className="fc-execution-wrap">
            {execution.workflow_name}
          </Text>
          <div className="fc-execution-subtitle">
            <Status tone={presentation.tone} pulsing={presentation.pulsing}>
              {presentation.label}
            </Status>
            <Text variant="mono-13" emphasis="secondary" title={execution.id}>
              <span className="fc-visually-hidden">Execução </span>
              {shortId(execution.id)}
            </Text>
            <Text variant="label-13" emphasis="secondary">
              {`Revisão ${countText(execution.draft_revision)} do rascunho`}
            </Text>
          </div>
        </div>
        <div className="fc-execution-actions">
          {canCancel ? <CancelExecution execution={execution} /> : null}
          <DownloadOutput execution={execution} />
        </div>
      </header>

      {query.isError ? (
        // A failed update keeps the last data on screen and stops the 2 s refresh (useExecution); this says so.
        <Notice
          type="error"
          title="Não foi possível atualizar a execução"
          actions={
            <Button size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          {executionErrorMessage(query.error)}
        </Notice>
      ) : null}

      <StatusNotes execution={execution} />

      <Phases execution={execution} />

      <section className="fc-execution-box" aria-label="Resumo">
        <Text as="h2" variant="heading-16">
          Resumo
        </Text>
        <Summary execution={execution} />
      </section>

      <section className="fc-execution-box" aria-label="Totais">
        <Text as="h2" variant="heading-16">
          Totais
        </Text>
        <Totals execution={execution} />
      </section>

      <ErrorGroups
        execution={execution}
        selected={recordsFilter.group}
        onChoose={canViewTraces ? chooseGroup : undefined}
      />

      {canViewTraces ? (
        <ExecutionRecords
          ref={recordsHeading}
          execution={execution}
          filter={recordsFilter}
          onFilterChange={setRecordsFilter}
          renderRecordTrace={renderRecordTrace}
        />
      ) : null}
    </section>
  );
}

/** The abort reason, the cancel request and the wait for the source. */
function StatusNotes({ execution }: { execution: Execution }) {
  if (execution.status === 'aborted' && execution.abort_reason) {
    return (
      <Notice type="error" title="Execução abortada">
        <span className="fc-execution-code">{execution.abort_reason.code}</span> {execution.abort_reason.message}{' '}
        {ABORT_GUIDANCE[execution.abort_reason.code]}
      </Notice>
    );
  }
  if (execution.status === 'awaiting_source') {
    return (
      <Notice type="warning" title="Aguardando a fonte">
        {execution.next_retry_at ? `Uma fonte está fora do ar. A próxima tentativa é em ${dateTime(execution.next_retry_at)}. ` : 'Uma fonte está fora do ar. '}
        A execução tenta de novo sozinha depois de 30 s, 2 min e 10 min; se a quarta tentativa falhar, ela é abortada e nada
        é entregue.
      </Notice>
    );
  }
  if (isRunning(execution.status) && execution.cancel_requested_at) {
    return (
      <Notice type="warning" title="Cancelamento pedido">
        {`Pedido em ${dateTime(execution.cancel_requested_at)}. A execução para ao terminar a parte do lote em andamento e não entrega nada.`}
      </Notice>
    );
  }
  return null;
}

/** Carga → Cálculo → Entrega, with the progress bar once the batch was counted. */
function Phases({ execution }: { execution: Execution }) {
  const phases = executionPhases(execution);
  const progress = executionProgress(execution);
  const counting = progress === null && (execution.status === 'loading' || execution.status === 'awaiting_source');
  return (
    <section className="fc-execution-box" aria-label="Fases">
      <ol className="fc-execution-phases">
        {phases.map((phase, index) => (
          <li
            key={phase.key}
            className={`fc-execution-phase fc-execution-phase-${phase.state}`}
            aria-current={phase.state === 'current' || phase.state === 'waiting' ? 'step' : undefined}
          >
            {index > 0 ? (
              <span className="fc-execution-phase-arrow">
                <ChevronIcon />
              </span>
            ) : null}
            {phase.state === 'done' ? <CheckIcon /> : null}
            <span className="fc-execution-phase-label">{phase.label}</span>
            <span className="fc-execution-phase-state">{PHASE_STATE_WORDS[phase.state]}</span>
          </li>
        ))}
      </ol>
      {progress ? (
        <div className="fc-execution-progress">
          <div
            className="fc-execution-meter"
            role="progressbar"
            aria-label="Registros calculados"
            aria-valuemin={0}
            aria-valuemax={progress.total}
            aria-valuenow={progress.done}
            aria-valuetext={progress.text}
          >
            <span className="fc-execution-meter-fill" style={{ width: `${progress.percent}%` }} />
          </div>
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-execution-number">
            {progress.text}
          </Text>
        </div>
      ) : counting ? (
        <Text as="p" variant="label-13" emphasis="secondary">
          Contando os registros do lote
        </Text>
      ) : null}
    </section>
  );
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fc-execution-pair">
      <dt>{label}</dt>
      <dd>{children === '' || children === null ? '—' : children}</dd>
    </div>
  );
}

/** The resolved parameters, the "agora", the trace level, the error limit and who triggered. */
function Summary({ execution }: { execution: Execution }) {
  const parameters = Object.entries(execution.parameters);
  const duration = executionDuration(execution, new Date());
  return (
    <div className="fc-execution-summary">
      <dl className="fc-execution-pairs" aria-label="Parâmetros">
        {parameters.length > 0 ? (
          parameters.map(([name, value]) => (
            <Pair key={name} label={name}>
              {parameterText(value)}
            </Pair>
          ))
        ) : (
          <Pair label="Parâmetros">Sem parâmetros</Pair>
        )}
      </dl>
      <dl className="fc-execution-pairs" aria-label="Execução">
        <Pair label="Agora">{dateTime(execution.now)}</Pair>
        <Pair label="Nível do trace">{TRACE_LEVEL_LABELS[execution.trace_level]}</Pair>
        <Pair label="Limite de erro">{percentText(execution.error_limit_percent)}</Pair>
        <Pair label="Disparado por">{`${execution.triggered_by.name} em ${dateTime(execution.created_at)}`}</Pair>
        <Pair label="Início">{dateTime(execution.started_at)}</Pair>
        <Pair label="Dados lidos em">{dateTime(execution.data_read_at)}</Pair>
        <Pair label="Duração">{duration}</Pair>
      </dl>
    </div>
  );
}

const TOTALS: readonly { key: keyof Execution['totals']; label: string }[] = [
  { key: 'read', label: 'Lidos' },
  { key: 'ok', label: 'Ok' },
  { key: 'ok_with_warnings', label: 'Com avisos' },
  { key: 'error', label: 'Com erro' },
  { key: 'ignored', label: 'Ignorados' },
  { key: 'filtered', label: 'Filtrados' },
];

function Totals({ execution }: { execution: Execution }) {
  return (
    <dl className="fc-execution-totals">
      {TOTALS.map((total) => (
        <div key={total.key} className="fc-execution-total">
          <dt>{total.label}</dt>
          <dd className="fc-execution-number">{countText(execution.totals[total.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

function recordsCount(count: number): string {
  return count === 1 ? '1 registro' : `${countText(count)} registros`;
}

interface ErrorGroupsProps {
  execution: Execution;
  selected: ErrorGroupFilter | null;
  /** With `traces.view`: a click on a group filters the records. Without it, the groups are only read. */
  onChoose?: (group: ErrorGroupFilter) => void;
}

/** The errors grouped by block and code, from the largest (E6-21). */
function ErrorGroups({ execution, selected, onChoose }: ErrorGroupsProps) {
  const groups = execution.error_groups;
  return (
    <section className="fc-execution-box" aria-label="Erros agrupados">
      <Text as="h2" variant="heading-16">
        Erros agrupados
      </Text>
      {groups.length > 0 ? (
        <ul className="fc-execution-groups">
          {groups.map((group) => {
            const label = group.node_name ?? group.node_id ?? nodelessName(group.code);
            const filter: ErrorGroupFilter = { nodeId: group.node_id, code: group.code, label };
            const isSelected = selected !== null && selected.nodeId === group.node_id && selected.code === group.code;
            const content = (
              <>
                <span className="fc-execution-group-what">
                  <span className="fc-execution-group-name">{label}</span>
                  <span className="fc-execution-code">{group.code}</span>
                </span>
                <span className="fc-execution-group-count">{recordsCount(group.count)}</span>
              </>
            );
            return (
              <li key={`${group.node_id ?? ''}:${group.code}`} className="fc-execution-group">
                {onChoose ? (
                  <button
                    type="button"
                    className="fc-execution-group-button"
                    aria-pressed={isSelected}
                    aria-label={`${label}, ${group.code}: ${recordsCount(group.count)}. Filtrar os registros`}
                    onClick={() => onChoose(filter)}
                  >
                    {content}
                  </button>
                ) : (
                  <div className="fc-execution-group-line">{content}</div>
                )}
              </li>
            );
          })}
        </ul>
      ) : (
        <Text as="p" variant="label-13" emphasis="secondary">
          {isRunning(execution.status) ? 'Nenhum registro com erro até agora.' : 'Nenhum registro com erro.'}
        </Text>
      )}
    </section>
  );
}

