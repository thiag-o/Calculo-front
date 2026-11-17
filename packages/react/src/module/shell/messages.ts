import { ApiError } from '../../api';

export const NO_TENANT_ACCESS_MESSAGE =
  'Você não tem mais acesso a esse cliente. A lista de clientes foi atualizada; escolha outro.';

/** What to say when the tenant switch fails. The decision is by `code`, never by the text. */
export function switchErrorMessage(error: unknown): string {
  if (error instanceof ApiError && error.code === 'no_tenant_access') return NO_TENANT_ACCESS_MESSAGE;
  if (error instanceof ApiError) return `Não foi possível trocar de cliente. ${error.message}`;
  return 'Não foi possível trocar de cliente. Tente de novo.';
}

/** What to say when "Sair" fails (e.g. `invalid_csrf`). The session stays open. */
export function signOutErrorMessage(error: unknown): string {
  if (error instanceof ApiError) return `Não foi possível sair. ${error.message}`;
  return 'Não foi possível sair. Tente de novo.';
}
