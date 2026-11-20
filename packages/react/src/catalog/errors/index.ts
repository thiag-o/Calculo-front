// Sub-vertical "errors" of the "catalog" vertical (ADR 0003): the one translation of a query error into a message,
// the version conflicts and the unreadable credential, shared by connections, datasets, files and variables. Other
// verticals reach the catalog only through catalog/index.ts.
export { isNotFoundError, queryErrorMessage } from './queryError';
export type { QueryErrorMessages } from './queryError';
export { CHANGED_DEFAULT_MESSAGE, conflictMessage, isChangedConflict, isCredentialUnreadable } from './conflicts';
export { ReloadNotice, RELOAD_FAILED_MESSAGE } from './ReloadNotice';
export type { ReloadNoticeProps } from './ReloadNotice';
