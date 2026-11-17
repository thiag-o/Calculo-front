import { ApiError } from '../../api';

/** Fields of the role form. */
export type RoleField = 'name' | 'permissions';

/** What the screen shows for an error: a general note (optional) and the error of each field. */
export interface ScreenError {
  message?: string;
  fields: Partial<Record<RoleField, string>>;
}

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para gerenciar papéis neste tenant. Peça acesso a um Admin.';
export const ROLE_ALREADY_EXISTS_MESSAGE = 'Já existe um papel com esse nome neste tenant. Escolha outro nome.';
export const FIXED_ROLE_MESSAGE = 'O papel Admin tem todas as permissões e não pode ser editado nem removido.';
export const ROLE_IN_USE_MESSAGE =
  'O papel está atribuído a usuários deste tenant. Tire o papel deles em Usuários e tente remover de novo.';
export const ROLE_NOT_FOUND_MESSAGE = 'Este papel não existe mais neste tenant. A lista foi atualizada.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** API field name (problem+json `campos`) -> form field. */
const FIELDS: Readonly<Record<string, RoleField>> = { nome: 'name', permissoes: 'permissions' };

function formFields(fields: Readonly<Record<string, string>>): Partial<Record<RoleField, string>> {
  const result: Partial<Record<RoleField, string>> = {};
  for (const [apiField, error] of Object.entries(fields)) {
    // `permissoes.0` (error in a list item) counts for the `permissions` field.
    const field = FIELDS[apiField.split('.')[0] ?? ''];
    if (field !== undefined && result[field] === undefined) result[field] = error;
  }
  return result;
}

/** Error of a query (role list or permission catalog). */
export function queryErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'sem_permissao') return NO_PERMISSION_MESSAGE;
  // sem_conexao, resposta_inesperada…: the error's own pt-BR message.
  return error.message;
}

/** Error creating (`POST /v1/papeis`) or updating (`PUT /v1/papeis/{id}`) a role, by `codigo` (ADR 0008). */
export function formError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'papel_existente':
      return { fields: { name: ROLE_ALREADY_EXISTS_MESSAGE } };
    case 'papel_fixo':
      return { message: FIXED_ROLE_MESSAGE, fields: {} };
    case 'nao_encontrado':
      return { message: ROLE_NOT_FOUND_MESSAGE, fields: {} };
    case 'sem_permissao':
      return { message: NO_PERMISSION_MESSAGE, fields: {} };
    case 'dados_invalidos': {
      const fields = formFields(error.fields);
      return Object.keys(fields).length > 0 ? { message: INVALID_DATA_MESSAGE, fields } : { message: error.message, fields: {} };
    }
    default:
      // csrf_invalido, sem_conexao, resposta_inesperada…: the error's own pt-BR message.
      return { message: error.message, fields: {} };
  }
}

/** Error deleting a role (`DELETE /v1/papeis/{id}`). */
export function deleteErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'papel_em_uso':
      return ROLE_IN_USE_MESSAGE;
    case 'papel_fixo':
      return FIXED_ROLE_MESSAGE;
    case 'nao_encontrado':
      return ROLE_NOT_FOUND_MESSAGE;
    case 'sem_permissao':
      return NO_PERMISSION_MESSAGE;
    default:
      return error.message;
  }
}
