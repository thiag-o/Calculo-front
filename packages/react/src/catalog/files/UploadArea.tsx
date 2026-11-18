import { useRef, useState, type DragEvent } from 'react';
import { Button, Notice, Text } from '../../design-system';
import { MAX_FILE_MB, XLSX_ACCEPT, fileSize } from './format';
import { UploadIcon } from './icons';
import { ONE_FILE_MESSAGE, clientUploadError, uploadError, type UploadError } from './messages';
import { useUploadExcelFile, type ExcelFile, type UploadProgress } from './queries';

export interface UploadAreaProps {
  /** Called with the stored file, its sheets and columns already read. */
  onUploaded: (file: ExcelFile) => void;
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

function percentOf(progress: UploadProgress | null): number {
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}

/**
 * Area to upload an Excel file (a visual piece only the catalog uses, D11): drag and drop, or "Enviar arquivo", which opens
 * the file picker. Only `.xlsx` up to 20 MB, both checked here before the upload; then the progress of the upload and, when it
 * fails, what to fix (the header cells, for `invalid_header`).
 */
export function UploadArea({ onUploaded }: UploadAreaProps) {
  const input = useRef<HTMLInputElement>(null);
  const dragDepth = useRef(0);
  const upload = useUploadExcelFile();
  const [chosen, setChosen] = useState<File | null>(null);
  const [clientError, setClientError] = useState<UploadError | null>(null);
  const [dragging, setDragging] = useState(false);
  const sendButton = useRef<HTMLButtonElement>(null);

  function cancelUpload() {
    upload.cancel();
    setChosen(null);
    // The "Cancelar" button leaves with the upload: the focus goes back to "Enviar arquivo".
    sendButton.current?.focus();
  }

  function send(file: File) {
    setChosen(file);
    const problem = clientUploadError(file);
    if (problem) {
      upload.reset();
      setClientError(problem);
      return;
    }
    setClientError(null);
    upload.mutate(file, { onSuccess: onUploaded });
  }

  function receive(files: FileList | null) {
    if (!files || files.length === 0 || upload.isPending) return;
    if (files.length > 1) {
      upload.reset();
      setChosen(null);
      setClientError({ message: ONE_FILE_MESSAGE, cells: [], retry: false });
      return;
    }
    const [file] = files;
    if (file) send(file);
  }

  function dragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }
  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = upload.isPending ? 'none' : 'copy';
  }
  function dragLeave() {
    dragDepth.current = Math.max(0, dragDepth.current - 1);
    if (dragDepth.current === 0) setDragging(false);
  }
  function drop(event: DragEvent<HTMLDivElement>) {
    // Without it, the browser would open the dropped file in place of the page.
    event.preventDefault();
    dragDepth.current = 0;
    setDragging(false);
    receive(event.dataTransfer.files);
  }

  const error = clientError ?? (upload.isError ? uploadError(upload.error) : null);
  const pending = upload.isPending;
  const percent = percentOf(upload.progress);
  const reading = pending && percent >= 100;
  const name = chosen?.name ?? '';

  return (
    <div className="fc-files-upload-block">
      <div
        className={['fc-files-upload', dragging ? 'fc-files-upload-over' : null].filter(Boolean).join(' ')}
        onDragEnter={dragEnter}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
        role="group"
        aria-label="Área para soltar o arquivo Excel"
      >
        <span className="fc-files-upload-icon">
          <UploadIcon />
        </span>
        {pending ? (
          <div className="fc-files-upload-text">
            <Text as="p" variant="label-14" medium className="fc-files-wrap" role="status">
              {reading ? `Lendo as abas de ${name}` : `Enviando ${name}`}
            </Text>
            <div
              role="progressbar"
              aria-label={`Envio de ${name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={reading ? 'Enviado; lendo as abas' : `${percent}%`}
              className="fc-files-meter"
            >
              <span className="fc-files-meter-fill" style={{ width: `${percent}%` }} />
            </div>
            <Text as="p" variant="label-13" emphasis="secondary" className="fc-files-number">
              {reading
                ? 'Enviado. Lendo as abas e inferindo os tipos das colunas.'
                : `${percent}% de ${fileSize(upload.progress?.total ?? chosen?.size ?? 0)}`}
            </Text>
          </div>
        ) : (
          <div className="fc-files-upload-text">
            <Text as="p" variant="label-14" medium>
              {dragging ? 'Solte para enviar' : 'Arraste um arquivo .xlsx para cá'}
            </Text>
            <Text as="p" variant="label-13" emphasis="secondary">
              {`Até ${MAX_FILE_MB} MB. A primeira linha de cada aba é o cabeçalho; os tipos vêm das primeiras 1.000 linhas.`}
            </Text>
          </div>
        )}
        <input
          ref={input}
          type="file"
          accept={XLSX_ACCEPT}
          hidden
          tabIndex={-1}
          aria-label="Arquivo Excel (.xlsx)"
          onChange={(event) => {
            receive(event.target.files);
            // Choosing the same file again (after fixing it) must fire the change again.
            event.target.value = '';
          }}
        />
        {pending ? <Button onClick={cancelUpload}>Cancelar</Button> : null}
        <Button ref={sendButton} variant="primary" loading={pending} onClick={() => input.current?.click()}>
          Enviar arquivo
        </Button>
      </div>

      {error ? (
        <Notice
          type="error"
          title={name ? `Não foi possível enviar ${name}` : 'Não foi possível enviar o arquivo'}
          actions={
            error.retry && chosen ? (
              <Button size="small" onClick={() => send(chosen)}>
                Tentar de novo
              </Button>
            ) : undefined
          }
        >
          <p className="fc-files-notice-text">{error.message}</p>
          {error.cells.length > 0 ? (
            <ul className="fc-files-cells" aria-label="Células do cabeçalho com problema">
              {error.cells.map(([cell, problem]) => (
                <li key={cell}>
                  <span className="fc-files-cell">{cell}</span> {problem}
                </li>
              ))}
            </ul>
          ) : null}
        </Notice>
      ) : null}
    </div>
  );
}
