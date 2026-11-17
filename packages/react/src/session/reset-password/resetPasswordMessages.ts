import { ApiError } from '../../api';

export const INVALID_LINK_CODE = 'link_invalido';

export const INVALID_LINK_MESSAGE = 'Este link não vale mais: já foi usado ou venceu. Peça ao administrador um link novo.';
export const PASSWORD_SAVED_MESSAGE = 'Senha salva. Entre com o seu e-mail e a nova senha.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível salvar a senha agora. Tente de novo em instantes.';
const UNKNOWN_VERIFICATION_MESSAGE = 'Não foi possível verificar o link agora. Tente de novo em instantes.';

/** Does the error say the link is no longer valid (unknown, used or expired)? */
export function isInvalidLink(error: unknown): boolean {
  return error instanceof ApiError && error.code === INVALID_LINK_CODE;
}

/** Message of a verification failure that is not `link_invalido` (no connection, unexpected response…). */
export function verificationErrorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : UNKNOWN_VERIFICATION_MESSAGE;
}

/** What the screen shows for a submit error (besides `link_invalido`): a general note and/or the field error. */
export interface SubmitError {
  message?: string;
  newPassword?: string;
}

/** Turns the `POST /v1/redefinicao` error into what the screen shows, always by `code` (ADR 0008). */
export function submitError(error: unknown): SubmitError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE };
  const newPassword = error.fields.nova_senha;
  switch (error.code) {
    case 'senha_invalida':
      // The rule the password broke (length, e-mail) comes in the field; without it, the note says what the server said.
      return newPassword ? { newPassword } : { message: error.message };
    case 'dados_invalidos':
      return newPassword ? { newPassword, message: INVALID_DATA_MESSAGE } : { message: error.message };
    default:
      // sem_conexao, resposta_inesperada, tipo_conteudo_invalido…: the error's own pt-BR message.
      return { message: error.message };
  }
}

const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "Este link vale até 16/11 às 14:30.", in the user's time zone. Without a valid date: `undefined` (the sentence goes away). */
export function expiryMessage(expiresAt: string): string | undefined {
  const when = new Date(expiresAt);
  if (Number.isNaN(when.getTime())) return undefined;
  return `Este link vale até ${dayFormat.format(when)} às ${timeFormat.format(when)}.`;
}

/** Password length in characters (code points, as the server counts), without trimming spaces. */
export function passwordLength(password: string): number {
  return Array.from(password).length;
}

/** The password rules, shown below the field. */
export function passwordRules(minPasswordLength: number): string {
  return `Pelo menos ${minPasswordLength} caracteres. Não pode conter o seu e-mail.`;
}
