import { ErroApi } from '../../api';

export const MENSAGEM_SEM_ACESSO_AO_CLIENTE =
  'Você não tem mais acesso a esse cliente. A lista de clientes foi atualizada; escolha outro.';

/** O que dizer quando a troca de cliente (tenant) falha. A decisão é pelo `codigo`, nunca pelo texto. */
export function mensagemErroTroca(erro: unknown): string {
  if (erro instanceof ErroApi && erro.codigo === 'sem_acesso_ao_tenant') return MENSAGEM_SEM_ACESSO_AO_CLIENTE;
  if (erro instanceof ErroApi) return `Não foi possível trocar de cliente. ${erro.mensagem}`;
  return 'Não foi possível trocar de cliente. Tente de novo.';
}

/** O que dizer quando o "Sair" falha (ex.: `csrf_invalido`). A sessão continua aberta. */
export function mensagemErroSair(erro: unknown): string {
  if (erro instanceof ErroApi) return `Não foi possível sair. ${erro.mensagem}`;
  return 'Não foi possível sair. Tente de novo.';
}
