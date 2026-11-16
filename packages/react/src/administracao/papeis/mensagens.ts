import { ErroApi } from '../../api';

/** Campos do formulário de papel, com os nomes do corpo (`DadosPapel`). */
export type CampoPapel = 'nome' | 'permissoes';

/** O que a tela mostra para um erro: uma nota geral (opcional) e o erro de cada campo. */
export interface ErroTela {
  mensagem?: string;
  campos: Partial<Record<CampoPapel, string>>;
}

export const MENSAGEM_SEM_PERMISSAO = 'Você não tem permissão para gerenciar papéis neste tenant. Peça acesso a um Admin.';
export const MENSAGEM_PAPEL_EXISTENTE = 'Já existe um papel com esse nome neste tenant. Escolha outro nome.';
export const MENSAGEM_PAPEL_FIXO = 'O papel Admin tem todas as permissões e não pode ser editado nem removido.';
export const MENSAGEM_PAPEL_EM_USO =
  'O papel está atribuído a usuários deste tenant. Tire o papel deles em Usuários e tente remover de novo.';
export const MENSAGEM_PAPEL_NAO_ENCONTRADO = 'Este papel não existe mais neste tenant. A lista foi atualizada.';
const MENSAGEM_DADOS_INVALIDOS = 'Confira os campos destacados e tente de novo.';
const MENSAGEM_DESCONHECIDA = 'Não foi possível concluir agora. Tente de novo em instantes.';

const CAMPOS: readonly CampoPapel[] = ['nome', 'permissoes'];

function camposDoFormulario(campos: Readonly<Record<string, string>>): Partial<Record<CampoPapel, string>> {
  const resultado: Partial<Record<CampoPapel, string>> = {};
  for (const [chave, erro] of Object.entries(campos)) {
    // `permissoes.0` (erro num item da lista) vale para o campo `permissoes`.
    const campo = chave.split('.')[0] as CampoPapel;
    if (CAMPOS.includes(campo) && resultado[campo] === undefined) resultado[campo] = erro;
  }
  return resultado;
}

/** Erro de uma consulta (lista de papéis ou catálogo de permissões). */
export function mensagemErroConsulta(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  if (erro.codigo === 'sem_permissao') return MENSAGEM_SEM_PERMISSAO;
  // sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
  return erro.mensagem;
}

/** Erro de criar (`POST /v1/papeis`) ou alterar (`PUT /v1/papeis/{id}`) um papel, pelo `codigo` (ADR 0008). */
export function erroDoFormulario(erro: unknown): ErroTela {
  if (!(erro instanceof ErroApi)) return { mensagem: MENSAGEM_DESCONHECIDA, campos: {} };
  switch (erro.codigo) {
    case 'papel_existente':
      return { campos: { nome: MENSAGEM_PAPEL_EXISTENTE } };
    case 'papel_fixo':
      return { mensagem: MENSAGEM_PAPEL_FIXO, campos: {} };
    case 'nao_encontrado':
      return { mensagem: MENSAGEM_PAPEL_NAO_ENCONTRADO, campos: {} };
    case 'sem_permissao':
      return { mensagem: MENSAGEM_SEM_PERMISSAO, campos: {} };
    case 'dados_invalidos': {
      const campos = camposDoFormulario(erro.campos);
      return Object.keys(campos).length > 0 ? { mensagem: MENSAGEM_DADOS_INVALIDOS, campos } : { mensagem: erro.mensagem, campos: {} };
    }
    default:
      // csrf_invalido, sem_conexao, resposta_inesperada…: a mensagem em pt-BR do próprio erro.
      return { mensagem: erro.mensagem, campos: {} };
  }
}

/** Erro de remover um papel (`DELETE /v1/papeis/{id}`). */
export function mensagemErroRemocao(erro: unknown): string {
  if (!(erro instanceof ErroApi)) return MENSAGEM_DESCONHECIDA;
  switch (erro.codigo) {
    case 'papel_em_uso':
      return MENSAGEM_PAPEL_EM_USO;
    case 'papel_fixo':
      return MENSAGEM_PAPEL_FIXO;
    case 'nao_encontrado':
      return MENSAGEM_PAPEL_NAO_ENCONTRADO;
    case 'sem_permissao':
      return MENSAGEM_SEM_PERMISSAO;
    default:
      return erro.mensagem;
  }
}
