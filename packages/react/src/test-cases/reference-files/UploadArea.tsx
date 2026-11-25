import { useRef, useState, type DragEvent, type RefObject } from 'react';
import { Button, Notice, Text } from '../../design-system';
import { CSV_ACCEPT, MAX_FILE_MB, fileSize, recordCount } from './format';
import { UploadIcon } from './icons';
import { MAX_LISTED_ERRORS, ONE_FILE_MESSAGE, clientUploadError, uploadError, type UploadError } from './messages';
import { useUploadReferenceFile, type ReferenceFile, type UploadProgress } from './queries';

/** The note on the format of the file (E7-25). */
export const FORMAT_NOTE = 'As colunas da chave do registro e os campos da saída. Um CSV entregue serve.';

function percentOf(progress: UploadProgress | null): number {
  if (!progress || progress.total <= 0) return 0;
  return Math.min(100, Math.round((progress.loaded / progress.total) * 100));
}

function hasFiles(event: DragEvent): boolean {
  return Array.from(event.dataTransfer.types).includes('Files');
}

/**
 * The upload of a reference file, shared by the upload area and the "Enviar arquivo" of the empty state: one file input,
 * the checks made in the browser (only `.csv`, up to 20 MB, one at a time), the upload with progress and its result.
 */
export function useReferenceFileUpload(workflowId: string) {
  const input = useRef<HTMLInputElement>(null);
  const upload = useUploadReferenceFile(workflowId);
  const [chosen, setChosen] = useState<File | null>(null);
  const [clientError, setClientError] = useState<UploadError | null>(null);
  const [uploaded, setUploaded] = useState<ReferenceFile | null>(null);

  function send(file: File) {
    setChosen(file);
    setUploaded(null);
    const problem = clientUploadError(file);
    if (problem) {
      upload.reset();
      setClientError(problem);
      return;
    }
    setClientError(null);
    upload.mutate(file, { onSuccess: setUploaded });
  }

  function receive(files: FileList | readonly File[] | null) {
    if (!files || files.length === 0 || upload.isPending) return;
    if (files.length > 1) {
      upload.reset();
      setChosen(null);
      setUploaded(null);
      setClientError({ message: ONE_FILE_MESSAGE, errors: [], retry: false });
      return;
    }
    const [file] = Array.from(files);
    if (file) send(file);
  }

  function cancel() {
    upload.cancel();
    setChosen(null);
  }

  return {
    input,
    /** Opens the file picker of the browser. */
    choose: () => input.current?.click(),
    receive,
    retry: () => {
      if (chosen) send(chosen);
    },
    cancel,
    pending: upload.isPending,
    progress: upload.progress,
    chosen,
    error: clientError ?? (upload.isError ? uploadError(upload.error) : null),
    uploaded,
  };
}

export type ReferenceFileUpload = ReturnType<typeof useReferenceFileUpload>;

export interface UploadAreaProps {
  upload: ReferenceFileUpload;
  /** Where the focus goes when "Cancelar" leaves with the upload (the "Enviar arquivo" of the area). */
  sendButton: RefObject<HTMLButtonElement | null>;
}

/**
 * The area to upload a reference file (E7-25): drag and drop, or "Enviar arquivo", which opens the file picker; the note on
 * the format; the progress of the upload with "Cancelar"; and, when it fails, what to fix (the errors by line and column of
 * `invalid_reference_file`, up to 20).
 */
export function UploadArea({ upload, sendButton }: UploadAreaProps) {
  const dragDepth = useRef(0);
  const [dragging, setDragging] = useState(false);
  const { pending, error, chosen, uploaded } = upload;
  const percent = percentOf(upload.progress);
  const reading = pending && percent >= 100;
  const name = chosen?.name ?? '';

  function dragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    dragDepth.current += 1;
    setDragging(true);
  }
  function dragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasFiles(event)) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = pending ? 'none' : 'copy';
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
    upload.receive(event.dataTransfer.files);
  }

  function cancel() {
    upload.cancel();
    // The "Cancelar" button leaves with the upload: the focus goes back to "Enviar arquivo".
    sendButton.current?.focus();
  }

  return (
    <div className="fc-reference-upload-block">
      <div
        className={['fc-reference-upload', dragging ? 'fc-reference-upload-over' : null].filter(Boolean).join(' ')}
        onDragEnter={dragEnter}
        onDragOver={dragOver}
        onDragLeave={dragLeave}
        onDrop={drop}
        role="group"
        aria-label="Área para soltar o arquivo de referência"
      >
        <span className="fc-reference-upload-icon">
          <UploadIcon />
        </span>
        {pending ? (
          <div className="fc-reference-upload-text">
            <Text as="p" variant="label-14" medium className="fc-reference-wrap" role="status">
              {reading ? `Conferindo ${name}` : `Enviando ${name}`}
            </Text>
            <div
              role="progressbar"
              aria-label={`Envio de ${name}`}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-valuenow={percent}
              aria-valuetext={reading ? 'Enviado; conferindo as linhas' : `${percent}%`}
              className="fc-reference-meter"
            >
              <span className="fc-reference-meter-fill" style={{ width: `${percent}%` }} />
            </div>
            <Text as="p" variant="label-13" emphasis="secondary" className="fc-reference-number">
              {reading
                ? 'Enviado. Conferindo cada linha com o rascunho salvo.'
                : `${percent}% de ${fileSize(upload.progress?.total ?? chosen?.size ?? 0)}`}
            </Text>
          </div>
        ) : (
          <div className="fc-reference-upload-text">
            <Text as="p" variant="label-14" medium>
              {dragging ? 'Solte para enviar' : 'Arraste um arquivo .csv para cá'}
            </Text>
            <Text as="p" variant="label-13" emphasis="secondary">
              {`${FORMAT_NOTE} Até ${MAX_FILE_MB} MB.`}
            </Text>
          </div>
        )}
        <input
          ref={upload.input}
          type="file"
          accept={CSV_ACCEPT}
          hidden
          tabIndex={-1}
          aria-label="Arquivo de referência (.csv)"
          onChange={(event) => {
            upload.receive(event.target.files);
            // Choosing the same file again (after fixing it) must fire the change again.
            event.target.value = '';
          }}
        />
        {pending ? <Button onClick={cancel}>Cancelar</Button> : null}
        <Button ref={sendButton} variant="primary" loading={pending} onClick={upload.choose}>
          Enviar arquivo
        </Button>
      </div>

      {!pending && uploaded && !error ? (
        <Notice type="success">{`Arquivo ${uploaded.name} enviado, com ${recordCount(uploaded.records)}.`}</Notice>
      ) : null}

      {!pending && error ? (
        <Notice
          type="error"
          title={name ? `Não foi possível enviar ${name}` : 'Não foi possível enviar o arquivo'}
          actions={
            error.retry && chosen ? (
              <Button size="small" onClick={upload.retry}>
                Tentar de novo
              </Button>
            ) : undefined
          }
        >
          <p className="fc-reference-notice-text">{error.message}</p>
          {error.errors.length > 0 ? (
            <ul className="fc-reference-errors" aria-label="Erros do arquivo">
              {error.errors.map((item) => (
                <li key={item.where}>
                  <span className="fc-reference-error-where">{item.where}</span> {item.problem}
                </li>
              ))}
            </ul>
          ) : null}
          {error.errors.length >= MAX_LISTED_ERRORS ? (
            <p className="fc-reference-notice-text fc-reference-notice-more">
              {`Mostrando os primeiros ${MAX_LISTED_ERRORS} erros. Corrija-os e envie de novo para ver se há outros.`}
            </p>
          ) : null}
        </Notice>
      ) : null}
    </div>
  );
}
