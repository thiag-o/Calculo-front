import { ErroApi } from '../../api';

export const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para ver a auditoria neste tenant. Peça acesso a um Admin.';
export const MENSAGEM_PERIODO_INVERTIDO = 'A data final vem antes da inicial. Ajuste o período.';
export const MENSAGEM_TIPO_INVALIDO = 'A API não reconhece o tipo de evento escolhido. Escolha outro tipo ou limpe os filtros.';
export const MENSAGEM_PERIODO_RECUSADO = 'A API recusou o período. Confira as datas destacadas ou limpe os filtros.';
export const MENSAGEM_CURSOR_INVALIDO =
  'Não foi possível continuar de onde a lista parou. Recarregue a lista para ver os eventos desde o início.';
const MENSAGEM_DESCONHECIDA = 'Não foi possível concluir agora. Tente de novo em instantes.';

/** Erros que os filtros causam: a saída é mudar ou limpar os filtros, não tentar de novo. */
export function erroDeFiltro(erro: unknown): boolean {
  return erro instanceof ErroApi && (erro.codigo === 'tipo_evento_invalido' || erro.codigo === 'dados_invalidos');
}

/** Erro da lista de eventos, pelo `codigo` (ADR 0008). */
export function mensagemErroLista(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  switch (erro.codigo) {
    case 'sem_permissao':
      return MENSAGEM_SEM_PERMISSAO;
    case 'tipo_evento_invalido':
      return MENSAGEM_TIPO_INVALIDO;
    case 'dados_invalidos':
      return MENSAGEM_PERIODO_RECUSADO;
    case 'cursor_invalido':
      return MENSAGEM_CURSOR_INVALIDO;
    default:
      // origem_nao_autorizada, sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
      return erro.mensagem;
  }
}

/** O erro que a API deu num campo do período (`campos.desde` ou `campos.ate` de `dados_invalidos`). */
export function erroDoCampo(erro: unknown, campo: 'desde' | 'ate'): string | undefined {
  if (!(erro instanceof ErroApi) || erro.codigo !== 'dados_invalidos') return undefined;
  return erro.campos[campo] || undefined;
}
