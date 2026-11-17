import { ApiError } from '../../api';

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver a auditoria neste tenant. Peça acesso a um Admin.';
export const INVERTED_PERIOD_MESSAGE = 'A data final vem antes da inicial. Ajuste o período.';
export const INVALID_TYPE_MESSAGE = 'A API não reconhece o tipo de evento escolhido. Escolha outro tipo ou limpe os filtros.';
export const REJECTED_PERIOD_MESSAGE = 'A API recusou o período. Confira as datas destacadas ou limpe os filtros.';
export const INVALID_CURSOR_MESSAGE =
  'Não foi possível continuar de onde a lista parou. Recarregue a lista para ver os eventos desde o início.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Errors the filters cause: the way out is to change or clear the filters, not to try again. */
export function filterError(error: unknown): boolean {
  return error instanceof ApiError && (error.code === 'invalid_event_type' || error.code === 'invalid_data');
}

/** Error of the event list, by `code` (ADR 0008). */
export function listErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'no_permission':
      return NO_PERMISSION_MESSAGE;
    case 'invalid_event_type':
      return INVALID_TYPE_MESSAGE;
    case 'invalid_data':
      return REJECTED_PERIOD_MESSAGE;
    case 'invalid_cursor':
      return INVALID_CURSOR_MESSAGE;
    default:
      // origin_not_authorized, no_connection, unexpected_response…: the error's own pt-BR message.
      return error.message;
  }
}

/** The error the API gave on a period field (`fields.since` or `fields.until` of `invalid_data`). */
export function fieldError(error: unknown, field: 'since' | 'until'): string | undefined {
  if (!(error instanceof ApiError) || error.code !== 'invalid_data') return undefined;
  return error.fields[field === 'since' ? 'since' : 'until'] || undefined;
}
