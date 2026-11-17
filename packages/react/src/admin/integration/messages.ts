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
  if (error.code === 'sem_permissao') return NO_PERMISSION_MESSAGE;
  // cursor_invalido, origem_nao_autorizada, sem_conexao, resposta_inesperada…: the error's own pt-BR message.
  return error.message;
}

/** Error of a single-field form (the key's `nome` or the domain's `origem`, as the API names them), by `codigo` (ADR 0008). */
function formError(error: unknown, apiField: 'nome' | 'origem'): FormError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE };
  switch (error.code) {
    case 'sem_permissao':
      return { message: NO_PERMISSION_MESSAGE };
    case 'dados_invalidos': {
      const fieldMessage = error.fields[apiField];
      return fieldMessage ? { message: INVALID_DATA_MESSAGE, field: fieldMessage } : { message: error.message };
    }
    default:
      // csrf_invalido, origem_nao_autorizada, sem_conexao, resposta_inesperada…: the error's own pt-BR message.
      return { message: error.message };
  }
}

/** Error creating an API key (`POST /v1/chaves-api`). */
export function newApiKeyError(error: unknown): FormError {
  return formError(error, 'nome');
}

/** Error registering a domain (`POST /v1/dominios-autorizados`). */
export function newAuthorizedDomainError(error: unknown): FormError {
  if (error instanceof ApiError) {
    if (error.code === 'origem_invalida') return { field: INVALID_ORIGIN_MESSAGE };
    if (error.code === 'dominio_existente') return { field: AUTHORIZED_DOMAIN_ALREADY_EXISTS_MESSAGE };
  }
  return formError(error, 'origem');
}

/** Error revoking a key (`DELETE /v1/chaves-api/{id}`). */
export function revokeErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'nao_encontrado') return API_KEY_NOT_FOUND_MESSAGE;
  return queryErrorMessage(error);
}

/** Error deleting a domain (`DELETE /v1/dominios-autorizados/{id}`). */
export function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'nao_encontrado') return AUTHORIZED_DOMAIN_NOT_FOUND_MESSAGE;
  return queryErrorMessage(error);
}
