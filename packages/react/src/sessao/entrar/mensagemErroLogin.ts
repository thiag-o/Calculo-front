import { ErroApi } from '../../api';

/** Campos do formulário de login, com os nomes do corpo `Credenciais`. */
export type CampoLogin = 'email' | 'senha';

/** O que a tela mostra para um erro do login: uma nota geral e, se houver, o erro de cada campo. */
export interface ErroLogin {
  mensagem: string;
  campos: Partial<Record<CampoLogin, string>>;
}

export const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail ou senha incorretos. Confira os dados e tente de novo.';
export const MENSAGEM_MUITAS_TENTATIVAS = 'Muitas tentativas de login a partir desta rede. Espere um pouco e tente de novo.';
const MENSAGEM_DADOS_INVALIDOS = 'Confira os campos destacados e tente de novo.';
const MENSAGEM_DESCONHECIDA = 'Não foi possível entrar agora. Tente de novo em instantes.';
const INICIO_BLOQUEIO = 'O login deste e-mail foi bloqueado depois de várias tentativas erradas.';

const formatoHora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });
const formatoDia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

function mesmoDia(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

/**
 * "Tente de novo às 14:30", no fuso de quem usa. Se o desbloqueio cair em outro dia (bloqueio perto da
 * meia-noite), inclui a data: "Tente de novo às 00:05 de 16/11". Sem data válida: "Tente de novo mais tarde".
 */
export function mensagemBloqueio(desbloqueiaEm: unknown, agora: Date = new Date()): string {
  const quando = typeof desbloqueiaEm === 'string' ? new Date(desbloqueiaEm) : undefined;
  if (quando === undefined || Number.isNaN(quando.getTime())) return `${INICIO_BLOQUEIO} Tente de novo mais tarde.`;
  const dia = mesmoDia(quando, agora) ? '' : ` de ${formatoDia.format(quando)}`;
  return `${INICIO_BLOQUEIO} Tente de novo às ${formatoHora.format(quando)}${dia}.`;
}

function camposDoLogin(campos: Readonly<Record<string, string>>): Partial<Record<CampoLogin, string>> {
  const resultado: Partial<Record<CampoLogin, string>> = {};
  if (campos.email) resultado.email = campos.email;
  if (campos.senha) resultado.senha = campos.senha;
  return resultado;
}

/** Traduz o erro do `POST /v1/sessao` no que a tela mostra, sempre pelo `codigo` (ADR 0008). */
export function erroDoLogin(erro: unknown, agora: Date = new Date()): ErroLogin {
  if (!(erro instanceof ErroApi)) return { mensagem: MENSAGEM_DESCONHECIDA, campos: {} };
  switch (erro.codigo) {
    case 'credenciais_invalidas':
      // Mensagem própria e genérica: não revela se o e-mail existe.
      return { mensagem: MENSAGEM_CREDENCIAIS_INVALIDAS, campos: {} };
    case 'login_bloqueado':
      return { mensagem: mensagemBloqueio(erro.corpo?.desbloqueia_em, agora), campos: {} };
    case 'muitas_tentativas':
      return { mensagem: MENSAGEM_MUITAS_TENTATIVAS, campos: {} };
    case 'dados_invalidos': {
      const campos = camposDoLogin(erro.campos);
      return { mensagem: Object.keys(campos).length > 0 ? MENSAGEM_DADOS_INVALIDOS : erro.mensagem, campos };
    }
    default:
      // sem_conexao, resposta_inesperada, tipo_conteudo_invalido…: a mensagem em pt-BR do próprio erro.
      return { mensagem: erro.mensagem, campos: {} };
  }
}
