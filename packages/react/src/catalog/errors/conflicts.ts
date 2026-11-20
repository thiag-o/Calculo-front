import { ApiError } from '../../api';

/** Shown when a version conflict (`409 *_changed`) comes without a message of its own. */
export const CHANGED_DEFAULT_MESSAGE = 'Os dados mudaram desde que você abriu esta tela. Recarregue para ver a versão atual.';

/** `409 connection_credential_unreadable`: the stored credential cannot be read; the fix is to register it again. */
export function isCredentialUnreadable(error: unknown): boolean {
  return error instanceof ApiError && error.code === 'connection_credential_unreadable';
}

/** The version conflicts of the catalog: the connection, the dataset or the variable changed after the screen read it. */
export function isChangedConflict(error: unknown): boolean {
  return (
    error instanceof ApiError &&
    (error.code === 'connection_changed' || error.code === 'dataset_changed' || error.code === 'variable_changed')
  );
}

/** The API's own message of a conflict (`detail` or `title`), or the default text when it came without one. */
export function conflictMessage(error: unknown): string {
  if (error instanceof ApiError) {
    const { detail, title } = error.body ?? {};
    if (typeof detail === 'string' && detail !== '') return detail;
    if (typeof title === 'string' && title !== '') return title;
  }
  return CHANGED_DEFAULT_MESSAGE;
}
