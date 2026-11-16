import { ErroApi } from '../../api';

export const MENSAGEM_SEM_PERMISSAO =
  'Você não tem permissão para gerenciar a integração neste tenant. Peça acesso a um Admin.';
export const MENSAGEM_CHAVE_NAO_ENCONTRADA = 'Esta chave não existe mais neste tenant. A lista foi atualizada.';
export const MENSAGEM_DOMINIO_NAO_ENCONTRADO = 'Este domínio já foi removido. A lista foi atualizada.';
export const MENSAGEM_DOMINIO_EXISTENTE = 'Esta origem já está autorizada neste tenant. Confira na lista.';
export const MENSAGEM_ORIGEM_INVALIDA =
  'Use só o esquema, o host e, se precisar, a porta, como https://app.exemplo.com.br, sem caminho no fim.';
const MENSAGEM_DADOS_INVALIDOS = 'Confira os campos destacados e tente de novo.';
const MENSAGEM_DESCONHECIDA = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** O que um formulário mostra para um erro: uma nota geral (opcional) e o erro do campo. */
export interface ErroFormulario {
  mensagem?: string;
  campo?: string;
}

/** Erro de uma consulta (lista de chaves ou de domínios). */
export function mensagemErroConsulta(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  if (erro.codigo === 'sem_permissao') return MENSAGEM_SEM_PERMISSAO;
  // cursor_invalido, origem_nao_autorizada, sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
  return erro.mensagem;
}

/** Erro de um formulário com um único campo (`nome` da chave ou `origem` do domínio), pelo `codigo` (ADR 0008). */
function erroDeFormulario(erro: unknown, campo: 'nome' | 'origem'): ErroFormulario {
  if (!(erro instanceof ErroApi)) return { mensagem: MENSAGEM_DESCONHECIDA };
  switch (erro.codigo) {
    case 'sem_permissao':
      return { mensagem: MENSAGEM_SEM_PERMISSAO };
    case 'dados_invalidos': {
      const doCampo = erro.campos[campo];
      return doCampo ? { mensagem: MENSAGEM_DADOS_INVALIDOS, campo: doCampo } : { mensagem: erro.mensagem };
    }
    default:
      // csrf_invalido, origem_nao_autorizada, sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
      return { mensagem: erro.mensagem };
  }
}

/** Erro de criar uma chave de API (`POST /v1/chaves-api`). */
export function erroNovaChave(erro: unknown): ErroFormulario {
  return erroDeFormulario(erro, 'nome');
}

/** Erro de cadastrar um domínio (`POST /v1/dominios-autorizados`). */
export function erroNovoDominio(erro: unknown): ErroFormulario {
  if (erro instanceof ErroApi) {
    if (erro.codigo === 'origem_invalida') return { campo: MENSAGEM_ORIGEM_INVALIDA };
    if (erro.codigo === 'dominio_existente') return { campo: MENSAGEM_DOMINIO_EXISTENTE };
  }
  return erroDeFormulario(erro, 'origem');
}

/** Erro de revogar uma chave (`DELETE /v1/chaves-api/{id}`). */
export function mensagemErroRevogacao(erro: unknown): string {
  if (erro instanceof ErroApi && erro.codigo === 'nao_encontrado') return MENSAGEM_CHAVE_NAO_ENCONTRADA;
  return mensagemErroConsulta(erro);
}

/** Erro de remover um domínio (`DELETE /v1/dominios-autorizados/{id}`). */
export function mensagemErroRemocao(erro: unknown): string {
  if (erro instanceof ErroApi && erro.codigo === 'nao_encontrado') return MENSAGEM_DOMINIO_NAO_ENCONTRADO;
  return mensagemErroConsulta(erro);
}
