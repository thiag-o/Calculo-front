// What the reference files section says, by the `code` of each error (ADR 0008), never by the server text, except where the
// plan asks for the API message (`reference_file_mismatch`, E7-25) or the API says the limit it applies.
import { ApiError, type Schemas } from '../../api';
import { MAX_FILE_BYTES, MAX_FILE_MB, fileSize, isCsv } from './format';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';
export const LIST_NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver os testes deste workflow. Peça acesso a um Admin.';
export const WORKFLOW_NOT_FOUND_MESSAGE = 'Este workflow não existe mais. Ele pode ter sido removido por outra pessoa.';
export const EDIT_NO_PERMISSION_MESSAGE = 'Você não tem permissão para enviar ou remover arquivos de referência. Peça acesso a um Admin.';
export const SIMULATE_NO_PERMISSION_MESSAGE = 'Você não tem permissão para simular este workflow. Peça acesso a um Admin.';
export const FILE_NOT_FOUND_MESSAGE = 'Este arquivo de referência não existe mais. Ele pode ter sido removido por outra pessoa.';
export const NOT_CSV_MESSAGE = 'Só dá para enviar arquivos .csv. Salve a planilha como CSV (UTF-8, separado por vírgula) e envie de novo.';
export const ONE_FILE_MESSAGE = 'Envie um arquivo por vez.';
export const SMALLER_FILE_HINT = 'Deixe no arquivo só os registros que você quer conferir e envie de novo.';
export const INVALID_FILE_MESSAGE = 'O arquivo tem erros. Corrija o que está abaixo e envie de novo.';
export const TOO_MANY_FILES_HINT = 'Remova um arquivo da lista antes de enviar outro.';
const TOO_LARGE_MESSAGE = `O arquivo passa do tamanho máximo aceito (${MAX_FILE_MB} MB).`;
const MISSING_FILE_MESSAGE = 'Escolha um arquivo .csv para enviar.';

/** The key of the errors of the header in `invalid_reference_file` (E7-10): shown as "Cabeçalho". */
const HEADER_KEY = 'header';
/** The contract sends at most 20 errors in `invalid_reference_file`. */
export const MAX_LISTED_ERRORS = 20;

/** One error of the file: where ("linha 12, coluna pontos" or "Cabeçalho") and what to fix. */
export interface FileError {
  where: string;
  problem: string;
}

/** What the section shows for an upload error. */
export interface UploadError {
  message: string;
  /** The errors by line and column (`invalid_reference_file`), in the order of the API. */
  errors: readonly FileError[];
  /** Whether sending the same file again may work (network, server); a problem in the file itself does not. */
  retry: boolean;
}

/** The file chosen in the browser, checked before going to the API: `undefined` when it can be sent. */
export function clientUploadError(file: Pick<File, 'name' | 'size'>): UploadError | undefined {
  if (!isCsv(file)) return { message: NOT_CSV_MESSAGE, errors: [], retry: false };
  if (file.size > MAX_FILE_BYTES) {
    return {
      message: `O arquivo tem ${fileSize(file.size)} e o limite é de ${MAX_FILE_MB} MB. ${SMALLER_FILE_HINT}`,
      errors: [],
      retry: false,
    };
  }
  return undefined;
}

/** The errors of an `invalid_reference_file`: the keys are text for people, in pt-BR (contract); `header` is the header. */
function fileErrors(fields: Readonly<Record<string, string>>): FileError[] {
  return Object.entries(fields).map(([where, problem]) => ({ where: where === HEADER_KEY ? 'Cabeçalho' : where, problem }));
}

/** Error of `POST /v1/workflows/{id}/reference-files`, by `code` (ADR 0008). */
export function uploadError(error: unknown): UploadError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, errors: [], retry: true };
  // A proxy in front of the API may refuse the size with a 413 that is not problem+json: same message, and no retry.
  if (error.status === 413 && error.code !== 'file_too_large') {
    return { message: `${TOO_LARGE_MESSAGE} ${SMALLER_FILE_HINT}`, errors: [], retry: false };
  }
  switch (error.code) {
    case 'file_too_large':
      // The API says the limit it applies.
      return { message: `${error.message} ${SMALLER_FILE_HINT}`, errors: [], retry: false };
    case 'invalid_reference_file':
      return { message: INVALID_FILE_MESSAGE, errors: fileErrors(error.fields), retry: false };
    case 'too_many_reference_files':
      return { message: `${error.message} ${TOO_MANY_FILES_HINT}`, errors: [], retry: false };
    case 'no_batch_source':
      // The API says what to do ("Escolha a fonte do lote para enviar um arquivo de referência.").
      return { message: error.message, errors: [], retry: false };
    case 'invalid_data':
      return { message: error.fields.file ?? MISSING_FILE_MESSAGE, errors: [], retry: false };
    case 'no_permission':
      return { message: EDIT_NO_PERMISSION_MESSAGE, errors: [], retry: false };
    case 'not_found':
      return { message: WORKFLOW_NOT_FOUND_MESSAGE, errors: [], retry: false };
    default:
      // no_connection, unexpected_response, invalid_csrf…: the error's own pt-BR message.
      return { message: error.message, errors: [], retry: true };
  }
}

/** Error of the list of reference files. */
export function listErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return LIST_NO_PERMISSION_MESSAGE;
    case 'not_found':
      return WORKFLOW_NOT_FOUND_MESSAGE;
    default:
      return error.message;
  }
}

/** Error of `DELETE /v1/workflows/{id}/reference-files/{file_id}`. */
export function deleteErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'not_found':
      return FILE_NOT_FOUND_MESSAGE;
    case 'no_permission':
      return EDIT_NO_PERMISSION_MESSAGE;
    default:
      return error.message;
  }
}

export function problemCount(count: number): string {
  return count === 1 ? '1 problema' : `${count.toLocaleString('pt-BR')} problemas`;
}

/** The reason beside the disabled "Simular" while the saved draft has problems (estilos.md §14). */
export function problemsReason(count: number): string {
  return `Resolva ${problemCount(count)} do rascunho para simular`;
}

/** The note on what runs (E7-25). */
export function revisionNote(revision: number): string {
  return `Simula o rascunho salvo (revisão ${revision.toLocaleString('pt-BR')}) e compara com o arquivo. Nada é entregue.`;
}

/** Why the saved draft could not be read, by `code`. */
export function draftErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return 'Você não tem permissão para ver o rascunho deste workflow. Peça acesso a um Admin.';
    case 'not_found':
      return WORKFLOW_NOT_FOUND_MESSAGE;
    default:
      return error.message;
  }
}

export interface SimulateErrorMessage {
  title: string;
  message: string;
}

function currentRevision(error: ApiError): number | null {
  const revision = (error.body as Partial<Schemas['DraftRunConflictProblem']> | undefined)?.current_revision;
  return typeof revision === 'number' ? revision : null;
}

function sentProblems(error: ApiError): number {
  const problems = (error.body as Partial<Schemas['DraftRunConflictProblem']> | undefined)?.problems;
  return Array.isArray(problems) ? problems.length : 0;
}

/**
 * What went wrong with the simulation, by `code` (ADR 0008). `missing_parameter` and `invalid_parameter` go to the parameter
 * field, not here. `reference_file_mismatch` shows the API message, as E7-25 asks.
 */
export function simulateErrorMessage(error: unknown): SimulateErrorMessage {
  const title = 'Não foi possível simular';
  if (!(error instanceof ApiError)) return { title, message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'reference_file_mismatch':
      return { title: 'O arquivo não bate mais com o workflow', message: error.message };
    case 'draft_conflict': {
      const revision = currentRevision(error);
      return {
        title: 'O rascunho foi salvo de novo',
        message:
          revision === null
            ? 'Alguém salvou o rascunho depois que esta janela abriu. Confira os parâmetros e simule de novo para rodar a revisão atual.'
            : `Alguém salvou o rascunho depois que esta janela abriu, e ele está agora na revisão ${revision.toLocaleString('pt-BR')}. Confira os parâmetros e simule de novo para rodar a revisão atual.`,
      };
    }
    case 'draft_has_problems': {
      const count = sentProblems(error);
      return {
        title: 'O rascunho salvo tem problemas',
        message: `${count > 0 ? `O rascunho salvo tem ${problemCount(count)}.` : 'O rascunho salvo tem problemas.'} Corrija-os no editor e salve antes de simular.`,
      };
    }
    case 'no_batch_source':
      return {
        title: 'Este workflow não tem fonte do lote',
        message: 'A simulação lê os registros da fonte do lote. Escolha a fonte do lote no painel do workflow, salve e simule de novo.',
      };
    case 'no_permission':
      return { title, message: SIMULATE_NO_PERMISSION_MESSAGE };
    case 'not_found':
      return { title, message: FILE_NOT_FOUND_MESSAGE };
    default:
      return { title, message: error.message };
  }
}
