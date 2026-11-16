// Apoio aos testes da tela de usuários (não é um teste nem vai para o pacote): API simulada por rota, dados do
// contrato, os provedores que a tela precisa e os recursos do navegador que o jsdom não tem (usados pelo Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { criarQueryClient, ProvedorApi, type Esquemas } from '../../api';
import { RaizFluxo } from '../../design-system';
import { Usuarios } from '.';

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

export const PAPEL_ADMIN: Esquemas['Papel'] = {
  id: '10000000-0000-0000-0000-000000000001',
  nome: 'Admin',
  permissoes: [],
  fixo: true,
  total_usuarios: 1,
};
export const PAPEL_CONFIGURADOR: Esquemas['Papel'] = {
  id: '10000000-0000-0000-0000-000000000002',
  nome: 'Configurador',
  permissoes: ['workflows.ver', 'workflows.editar'],
  fixo: false,
  total_usuarios: 1,
};
export const PAPEL_AUDITOR: Esquemas['Papel'] = {
  id: '10000000-0000-0000-0000-000000000003',
  nome: 'Auditor',
  permissoes: ['auditoria.ver'],
  fixo: false,
  total_usuarios: 0,
};
export const PAPEIS = [PAPEL_ADMIN, PAPEL_CONFIGURADOR, PAPEL_AUDITOR];

const resumo = (papel: Esquemas['Papel']) => ({ id: papel.id, nome: papel.nome });

export const ANA: Esquemas['Usuario'] = {
  id: '20000000-0000-0000-0000-000000000001',
  email: 'ana@exemplo.com',
  nome: 'Ana Beatriz Souza',
  papeis: [resumo(PAPEL_ADMIN)],
  ativo: true,
  externo: false,
};
export const BRUNO: Esquemas['Usuario'] = {
  id: '20000000-0000-0000-0000-000000000002',
  email: 'bruno.figueiredo.de.albuquerque@exemplo.com',
  nome: 'Bruno Figueiredo de Albuquerque',
  papeis: [resumo(PAPEL_CONFIGURADOR), resumo(PAPEL_AUDITOR)],
  ativo: true,
  externo: false,
};
export const CARLA: Esquemas['Usuario'] = {
  id: '20000000-0000-0000-0000-000000000003',
  email: 'carla@exemplo.com',
  nome: 'Carla Menezes',
  papeis: [],
  ativo: false,
  externo: false,
};
export const DAVI: Esquemas['Usuario'] = {
  id: '20000000-0000-0000-0000-000000000004',
  email: 'davi@hospedeiro.com',
  nome: 'Davi Externo',
  papeis: [resumo(PAPEL_AUDITOR)],
  ativo: true,
  externo: true,
};

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
 * Rota sem resposta configurada falha o teste com 500 de resposta inesperada.
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

/** Monta a tela com a API (modo cookie), o QueryClient do produto e a raiz do módulo. */
export function renderizarUsuarios(): { usuario: UserEvent; queryClient: QueryClient } {
  const usuario = userEvent.setup();
  const queryClient = criarQueryClient();
  // Sem repetir consultas que falharam: os testes de erro não esperam as 3 repetições.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <RaizFluxo tema="claro">
      <ProvedorApi apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Usuarios />
        </QueryClientProvider>
      </ProvedorApi>
    </RaizFluxo>,
  );
  return { usuario, queryClient };
}

export function definirCookieCsrf(valor: string) {
  document.cookie = `fc_csrf=${valor}; path=/`;
}
