// Support for the roles screen tests (not a test and not shipped in the package): API simulated per route, data from the
// contract, the providers the screen needs and the browser features jsdom lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { Roles } from '.';

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}
const prototype = Element.prototype as Element & {
  hasPointerCapture?: (id: number) => boolean;
  setPointerCapture?: (id: number) => void;
  releasePointerCapture?: (id: number) => void;
  scrollIntoView?: () => void;
};
prototype.hasPointerCapture ??= () => false;
prototype.setPointerCapture ??= () => {};
prototype.releasePointerCapture ??= () => {};
prototype.scrollIntoView ??= () => {};

export const API = 'https://api.teste';

/** Part of the contract catalog (backend/docs/plano.md §Contratos), with sensitive ones in two groups. */
export const PERMISSION_CATALOG: Schemas['Permission'][] = [
  { code: 'users.manage', name: 'Gerenciar usuários', category: 'Administração', sensitive: false },
  { code: 'roles.manage', name: 'Gerenciar papéis', category: 'Administração', sensitive: false },
  { code: 'security.manage', name: 'Gerenciar segurança', category: 'Administração', sensitive: true },
  { code: 'connections.view', name: 'Ver conexões', category: 'Dados', sensitive: false },
  { code: 'credentials.manage', name: 'Gerenciar credenciais', category: 'Dados', sensitive: true },
  { code: 'workflows.view', name: 'Ver workflows', category: 'Workflows', sensitive: false },
  { code: 'workflows.edit', name: 'Editar workflows', category: 'Workflows', sensitive: false },
  { code: 'versions.approve', name: 'Aprovar versões', category: 'Workflows', sensitive: true },
  { code: 'audit.view', name: 'Ver auditoria', category: 'Auditoria', sensitive: false },
];

export const ADMIN_ROLE: Schemas['Role'] = {
  id: '10000000-0000-0000-0000-000000000001',
  name: 'Admin',
  permissions: PERMISSION_CATALOG.map((permission) => permission.code),
  fixed: true,
  user_count: 2,
};
export const CONFIGURATOR_ROLE: Schemas['Role'] = {
  id: '10000000-0000-0000-0000-000000000002',
  name: 'Configurador',
  permissions: ['workflows.view', 'workflows.edit', 'connections.view'],
  fixed: false,
  user_count: 3,
};
export const AUDITOR_ROLE: Schemas['Role'] = {
  id: '10000000-0000-0000-0000-000000000003',
  name: 'Auditor de contratos e conciliações do grupo econômico',
  permissions: ['audit.view'],
  fixed: false,
  user_count: 0,
};
export const EMPTY_ROLE: Schemas['Role'] = {
  id: '10000000-0000-0000-0000-000000000004',
  name: 'Sem acesso',
  permissions: [],
  fixed: false,
  user_count: 1,
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** problem+json error of the contract. */
export function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, code: code, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type RouteResponse = Response | Promise<Response> | ((request: Request) => Response | Promise<Response>);

/**
 * fetch simulated per route ("METHOD /path"). Each route has a queue of responses: the last one repeats.
 * A route without a configured response answers 599 (it becomes `unexpected_response` on screen).
 */
export function simulateApi() {
  const queues = new Map<string, RouteResponse[]>();
  const calls: Request[] = [];
  const simulatedFetch = vi.fn(async (request: Request) => {
    calls.push(request.clone());
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    const queue = queues.get(route);
    if (!queue || queue.length === 0) return new Response(`rota não simulada: ${route}`, { status: 599 });
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    if (typeof next === 'function') return next(request);
    return next instanceof Response ? next.clone() : (await next).clone();
  });
  vi.stubGlobal('fetch', simulatedFetch);

  return {
    /** Sets the route responses, in order (the last one repeats). */
    respond(route: string, ...responses: RouteResponse[]) {
      queues.set(route, responses);
    },
    /** The requests made to a route ("METHOD /path"), in order. */
    callsTo(route: string): Request[] {
      return calls.filter((req) => `${req.method} ${new URL(req.url).pathname}` === route);
    },
  };
}

export type SimulatedApi = ReturnType<typeof simulateApi>;

/** A response that only arrives when the test calls `release`. */
export function pendingResponse(response: () => Response) {
  let release: () => void = () => {};
  const promise = new Promise<Response>((resolver) => {
    release = () => resolver(response());
  });
  return { promise, release: () => release() };
}

export interface RolesScreen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders the screen with the API (cookie mode), the product QueryClient and the module root. */
export function renderRoles(): RolesScreen {
  const user = userEvent.setup({ delay: null }); // no pause between actions: the default piles up on a busy machine (F43)
  const queryClient = createQueryClient();
  // Without retrying failed queries: the error tests do not wait for the 3 retries.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Roles />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}

export function setCsrfCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}
