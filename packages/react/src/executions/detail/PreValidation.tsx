// The pre-validation in the panel of an execution (E7-21): the alert waiting for a decision, with "Prosseguir" and
// "Cancelar", and the summary of what the pre-validation read (records, empty rows, null and repeated keys, empty values).
import type { ReactNode } from 'react';
import type { Schemas } from '../../api';
import { Button, Notice, Status, Text, type StatusTone } from '../../design-system';
import type { Execution } from '../api';
import { dateTime, shortDateTime } from '../list/format';
import { recordKeyText } from '../records';
import { CancelExecution } from './CancelExecution';
import { countText, percentText } from './format';
import { PROCEEDING_REASON } from './messages';

type PreValidation = Schemas['PreValidation'];

/** Who may decide on the alert, by the mode of the execution (the sentence shown without the permission). */
const NO_PERMISSION_TEXT: Readonly<Record<Execution['mode'], string>> = {
  batch: 'Só quem executa lotes pode decidir.',
  simulation: 'Só quem executa simulações pode decidir.',
};

/** The result of the pre-validation as dot + word. */
const PRE_VALIDATION_STATUS: Readonly<Record<Schemas['PreValidationStatus'], { tone: StatusTone; word: string }>> = {
  passed: { tone: 'green', word: 'Sem alerta' },
  alerted: { tone: 'amber', word: 'Com alerta' },
  blocked: { tone: 'red', word: 'Bloqueada' },
};

/** "quantidade: 22,22% vazios, limite 1%". */
function alertLine(value: Schemas['EmptyValueCount'], limit: string): string {
  return `${value.variable}: ${percentText(value.percent)} vazios, limite ${percentText(limit)}`;
}

export interface DecisionNoteProps {
  execution: Execution;
  /** With the permission of the mode: "Prosseguir" and "Cancelar". Without it, the note says who may decide. */
  canDecide: boolean;
  /** Sends "Prosseguir". */
  onProceed: () => void;
  /** "Cancelar" was pressed: the panel opens the cancel dialog (see `CancelDialog`). */
  onCancel: (button: HTMLButtonElement | null) => void;
  /** "Prosseguir" is in flight. */
  proceeding: boolean;
}

/**
 * The amber note of `awaiting_decision` (E7-21, estilos.md §7.7): the variables above the limit, the deadline and the
 * actions "Prosseguir" (primary) and "Cancelar" (secondary, with the confirmation of E6-21).
 */
export function DecisionNote({ execution, canDecide, onProceed, onCancel, proceeding }: DecisionNoteProps) {
  const check = execution.pre_validation;
  const alerted = check ? check.empty_values.filter((value) => value.alert) : [];
  const deadline = check?.decision_expires_at ? shortDateTime(check.decision_expires_at) : '';
  return (
    <Notice
      type="warning"
      title="A pré-validação encontrou campos vazios acima do limite."
      className="fc-execution-decision"
      actions={
        canDecide ? (
          <>
            <Button variant="primary" loading={proceeding} onClick={onProceed}>
              Prosseguir
            </Button>
            <CancelExecution
              execution={execution}
              label="Cancelar"
              disabledReason={proceeding ? PROCEEDING_REASON : undefined}
              onRequest={onCancel}
            />
          </>
        ) : undefined
      }
    >
      {alerted.length > 0 && check ? (
        <ul className="fc-execution-decision-list" aria-label="Campos vazios acima do limite">
          {alerted.map((value) => (
            <li key={value.variable}>{alertLine(value, check.alert_percent)}</li>
          ))}
        </ul>
      ) : null}
      {deadline ? <p className="fc-execution-decision-line">{`Sem resposta até ${deadline}, a execução é cancelada.`}</p> : null}
      {canDecide ? null : <p className="fc-execution-decision-line">{NO_PERMISSION_TEXT[execution.mode]}</p>}
    </Notice>
  );
}

/** Up to 5 repeated keys of the batch, in mono (the API sends at most 5). */
export function DuplicateKeyExamples({ keys, label }: { keys: readonly Schemas['RecordKey'][]; label: string }) {
  if (keys.length === 0) return null;
  return (
    <ul className="fc-execution-keys" aria-label={label}>
      {keys.map((key, index) => (
        <li key={index} className="fc-execution-key">
          {recordKeyText(key)}
        </li>
      ))}
    </ul>
  );
}

/** "3 chaves se repetem no lote" / "1 chave se repete no lote". */
export function duplicateKeysText(count: number): string {
  return count === 1 ? '1 chave se repete no lote' : `${countText(count)} chaves se repetem no lote`;
}

/** Who decided on the alert, what and when. */
function decisionText(decision: Schemas['PreValidationDecision']): string {
  const when = dateTime(decision.at);
  switch (decision.choice) {
    case 'proceed':
      return `Prosseguir · ${decision.by?.name ?? '—'} em ${when}`;
    case 'cancel':
      return `Cancelar · ${decision.by?.name ?? '—'} em ${when}`;
    case 'automatic':
      return `Seguiu sozinha, por ser agendada, em ${when}`;
    case 'expired':
      return `Sem resposta no prazo: cancelada em ${when}`;
  }
}

function Pair({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="fc-execution-pair">
      <dt>{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

function emptyText(empty: number): string {
  return empty === 1 ? '1 vazio' : `${countText(empty)} vazios`;
}

/**
 * The summary of the pre-validation (E7-21): the result as dot + word, the records, the empty rows, the null keys, the
 * repeated keys (up to 5 examples in mono), the empty values by variable and the decision on the alert.
 */
export function PreValidationSummary({ check }: { check: PreValidation }) {
  const status = PRE_VALIDATION_STATUS[check.status];
  return (
    <section className="fc-execution-box" aria-label="Pré-validação">
      <div className="fc-execution-box-head">
        <Text as="h2" variant="heading-16">
          Pré-validação
        </Text>
        <Status tone={status.tone}>{status.word}</Status>
      </div>
      <dl className="fc-execution-pairs">
        <Pair label="Registros">{countText(check.records)}</Pair>
        <Pair label="Linhas vazias">{countText(check.empty_rows)}</Pair>
        <Pair label="Chaves nulas">{countText(check.null_key_records)}</Pair>
        <Pair label="Chaves repetidas">{countText(check.duplicate_keys.count)}</Pair>
        <Pair label="Limite do alerta">{percentText(check.alert_percent)}</Pair>
        {check.decision ? <Pair label="Decisão">{decisionText(check.decision)}</Pair> : null}
      </dl>
      <DuplicateKeyExamples keys={check.duplicate_keys.examples} label="Chaves repetidas: exemplos" />
      <div className="fc-execution-empties">
        <Text as="h3" variant="label-13" emphasis="secondary">
          Vazios por variável
        </Text>
        {check.empty_values.length > 0 ? (
          <ul className="fc-execution-empty-list" aria-label="Vazios por variável">
            {check.empty_values.map((value) => (
              <li key={value.variable} className="fc-execution-empty">
                <span className="fc-execution-empty-name">{value.variable}</span>
                <span className="fc-execution-number">{`${emptyText(value.empty)} · ${percentText(value.percent)}`}</span>
                {value.alert ? <Status tone="amber">acima do limite</Status> : null}
              </li>
            ))}
          </ul>
        ) : (
          <Text as="p" variant="label-13" emphasis="secondary">
            Nenhuma variável com vazios.
          </Text>
        )}
      </div>
    </section>
  );
}
