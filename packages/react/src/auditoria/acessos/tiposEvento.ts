// Os tipos de evento da auditoria de acessos (contrato: GET /v1/auditoria/acessos), com o rótulo e a cor do ponto
// decididos pela sessão global (resposta D3 da F18): login_ok verde, login_falhou âmbar, login_bloqueado vermelho e os
// demais cinza. O status é sempre ponto + palavra (estilos.md §1.4 e §11).
import type { CorStatus } from '../../design-system';

export interface TipoEvento {
  /** O código do contrato (`login_ok`). */
  tipo: string;
  rotulo: string;
  cor: CorStatus;
}

/** Na ordem do contrato, que também é a ordem do filtro por tipo. */
export const TIPOS_EVENTO: readonly TipoEvento[] = [
  { tipo: 'login_ok', rotulo: 'Login', cor: 'verde' },
  { tipo: 'login_falhou', rotulo: 'Falha de login', cor: 'ambar' },
  { tipo: 'login_bloqueado', rotulo: 'Login bloqueado', cor: 'vermelho' },
  { tipo: 'logout', rotulo: 'Saída', cor: 'cinza' },
  { tipo: 'troca_tenant', rotulo: 'Troca de tenant', cor: 'cinza' },
  { tipo: 'redefinicao_gerada', rotulo: 'Link de redefinição gerado', cor: 'cinza' },
  { tipo: 'senha_redefinida', rotulo: 'Senha redefinida', cor: 'cinza' },
  { tipo: 'chave_api_criada', rotulo: 'Chave de API criada', cor: 'cinza' },
  { tipo: 'chave_api_revogada', rotulo: 'Chave de API revogada', cor: 'cinza' },
  { tipo: 'token_incorporacao_emitido', rotulo: 'Token de incorporação emitido', cor: 'cinza' },
  { tipo: 'papel_alterado', rotulo: 'Papel alterado', cor: 'cinza' },
  { tipo: 'usuario_alterado', rotulo: 'Usuário alterado', cor: 'cinza' },
  { tipo: 'seguranca_alterada', rotulo: 'Segurança alterada', cor: 'cinza' },
];

const POR_TIPO = new Map(TIPOS_EVENTO.map((tipo) => [tipo.tipo, tipo]));

/** Rótulo e cor de um tipo. Um tipo que o front ainda não conhece aparece com o código cru e o ponto cinza. */
export function apresentacaoDoTipo(tipo: string): TipoEvento {
  return POR_TIPO.get(tipo) ?? { tipo, rotulo: tipo, cor: 'cinza' };
}
