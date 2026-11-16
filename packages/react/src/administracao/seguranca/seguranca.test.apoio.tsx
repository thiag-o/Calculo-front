// Apoio aos testes da tela de segurança (não é um teste nem vai para o pacote): API simulada por rota, dados do
// contrato, os provedores que a tela precisa e os recursos do navegador que o jsdom não tem (usados pelo Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { criarQueryClient, ProvedorApi, type Esquemas } from '../../api';
import { RaizFluxo } from '../../design-system';
import { Seguranca } from '.';

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

/** Tenant que nunca alterou os parâmetros: os padrões do contrato (G4), com os limites da tabela do GET. */
export const PADROES: Esquemas['ConfiguracaoSeguranca'] = {
  inatividade_minutos: { valor: 480, padrao: 480, minimo: 15, maximo: 1440 },
  duracao_maxima_dias: { valor: 7, padrao: 7, minimo: 1, maximo: 30 },
  senha_minima: { valor: 12, padrao: 12, minimo: 8, maximo: 64 },
  validade_link_horas: { valor: 24, padrao: 24, minimo: 1, maximo: 72 },
  validade_token_minutos: { valor: 15, padrao: 15, minimo: 5, maximo: 60 },
};

/** Tenant que já mudou dois parâmetros. */
export const AJUSTADA: Esquemas['ConfiguracaoSeguranca'] = {
  ...PADROES,
  inatividade_minutos: { ...PADROES.inatividade_minutos, valor: 60 },
  senha_minima: { ...PADROES.senha_minima, valor: 16 },
};

/** A configuração com outros valores em vigor (o resto igual). */
export function comValores(
  base: Esquemas['ConfiguracaoSeguranca'],
  valores: Partial<Record<keyof Esquemas['ConfiguracaoSeguranca'], number>>,
): Esquemas['ConfiguracaoSeguranca'] {
  const resultado = { ...base };
  for (const [campo, valor] of Object.entries(valores) as [keyof Esquemas['ConfiguracaoSeguranca'], number][]) {
    resultado[campo] = { ...base[campo], valor };
  }
  return resultado;
}

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
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

export interface TelaSeguranca {
  usuario: UserEvent;
  queryClient: QueryClient;
}

/** Monta a tela com a API (modo cookie), o QueryClient do produto e a raiz do módulo. */
export function renderizarSeguranca(): TelaSeguranca {
  const usuario = userEvent.setup();
  const queryClient = criarQueryClient();
  // Sem repetir consultas que falharam: os testes de erro não esperam as 3 repetições.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <RaizFluxo tema="claro">
      <ProvedorApi apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Seguranca />
        </QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>,
  );
  return { usuario, queryClient };
}

export function definirCookieCsrf(valor: string) {
  document.cookie = `fc_csrf=${valor}; path=/`;
}
