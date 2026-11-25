import { useId, useRef, useState } from 'react';
import { ApiError } from '../../api';
import { Button, EmptyState, Menu, Notice, Status, Table, Text, textClasses, type TableColumn } from '../../design-system';
import { statusPresentation } from '../../executions';
import { useSession } from '../../session';
import { DeleteReferenceFileDialog } from './DeleteReferenceFileDialog';
import { comparisonSummary, dateTime, fileCount, fileSize, shortHash } from './format';
import { CopyIcon, FileCheckIcon, MoreActionsIcon } from './icons';
import { listErrorMessage } from './messages';
import { SIMULATIONS_RUN, TEST_CASES_EDIT, useReferenceFiles, type ReferenceFile } from './queries';
import { SimulateDialog } from './SimulateDialog';
import { UploadArea, useReferenceFileUpload } from './UploadArea';
import './reference-files.css';

const SIMULATE_ATTRIBUTE = 'data-fc-reference-simulate';
const ACTIONS_ATTRIBUTE = 'data-fc-reference-actions';

type OpenDialog = { type: 'simulate'; file: ReferenceFile } | { type: 'delete'; file: ReferenceFile } | null;

type CopyResult = { status: 'copied'; file: ReferenceFile } | { status: 'failed'; file: ReferenceFile } | null;

/** The columns of the file: the key and the fields of the output it brings (and `status`, when it has it). */
function columnsText(file: ReferenceFile): string {
  const fields = file.has_status ? [...file.field_columns, 'status'] : file.field_columns;
  return `Chave: ${file.key_columns.join(', ')} · Campos: ${fields.join(', ')}`;
}

/** What the last simulation with the file says: the percentage of equal records, or why there is none yet. */
function lastComparisonText(comparison: NonNullable<ReferenceFile['last_comparison']>): string {
  if (comparison.equal_percent !== null) return comparisonSummary(comparison.equal_percent);
  return comparison.finished_at === null ? 'Simulação em andamento' : 'Simulação sem comparação';
}

export interface ReferenceFilesProps {
  workflowId: string;
  /** Opens the panel of an execution: the simulation just started (E7-25) and the last comparison of a file. */
  onOpenExecution: (id: string) => void;
}

/**
 * Testes › Arquivo de referência (E7-25): the CSV files with the results already known, newest first, with the records, who
 * uploaded and when, the short SHA-256 (with copy) and the last comparison (with the link to the simulation). With
 * `test_cases.edit`, the upload area and "Remover arquivo" in the "…" menu; with `simulations.run`, "Simular" in each row.
 * Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function ReferenceFiles({ workflowId, onOpenExecution }: ReferenceFilesProps) {
  const titleId = useId();
  const section = useRef<HTMLElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const sendButton = useRef<HTMLButtonElement>(null);
  const session = useSession();
  const list = useReferenceFiles(workflowId);
  const upload = useReferenceFileUpload(workflowId);
  const [dialog, setDialog] = useState<OpenDialog>(null);
  const [deletedName, setDeletedName] = useState<string | null>(null);
  const [copy, setCopy] = useState<CopyResult>(null);
  const deleted = useRef(false);
  const canEdit = session.hasPermission(TEST_CASES_EDIT);
  const canSimulate = session.hasPermission(SIMULATIONS_RUN);

  const files = list.data;
  const noDataError = list.isError && files === undefined ? list.error : null;
  const finalError = noDataError instanceof ApiError && (noDataError.code === 'no_permission' || noDataError.code === 'not_found');

  /** An element of a row, looked up only inside the section (ADR 0002). */
  function rowElement(attribute: string, fileId: string): HTMLElement | null {
    return section.current?.querySelector<HTMLElement>(`[${attribute}="${fileId}"]`) ?? null;
  }

  async function copyHash(file: ReferenceFile) {
    try {
      await navigator.clipboard.writeText(file.sha256);
      setCopy({ status: 'copied', file });
    } catch {
      setCopy({ status: 'failed', file });
    }
  }

  const columns: TableColumn<ReferenceFile>[] = [
    {
      key: 'file',
      title: 'Arquivo',
      skeletonWidth: 200,
      cell: (file) => (
        <div className="fc-reference-two-lines">
          <Text variant="label-14" medium className="fc-reference-wrap">
            {file.name}
          </Text>
          <Text variant="label-13" emphasis="secondary" className="fc-reference-wrap">
            {`${fileSize(file.size_bytes)} · ${columnsText(file)}`}
          </Text>
        </div>
      ),
    },
    {
      key: 'records',
      title: 'Registros',
      align: 'end',
      width: '120px',
      skeletonWidth: 64,
      cell: (file) => (
        <Text variant="label-14" className="fc-reference-number">
          {file.records.toLocaleString('pt-BR')}
        </Text>
      ),
    },
    {
      key: 'uploaded',
      title: 'Enviado por',
      skeletonWidth: 140,
      cell: (file) => (
        <div className="fc-reference-two-lines">
          <Text variant="label-14" className="fc-reference-wrap">
            {file.uploaded_by.name}
          </Text>
          <Text variant="label-13" emphasis="secondary" className="fc-reference-number">
            {dateTime(file.uploaded_at)}
          </Text>
        </div>
      ),
    },
    {
      key: 'sha256',
      title: 'SHA-256',
      skeletonWidth: 120,
      cell: (file) => (
        <span className="fc-reference-hash">
          <Text variant="mono-13" emphasis="secondary">
            {shortHash(file.sha256)}
          </Text>
          <Button iconOnly variant="ghost" size="small" label={`Copiar SHA-256 de ${file.name}`} icon={<CopyIcon />} onClick={() => void copyHash(file)} />
          {/* Seen beside the button; the screen reader hears it from the status region of the section. */}
          {copy?.status === 'copied' && copy.file.id === file.id ? (
            <Text variant="label-13" emphasis="secondary" aria-hidden="true">
              Copiado
            </Text>
          ) : null}
        </span>
      ),
    },
    {
      key: 'comparison',
      title: 'Última comparação',
      skeletonWidth: 140,
      cell: (file) => {
        const comparison = file.last_comparison;
        if (!comparison) {
          return (
            <Text variant="label-13" emphasis="secondary">
              Nenhuma simulação ainda
            </Text>
          );
        }
        const text = lastComparisonText(comparison);
        // The dot and the word of the simulation, as the execution list shows it.
        const presentation = statusPresentation({ status: comparison.status, mode: 'simulation' });
        return (
          <div className="fc-reference-two-lines">
            <Status tone={presentation.tone} pulsing={presentation.pulsing}>
              {presentation.label}
            </Status>
            <button
              type="button"
              className="fc-reference-link"
              aria-label={`${text}, abrir a simulação de ${file.name}`}
              onClick={() => onOpenExecution(comparison.execution_id)}
            >
              {text}
            </button>
            {comparison.finished_at ? (
              <Text variant="label-13" emphasis="secondary" className="fc-reference-number">
                {dateTime(comparison.finished_at)}
              </Text>
            ) : null}
          </div>
        );
      },
    },
  ];
  if (canSimulate || canEdit) {
    columns.push({
      key: 'actions',
      title: 'Ações',
      hiddenTitle: true,
      align: 'end',
      width: canSimulate && canEdit ? '136px' : canSimulate ? '104px' : '56px',
      skeletonWidth: 40,
      cell: (file) => (
        <span className="fc-reference-actions">
          {canSimulate ? (
            <Button
              size="small"
              aria-label={`Simular com ${file.name}`}
              data-fc-reference-simulate={file.id}
              onClick={() => setDialog({ type: 'simulate', file })}
            >
              Simular
            </Button>
          ) : null}
          {canEdit ? (
            <Menu
              trigger={
                <Button
                  iconOnly
                  variant="ghost"
                  size="small"
                  label={`Mais ações para o arquivo ${file.name}`}
                  icon={<MoreActionsIcon />}
                  data-fc-reference-actions={file.id}
                />
              }
              items={[
                {
                  label: 'Remover arquivo',
                  danger: true,
                  onSelect: () => {
                    deleted.current = false;
                    setDialog({ type: 'delete', file });
                  },
                },
              ]}
            />
          ) : null}
        </span>
      ),
    });
  }

  return (
    <section ref={section} className="fc-reference" aria-labelledby={titleId}>
      <header className="fc-reference-top">
        <div className="fc-reference-title">
          <h2 id={titleId} ref={heading} tabIndex={-1} className={`fc-reference-heading ${textClasses({ variant: 'heading-16' })}`}>
            Arquivo de referência
          </h2>
          <Text as="p" variant="label-14" emphasis="secondary">
            {files && files.length > 0
              ? fileCount(files.length)
              : 'Resultados que você já conhece, comparados registro a registro com uma simulação'}
          </Text>
        </div>
      </header>

      {canEdit ? <UploadArea upload={upload} sendButton={sendButton} /> : null}

      {deletedName ? <Notice type="success">{`Arquivo ${deletedName} removido.`}</Notice> : null}

      <div role="status" className="fc-reference-copy-status">
        {copy?.status === 'copied' ? `SHA-256 de ${copy.file.name} copiado.` : null}
      </div>
      {copy?.status === 'failed' ? (
        <Notice type="error" title="Não foi possível copiar o SHA-256">
          <p className="fc-reference-notice-text">
            {`O navegador não deixou copiar. Selecione o código de ${copy.file.name} e copie à mão: `}
            <span className="fc-reference-full-hash">{copy.file.sha256}</span>
          </p>
        </Notice>
      ) : null}

      <Table
        caption="Arquivos de referência do workflow"
        className="fc-reference-table"
        columns={columns}
        rows={files}
        rowKey={(file) => file.id}
        loading={list.isPending}
        error={
          noDataError ? (
            <Notice
              type="error"
              title="Não foi possível carregar os arquivos de referência"
              actions={
                finalError ? undefined : (
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
          <EmptyState
            icon={<FileCheckIcon />}
            title="Nenhum arquivo de referência"
            description={
              canEdit
                ? 'Envie um CSV com os resultados que você já conhece.'
                : 'Quem edita os testes deste workflow ainda não enviou nenhum arquivo.'
            }
            action={
              canEdit ? (
                <Button size="small" loading={upload.pending} onClick={upload.choose}>
                  Enviar arquivo
                </Button>
              ) : undefined
            }
          />
        }
      />

      {list.isError && files !== undefined ? (
        <Notice
          type="error"
          title="Não foi possível atualizar a lista"
          actions={
            <Button size="small" loading={list.isFetching} onClick={() => void list.refetch()}>
              Tentar de novo
            </Button>
          }
        >
          {listErrorMessage(list.error)}
        </Notice>
      ) : null}

      {dialog?.type === 'simulate' ? (
        <SimulateDialog
          workflowId={workflowId}
          file={dialog.file}
          focusOnClose={() => rowElement(SIMULATE_ATTRIBUTE, dialog.file.id)}
          onClose={() => setDialog(null)}
          onSimulated={(simulation) => {
            setDialog(null);
            onOpenExecution(simulation.id);
          }}
        />
      ) : null}

      {dialog?.type === 'delete' ? (
        <DeleteReferenceFileDialog
          workflowId={workflowId}
          file={dialog.file}
          // The row of a removed file goes away: the focus goes to the section title.
          focusOnClose={() => (deleted.current ? heading.current : rowElement(ACTIONS_ATTRIBUTE, dialog.file.id))}
          onClose={() => setDialog(null)}
          onDeleted={() => {
            deleted.current = true;
            setDeletedName(dialog.file.name);
            setCopy(null);
            setDialog(null);
          }}
        />
      ) : null}
    </section>
  );
}
