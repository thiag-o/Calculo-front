import { ApiError } from '../../api';
import { MAX_FILE_BYTES, MAX_FILE_MB, fileSize, isXlsx } from './format';

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para gerenciar arquivos e datasets neste tenant. Peça acesso a um Admin.';
export const FILE_NOT_FOUND_MESSAGE = 'Este arquivo não existe mais neste tenant.';
export const NOT_XLSX_MESSAGE = 'Só dá para enviar planilhas .xlsx. Abra o arquivo no Excel, salve como .xlsx e envie de novo.';
export const ONE_FILE_MESSAGE = 'Envie um arquivo por vez.';
export const INVALID_FILE_MESSAGE =
  'O arquivo não é uma planilha .xlsx que possa ser lida. Abra no Excel, salve como .xlsx e envie de novo.';
export const INVALID_HEADER_MESSAGE =
  'A primeira linha de cada aba precisa ter um nome único em cada coluna. Corrija as células abaixo e envie de novo.';
export const SPLIT_FILE_HINT = 'Divida a planilha ou tire as abas que não vão virar dataset e envie de novo.';
export const FILE_IN_USE_MESSAGE = 'O arquivo é usado por datasets. Remova esses datasets antes de remover o arquivo.';
export const DATASET_ALREADY_EXISTS_MESSAGE = 'Já existe um dataset com esse nome neste tenant. Escolha outro nome.';
export const UNKNOWN_SHEET_MESSAGE = 'A aba não existe mais no arquivo. Envie o arquivo de novo e crie o dataset a partir dele.';
const TOO_LARGE_MESSAGE = `O arquivo passa do tamanho máximo aceito (${MAX_FILE_MB} MB).`;
const MISSING_FILE_MESSAGE = 'Escolha um arquivo .xlsx para enviar.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** What the screen shows for an upload error. */
export interface UploadError {
  message: string;
  /** Header cells that stopped the upload (`invalid_header`), as `Vendas!C1` → "Coluna sem nome.". */
  cells: readonly (readonly [cell: string, problem: string])[];
  /** Whether sending the same file again may work (network, server); a problem in the file itself does not. */
  retry: boolean;
}

/** The file chosen in the browser, checked before going to the API: `undefined` when it can be sent. */
export function clientUploadError(file: Pick<File, 'name' | 'size'>): UploadError | undefined {
  if (!isXlsx(file)) return { message: NOT_XLSX_MESSAGE, cells: [], retry: false };
  if (file.size > MAX_FILE_BYTES) {
    return {
      message: `O arquivo tem ${fileSize(file.size)} e o limite é de ${MAX_FILE_MB} MB. ${SPLIT_FILE_HINT}`,
      cells: [],
      retry: false,
    };
  }
  return undefined;
}

/** Error of `POST /v1/excel-files`, by `code` (ADR 0008). */
export function uploadError(error: unknown): UploadError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, cells: [], retry: true };
  // A proxy in front of the API may refuse the size with a 413 that is not problem+json: same message, and no retry.
  if (error.status === 413 && error.code !== 'file_too_large') {
    return { message: `${TOO_LARGE_MESSAGE} ${SPLIT_FILE_HINT}`, cells: [], retry: false };
  }
  switch (error.code) {
    case 'file_too_large':
      // The API says the limit it applies (it may be set below the default).
      return { message: `${error.message} ${SPLIT_FILE_HINT}`, cells: [], retry: false };
    case 'invalid_file':
      return { message: INVALID_FILE_MESSAGE, cells: [], retry: false };
    case 'invalid_header':
      return { message: INVALID_HEADER_MESSAGE, cells: Object.entries(error.fields), retry: false };
    case 'invalid_data':
      return { message: error.fields.file !== undefined ? MISSING_FILE_MESSAGE : error.message, cells: [], retry: false };
    case 'no_permission':
      return { message: NO_PERMISSION_MESSAGE, cells: [], retry: false };
    default:
      // no_connection, unexpected_response, invalid_csrf…: the error's own pt-BR message.
      return { message: error.message, cells: [], retry: true };
  }
}

/** Error of a query (file list or file). */
export function queryErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'not_found' || error.code === 'invalid_data') return FILE_NOT_FOUND_MESSAGE;
  // no_permission, no_connection…: the API's own pt-BR message.
  return error.message;
}

/** What the new dataset dialog shows for an error: a general note and the name field error. */
export interface CreateDatasetError {
  message?: string;
  name?: string;
}

/** Error of `POST /v1/datasets` with `type: excel`, by `code` (ADR 0008). */
export function createDatasetError(error: unknown): CreateDatasetError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'dataset_already_exists':
      return { name: DATASET_ALREADY_EXISTS_MESSAGE };
    case 'unknown_sheet':
      return { message: UNKNOWN_SHEET_MESSAGE };
    case 'no_permission':
      return { message: NO_PERMISSION_MESSAGE };
    case 'invalid_data':
      if (error.fields.excel_file_id !== undefined) return { message: FILE_NOT_FOUND_MESSAGE };
      if (error.fields.name !== undefined) return { name: error.fields.name };
      return { message: error.message };
    default:
      return { message: error.message };
  }
}

/** Error of `DELETE /v1/excel-files/{id}`. */
export function deleteErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'excel_file_in_use':
      return FILE_IN_USE_MESSAGE;
    case 'not_found':
      return FILE_NOT_FOUND_MESSAGE;
    case 'no_permission':
      return NO_PERMISSION_MESSAGE;
    default:
      return error.message;
  }
}
