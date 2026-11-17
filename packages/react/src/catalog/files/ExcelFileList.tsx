import { useEffect, useId, useRef } from 'react';
import { ApiError } from '../../api';
import { Button, EmptyState, Notice, Table, Text, textClasses, type TableColumn } from '../../design-system';
import { useSession } from '../../session';
import { dateTime, fileSize, sheetCount } from './format';
import { SpreadsheetIcon } from './icons';
import { queryErrorMessage } from './messages';
import { DATASETS_MANAGE, useExcelFileList, type ExcelFile } from './queries';
import { UploadArea } from './UploadArea';
import './files.css';

const LINK_ATTRIBUTE = 'data-fc-file-link';

function summary(total: number): string {
  return total === 1 ? '1 arquivo' : `${total.toLocaleString('pt-BR')} arquivos`;
}

export interface ExcelFileListProps {
  /** Opens the detail of a file: the name in each row, and a file right after it is uploaded. */
  onOpen: (id: string) => void;
  /** When the screen comes back from a detail, the focus goes to that file's name in the list. */
  focusFileId?: string;
  /** Name of a file just deleted in the detail: the list says it is gone. */
  deletedFileName?: string;
}

/**
 * Catalog › Arquivos: the tenant Excel files with name, sheets, size and upload date. With `datasets.manage`, the upload
 * area (drag and drop, or "Enviar arquivo"). Needs `ApiProvider`, `QueryClientProvider` and `FluxoRoot`.
 */
export function ExcelFileList({ onOpen, focusFileId, deletedFileName }: ExcelFileListProps) {
  const titleId = useId();
  const session = useSession();
  const list = useExcelFileList();
  const section = useRef<HTMLElement>(null);
  const canManage = session.hasPermission(DATASETS_MANAGE);

  const files = list.data;
  const loaded = files !== undefined;
  // Back from a detail: the focus goes to that file's name, looked up only inside the section (ADR 0002).
  useEffect(() => {
    if (!loaded || !focusFileId) return;
    section.current?.querySelector<HTMLElement>(`[${LINK_ATTRIBUTE}="${focusFileId}"]`)?.focus();
  }, [loaded, focusFileId]);

  const noPermission = list.error instanceof ApiError && list.error.code === 'no_permission';

  const columns: readonly TableColumn<ExcelFile>[] = [
    {
      key: 'name',
      title: 'Nome',
      skeletonWidth: 200,
      cell: (file) => (
        <button
          type="button"
          className={`fc-files-link ${textClasses({ variant: 'label-14', medium: true })}`}
          onClick={() => onOpen(file.id)}
          data-fc-file-link={file.id}
        >
          {file.file_name}
        </button>
      ),
    },
    {
      key: 'sheets',
      title: 'Abas',
      skeletonWidth: 140,
      cell: (file) => (
        <div className="fc-files-two-lines">
          <Text variant="label-14" className="fc-files-number">
            {sheetCount(file.sheets.length)}
          </Text>
          {file.sheets.length > 0 ? (
            <Text variant="label-13" emphasis="secondary" className="fc-files-wrap">
              {file.sheets.map((sheet) => sheet.name).join(', ')}
            </Text>
          ) : null}
        </div>
      ),
    },
    {
      key: 'size',
      title: 'Tamanho',
      width: '112px',
      align: 'end',
      skeletonWidth: 56,
      cell: (file) => (
        <Text variant="label-14" className="fc-files-number">
          {fileSize(file.size_bytes)}
        </Text>
      ),
    },
    {
      key: 'uploaded',
      title: 'Enviado em',
      width: '180px',
      skeletonWidth: 120,
      cell: (file) => (
        <Text variant="label-13" emphasis="secondary" className="fc-files-number">
          {dateTime(file.uploaded_at)}
        </Text>
      ),
    },
  ];

  return (
    <section ref={section} className="fc-files" aria-labelledby={titleId}>
      <header className="fc-files-top">
        <div className="fc-files-title">
          <Text as="h2" variant="heading-16" id={titleId}>
            Arquivos
          </Text>
          <Text as="p" variant="label-14" emphasis="secondary">
            {files ? summary(files.length) : 'Planilhas Excel enviadas ao tenant; cada aba pode virar um dataset'}
          </Text>
        </div>
      </header>

      {deletedFileName ? <Notice type="success">{`Arquivo ${deletedFileName} removido.`}</Notice> : null}

      {canManage ? <UploadArea onUploaded={(file) => onOpen(file.id)} /> : null}

      <Table
        caption="Arquivos do tenant"
        columns={columns}
        rows={files}
        rowKey={(file) => file.id}
        loading={list.isPending}
        error={
          list.isError && files === undefined ? (
            <Notice
              type="error"
              title="Não foi possível carregar os arquivos"
              actions={
                noPermission ? undefined : (
                  <Button size="small" onClick={() => void list.refetch()} loading={list.isFetching}>
                    Tentar de novo
                  </Button>
                )
              }
            >
              {queryErrorMessage(list.error)}
            </Notice>
          ) : undefined
        }
        empty={
          <EmptyState
            icon={<SpreadsheetIcon />}
            title="Nenhum arquivo ainda"
            description={
              canManage
                ? 'Arraste uma planilha .xlsx para a área acima ou use Enviar arquivo. Cada aba pode virar um dataset.'
                : 'Quem gerencia datasets no tenant ainda não enviou nenhuma planilha.'
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
          {queryErrorMessage(list.error)}
        </Notice>
      ) : null}
    </section>
  );
}
