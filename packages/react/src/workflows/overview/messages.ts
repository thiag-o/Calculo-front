import { ApiError } from '../../api';

/** Fields of the rename form (name and objective). */
export type WorkflowField = 'name' | 'objective';

/** What the screen shows for an error: a general note (optional) and the error of each field. */
export interface ScreenError {
  message?: string;
  fields: Partial<Record<WorkflowField, string>>;
}

export const NOT_FOUND_MESSAGE = 'Este workflow não existe neste tenant ou foi removido. Volte para a lista de workflows.';
export const VIEW_NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver os workflows deste tenant. Peça acesso a um Admin.';
export const EDIT_NO_PERMISSION_MESSAGE = 'Você não tem permissão para editar workflows neste tenant. Peça acesso a um Admin.';
export const WORKFLOW_EXISTS_MESSAGE = 'Já existe um workflow com esse nome neste tenant. Escolha outro nome.';
export const GONE_MESSAGE = 'Este workflow não existe mais. Volte para a lista de workflows.';
/** Why "Salvar" and "Remover workflow" stay disabled once the API says the workflow is gone. */
export const GONE_REASON = 'O workflow não existe mais';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/**
 * Whether the workflow of the address does not exist: `not_found`, or `invalid_data` (`422`), which in a query by id
 * means the id is not even a UUID (same rule as the dataset detail, F44).
 */
export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'not_found' || error.code === 'invalid_data');
}

export function isNoPermission(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'no_permission';
}

/** Error reading the workflow (`GET /v1/workflows/{id}`), by `code` (ADR 0008). */
export function loadErrorMessage(error: unknown): string {
  if (isNotFound(error)) return NOT_FOUND_MESSAGE;
  if (isNoPermission(error)) return VIEW_NO_PERMISSION_MESSAGE;
  if (error instanceof ApiError) return error.message || UNKNOWN_MESSAGE;
  return UNKNOWN_MESSAGE;
}

/** Error renaming (`PUT /v1/workflows/{id}`), by `code` (ADR 0008). */
export function renameError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'workflow_exists':
      return { fields: { name: WORKFLOW_EXISTS_MESSAGE } };
    case 'no_permission':
      return { message: EDIT_NO_PERMISSION_MESSAGE, fields: {} };
    case 'not_found':
      return { message: GONE_MESSAGE, fields: {} };
    case 'invalid_data': {
      const fields: ScreenError['fields'] = {};
      if (error.fields.name !== undefined) fields.name = error.fields.name;
      if (error.fields.objective !== undefined) fields.objective = error.fields.objective;
      return Object.keys(fields).length > 0
        ? { message: INVALID_DATA_MESSAGE, fields }
        : { message: error.message || UNKNOWN_MESSAGE, fields: {} };
    }
    default:
      // invalid_csrf, no_connection, unexpected_response…: the error's own pt-BR message.
      return { message: error.message || UNKNOWN_MESSAGE, fields: {} };
  }
}

/** Error removing (`DELETE /v1/workflows/{id}`), by `code` (ADR 0008). */
export function deleteErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'not_found':
      return GONE_MESSAGE;
    case 'no_permission':
      return EDIT_NO_PERMISSION_MESSAGE;
    default:
      return error.message || UNKNOWN_MESSAGE;
  }
}
