import { ApiError } from '../../api';
import { queryErrorMessage as sharedQueryErrorMessage } from '../errors';

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para fazer isso neste tenant. Peça acesso a um Admin.';
export const LIST_NO_PERMISSION_MESSAGE = 'Você não tem permissão para ver as conexões neste tenant. Peça acesso a um Admin.';
export const NOT_FOUND_MESSAGE = 'Esta conexão não existe mais neste tenant. Volte para a lista de conexões.';
export const ALREADY_EXISTS_MESSAGE = 'Já existe uma conexão com esse nome neste tenant. Escolha outro nome.';
export const IN_USE_MESSAGE = 'Esta conexão é usada por datasets. Remova esses datasets antes de remover a conexão.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** The form fields, named as in the screen code. */
export type ConnectionField = 'name' | 'type' | 'host' | 'port' | 'database' | 'username' | 'password';

const FIELDS: readonly ConnectionField[] = ['name', 'type', 'host', 'port', 'database', 'username', 'password'];

/** What a form shows for an error: a general note, the privileges that prevent read-only, and each field's error. */
export interface FormError {
  message?: string;
  /** Only in `connection_not_read_only`: what the API found, one item per privilege (text for people). */
  privileges?: readonly string[];
  fields: Partial<Record<ConnectionField, string>>;
}

/** The `privileges` of a `connection_not_read_only`, narrowed from the problem+json body. */
function privilegesOf(error: ApiError): readonly string[] {
  const privileges = error.body?.privileges;
  return Array.isArray(privileges) ? privileges.filter((item): item is string => typeof item === 'string') : [];
}

/**
 * The `invalid_data` field errors. In the creation the credential comes nested (`credential.host`); in the credential change
 * it is the body itself (`host`).
 */
function fieldErrors(error: ApiError): Partial<Record<ConnectionField, string>> {
  const fields: Partial<Record<ConnectionField, string>> = {};
  for (const field of FIELDS) {
    const message = error.fields[field] ?? error.fields[`credential.${field}`];
    if (message) fields[field] = message;
  }
  return fields;
}

/**
 * Error of a query (list or detail), by `code` (ADR 0008). The other codes (`no_connection`, `unexpected_response`…) show the
 * error's own pt-BR message.
 */
export function queryErrorMessage(error: unknown, noPermission = NO_PERMISSION_MESSAGE, byId = false): string {
  return sharedQueryErrorMessage(error, { notFound: NOT_FOUND_MESSAGE, noPermission, byId });
}

/**
 * Error of the forms that carry a credential (new connection, credential change, test without saving) and of the rename.
 * The test errors (`connection_failed`, `connection_without_tls`, `connection_not_read_only` and
 * `connection_target_not_allowed`) are fixed texts of the API, shown as they come.
 */
export function formError(error: unknown): FormError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'connection_not_read_only':
      return { message: error.message, privileges: privilegesOf(error), fields: {} };
    case 'connection_already_exists':
      return { fields: { name: ALREADY_EXISTS_MESSAGE } };
    case 'too_many_connection_tests':
      return { message: tooManyTestsMessage(retryAfterSeconds(error) ?? 1), fields: {} };
    case 'no_permission':
      return { message: NO_PERMISSION_MESSAGE, fields: {} };
    case 'not_found':
      return { message: NOT_FOUND_MESSAGE, fields: {} };
    case 'invalid_data': {
      const fields = fieldErrors(error);
      return Object.keys(fields).length > 0 ? { message: INVALID_DATA_MESSAGE, fields } : { message: error.message, fields };
    }
    default:
      // connection_failed, connection_without_tls, connection_target_not_allowed, invalid_csrf, no_connection…
      return { message: error.message, fields: {} };
  }
}

/** Error of the deletion: `connection_in_use` says what to do. */
export function deleteErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'connection_in_use') return IN_USE_MESSAGE;
  return queryErrorMessage(error);
}

/** `429 too_many_connection_tests` (E4-16): too many connection tests in a row; `retry_after_seconds` says when one is accepted. */
export function isTooManyTests(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'too_many_connection_tests';
}

/** The seconds until a test is accepted again, from the `retry_after_seconds` of a `429` (at least 1); `undefined` for other errors. */
export function retryAfterSeconds(error: unknown): number | undefined {
  if (!isTooManyTests(error)) return undefined;
  const seconds = (error as ApiError).body?.retry_after_seconds;
  return typeof seconds === 'number' && Number.isFinite(seconds) ? Math.max(1, Math.ceil(seconds)) : 1;
}

/** The text of the `429` (and the reason beside "Testar" while it lasts), with the seconds left. */
export function tooManyTestsMessage(seconds: number): string {
  return `Muitos testes de conexão seguidos. Tente de novo em ${seconds} s.`;
}
