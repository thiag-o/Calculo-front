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

/** Fields of the variable form. */
export type VariableField = 'column' | 'name' | 'type' | 'scale';

/** What the variable form shows for an error: a general note (optional) and the error of each field. */
export interface VariableScreenError {
  message?: string;
  fields: Partial<Record<VariableField, string>>;
}

export const VARIABLES_NO_PERMISSION_MESSAGE = 'Você não tem permissão para gerenciar variáveis neste tenant. Peça acesso a um Admin.';
export const VARIABLE_ALREADY_EXISTS_MESSAGE = 'Já existe uma variável com esse nome neste dataset. Escolha outro nome.';
export const INVALID_VARIABLE_NAME_MESSAGE =
  'Use de 1 a 63 caracteres: letras minúsculas sem acento, números e _, começando por uma letra.';
export const INCOMPATIBLE_TYPE_MESSAGE = 'A coluna não pode virar uma variável desse tipo. Escolha um dos tipos da lista.';
export const UNKNOWN_COLUMN_MESSAGE = 'A coluna não está mais no dataset; a lista de colunas foi atualizada.';
export const VARIABLE_NOT_FOUND_MESSAGE = 'Esta variável não existe mais neste dataset.';

/** API field name (problem+json `fields`) -> variable form field. */
const VARIABLE_FIELDS: Readonly<Record<string, VariableField>> = {
  column: 'column',
  name: 'name',
  type: 'type',
  scale: 'scale',
};

/**
 * Error creating (`POST /v1/datasets/{id}/variables`) or changing (`PUT /v1/variables/{id}`) a variable, by `code`.
 * `editing` tells what a `404 not_found` means: the variable is gone (change) or the dataset is gone (creation).
 */
export function variableError(error: unknown, editing: boolean): VariableScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'variable_already_exists':
      return { fields: { name: VARIABLE_ALREADY_EXISTS_MESSAGE } };
    case 'invalid_variable_name':
      return { fields: { name: INVALID_VARIABLE_NAME_MESSAGE } };
    case 'incompatible_type':
      return { fields: { type: INCOMPATIBLE_TYPE_MESSAGE } };
    case 'unknown_column':
      // Editing has no column field (the column stays): the error goes to the general note.
      return editing ? { message: UNKNOWN_COLUMN_MESSAGE, fields: {} } : { fields: { column: UNKNOWN_COLUMN_MESSAGE } };
    case 'not_found':
      return { message: editing ? VARIABLE_NOT_FOUND_MESSAGE : DATASET_NOT_FOUND_MESSAGE, fields: {} };
    case 'no_permission':
      return { message: VARIABLES_NO_PERMISSION_MESSAGE, fields: {} };
    case 'invalid_data': {
      const fields: Partial<Record<VariableField, string>> = {};
      for (const [apiField, message] of Object.entries(error.fields)) {
        const field = VARIABLE_FIELDS[apiField];
        if (field !== undefined && fields[field] === undefined) fields[field] = message;
      }
      if (editing && fields.column !== undefined) return { message: fields.column, fields: {} };
      return Object.keys(fields).length > 0 ? { fields } : { message: error.message, fields: {} };
    }
    default:
      return { message: error.message, fields: {} };
  }
}

/** Error deleting a variable (`DELETE /v1/variables/{id}`). */
export function deleteVariableErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'not_found':
      return VARIABLE_NOT_FOUND_MESSAGE;
    case 'no_permission':
      return VARIABLES_NO_PERMISSION_MESSAGE;
    default:
      return error.message;
  }
}
