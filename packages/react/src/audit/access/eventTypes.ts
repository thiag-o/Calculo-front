// The access audit event types (contract: GET /v1/audit/access-events), with the label and dot color
// decided by the global session (answer D3 of F18): login_succeeded green, login_failed amber, login_locked red and the
// rest gray. The status is always dot + word (estilos.md §1.4 and §11).
import type { StatusTone } from '../../design-system';

export interface EventType {
  /** The contract code (`login_succeeded`). */
  type: string;
  label: string;
  tone: StatusTone;
}

/** In the contract order, which is also the order of the type filter. */
export const EVENT_TYPES: readonly EventType[] = [
  { type: 'login_succeeded', label: 'Login', tone: 'green' },
  { type: 'login_failed', label: 'Falha de login', tone: 'amber' },
  { type: 'login_locked', label: 'Login bloqueado', tone: 'red' },
  { type: 'logout', label: 'Saída', tone: 'gray' },
  { type: 'tenant_switched', label: 'Troca de tenant', tone: 'gray' },
  { type: 'reset_link_generated', label: 'Link de redefinição gerado', tone: 'gray' },
  { type: 'password_reset', label: 'Senha redefinida', tone: 'gray' },
  { type: 'api_key_created', label: 'Chave de API criada', tone: 'gray' },
  { type: 'api_key_revoked', label: 'Chave de API revogada', tone: 'gray' },
  { type: 'embed_token_issued', label: 'Token de incorporação emitido', tone: 'gray' },
  { type: 'role_updated', label: 'Papel alterado', tone: 'gray' },
  { type: 'user_updated', label: 'Usuário alterado', tone: 'gray' },
  { type: 'security_updated', label: 'Segurança alterada', tone: 'gray' },
];

const BY_TYPE = new Map(EVENT_TYPES.map((type) => [type.type, type]));

/** Label and color of a type. A type the front does not know yet shows with the raw code and the gray dot. */
export function typePresentation(type: string): EventType {
  return BY_TYPE.get(type) ?? { type, label: type, tone: 'gray' };
}
