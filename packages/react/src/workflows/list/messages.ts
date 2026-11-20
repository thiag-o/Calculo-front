import { ApiError } from '../../api';

/** Fields of the workflow form (name and objective). */
export type WorkflowField = 'name' | 'objective';

/** What the screen shows for an error: a general note (optional) and the error of each field. */
export interface ScreenError {
  message?: string;
  fields: Partial<Record<WorkflowField, string>>;
}

export const LIST_NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver os workflows deste tenant. Peça acesso a um Admin.';
export const EDIT_NO_PERMISSION_MESSAGE = 'Você não tem permissão para editar workflows neste tenant. Peça acesso a um Admin.';
export const WORKFLOW_EXISTS_MESSAGE = 'Já existe um workflow com esse nome neste tenant. Escolha outro nome.';
export const INVALID_CURSOR_MESSAGE = 'A lista mudou enquanto você navegava. Carregue a lista de novo.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Error of the workflow list (`GET /v1/workflows`), by `code` (ADR 0008). */
export function listErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return LIST_NO_PERMISSION_MESSAGE;
    case 'invalid_cursor':
      return INVALID_CURSOR_MESSAGE;
    default:
      // no_connection, unexpected_response, invalid_data…: the error's own pt-BR message.
      return error.message || UNKNOWN_MESSAGE;
  }
}

/** Error saving the name and the objective (`POST /v1/workflows` or `PUT /v1/workflows/{id}`), by `code` (ADR 0008). */
export function saveError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'workflow_exists':
      return { fields: { name: WORKFLOW_EXISTS_MESSAGE } };
    case 'no_permission':
      return { message: EDIT_NO_PERMISSION_MESSAGE, fields: {} };
    case 'invalid_data': {
      const fields: ScreenError['fields'] = {};
      if (error.fields.name !== undefined) fields.name = error.fields.name;
      if (error.fields.objective !== undefined) fields.objective = error.fields.objective;
      return Object.keys(fields).length > 0 ? { message: INVALID_DATA_MESSAGE, fields } : { message: error.message || UNKNOWN_MESSAGE, fields: {} };
    }
    default:
      // not_found, invalid_csrf, no_connection…: the error's own pt-BR message.
      return { message: error.message || UNKNOWN_MESSAGE, fields: {} };
  }
}
