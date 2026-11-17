import { useEffect, useId, useRef, useState, type ReactNode } from 'react';
import { ApiError } from '../../api';
import { Badge, Button, EmptyState, Loading, Notice, Tabs, Text, textClasses } from '../../design-system';
import { useSession } from '../../session';
import { ColumnsTable } from '../columns';
import { DeleteExcelFileDialog } from './DeleteExcelFileDialog';
import { columnCount, dateTime, fileSize, sampledRows, sheetCount } from './format';
import { BackIcon, SpreadsheetIcon } from './icons';
import { queryErrorMessage } from './messages';
import { NewSheetDatasetDialog } from './NewSheetDatasetDialog';
import { DATASETS_MANAGE, useExcelFile, type Dataset, type ExcelFile, type Sheet } from './queries';
import './files.css';

export interface ExcelFileDetailProps {
  /** Id (UUID) of the file. */
  fileId: string;
  /** Back to the list ("Voltar para Arquivos"). */
  onBack: () => void;
  /** Called after the file is deleted, with its name (the screen goes back to the list). */
  onDeleted: (fileName: string) => void;
  /**
   * Opens the detail of a dataset (`/catalog/datasets/:id` in the module): a dataset created from a sheet opens right after
   * it is saved. Without it, the sheet says the dataset was created.
   */
  onOpenDataset?: (id: string) => void;
  /** Puts the focus on the title when the detail opens from the list (keyboard and screen reader land on it). */
  focusTitle?: boolean;
}

/**
 * Catalog › Arquivos › one Excel file: size, upload date, SHA-256 and one tab per sheet, with the columns and the inferred
 * types. With `datasets.manage`: "Novo dataset" in each sheet (`POST /v1/datasets` with `type: excel`) and "Remover arquivo"
 * with confirmation (`excel_file_in_use`). Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function ExcelFileDetail({ fileId, onBack, onDeleted, onOpenDataset, focusTitle = false }: ExcelFileDetailProps) {
  const query = useExcelFile(fileId);
  const file = query.data;

  if (!file) {
    if (query.isError) {
      const notFound = query.error instanceof ApiError && ['not_found', 'invalid_data'].includes(query.error.code);
      const noPermission = query.error instanceof ApiError && query.error.code === 'no_permission';
      return (
        <DetailFrame onBack={onBack}>
          <Notice
            type="error"
            title="Não foi possível abrir o arquivo"
            actions={
              notFound || noPermission ? undefined : (
                <Button size="small" loading={query.isFetching} onClick={() => void query.refetch()}>
                  Tentar de novo
                </Button>
              )
            }
          >
            {queryErrorMessage(query.error)}
          </Notice>
        </DetailFrame>
      );
    }
    return (
      <DetailFrame onBack={onBack}>
        <Loading label="Carregando o arquivo" rows={4} />
      </DetailFrame>
    );
  }

  return (
    <LoadedDetail
      file={file}
      onBack={onBack}
      onDeleted={onDeleted}
      onOpenDataset={onOpenDataset}
      focusTitle={focusTitle}
      refetchError={query.isError ? query.error : null}
      refetching={query.isFetching}
      refetch={() => void query.refetch()}
    />
  );
}

function BackButton({ onBack }: { onBack: () => void }) {
  return (
    <div>
      <Button variant="ghost" size="small" icon={<BackIcon size={14} />} onClick={onBack}>
        Voltar para Arquivos
      </Button>
    </div>
  );
}

/** "Voltar para Arquivos" above the detail, in every state. */
function DetailFrame({ onBack, children }: { onBack: () => void; children: ReactNode }) {
  return (
    <section className="fc-files" aria-label="Arquivo Excel">
      <BackButton onBack={onBack} />
      {children}
    </section>
  );
}

interface LoadedDetailProps {
  file: ExcelFile;
  onBack: () => void;
  onDeleted: (fileName: string) => void;
  onOpenDataset?: (id: string) => void;
  focusTitle: boolean;
  refetchError: Error | null;
  refetching: boolean;
  refetch: () => void;
}

function LoadedDetail({ file, onBack, onDeleted, onOpenDataset, focusTitle, refetchError, refetching, refetch }: LoadedDetailProps) {
  const titleId = useId();
  const sheetsTitleId = useId();
  const session = useSession();
  const title = useRef<HTMLHeadingElement>(null);
  const deleteButton = useRef<HTMLButtonElement>(null);
  const [deleting, setDeleting] = useState(false);
  const canManage = session.hasPermission(DATASETS_MANAGE);

  useEffect(() => {
    if (focusTitle) title.current?.focus();
  }, [focusTitle]);

  return (
    <section className="fc-files" aria-labelledby={titleId}>
      <BackButton onBack={onBack} />
      <header className="fc-files-top">
        <div className="fc-files-title">
          <h2 id={titleId} ref={title} tabIndex={-1} className={`fc-text fc-files-wrap fc-files-heading ${textClasses({ variant: 'heading-16' })}`}>
            {file.file_name}
          </h2>
          <Text as="p" variant="label-14" emphasis="secondary" className="fc-files-number">
            {`${fileSize(file.size_bytes)} · ${sheetCount(file.sheets.length)} · enviado em ${dateTime(file.uploaded_at) || '—'}`}
          </Text>
          <Text as="p" variant="label-12" emphasis="secondary" className="fc-files-hash">
            SHA-256 <span className={textClasses({ variant: 'mono-12' })}>{file.sha256}</span>
          </Text>
        </div>
        {canManage ? (
          <Button ref={deleteButton} onClick={() => setDeleting(true)}>
            Remover arquivo
          </Button>
        ) : null}
      </header>

      {refetchError ? (
        <Notice
          type="error"
          title="Não foi possível atualizar o arquivo"
          actions={
            <Button size="small" loading={refetching} onClick={refetch}>
              Tentar de novo
            </Button>
          }
        >
          {queryErrorMessage(refetchError)}
        </Notice>
      ) : null}

      <section className="fc-files-section" aria-labelledby={sheetsTitleId}>
        <Text as="h3" variant="heading-14" id={sheetsTitleId}>
          Abas
        </Text>
        {file.sheets.length === 0 ? (
          <EmptyState icon={<SpreadsheetIcon />} title="Nenhuma aba" description="O arquivo não tem abas para ler." />
        ) : (
          <Tabs label={`Abas de ${file.file_name}`} items={file.sheets.map((sheet) => ({ value: sheet.name, label: sheet.name }))} size="small" panelClassName="fc-files-panel">
            {(sheetName) => {
              const sheet = file.sheets.find((candidate) => candidate.name === sheetName);
              return sheet ? (
                <SheetPanel key={sheet.name} file={file} sheet={sheet} canManage={canManage} onOpenDataset={onOpenDataset} />
              ) : null;
            }}
          </Tabs>
        )}
      </section>

      {deleting ? (
        <DeleteExcelFileDialog
          file={file}
          focusOnClose={deleteButton}
          onClose={() => setDeleting(false)}
          onDeleted={() => {
            setDeleting(false);
            onDeleted(file.file_name);
          }}
        />
      ) : null}
    </section>
  );
}

interface SheetPanelProps {
  file: ExcelFile;
  sheet: Sheet;
  canManage: boolean;
  onOpenDataset?: (id: string) => void;
}

/** One sheet: what was read to infer the types, the columns and, with `datasets.manage`, "Novo dataset". */
function SheetPanel({ file, sheet, canManage, onOpenDataset }: SheetPanelProps) {
  const newButton = useRef<HTMLButtonElement>(null);
  const [creating, setCreating] = useState(false);
  const [created, setCreated] = useState<Dataset | null>(null);

  return (
    <div className="fc-files-sheet">
      <div className="fc-files-top">
        <div className="fc-files-facts">
          <Badge>{columnCount(sheet.columns.length)}</Badge>
          <Text variant="label-13" emphasis="secondary" className="fc-files-number">
            {sampledRows(sheet.sampled_rows)}
          </Text>
        </div>
        {canManage ? (
          <Button
            ref={newButton}
            variant="primary"
            onClick={() => {
              setCreated(null);
              setCreating(true);
            }}
          >
            Novo dataset
          </Button>
        ) : null}
      </div>

      {created ? <Notice type="success">{`Dataset ${created.name} criado a partir da aba ${sheet.name}.`}</Notice> : null}

      <ColumnsTable
        caption={`Colunas da aba ${sheet.name}`}
        columns={sheet.columns}
        empty={
          <EmptyState
            icon={<SpreadsheetIcon />}
            title="Nenhuma coluna"
            description="A primeira linha da aba está vazia. Preencha o cabeçalho na planilha e envie o arquivo de novo."
          />
        }
      />

      {creating ? (
        <NewSheetDatasetDialog
          file={file}
          sheet={sheet}
          focusOnClose={newButton}
          onClose={() => setCreating(false)}
          onCreated={(dataset) => {
            setCreating(false);
            if (onOpenDataset) onOpenDataset(dataset.id);
            else setCreated(dataset);
          }}
        />
      ) : null}
    </div>
  );
}
