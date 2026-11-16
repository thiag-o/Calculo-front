import { ErroApi } from '../../api';

/** Campos dos formulários de usuário, com os nomes do corpo (`NovoUsuario` e `AlteracaoUsuario`). */
export type CampoUsuario = 'email' | 'nome' | 'papeis' | 'ativo';

/** O que a tela mostra para um erro: uma nota geral (opcional) e o erro de cada campo. */
export interface ErroTela {
  mensagem?: string;
  campos: Partial<Record<CampoUsuario, string>>;
}

export const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para gerenciar usuários neste tenant. Peça acesso a um Admin.';
export const MENSAGEM_USUARIO_EXISTENTE = 'Este e-mail já é de um usuário deste tenant. Procure-o na lista para editar.';
export const MENSAGEM_PAPEL_INEXISTENTE = 'Um dos papéis escolhidos não existe mais. A lista foi atualizada: escolha de novo.';
export const MENSAGEM_ULTIMO_ADMIN =
  'O tenant precisa de pelo menos um Admin ativo. Dê o papel Admin a outro usuário antes de tirá-lo deste ou de desativá-lo.';
export const MENSAGEM_USUARIO_NAO_ENCONTRADO = 'Este usuário não existe mais neste tenant. A lista foi atualizada.';
export const MENSAGEM_USUARIO_INATIVO = 'O usuário está inativo neste tenant. Ative-o para gerar o link.';
export const MENSAGEM_USUARIO_EXTERNO = 'O usuário foi criado pela incorporação e entra pelo sistema hospedeiro, sem senha.';
const MENSAGEM_DADOS_INVALIDOS = 'Confira os campos destacados e tente de novo.';
const MENSAGEM_DESCONHECIDA = 'Não foi possível concluir agora. Tente de novo em instantes.';

const CAMPOS: readonly CampoUsuario[] = ['email', 'nome', 'papeis', 'ativo'];

function camposDoFormulario(campos: Readonly<Record<string, string>>): Partial<Record<CampoUsuario, string>> {
  const resultado: Partial<Record<CampoUsuario, string>> = {};
  for (const [chave, erro] of Object.entries(campos)) {
    // `papeis.0` (erro num item da lista) vale para o campo `papeis`.
    const campo = chave.split('.')[0] as CampoUsuario;
    if (CAMPOS.includes(campo) && resultado[campo] === undefined) resultado[campo] = erro;
  }
  return resultado;
}

/** Códigos comuns a toda chamada (permissão, rede, dados inválidos); `undefined` se o código não é um deles. */
function erroComum(erro: ErroApi): ErroTela | undefined {
  switch (erro.codigo) {
    case 'sem_permissao':
      return { mensagem: MENSAGEM_SEM_PERMISSAO, campos: {} };
    case 'dados_invalidos': {
      const campos = camposDoFormulario(erro.campos);
      return Object.keys(campos).length > 0 ? { mensagem: MENSAGEM_DADOS_INVALIDOS, campos } : { mensagem: erro.mensagem, campos: {} };
    }
    default:
      return undefined;
  }
}

/** Erro da lista de usuários. */
export function mensagemErroLista(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  if (erro.codigo === 'sem_permissao') return MENSAGEM_SEM_PERMISSAO;
  // cursor_invalido, sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
  return erro.mensagem;
}

/** Erro da lista de papéis do formulário. */
export function mensagemErroPapeis(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  // GET /v1/papeis aceita usuarios.gerenciar ou papeis.gerenciar (D2): sem_permissao aqui é falta de gerenciar usuários.
  if (erro.codigo === 'sem_permissao') return MENSAGEM_SEM_PERMISSAO;
  return erro.mensagem;
}

/** Erro de criar (`POST /v1/usuarios`) ou alterar (`PUT /v1/usuarios/{id}`) um usuário, pelo `codigo` (ADR 0008). */
export function erroDoFormulario(erro: unknown): ErroTela {
  if (!(erro instanceof ErroApi)) return { mensagem: MENSAGEM_DESCONHECIDA, campos: {} };
  switch (erro.codigo) {
    case 'usuario_existente':
      return { campos: { email: MENSAGEM_USUARIO_EXISTENTE } };
    case 'papel_inexistente':
      return { campos: { papeis: MENSAGEM_PAPEL_INEXISTENTE } };
    case 'ultimo_admin':
      return { mensagem: MENSAGEM_ULTIMO_ADMIN, campos: {} };
    case 'nao_encontrado':
      return { mensagem: MENSAGEM_USUARIO_NAO_ENCONTRADO, campos: {} };
    default:
      // csrf_invalido, sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
      return erroComum(erro) ?? { mensagem: erro.mensagem, campos: {} };
  }
}

/** Erro de gerar o link de redefinição (`POST /v1/usuarios/{id}/redefinicao`). */
export function mensagemErroLink(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  switch (erro.codigo) {
    case 'usuario_inativo':
      return MENSAGEM_USUARIO_INATIVO;
    case 'usuario_externo':
      return MENSAGEM_USUARIO_EXTERNO;
    case 'nao_encontrado':
      return MENSAGEM_USUARIO_NAO_ENCONTRADO;
    case 'sem_permissao':
      return MENSAGEM_SEM_PERMISSAO;
    default:
      return erro.mensagem;
  }
}
