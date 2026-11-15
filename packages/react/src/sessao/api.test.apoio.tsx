// Apoio aos testes da vertical (não é um teste nem vai para o pacote): fetch simulado, respostas do contrato
// e os provedores (API em modo cookie e QueryClient) que os hooks precisam.
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { criarQueryClient, ProvedorApi } from '../api';
import type { Sessao } from './useSessao';

export const API = 'https://api.teste';

export const TENANT_MATRIZ = { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' };
export const TENANT_FILIAL = { id: '00000000-0000-0000-0000-00000000000b', nome: 'Filial Nordeste e Centro-Oeste' };

export const sessaoMatriz: Sessao = {
  usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana Beatriz', email: 'ana@exemplo.com' },
  tenants: [TENANT_MATRIZ, TENANT_FILIAL],
  tenant_atual: TENANT_MATRIZ,
  permissoes: ['workflows.ver', 'execucoes.ver'],
};

export const sessaoFilial: Sessao = { ...sessaoMatriz, tenant_atual: TENANT_FILIAL, permissoes: ['auditoria.ver'] };

export type FetchSimulado = ReturnType<typeof vi.fn<(requisicao: Request) => Promise<Response>>>;

/** Troca o fetch global por um simulado; desfaça com `vi.unstubAllGlobals()`. */
export function simularFetch(): FetchSimulado {
  const fetchSimulado = vi.fn<(requisicao: Request) => Promise<Response>>();
  vi.stubGlobal('fetch', fetchSimulado);
  return fetchSimulado;
}

export function json(corpo: unknown, status = 200): Response {
  return new Response(JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Erro problem+json do contrato, com os membros de extensão em `extra`. */
export function problema(status: number, codigo: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${codigo}.`, codigo, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** A requisição entregue ao fetch na chamada `indice`. */
export function requisicao(fetchSimulado: FetchSimulado, indice = 0): Request {
  const chamada = fetchSimulado.mock.calls[indice];
  if (!chamada) throw new Error(`o fetch não foi chamado ${indice + 1} vez(es)`);
  return chamada[0];
}

/** As requisições feitas, como "MÉTODO /caminho". */
export function rotasChamadas(fetchSimulado: FetchSimulado): string[] {
  return fetchSimulado.mock.calls.map(([req]) => `${req.method} ${new URL(req.url).pathname}`);
}

export function definirCookieCsrf(valor: string) {
  document.cookie = `fc_csrf=${valor}; path=/`;
}

export function apagarCookieCsrf() {
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/** Provedores dos hooks: API em modo cookie e o QueryClient do produto (ou o passado). */
export function criarProvedores(queryClient: QueryClient = criarQueryClient()) {
  function Provedores({ children }: { children: ReactNode }) {
    return (
      <ProvedorApi apiUrl={API}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ProvedorApi>
    );
  }
  return { queryClient, Provedores };
}
