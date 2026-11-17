import { ApiError } from '../../api';
import { FIELDS, type SecurityField } from './parameters';

/** What the screen shows for a PUT error: a general note (optional) and the error of each field. */
export interface ScreenError {
  message?: string;
  fields: Partial<Record<SecurityField, string>>;
}

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para gerenciar a segurança deste tenant. Peça acesso a um Admin.';
export const OUT_OF_RANGE_MESSAGE = 'Nada foi salvo: há valores fora dos limites aceitos. Confira os campos destacados.';
const INVALID_DATA_MESSAGE = 'Nada foi salvo. Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

function formFields(fields: Readonly<Record<string, string>>): Partial<Record<SecurityField, string>> {
  const result: Partial<Record<SecurityField, string>> = {};
  for (const [apiField, error] of Object.entries(fields)) {
    const field = apiField as SecurityField;
    if (FIELDS.includes(field)) result[field] = error;
  }
  return result;
}

/** Error loading the parameters (`GET /v1/settings/security`). */
export function queryErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'no_permission') return NO_PERMISSION_MESSAGE;
  // no_connection, unexpected_response, origin_not_authorized…: the error's own pt-BR message.
  return error.message;
}

/** Error saving (`PUT /v1/settings/security`), by `code` (ADR 0008). */
export function saveError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'value_out_of_range':
    case 'invalid_data': {
      const fields = formFields(error.fields);
      if (Object.keys(fields).length === 0) return { message: error.message, fields: {} };
      return { message: error.code === 'value_out_of_range' ? OUT_OF_RANGE_MESSAGE : INVALID_DATA_MESSAGE, fields };
    }
    case 'no_permission':
      return { message: NO_PERMISSION_MESSAGE, fields: {} };
    default:
      // invalid_csrf, no_connection, unexpected_response…: the error's own pt-BR message.
      return { message: error.message, fields: {} };
  }
}
