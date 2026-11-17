import { ApiError } from '../../api';
import { FIELDS, type SecurityField } from './parameters';

/** What the screen shows for a PUT error: a general note (optional) and the error of each field. */
export interface ScreenError {
  message?: string;
  fields: Partial<Record<SecurityField, string>>;
}

export const NO_PERMISSION_MESSAGE = 'Você não tem permissão para gerenciar a segurança deste tenant. Peça acesso a um Admin.';
export const OUT_OF_RANGE_MESSAGE = 'Nada foi salvo: há valores fora dos limites aceitos. Confira os campos destacados.';
const INVALID_DATA_MESSAGE = 'Nada foi salvo. Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível concluir agora. Tente de novo em instantes.';

function formFields(fields: Readonly<Record<string, string>>): Partial<Record<SecurityField, string>> {
  const result: Partial<Record<SecurityField, string>> = {};
  for (const [apiField, error] of Object.entries(fields)) {
    const field = apiField as SecurityField;
    if (FIELDS.includes(field)) result[field] = error;
  }
  return result;
}

/** Error loading the parameters (`GET /v1/configuracoes/seguranca`). */
export function queryErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) return UNKNOWN_MESSAGE;
  if (error.code === 'sem_permissao') return NO_PERMISSION_MESSAGE;
  // sem_conexao, resposta_inesperada, origem_nao_autorizada…: the error's own pt-BR message.
  return error.message;
}

/** Error saving (`PUT /v1/configuracoes/seguranca`), by `codigo` (ADR 0008). */
export function saveError(error: unknown): ScreenError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'valor_fora_do_limite':
    case 'dados_invalidos': {
      const fields = formFields(error.fields);
      if (Object.keys(fields).length === 0) return { message: error.message, fields: {} };
      return { message: error.code === 'valor_fora_do_limite' ? OUT_OF_RANGE_MESSAGE : INVALID_DATA_MESSAGE, fields };
    }
    case 'sem_permissao':
      return { message: NO_PERMISSION_MESSAGE, fields: {} };
    default:
      // csrf_invalido, sem_conexao, resposta_inesperada…: the error's own pt-BR message.
      return { message: error.message, fields: {} };
  }
}
