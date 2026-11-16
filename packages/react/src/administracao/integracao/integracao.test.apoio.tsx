// Apoio aos testes da tela de integração (não é um teste nem vai para o pacote): API simulada por rota, dados do
// contrato, os provedores que a tela precisa e os recursos do navegador que o jsdom não tem (usados pelo Radix).
// Repete o simularApi das telas de usuários e de papéis; um apoio de testes comum seria tarefa própria.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { criarQueryClient, ProvedorApi, type Esquemas } from '../../api';
import { RaizFluxo } from '../../design-system';
import { Integracao } from '.';

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
const prototipo = Element.prototype as Element & {
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
  scrollIntoView?: () => void;
};
prototipo.hasPointerCapture ??= () => false;
prototipo.setPointerCapture ??= () => {};
prototipo.releasePointerCapture ??= () => {};
prototipo.scrollIntoView ??= () => {};

export const API = 'https://api.teste';

/** Data local (no fuso de quem roda o teste), em ISO/UTC como a API manda. */
export function isoLocal(ano: number, mes: number, dia: number, hora = 12, minuto = 0): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString();
}

export const CHAVE_PORTAL: Esquemas['ChaveApi'] = {
  id: '30000000-0000-0000-0000-000000000001',
  nome: 'Portal do cliente',
  prefixo: 'fc_3k9Q',
  criada_em: isoLocal(2026, 11, 2),
  ultimo_uso_em: isoLocal(2026, 11, 15, 9, 5),
  revogada_em: null,
};
export const CHAVE_ERP: Esquemas['ChaveApi'] = {
  id: '30000000-0000-0000-0000-000000000002',
  nome: 'Integração do ERP corporativo de faturamento, conciliação e repasses',
  prefixo: 'fc_Zp71',
  criada_em: isoLocal(2026, 11, 10),
  ultimo_uso_em: null,
  revogada_em: null,
};
export const CHAVE_ANTIGA: Esquemas['ChaveApi'] = {
  id: '30000000-0000-0000-0000-000000000003',
  nome: 'Portal antigo',
  prefixo: 'fc_a0b1',
  criada_em: isoLocal(2026, 1, 5),
  ultimo_uso_em: isoLocal(2026, 3, 1, 18, 30),
  revogada_em: isoLocal(2026, 3, 2),
};
export const CHAVES = [CHAVE_PORTAL, CHAVE_ERP, CHAVE_ANTIGA];

export const DOMINIO_APP: Esquemas['DominioAutorizado'] = {
  id: '40000000-0000-0000-0000-000000000001',
  origem: 'https://app.exemplo.com.br',
  criado_em: isoLocal(2026, 11, 3),
};
export const DOMINIO_LOCAL: Esquemas['DominioAutorizado'] = {
  id: '40000000-0000-0000-0000-000000000002',
  origem: 'http://localhost:5274',
  criado_em: isoLocal(2026, 11, 14),
};
export const DOMINIOS = [DOMINIO_APP, DOMINIO_LOCAL];

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Resposta sem corpo (204), como a revogação e a remoção. */
export function semConteudo(): Response {
  return new Response(null, { status: 204 });
}

/** Erro problem+json do contrato. */
export function problema(status: number, codigo: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${codigo}.`, codigo, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type Resposta = Response | Promise<Response> | ((requisicao: Request) => Response | Promise<Response>);

/**
 * fetch simulado por rota ("MÉTODO /caminho"). Cada rota tem uma fila de respostas: a última se repete.
 * Rota sem resposta configurada responde 599 (vira `resposta_inesperada` na tela).
 */
export function simularApi() {
  const filas = new Map<string, Resposta[]>();
  const chamadas: Request[] = [];
  const fetchSimulado = vi.fn(async (requisicao: Request) => {
    chamadas.push(requisicao.clone());
    const url = new URL(requisicao.url);
    const rota = `${requisicao.method} ${url.pathname}`;
    const fila = filas.get(rota);
    if (!fila || fila.length === 0) return new Response(`rota não simulada: ${rota}`, { status: 599 });
    const proxima = fila.length > 1 ? fila.shift()! : fila[0]!;
    if (typeof proxima === 'function') return proxima(requisicao);
    return proxima instanceof Response ? proxima.clone() : (await proxima).clone();
  });
  vi.stubGlobal('fetch', fetchSimulado);

  return {
    /** Define as respostas da rota, em ordem (a última se repete). */
    responder(rota: string, ...respostas: Resposta[]) {
      filas.set(rota, respostas);
    },
    /** As requisições feitas a uma rota ("MÉTODO /caminho"), na ordem. */
    chamadasDe(rota: string): Request[] {
      return chamadas.filter((req) => `${req.method} ${new URL(req.url).pathname}` === rota);
    },
  };
}

export type ApiSimulada = ReturnType<typeof simularApi>;

/** Uma resposta que só chega quando o teste chama `liberar`. */
export function respostaPendente(resposta: () => Response) {
  let liberar: () => void = () => {};
  const promessa = new Promise<Response>((resolver) => {
    liberar = () => resolver(resposta());
  });
  return { promessa, liberar: () => liberar() };
}

export interface TelaIntegracao {
  usuario: UserEvent;
  queryClient: QueryClient;
}

/** Monta a tela (por padrão, `<Integracao>` inteira) com a API (modo cookie), o QueryClient do produto e a raiz. */
export function renderizarIntegracao(tela: ReactElement = <Integracao />): TelaIntegracao {
  const usuario = userEvent.setup();
  const queryClient = criarQueryClient();
  // Sem repetir consultas que falharam: os testes de erro não esperam as 3 repetições.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <RaizFluxo tema="claro">
      <ProvedorApi apiUrl={API}>
        <QueryClientProvider client={queryClient}>{tela}</QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>,
  );
  return { usuario, queryClient };
}

export function definirCookieCsrf(valor: string) {
  document.cookie = `fc_csrf=${valor}; path=/`;
}

/** Tudo o que o QueryClient guarda (dados das consultas e estado das mutações), em texto, para procurar segredos. */
export function conteudoDoCache(queryClient: QueryClient): string {
  return JSON.stringify({
    consultas: queryClient.getQueryCache().getAll().map((consulta) => ({ chave: consulta.queryKey, dados: consulta.state.data })),
    mutacoes: queryClient.getMutationCache().getAll().map((mutacao) => mutacao.state),
  });
}
