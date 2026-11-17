import { ApiError } from '../../api';

export const NO_PERMISSION_MESSAGE =
  'Você não tem permissão para gerenciar a integração neste tenant. Peça acesso a um Admin.';
export const API_KEY_NOT_FOUND_MESSAGE = 'Esta chave não existe mais neste tenant. A lista foi atualizada.';
export const AUTHORIZED_DOMAIN_NOT_FOUND_MESSAGE = 'Este domínio já foi removido. A lista foi atualizada.';
export const AUTHORIZED_DOMAIN_ALREADY_EXISTS_MESSAGE = 'Esta origem já está autorizada neste tenant. Confira na lista.';
export const INVALID_ORIGIN_MESSAGE =
  'Use só o esquema, o host e, se precisar, a porta, como https://app.exemplo.com.br, sem caminho no fim.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** What a form shows for an error: a general note (optional) and the field error. */
export interface FormError {
  message?: string;
  field?: string;
}

/** Error of a query (list of keys or of domains). */
export function queryErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'no_permission') return NO_PERMISSION_MESSAGE;
  // invalid_cursor, origin_not_authorized, no_connection, unexpected_response…: the error's own pt-BR message.
  return error.message;
}

/** Error of a single-field form (the key's `name` or the domain's `origin`, as the API names them), by `code` (ADR 0008). */
function formError(error: unknown, apiField: 'name' | 'origin'): FormError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'no_permission':
      return { message: NO_PERMISSION_MESSAGE };
    case 'invalid_data': {
      const fieldMessage = error.fields[apiField];
      return fieldMessage ? { message: INVALID_DATA_MESSAGE, field: fieldMessage } : { message: error.message };
    }
    default:
      // invalid_csrf, origin_not_authorized, no_connection, unexpected_response…: the error's own pt-BR message.
      return { message: error.message };
  }
}

/** Error creating an API key (`POST /v1/api-keys`). */
export function newApiKeyError(error: unknown): FormError {
  return formError(error, 'name');
}

/** Error registering a domain (`POST /v1/authorized-domains`). */
export function newAuthorizedDomainError(error: unknown): FormError {
  if (error instanceof ApiError) {
    if (error.code === 'invalid_origin') return { field: INVALID_ORIGIN_MESSAGE };
    if (error.code === 'authorized_domain_already_exists') return { field: AUTHORIZED_DOMAIN_ALREADY_EXISTS_MESSAGE };
  }
  return formError(error, 'origin');
}

/** Error revoking a key (`DELETE /v1/api-keys/{id}`). */
export function revokeErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'not_found') return API_KEY_NOT_FOUND_MESSAGE;
  return queryErrorMessage(error);
}

/** Error deleting a domain (`DELETE /v1/authorized-domains/{id}`). */
export function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'not_found') return AUTHORIZED_DOMAIN_NOT_FOUND_MESSAGE;
  return queryErrorMessage(error);
}
