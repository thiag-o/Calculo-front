import { ApiError } from '../../api';

export const CONFLICT_TITLE = 'Este rascunho mudou em outra aba ou por outra pessoa';
export const CONFLICT_MESSAGE = 'Recarregue o rascunho para continuar. O que você mudou aqui depois do último salvamento não é mantido.';
export const READ_ONLY_REASON = 'Você não tem permissão para editar este workflow';
export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para editar este workflow. Peça acesso a um Admin.';
const NOT_FOUND_MESSAGE = 'Este workflow não existe mais. Ele pode ter sido removido por outra pessoa.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Why the draft was not saved (`PUT …/draft`), by `code` (ADR 0008). The conflict has its own note. */
export function saveErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return NO_PERMISSION_MESSAGE;
    case 'not_found':
      return NOT_FOUND_MESSAGE;
    default:
      // definition_too_large, invalid_data, no_connection, unexpected_response…: the error's own pt-BR message.
      return error.message || UNKNOWN_MESSAGE;
  }
}

/** Why the draft did not open (`GET …/draft`), by `code`. */
export function loadErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'not_found':
    case 'invalid_data':
      // invalid_data: an id that is not a UUID, which no workflow has.
      return 'Este workflow não existe ou foi removido. Volte e escolha outro workflow.';
    case 'no_permission':
      return 'Você não tem permissão para ver este workflow. Peça acesso a um Admin.';
    default:
      return error.message || UNKNOWN_MESSAGE;
  }
}

/** Whether trying again can help (not for a missing workflow nor a missing permission). */
export function canRetryLoad(error: unknown): boolean {
  return !(error instanceof ApiError && (error.code === 'not_found' || error.code === 'no_permission' || error.code === 'invalid_data'));
}
