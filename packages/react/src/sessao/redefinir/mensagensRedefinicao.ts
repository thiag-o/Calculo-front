import { ErroApi } from '../../api';

export const CODIGO_LINK_INVALIDO = 'link_invalido';

export const MENSAGEM_LINK_INVALIDO = 'Este link não vale mais: já foi usado ou venceu. Peça ao administrador um link novo.';
export const MENSAGEM_SENHA_SALVA = 'Senha salva. Entre com o seu e-mail e a nova senha.';
const MENSAGEM_DADOS_INVALIDOS = 'Confira os campos destacados e tente de novo.';
const MENSAGEM_DESCONHECIDA = 'Não foi possível salvar a senha agora. Tente de novo em instantes.';
const MENSAGEM_VERIFICACAO_DESCONHECIDA = 'Não foi possível verificar o link agora. Tente de novo em instantes.';

/** O erro diz que o link não vale mais (inexistente, usado ou vencido)? */
export function ehLinkInvalido(erro: unknown): boolean {
  return erro instanceof ErroApi && erro.codigo === CODIGO_LINK_INVALIDO;
}

/** Mensagem de uma falha da verificação que não é `link_invalido` (sem conexão, resposta inesperada…). */
export function mensagemErroVerificacao(erro: unknown): string {
  return erro instanceof ErroApi ? erro.mensagem : MENSAGEM_VERIFICACAO_DESCONHECIDA;
}

/** O que a tela mostra para um erro do envio (fora o `link_invalido`): uma nota geral e/ou o erro do campo. */
export interface ErroEnvio {
  mensagem?: string;
  novaSenha?: string;
}

/** Traduz o erro do `POST /v1/redefinicao` no que a tela mostra, sempre pelo `codigo` (ADR 0008). */
export function erroDoEnvio(erro: unknown): ErroEnvio {
  if (!(erro instanceof ErroApi)) return { mensagem: MENSAGEM_DESCONHECIDA };
  const novaSenha = erro.campos.nova_senha;
  switch (erro.codigo) {
    case 'senha_invalida':
      // A regra que a senha quebrou (tamanho, e-mail) vem no campo; sem ele, a nota diz o que o servidor disse.
      return novaSenha ? { novaSenha } : { mensagem: erro.mensagem };
    case 'dados_invalidos':
      return novaSenha ? { novaSenha, mensagem: MENSAGEM_DADOS_INVALIDOS } : { mensagem: erro.mensagem };
    default:
      // sem_conexao, resposta_inesperada, tipo_conteudo_invalido…: a mensagem em pt-BR do próprio erro.
      return { mensagem: erro.mensagem };
  }
}

const formatoDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });
const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

/** "Este link vale até 16/11 às 14:30.", no fuso de quem usa. Sem data válida: `undefined` (a frase some). */
export function mensagemPrazo(expiraEm: string): string | undefined {
  const quando = new Date(expiraEm);
  if (Number.isNaN(quando.getTime())) return undefined;
  return `Este link vale até ${formatoDia.format(quando)} às ${formatoHora.format(quando)}.`;
}

/** Tamanho da senha em caracteres (code points, como o servidor conta), sem tirar espaços. */
export function tamanhoSenha(senha: string): number {
  return Array.from(senha).length;
}

/** As regras da senha, mostradas abaixo do campo. */
export function regrasSenha(senhaMinima: number): string {
  return `Pelo menos ${senhaMinima} caracteres. Não pode conter o seu e-mail.`;
}
