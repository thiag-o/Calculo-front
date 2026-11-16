// Apoio aos testes da tela de acessos (não é um teste nem vai para o pacote): API simulada por rota, dados do
// contrato, os provedores que a tela precisa e os recursos do navegador que o jsdom não tem (usados pelo Radix).
// Repete o simularApi das telas da Administração; um apoio de testes comum seria tarefa própria.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { criarQueryClient, ProvedorApi, type Esquemas } from '../../api';
import { RaizFluxo } from '../../design-system';
import { Acessos } from '.';

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
export const ROTA_ACESSOS = 'GET /v1/auditoria/acessos';

/** Data local (no fuso de quem roda o teste), em ISO/UTC como a API manda. */
export function isoLocal(ano: number, mes: number, dia: number, hora = 0, minuto = 0): string {
  return new Date(ano, mes - 1, dia, hora, minuto).toISOString();
}

type EventoAcesso = Esquemas['EventoAcesso'];

let sequencia = 0;
/** Um evento do contrato; o resto vem de `parcial`. */
export function evento(parcial: Partial<EventoAcesso> = {}): EventoAcesso {
  sequencia += 1;
  return {
    id: `50000000-0000-0000-0000-${String(sequencia).padStart(12, '0')}`,
    ocorrido_em: isoLocal(2026, 11, 15, 9, 5),
    tipo: 'login_ok',
    usuario_id: '10000000-0000-0000-0000-000000000001',
    email_informado: 'ana.souza@exemplo.com.br',
    ip: '203.0.113.7',
    detalhe: null,
    ...parcial,
  };
}

export const LOGIN_ANA = evento({
  ocorrido_em: isoLocal(2026, 11, 15, 9, 5),
  tipo: 'login_ok',
  email_informado: 'ana.souza@exemplo.com.br',
  ip: '203.0.113.7',
});
export const FALHA_BRUNO = evento({
  ocorrido_em: isoLocal(2026, 11, 14, 18, 30),
  tipo: 'login_falhou',
  usuario_id: null,
  email_informado: 'bruno.lima.da.silva.gerente.regional@exemplo-distribuidora.com.br',
  ip: '2001:db8:85a3::8a2e:370:7334',
  detalhe: 'senha incorreta',
});
export const BLOQUEIO_BRUNO = evento({
  ocorrido_em: isoLocal(2026, 11, 14, 18, 31),
  tipo: 'login_bloqueado',
  email_informado: 'bruno.lima.da.silva.gerente.regional@exemplo-distribuidora.com.br',
  ip: null,
  detalhe: null,
});

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Uma página da lista de eventos. */
export function pagina(itens: readonly EventoAcesso[], proximoCursor: string | null = null): Response {
  return json({ itens, proximo_cursor: proximoCursor });
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
    /** Os parâmetros de busca das requisições feitas a uma rota ("MÉTODO /caminho"), na ordem. */
    buscasDe(rota: string): URLSearchParams[] {
      return chamadas
        .filter((req) => `${req.method} ${new URL(req.url).pathname}` === rota)
        .map((req) => new URL(req.url).searchParams);
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

export interface TelaAcessos {
  usuario: UserEvent;
  queryClient: QueryClient;
}

/** Monta a tela (por padrão, `<Acessos>`) com a API (modo cookie), o QueryClient do produto e a raiz. */
export function renderizarAcessos(tela: ReactElement = <Acessos />): TelaAcessos {
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
