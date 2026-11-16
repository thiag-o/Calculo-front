import { ErroApi } from '../../api';
import { CAMPOS, type CampoSeguranca } from './parametros';

/** O que a tela mostra para um erro do PUT: uma nota geral (opcional) e o erro de cada campo. */
export interface ErroTela {
  mensagem?: string;
  campos: Partial<Record<CampoSeguranca, string>>;
}

export const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para gerenciar a segurança deste tenant. Peça acesso a um Admin.';
export const MENSAGEM_FORA_DO_LIMITE = 'Nada foi salvo: há valores fora dos limites aceitos. Confira os campos destacados.';
const MENSAGEM_DADOS_INVALIDOS = 'Nada foi salvo. Confira os campos destacados e tente de novo.';
const MENSAGEM_DESCONHECIDA = 'Não foi possível concluir agora. Tente de novo em instantes.';

function camposDoFormulario(campos: Readonly<Record<string, string>>): Partial<Record<CampoSeguranca, string>> {
  const resultado: Partial<Record<CampoSeguranca, string>> = {};
  for (const [chave, erro] of Object.entries(campos)) {
    const campo = chave as CampoSeguranca;
    if (CAMPOS.includes(campo)) resultado[campo] = erro;
  }
  return resultado;
}

/** Erro de carregar os parâmetros (`GET /v1/configuracoes/seguranca`). */
export function mensagemErroConsulta(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  if (erro.codigo === 'sem_permissao') return MENSAGEM_SEM_PERMISSAO;
  // sem_conexao, resposta_inesperada, origem_nao_autorizada…: a mensagem em pt-BR do próprio erro.
  return erro.mensagem;
}

/** Erro de salvar (`PUT /v1/configuracoes/seguranca`), pelo `codigo` (ADR 0008). */
export function erroAoSalvar(erro: unknown): ErroTela {
  if (!(erro instanceof ErroApi)) return { mensagem: MENSAGEM_DESCONHECIDA, campos: {} };
  switch (erro.codigo) {
    case 'valor_fora_do_limite':
    case 'dados_invalidos': {
      const campos = camposDoFormulario(erro.campos);
      if (Object.keys(campos).length === 0) return { mensagem: erro.mensagem, campos: {} };
      return { mensagem: erro.codigo === 'valor_fora_do_limite' ? MENSAGEM_FORA_DO_LIMITE : MENSAGEM_DADOS_INVALIDOS, campos };
    }
    case 'sem_permissao':
      return { mensagem: MENSAGEM_SEM_PERMISSAO, campos: {} };
    default:
      // csrf_invalido, sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
      return { mensagem: erro.mensagem, campos: {} };
  }
}
