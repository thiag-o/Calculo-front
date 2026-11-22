import * as RadixDialog from '@radix-ui/react-dialog';
import { useRef, type ReactNode } from 'react';
import { Button, Loading, Notice, Skeleton, Status, Text, useFluxoPortal } from '../../design-system';
import { useExecutionRecord, type ExecutionRecord, type ExecutionRecordTrace } from '../api';
import { CloseIcon } from './icons';
import { RECORD_STATUS, recordKeyText } from './labels';
import { traceErrorMessage } from './messages';

/** What the drawer gives the trace component (the one of the editor's "Calcular", wired by the module, ADR 0062). */
export interface RecordTraceRenderProps {
  /** The stored trace of the record (the format of the unit run). */
  trace: ExecutionRecordTrace;
  /** The record as the execution kept it (status, key, hashes, outputs). */
  record: ExecutionRecord;
}

/** Renders the trace of a record (blocks, values, rule, warnings, outputs and hashes). */
export type RenderRecordTrace = (props: RecordTraceRenderProps) => ReactNode;

/** The note of the minimal level (E6-21). */
export const MINIMAL_TRACE_NOTE = 'Esta execução guardou o trace mínimo.';
/** Until the frozen definition arrives (B154, F118), the blocks go by their id and the numbers as the API sends them (D40). */
export const NO_DEFINITION_NOTE = 'Nomes e formatação chegam com a definição congelada';

export interface RecordTraceDrawerProps {
  executionId: string;
  /** The record whose trace is open; `null` closes the drawer. */
  resultKey: string | null;
  onClose: () => void;
  renderRecordTrace?: RenderRecordTrace;
  /** Who gets the focus back on close (the key that opened the drawer); a function, read only on close. */
  focusOnClose?: () => HTMLElement | null | undefined;
}

/**
 * The side drawer with the stored trace of one record (E6-21). In the minimal level, only the hashes, with "Esta execução
 * guardou o trace mínimo."; in the standard and full ones, the trace through `renderRecordTrace` (without it, the outputs
 * and the hashes). Modal: the focus stays inside, Esc and "Fechar" close and the focus goes back to the record. The portal
 * sits in the module root (ADR 0011).
 */
export function RecordTraceDrawer({ executionId, resultKey, onClose, renderRecordTrace, focusOnClose }: RecordTraceDrawerProps) {
  const portal = useFluxoPortal();
  const panel = useRef<HTMLDivElement>(null);
  return (
    <RadixDialog.Root open={resultKey !== null} onOpenChange={(open) => (open ? undefined : onClose())}>
      {portal && resultKey !== null ? (
        <RadixDialog.Portal container={portal}>
          <RadixDialog.Overlay className="fc-record-drawer-backdrop" />
          <RadixDialog.Content
            ref={panel}
            className="fc-record-drawer"
            aria-describedby={undefined}
            onOpenAutoFocus={(event) => {
              // The focus goes to the drawer itself, not to "Fechar": its tooltip would open on focus and the first Esc
              // would close the tooltip, not the drawer (as in the Dialog of the design system).
              event.preventDefault();
              panel.current?.focus();
            }}
            onCloseAutoFocus={(event) => {
              // Without a Radix trigger, the focus would be lost: it goes back to the record that opened the drawer.
              const target = focusOnClose?.();
              if (!target?.isConnected) return;
              event.preventDefault();
              target.focus();
            }}
          >
            <div className="fc-record-drawer-header">
              <RadixDialog.Title asChild>
                <Text as="h2" variant="heading-16">
                  Trace do registro
                </Text>
              </RadixDialog.Title>
              <RadixDialog.Close asChild>
                <Button iconOnly variant="ghost" size="small" label="Fechar" icon={<CloseIcon />} />
              </RadixDialog.Close>
            </div>
            <div className="fc-record-drawer-body">
              <DrawerContent executionId={executionId} resultKey={resultKey} renderRecordTrace={renderRecordTrace} />
            </div>
          </RadixDialog.Content>
        </RadixDialog.Portal>
      ) : null}
    </RadixDialog.Root>
  );
}

function DrawerContent({ executionId, resultKey, renderRecordTrace }: { executionId: string; resultKey: string; renderRecordTrace?: RenderRecordTrace }) {
  const query = useExecutionRecord(executionId, resultKey);
  const record = query.data;

  if (query.isPending) {
    return (
      <Loading label="Carregando o trace do registro">
        <div className="fc-record-drawer-skeleton">
          <Skeleton width="50%" />
          <Skeleton width="80%" />
          <Skeleton width="100%" />
          <Skeleton width="70%" />
        </div>
      </Loading>
    );
  }
  if (!record) {
    return (
      <Notice
        type="error"
        title="Não foi possível carregar o trace"
        actions={
          <Button size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
            Tentar de novo
          </Button>
        }
      >
        {traceErrorMessage(query.error)}
      </Notice>
    );
  }

  const status = RECORD_STATUS[record.status];
  return (
    <>
      <div className="fc-record-drawer-record">
        <Status tone={status.tone}>{status.word}</Status>
        <Text as="p" variant="mono-13" className="fc-record-drawer-key">
          <span className="fc-visually-hidden">Registro </span>
          {recordKeyText(record.record_key)}
        </Text>
      </div>

      {record.trace_level === 'minimal' || record.trace === null ? (
        <>
          <div className="fc-record-drawer-note">
            <Text as="p" variant="label-14" medium>
              {MINIMAL_TRACE_NOTE}
            </Text>
            <Text as="p" variant="label-13" emphasis="secondary">
              Só os hashes das entradas e da saída ficaram guardados: eles provam se o dado mudou, sem mostrar os valores.
            </Text>
          </div>
          <Hashes record={record} />
        </>
      ) : (
        <>
          <Text as="p" variant="label-13" emphasis="secondary" className="fc-record-drawer-note">
            {NO_DEFINITION_NOTE}
          </Text>
          {renderRecordTrace ? (
            renderRecordTrace({ trace: record.trace, record })
          ) : (
            <>
              <Outputs record={record} />
              <Hashes record={record} />
            </>
          )}
        </>
      )}
    </>
  );
}

/** The output fields as the API sends them (D40: the types arrive with the frozen definition). */
function Outputs({ record }: { record: ExecutionRecord }) {
  const entries = Object.entries(record.outputs ?? {});
  return (
    <section className="fc-record-drawer-section" aria-label="Saídas">
      <Text as="h3" variant="heading-14">
        Saídas
      </Text>
      {entries.length > 0 ? (
        <dl className="fc-record-drawer-values">
          {entries.map(([name, value]) => (
            <div key={name} className="fc-record-drawer-value">
              <dt className="fc-record-drawer-mono">{name}</dt>
              <dd className="fc-record-drawer-mono">{value === null ? '—' : String(value)}</dd>
            </div>
          ))}
        </dl>
      ) : (
        <Text as="p" variant="label-13" emphasis="secondary">
          Sem saídas neste registro.
        </Text>
      )}
    </section>
  );
}

function Hashes({ record }: { record: ExecutionRecord }) {
  return (
    <dl className="fc-record-drawer-values" aria-label="Hashes">
      <div className="fc-record-drawer-value">
        <dt>Hash das entradas</dt>
        <dd className="fc-record-drawer-mono fc-record-drawer-hash">{record.input_hash}</dd>
      </div>
      <div className="fc-record-drawer-value">
        <dt>Hash da saída</dt>
        <dd className="fc-record-drawer-mono fc-record-drawer-hash">{record.output_hash ?? '—'}</dd>
      </div>
    </dl>
  );
}
