import { ApiError } from '../../api';

/** Fields of the user forms. */
export type UserField = 'email' | 'name' | 'roles' | 'active';

/** What the screen shows for an error: a general note (optional) and the error of each field. */
export interface ScreenError {
  message?: string;
  fields: Partial<Record<UserField, string>>;
}

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para gerenciar usuários neste tenant. Peça acesso a um Admin.';
export const USER_ALREADY_EXISTS_MESSAGE = 'Este e-mail já é de um usuário deste tenant. Procure-o na lista para editar.';
export const UNKNOWN_ROLE_MESSAGE = 'Um dos papéis escolhidos não existe mais. A lista foi atualizada: escolha de novo.';
export const LAST_ADMIN_MESSAGE =
  'O tenant precisa de pelo menos um Admin ativo. Dê o papel Admin a outro usuário antes de tirá-lo deste ou de desativá-lo.';
export const USER_NOT_FOUND_MESSAGE = 'Este usuário não existe mais neste tenant. A lista foi atualizada.';
export const INACTIVE_USER_MESSAGE = 'O usuário está inativo neste tenant. Ative-o para gerar o link.';
export const EXTERNAL_USER_MESSAGE = 'O usuário foi criado pela incorporação e entra pelo sistema hospedeiro, sem senha.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** API field name (problem+json `campos`) -> form field. */
const FIELDS: Readonly<Record<string, UserField>> = { email: 'email', nome: 'name', papeis: 'roles', ativo: 'active' };

function formFields(fields: Readonly<Record<string, string>>): Partial<Record<UserField, string>> {
  const result: Partial<Record<UserField, string>> = {};
  for (const [apiField, error] of Object.entries(fields)) {
    // `papeis.0` (error in a list item) counts for the `roles` field.
    const field = FIELDS[apiField.split('.')[0] ?? ''];
    if (field !== undefined && result[field] === undefined) result[field] = error;
  }
  return result;
}

/** Codes common to every call (permission, network, invalid data); `undefined` if the code is not one of them. */
function commonError(error: ApiError): ScreenError | undefined {
  switch (error.code) {
    case 'sem_permissao':
      return { message: NO_PERMISSION_MESSAGE, fields: {} };
    case 'dados_invalidos': {
      const fields = formFields(error.fields);
      return Object.keys(fields).length > 0 ? { message: INVALID_DATA_MESSAGE, fields } : { message: error.message, fields: {} };
    }
    default:
      return undefined;
  }
}

/** Error of the user list. */
export function listErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'sem_permissao') return NO_PERMISSION_MESSAGE;
  // cursor_invalido, sem_conexao, resposta_inesperada…: the error's own pt-BR message.
  return error.message;
}

/** Error of the form's role list. */
export function rolesErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  // GET /v1/papeis accepts usuarios.gerenciar or papeis.gerenciar (D2): sem_permissao here means not managing users.
  if (error.code === 'sem_permissao') return NO_PERMISSION_MESSAGE;
  return error.message;
}

/** Error creating (`POST /v1/usuarios`) or updating (`PUT /v1/usuarios/{id}`) a user, by `codigo` (ADR 0008). */
export function formError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'usuario_existente':
      return { fields: { email: USER_ALREADY_EXISTS_MESSAGE } };
    case 'papel_inexistente':
      return { fields: { roles: UNKNOWN_ROLE_MESSAGE } };
    case 'ultimo_admin':
      return { message: LAST_ADMIN_MESSAGE, fields: {} };
    case 'nao_encontrado':
      return { message: USER_NOT_FOUND_MESSAGE, fields: {} };
    default:
      // csrf_invalido, sem_conexao, resposta_inesperada…: the error's own pt-BR message.
      return commonError(error) ?? { message: error.message, fields: {} };
  }
}

/** Error generating the reset link (`POST /v1/usuarios/{id}/redefinicao`). */
export function linkErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  switch (error.code) {
    case 'usuario_inativo':
      return INACTIVE_USER_MESSAGE;
    case 'usuario_externo':
      return EXTERNAL_USER_MESSAGE;
    case 'nao_encontrado':
      return USER_NOT_FOUND_MESSAGE;
    case 'sem_permissao':
      return NO_PERMISSION_MESSAGE;
    default:
      return error.message;
  }
}
