import { ApiError } from '../../api';

/** Fields of the sign-in form. */
export type SignInField = 'email' | 'password';

/** What the screen shows for a sign-in error: a general note and, if any, the error of each field. */
export interface SignInError {
  message: string;
  fields: Partial<Record<SignInField, string>>;
}

export const INVALID_CREDENTIALS_MESSAGE = 'E-mail ou senha incorretos. Confira os dados e tente de novo.';
export const TOO_MANY_ATTEMPTS_MESSAGE = 'Muitas tentativas de login a partir desta rede. Espere um pouco e tente de novo.';
const INVALID_DATA_MESSAGE = 'Confira os campos destacados e tente de novo.';
const UNKNOWN_MESSAGE = 'Não foi possível entrar agora. Tente de novo em instantes.';
const LOCK_START = 'O login deste e-mail foi bloqueado depois de várias tentativas erradas.';

const timeFormat = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const dayFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

function sameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * "Tente de novo às 14:30", in the user's time zone. If the unlock falls on another day (lock close to
 * midnight), includes the date: "Tente de novo às 00:05 de 16/11". Without a valid date: "Tente de novo mais tarde".
 */
export function lockMessage(unlocksAt: unknown, now: Date = new Date()): string {
  const when = typeof unlocksAt === 'string' ? new Date(unlocksAt) : undefined;
  if (when === undefined || Number.isNaN(when.getTime())) return `${LOCK_START} Tente de novo mais tarde.`;
  const day = sameDay(when, now) ? '' : ` de ${dayFormat.format(when)}`;
  return `${LOCK_START} Tente de novo às ${timeFormat.format(when)}${day}.`;
}

function signInFields(fields: Readonly<Record<string, string>>): Partial<Record<SignInField, string>> {
  const result: Partial<Record<SignInField, string>> = {};
  if (fields.email) result.email = fields.email;
  if (fields.password) result.password = fields.password;
  return result;
}

/** Turns the `POST /v1/session` error into what the screen shows, always by `code` (ADR 0008). */
export function signInError(error: unknown, now: Date = new Date()): SignInError {
  if (!(error instanceof ApiError)) return { message: UNKNOWN_MESSAGE, fields: {} };
  switch (error.code) {
    case 'invalid_credentials':
      // Own, generic message: does not reveal whether the e-mail exists.
      return { message: INVALID_CREDENTIALS_MESSAGE, fields: {} };
    case 'login_locked':
      return { message: lockMessage(error.body?.unlocks_at, now), fields: {} };
    case 'too_many_attempts':
      return { message: TOO_MANY_ATTEMPTS_MESSAGE, fields: {} };
    case 'invalid_data': {
      const fields = signInFields(error.fields);
      return { message: Object.keys(fields).length > 0 ? INVALID_DATA_MESSAGE : error.message, fields };
    }
    default:
      // no_connection, unexpected_response, invalid_content_type…: the error's own pt-BR message.
      return { message: error.message, fields: {} };
  }
}
