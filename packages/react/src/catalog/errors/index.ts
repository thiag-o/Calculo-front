// Sub-vertical "errors" of the "catalog" vertical (ADR 0003): the one translation of a query error into a message,
// shared by connections, datasets, files and variables. Other verticals reach the catalog only through catalog/index.ts.
export { isNotFoundError, queryErrorMessage } from './queryError';
export type { QueryErrorMessages } from './queryError';
