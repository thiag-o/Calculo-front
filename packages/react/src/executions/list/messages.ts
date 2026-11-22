import { ApiError } from '../../api';

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver as execuções neste tenant. Peça acesso a um Admin.';
export const INVALID_FILTER_MESSAGE = 'A API recusou os filtros escolhidos. Mude os filtros ou limpe-os para ver todas as execuções.';
export const INVALID_CURSOR_MESSAGE =
  'Não foi possível continuar de onde a lista parou. Recarregue a lista para ver as execuções desde o início.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Errors the filters cause: the way out is to change or clear the filters, not to try again. */
export function filterError(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'invalid_data';
}

/** Error of the execution list, by `code` (ADR 0008). */
export function listErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return NO_PERMISSION_MESSAGE;
    case 'invalid_data':
      return INVALID_FILTER_MESSAGE;
    case 'invalid_cursor':
      return INVALID_CURSOR_MESSAGE;
    default:
      // no_connection, unexpected_response…: the error's own pt-BR message.
      return error.message;
  }
}

/** "3 execuções", "Mais de 50 execuções", "… com esses filtros". */
export function listSummary(total: number, hasMore: boolean, filtered: boolean): string {
  const howMany = total.toLocaleString('pt-BR');
  const base = hasMore ? `Mais de ${howMany} execuções` : total === 1 ? '1 execução' : `${howMany} execuções`;
  return filtered ? `${base} com esses filtros` : base;
}
