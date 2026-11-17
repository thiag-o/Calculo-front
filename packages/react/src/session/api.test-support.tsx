// Support for the vertical's tests (not a test and not shipped in the package): simulated fetch, contract responses
// and the providers (API in cookie mode and QueryClient) the hooks need.
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider } from '../api';
import type { Session } from './useSession';

export const API = 'https://api.teste';

export const HEADQUARTERS_TENANT = { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' };
export const BRANCH_TENANT = { id: '00000000-0000-0000-0000-00000000000b', nome: 'Filial Nordeste e Centro-Oeste' };

export const headquartersSession: Session = {
  usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana Beatriz', email: 'ana@exemplo.com' },
  tenants: [HEADQUARTERS_TENANT, BRANCH_TENANT],
  tenant_atual: HEADQUARTERS_TENANT,
  permissoes: ['workflows.ver', 'execucoes.ver'],
};

export const branchSession: Session = { ...headquartersSession, tenant_atual: BRANCH_TENANT, permissoes: ['auditoria.ver'] };

export type SimulatedFetch = ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;

/** Replaces the global fetch with a simulated one; undo with `vi.unstubAllGlobals()`. */
export function simulateFetch(): SimulatedFetch {
  const simulatedFetch = vi.fn<(request: Request) => Promise<Response>>();
  vi.stubGlobal('fetch', simulatedFetch);
  return simulatedFetch;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** problem+json error of the contract, with the extension members in `extra`. */
export function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, codigo: code, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

/** The request handed to fetch on call `index`. */
export function request(simulatedFetch: SimulatedFetch, index = 0): Request {
  const call = simulatedFetch.mock.calls[index];
  if (!call) throw new Error(`o fetch não foi chamado ${index + 1} vez(es)`);
  return call[0];
}

/** The requests made, as "METHOD /path". */
export function calledRoutes(simulatedFetch: SimulatedFetch): string[] {
  return simulatedFetch.mock.calls.map(([req]) => `${req.method} ${new URL(req.url).pathname}`);
}

export function setCsrfCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}

export function deleteCsrfCookie() {
  document.cookie = 'fc_csrf=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/';
}

/** Hook providers: API in cookie mode and the product QueryClient (or the one passed). */
export function createProviders(queryClient: QueryClient = createQueryClient()) {
  function Providers({ children }: { children: ReactNode }) {
    return (
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
      </ApiProvider>
    );
  }
  return { queryClient, Providers };
}
