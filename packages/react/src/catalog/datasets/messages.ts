import { ApiError } from '../../api';

/** Fields of the new dataset form. */
export type DatasetField = 'connection' | 'object' | 'sql' | 'name';

/** What the screen shows for an error: a general note (optional) and the error of each field. */
export interface ScreenError {
  message?: string;
  fields: Partial<Record<DatasetField, string>>;
}

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para gerenciar datasets neste tenant. Peça acesso a um Admin.';
export const DATASET_ALREADY_EXISTS_MESSAGE = 'Já existe um dataset com esse nome neste tenant. Escolha outro nome.';
export const UNKNOWN_OBJECT_MESSAGE = 'A tabela ou view não existe mais nesta conexão. Escolha outra na lista.';
export const UNKNOWN_CONNECTION_MESSAGE = 'A conexão não existe mais. Escolha outra.';
export const REFRESH_UNKNOWN_OBJECT_MESSAGE =
  'A tabela ou view deste dataset não existe mais na origem. Confira o banco do cliente ou crie o dataset de novo.';
export const REFRESH_INVALID_SQL_MESSAGE = 'O banco recusou o SQL deste dataset ao ler as colunas.';
export const NO_CONNECTIONS_PERMISSION_MESSAGE =
  'Você não tem permissão para ver as conexões deste tenant. Peça acesso a um Admin para criar datasets.';
export const DATASET_NOT_FOUND_MESSAGE = 'Este dataset não existe mais neste tenant.';
const INVALID_SQL_MESSAGE = 'O SQL foi recusado. Confira o comando e tente de novo.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** API field name (problem+json `fields`) -> form field. */
const FIELDS: Readonly<Record<string, DatasetField>> = {
  connection_id: 'connection',
  schema_name: 'object',
  object_name: 'object',
  sql: 'sql',
  name: 'name',
};

function formFields(fields: Readonly<Record<string, string>>): Partial<Record<DatasetField, string>> {
  const result: Partial<Record<DatasetField, string>> = {};
  for (const [apiField, error] of Object.entries(fields)) {
    const field = FIELDS[apiField];
    if (field !== undefined && result[field] === undefined) result[field] = error;
  }
  return result;
}

/**
 * Error of a query (dataset list, dataset, connections, objects or columns). `notFound` is what a `404 not_found`
 * means in that query (the dataset, the connection or the object is gone).
 */
export function queryErrorMessage(error: unknown, notFound: string = DATASET_NOT_FOUND_MESSAGE): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'not_found') return notFound;
  // no_permission, connection_failed, connection_target_not_allowed, no_connection…: the API's own pt-BR message
  // (the connection errors are fixed texts of the API, never the driver's).
  return error.message;
}

/** Error creating a dataset (`POST /v1/datasets`), by `code` (ADR 0008). */
export function createError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'dataset_already_exists':
      return { fields: { name: DATASET_ALREADY_EXISTS_MESSAGE } };
    case 'unknown_object':
      return { fields: { object: UNKNOWN_OBJECT_MESSAGE } };
    case 'invalid_sql':
      return { fields: { sql: error.fields.sql ?? (error.message || INVALID_SQL_MESSAGE) } };
    case 'no_permission':
      return { message: NO_PERMISSION_MESSAGE, fields: {} };
    case 'invalid_data': {
      const fields = formFields(error.fields);
      if (error.fields.connection_id !== undefined) fields.connection = UNKNOWN_CONNECTION_MESSAGE;
      return Object.keys(fields).length > 0 ? { message: INVALID_DATA_MESSAGE, fields } : { message: error.message, fields: {} };
    }
    default:
      // connection_failed, connection_target_not_allowed, invalid_csrf, no_connection…: the error's own pt-BR message.
      return { message: error.message, fields: {} };
  }
}

/** Error renaming a dataset (`PUT /v1/datasets/{id}`). */
export function renameError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'dataset_already_exists':
      return { fields: { name: DATASET_ALREADY_EXISTS_MESSAGE } };
    case 'not_found':
      return { message: DATASET_NOT_FOUND_MESSAGE, fields: {} };
    case 'no_permission':
      return { message: NO_PERMISSION_MESSAGE, fields: {} };
    case 'invalid_data': {
      const fields = formFields(error.fields);
      return fields.name ? { fields: { name: fields.name } } : { message: error.message, fields: {} };
    }
    default:
      return { message: error.message, fields: {} };
  }
}

/** Error reading the columns again (`POST /v1/datasets/{id}/column-refresh`). */
export function refreshErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'unknown_object':
      return REFRESH_UNKNOWN_OBJECT_MESSAGE;
    case 'invalid_sql':
      return error.fields.sql ? `${REFRESH_INVALID_SQL_MESSAGE} ${error.fields.sql}` : REFRESH_INVALID_SQL_MESSAGE;
    case 'not_found':
      return DATASET_NOT_FOUND_MESSAGE;
    case 'no_permission':
      return NO_PERMISSION_MESSAGE;
    default:
      return error.message;
  }
}

/** Error deleting a dataset (`DELETE /v1/datasets/{id}`). */
export function deleteErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'not_found':
      return DATASET_NOT_FOUND_MESSAGE;
    case 'no_permission':
      return NO_PERMISSION_MESSAGE;
    default:
      return error.message;
  }
}
