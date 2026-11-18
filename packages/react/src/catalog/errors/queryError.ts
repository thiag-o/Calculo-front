import { ApiError } from '../../api';

const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/**
 * Whether a query failed because what it asked for does not exist. `not_found` always means that. `invalid_data` (a `422`)
 * means it only in a query by id (`byId`): the id in the address is not even valid. In a list it is a real failure.
 */
export function isNotFoundError(error: unknown, byId = false): boolean {
  return error instanceof ApiError && (error.code === 'not_found' || (byId && error.code === 'invalid_data'));
}

/** The texts a query error is translated to; the codes without a text show the error's own pt-BR message. */
export interface QueryErrorMessages {
  /** What "not found" means in this query. */
  notFound: string;
  /** What `no_permission` means in this query (default: the API's own message). */
  noPermission?: string;
  /** The query is a detail by id: `invalid_data` (a malformed id) also means "not found". */
  byId?: boolean;
}

/** The single translation of a query error (list, detail, objects, columns) into a message for people (ADR 0008). */
export function queryErrorMessage(error: unknown, messages: QueryErrorMessages): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (isNotFoundError(error, messages.byId)) return messages.notFound;
  if (error.code === 'no_permission' && messages.noPermission !== undefined) return messages.noPermission;
  // no_permission, invalid_data in a list, connection_failed, no_connection…: the error's own pt-BR message.
  return error.message;
}
