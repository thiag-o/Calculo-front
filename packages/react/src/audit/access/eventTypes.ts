// The access audit event types (contract: GET /v1/auditoria/acessos), with the label and dot color
// decided by the global session (answer D3 of F18): login_ok green, login_falhou amber, login_bloqueado red and the
// rest gray. The status is always dot + word (estilos.md §1.4 and §11).
import type { StatusTone } from '../../design-system';

export interface EventType {
  /** The contract code (`login_ok`). */
  type: string;
  label: string;
  tone: StatusTone;
}

/** In the contract order, which is also the order of the type filter. */
export const EVENT_TYPES: readonly EventType[] = [
  { type: 'login_ok', label: 'Login', tone: 'green' },
  { type: 'login_falhou', label: 'Falha de login', tone: 'amber' },
  { type: 'login_bloqueado', label: 'Login bloqueado', tone: 'red' },
  { type: 'logout', label: 'Saída', tone: 'gray' },
  { type: 'troca_tenant', label: 'Troca de tenant', tone: 'gray' },
  { type: 'redefinicao_gerada', label: 'Link de redefinição gerado', tone: 'gray' },
  { type: 'senha_redefinida', label: 'Senha redefinida', tone: 'gray' },
  { type: 'chave_api_criada', label: 'Chave de API criada', tone: 'gray' },
  { type: 'chave_api_revogada', label: 'Chave de API revogada', tone: 'gray' },
  { type: 'token_incorporacao_emitido', label: 'Token de incorporação emitido', tone: 'gray' },
  { type: 'papel_alterado', label: 'Papel alterado', tone: 'gray' },
  { type: 'usuario_alterado', label: 'Usuário alterado', tone: 'gray' },
  { type: 'seguranca_alterada', label: 'Segurança alterada', tone: 'gray' },
];

const BY_TYPE = new Map(EVENT_TYPES.map((type) => [type.type, type]));

/** Label and color of a type. A type the front does not know yet shows with the raw code and the gray dot. */
export function typePresentation(type: string): EventType {
  return BY_TYPE.get(type) ?? { type, label: type, tone: 'gray' };
}
