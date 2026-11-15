import createClient, { type Client, type Middleware } from 'openapi-fetch';
import type { paths } from '../gerado/esquema';
import { codigoDoProblema } from './erroApi';

/** `cookie`: app casca, sessão por cookie com CSRF. `token`: incorporado, `Authorization: Bearer`. */
export type ModoAutenticacao = 'cookie' | 'token';

export interface OpcoesClienteApi {
  /** Endereço da API, sem o `/v1` (ex.: `https://api.exemplo.com`). */
  apiUrl: string;
  /** Token de incorporação. Com ele o cliente usa `Authorization: Bearer`; sem ele, o cookie de sessão. */
  token?: string;
}

export interface ClienteApi extends Client<paths> {
  readonly modo: ModoAutenticacao;
  /**
   * Avisa quando a API responde `401 sem_sessao` (sessão ausente, revogada ou expirada; token vencido).
   * Devolve a função que cancela o aviso.
   */
  aoExpirarSessao(ouvinte: () => void): () => void;
}

/** Cookie com o token CSRF emitido no login (não é HttpOnly, para o front poder ler). */
const COOKIE_CSRF = 'fc_csrf';
const CABECALHO_CSRF = 'X-CSRF-Token';
const METODOS_COM_CSRF = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const CODIGO_SEM_SESSAO = 'sem_sessao';

function lerCookie(nome: string): string | undefined {
  if (typeof document === 'undefined') return undefined;
  for (const par of document.cookie.split(';')) {
    const separador = par.indexOf('=');
    if (separador === -1) continue;
    if (par.slice(0, separador).trim() === nome) {
      const valor = par.slice(separador + 1).trim();
      return valor === '' ? undefined : valor;
    }
  }
  return undefined;
}

async function codigoDaResposta(resposta: Response): Promise<string | undefined> {
  try {
    return codigoDoProblema(await resposta.clone().json());
  } catch {
    return undefined;
  }
}

/**
 * Cria o cliente HTTP da API (openapi-fetch, tipado pelo contrato).
 * - **Modo cookie** (sem `token`): `credentials: 'include'` e, em POST, PUT, PATCH e DELETE,
 *   o cabeçalho `X-CSRF-Token` com o valor do cookie `fc_csrf`, lido a cada requisição.
 * - **Modo token** (com `token`): `Authorization: Bearer <token>`, sem cookies e sem CSRF.
 */
export function criarClienteApi({ apiUrl, token }: OpcoesClienteApi): ClienteApi {
  const modo: ModoAutenticacao = token === undefined ? 'cookie' : 'token';
  const ouvintes = new Set<() => void>();

  const http = createClient<paths>({
    baseUrl: apiUrl,
    // Lê o fetch global a cada chamada (não na criação), para respeitar quem o substitui depois.
    fetch: (requisicao) => globalThis.fetch(requisicao),
    credentials: modo === 'cookie' ? 'include' : 'omit',
    headers: modo === 'token' ? { Authorization: `Bearer ${token}` } : undefined,
  });

  const autenticacao: Middleware = {
    onRequest({ request }) {
      if (modo !== 'cookie' || !METODOS_COM_CSRF.has(request.method.toUpperCase())) return undefined;
      const csrf = lerCookie(COOKIE_CSRF);
      if (csrf !== undefined) request.headers.set(CABECALHO_CSRF, csrf);
      return undefined;
    },
    async onResponse({ response }) {
      if (response.status === 401 && (await codigoDaResposta(response)) === CODIGO_SEM_SESSAO) {
        for (const ouvinte of [...ouvintes]) ouvinte();
      }
      return undefined;
    },
  };
  http.use(autenticacao);

  return Object.assign(http, {
    modo,
    aoExpirarSessao(ouvinte: () => void) {
      ouvintes.add(ouvinte);
      return () => {
        ouvintes.delete(ouvinte);
      };
    },
  });
}
