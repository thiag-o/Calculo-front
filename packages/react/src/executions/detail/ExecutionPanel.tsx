import { useId, useRef, useState, type ReactNode } from 'react';
import { Button, Loading, Notice, Skeleton, Status, Text } from '../../design-system';
import { useSession } from '../../session';
import { isRunning, statusPresentation, useExecution, useProceedExecution, type Execution, type ExecutionMode } from '../api';
import { dateTime, executionDuration, shortDateTime, triggeredByText } from '../list/format';
import {
  ExecutionRecords,
  NO_RECORDS_FILTER,
  nodelessName,
  type ErrorGroupFilter,
  type RecordsFilter,
  type RenderRecordTrace,
} from '../records';
import { TRIGGER_PERMISSION } from '../trigger';
import { ReferenceComparison } from '../comparison';
import { CancelDialog, CancelExecution } from './CancelExecution';
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
import { ABORT_GUIDANCE, canRetryExecution, executionErrorMessage, proceedErrorMessage } from './messages';
import { DecisionNote, DuplicateKeyExamples, PreValidationSummary, duplicateKeysText } from './PreValidation';
import { SourceCounts } from './SourceCounts';
import './execution-panel.css';

/** The permission of the records table and of the trace (E6-21). */
export const TRACES_PERMISSION = 'traces.view';
/** The permission of the simulations: it also decides on, and cancels, a simulation (E7-21). */
export const SIMULATIONS_PERMISSION = 'simulations.run';

/** The permission that cancels an execution and decides on its pre-validation alert, by the mode (contract, ADR 0046). */
export const MODE_PERMISSIONS: Readonly<Record<ExecutionMode, string>> = {
  batch: TRIGGER_PERMISSION,
  simulation: SIMULATIONS_PERMISSION,
};

export interface ExecutionPanelProps {
  /** The execution (`/executions/:id` in the module). */
  executionId: string;
  /**
   * The trace of a record, in the side drawer: the module passes the trace component of the editor's "Calcular"
   * (exported by `editor/index.ts`), because executions never imports the editor (ADR 0062). Without it, the drawer shows
   * the outputs and the hashes.
   */
  renderRecordTrace?: RenderRecordTrace;
  /**
   * Opens the panel of another execution (`/executions/:id` in the module): the execution this one ran again over (a
   * confirmed overlap, E7-21). Without it, that execution is plain text.
   */
  onOpenExecution?: (id: string) => void;
}

/**
 * The panel of one execution (E6-21, E7-21): status and abort reason, the phases Carga → Pré-validação → Cálculo → Entrega
 * (Comparação in a simulation) with the progress bar, the comparison with the reference file at the top of a simulation
 * (E7-26), the pre-validation alert waiting for "Prosseguir" or "Cancelar", the
 * summary (resolved parameters, the "agora", trace level, error limit, who triggered or the schedule, the overlap), the
 * pre-validation, the counts of the Fonte blocks, the totals, the errors grouped by block and code (a click filters the
 * records) and, with `traces.view`, the records with the trace drawer. "Baixar CSV" (disabled with the reason) and
 * "Cancelar execução" (with the permission of the mode, while it runs). Asks the API again every 2 s until a final state.
 * Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot` (portals).
 */
export function ExecutionPanel({ executionId, renderRecordTrace, onOpenExecution }: ExecutionPanelProps) {
  const titleId = useId();
  const session = useSession();
  const query = useExecution(executionId);
  const execution = query.data;
  const recordsHeading = useRef<HTMLHeadingElement>(null);
  const title = useRef<HTMLDivElement>(null);
  // One cancel dialog for the header's button and the alert's: the execution leaving `awaiting_decision` moves the button, and
  // the dialog (with the error of a `409 execution_finished`) must stay where it is.
  const [cancelling, setCancelling] = useState<{ origin: HTMLElement | null } | null>(null);
  const [recordsFilter, setRecordsFilter] = useState<RecordsFilter>(NO_RECORDS_FILTER);
  const proceed = useProceedExecution(executionId);
  const canViewTraces = session.hasPermission(TRACES_PERMISSION);

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

  const presentation = statusPresentation(execution);
  const canDecide = session.hasPermission(MODE_PERMISSIONS[execution.mode]);
  const awaitingDecision = execution.status === 'awaiting_decision';
  const canReadDefinition = canViewTraces || (execution.mode === 'simulation' && session.hasPermission(SIMULATIONS_PERMISSION));

  function chooseGroup(group: ErrorGroupFilter) {
    setRecordsFilter({ status: null, group });
    // The records are below: the focus goes to their title, so the keyboard and the screen reader follow the filter.
    recordsHeading.current?.focus();
    recordsHeading.current?.scrollIntoView?.({ block: 'start' });
  }

  return (
    <section className="fc-execution" aria-labelledby={titleId}>
      <header className="fc-execution-top">
        <div ref={title} tabIndex={-1} className="fc-execution-title">
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
          {execution.overlap_of ? <Overlap overlap={execution.overlap_of} onOpenExecution={onOpenExecution} /> : null}
        </div>
        <div className="fc-execution-actions">
          {/* While the alert waits, "Cancelar" is in the alert itself: one button per action. */}
          {canDecide && !awaitingDecision ? (
            <CancelExecution execution={execution} onRequest={(origin) => setCancelling({ origin })} />
          ) : null}
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

      {awaitingDecision ? (
        <DecisionNote
          execution={execution}
          canDecide={canDecide}
          proceeding={proceed.isPending}
          onProceed={() => {
            if (!proceed.isPending) proceed.mutate();
          }}
          onCancel={(origin) => setCancelling({ origin })}
        />
      ) : null}
      {canDecide ? (
        <CancelDialog
          execution={execution}
          open={cancelling !== null}
          origin={cancelling?.origin ?? null}
          fallbackFocus={() => title.current}
          onClose={() => setCancelling(null)}
        />
      ) : null}
      {/* The error belongs to the alert: once the execution leaves `awaiting_decision` (this or another person decided), it goes. */}
      {proceed.isError && awaitingDecision ? (
        <Notice type="error" title="Não foi possível prosseguir">
          {proceedErrorMessage(proceed.error)}
        </Notice>
      ) : null}

      <StatusNotes execution={execution} />

      {/* A simulation with a reference file: the comparison goes at the top (E7-26). */}
      {execution.mode === 'simulation' && execution.reference_file ? (
        <ReferenceComparison execution={execution} renderRecordTrace={renderRecordTrace} />
      ) : null}

      <Phases execution={execution} />

      <section className="fc-execution-box" aria-label="Resumo">
        <Text as="h2" variant="heading-16">
          Resumo
        </Text>
        <Summary execution={execution} />
      </section>

      {execution.pre_validation ? <PreValidationSummary check={execution.pre_validation} /> : null}

      <SourceCounts execution={execution} canReadDefinition={canReadDefinition} />

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
        {execution.abort_reason.code === 'duplicate_record_key' && execution.pre_validation ? (
          <span className="fc-execution-abort-keys">
            {`${duplicateKeysText(execution.pre_validation.duplicate_keys.count)}. Exemplos:`}
            <DuplicateKeyExamples keys={execution.pre_validation.duplicate_keys.examples} label="Chaves repetidas: exemplos" />
          </span>
        ) : null}
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

/** "Executada de novo sobre a execução de 03/11 às 02:00", with the link to it (a confirmed overlap, E7-21). */
function Overlap({ overlap, onOpenExecution }: { overlap: NonNullable<Execution['overlap_of']>; onOpenExecution?: (id: string) => void }) {
  const what = `execução de ${shortDateTime(overlap.created_at)}`;
  return (
    <Text as="p" variant="label-13" emphasis="secondary" className="fc-execution-overlap">
      Executada de novo sobre a{' '}
      {onOpenExecution ? (
        <button type="button" className="fc-execution-link" onClick={() => onOpenExecution(overlap.id)}>
          {what}
        </button>
      ) : (
        what
      )}
    </Text>
  );
}

/** The phases with the progress bar once the batch was counted. */
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
            aria-current={phase.state === 'current' || phase.state === 'waiting' || phase.state === 'deciding' ? 'step' : undefined}
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
      <dl className="fc-execution-pairs">
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
      <dl className="fc-execution-pairs">
        <Pair label="Agora">{dateTime(execution.now)}</Pair>
        <Pair label="Nível do trace">{TRACE_LEVEL_LABELS[execution.trace_level]}</Pair>
        <Pair label="Limite de erro">{percentText(execution.error_limit_percent)}</Pair>
        <Pair label="Disparado por">{`${triggeredByText(execution)} em ${dateTime(execution.created_at)}`}</Pair>
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

