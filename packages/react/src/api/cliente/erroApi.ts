import type { components } from '../gerado/esquema';

/** O corpo problem+json do contrato, com os membros de extensão de cada erro (ex.: `desbloqueia_em`). */
export type CorpoProblema = components['schemas']['Problema'] & Readonly<Record<string, unknown>>;

/**
 * Códigos que nascem no próprio cliente, quando não há problem+json para ler.
 * Os demais códigos vêm do backend (contrato OpenAPI).
 */
export const CODIGO_SEM_CONEXAO = 'sem_conexao';
export const CODIGO_RESPOSTA_INESPERADA = 'resposta_inesperada';

const MENSAGEM_SEM_CONEXAO = 'Não foi possível falar com o servidor. Verifique a conexão e tente de novo.';
const MENSAGEM_RESPOSTA_INESPERADA = 'O servidor respondeu de um jeito inesperado. Tente de novo em instantes.';

/**
 * Erro de uma chamada à API. A tela decide pelo `codigo`, nunca pelo texto (ADR 0005).
 * - `status`: status HTTP da resposta (0 quando não houve resposta);
 * - `mensagem`: texto em pt-BR para o usuário final;
 * - `campos`: erro de cada campo do corpo (vazio quando o erro não é de campo);
 * - `corpo`: o problem+json inteiro, para os membros de extensão (ausente quando não houve problem+json).
 */
export class ErroApi extends Error {
  readonly status: number;
  readonly codigo: string;
  readonly mensagem: string;
  readonly campos: Readonly<Record<string, string>>;
  readonly corpo: CorpoProblema | undefined;

  constructor(dados: {
    status: number;
    codigo: string;
    mensagem: string;
    campos?: Readonly<Record<string, string>>;
    corpo?: CorpoProblema;
    cause?: unknown;
  }) {
    super(dados.mensagem, dados.cause === undefined ? undefined : { cause: dados.cause });
    this.name = 'ErroApi';
    this.status = dados.status;
    this.codigo = dados.codigo;
    this.mensagem = dados.mensagem;
    this.campos = dados.campos ?? {};
    this.corpo = dados.corpo;
  }
}

function ehObjeto(valor: unknown): valor is Record<string, unknown> {
  return typeof valor === 'object' && valor !== null && !Array.isArray(valor);
}

/** Lê o `codigo` de um corpo problem+json; `undefined` se o corpo não for um. */
export function codigoDoProblema(corpo: unknown): string | undefined {
  return ehObjeto(corpo) && typeof corpo.codigo === 'string' && corpo.codigo !== '' ? corpo.codigo : undefined;
}

function camposDoProblema(campos: unknown): Record<string, string> {
  if (!ehObjeto(campos)) return {};
  const resultado: Record<string, string> = {};
  for (const [campo, erro] of Object.entries(campos)) {
    if (typeof erro === 'string') resultado[campo] = erro;
  }
  return resultado;
}

/** Converte a resposta de erro (e o corpo já lido) em `ErroApi`. */
export function erroDaResposta(resposta: Response, corpo: unknown): ErroApi {
  const codigo = codigoDoProblema(corpo);
  if (codigo === undefined || !ehObjeto(corpo)) {
    return new ErroApi({ status: resposta.status, codigo: CODIGO_RESPOSTA_INESPERADA, mensagem: MENSAGEM_RESPOSTA_INESPERADA });
  }
  const mensagem =
    typeof corpo.detail === 'string' && corpo.detail !== ''
      ? corpo.detail
      : typeof corpo.title === 'string' && corpo.title !== ''
        ? corpo.title
        : MENSAGEM_RESPOSTA_INESPERADA;
  return new ErroApi({
    status: resposta.status,
    codigo,
    mensagem,
    campos: camposDoProblema(corpo.campos),
    corpo: corpo as CorpoProblema,
  });
}

/** Erro de rede: a requisição não chegou a ter resposta. */
export function erroSemConexao(causa: unknown): ErroApi {
  return new ErroApi({ status: 0, codigo: CODIGO_SEM_CONEXAO, mensagem: MENSAGEM_SEM_CONEXAO, cause: causa });
}

function ehCancelamento(erro: unknown): boolean {
  return ehObjeto(erro) && erro.name === 'AbortError';
}

/** O resultado de uma chamada do openapi-fetch. */
interface ResultadoChamada<D> {
  data?: D;
  error?: unknown;
  response: Response;
}

/**
 * Espera a chamada e devolve os dados da resposta de sucesso, ou lança `ErroApi`.
 * Uso típico numa consulta: `queryFn: () => dadosOuErro(cliente.GET('/v1/sessao'))`.
 * O cancelamento (`AbortError`, ex.: consulta cancelada pelo TanStack Query) passa adiante sem conversão.
 */
export async function dadosOuErro<D>(chamada: Promise<ResultadoChamada<D>>): Promise<D> {
  let resultado: ResultadoChamada<D>;
  try {
    resultado = await chamada;
  } catch (erro) {
    if (erro instanceof ErroApi || ehCancelamento(erro)) throw erro;
    // fetch rejeita com TypeError quando não há resposta (rede, CORS, servidor fora do ar).
    if (erro instanceof TypeError) throw erroSemConexao(erro);
    throw erro;
  }
  if (!resultado.response.ok) throw erroDaResposta(resultado.response, resultado.error);
  return resultado.data as D;
}
