// Support for the users screen tests (not a test and not shipped in the package): API simulated per route, data from the
// contract, the providers the screen needs and the browser features jsdom lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { Users } from '.';

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

export const ADMIN_ROLE: Schemas['Role'] = {
  id: '10000000-0000-0000-0000-000000000001',
  name: 'Admin',
  permissions: [],
  fixed: true,
  user_count: 1,
};
export const CONFIGURATOR_ROLE: Schemas['Role'] = {
  id: '10000000-0000-0000-0000-000000000002',
  name: 'Configurador',
  permissions: ['workflows.view', 'workflows.edit'],
  fixed: false,
  user_count: 1,
};
export const AUDITOR_ROLE: Schemas['Role'] = {
  id: '10000000-0000-0000-0000-000000000003',
  name: 'Auditor',
  permissions: ['audit.view'],
  fixed: false,
  user_count: 0,
};
export const ROLES = [ADMIN_ROLE, CONFIGURATOR_ROLE, AUDITOR_ROLE];

const summary = (role: Schemas['Role']) => ({ id: role.id, name: role.name });

export const ANA: Schemas['User'] = {
  id: '20000000-0000-0000-0000-000000000001',
  email: 'ana@exemplo.com',
  name: 'Ana Beatriz Souza',
  roles: [summary(ADMIN_ROLE)],
  active: true,
  external: false,
};
export const BRUNO: Schemas['User'] = {
  id: '20000000-0000-0000-0000-000000000002',
  email: 'bruno.figueiredo.de.albuquerque@exemplo.com',
  name: 'Bruno Figueiredo de Albuquerque',
  roles: [summary(CONFIGURATOR_ROLE), summary(AUDITOR_ROLE)],
  active: true,
  external: false,
};
export const CARLA: Schemas['User'] = {
  id: '20000000-0000-0000-0000-000000000003',
  email: 'carla@exemplo.com',
  name: 'Carla Menezes',
  roles: [],
  active: false,
  external: false,
};
export const DAVI: Schemas['User'] = {
  id: '20000000-0000-0000-0000-000000000004',
  email: 'davi@hospedeiro.com',
  name: 'Davi Externo',
  roles: [summary(AUDITOR_ROLE)],
  active: true,
  external: true,
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
 * A route without a configured response fails the test with an unexpected-response 500.
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

/** Renders the screen with the API (cookie mode), the product QueryClient and the module root. */
export function renderUsers(): { user: UserEvent; queryClient: QueryClient } {
  const user = userEvent.setup();
  const queryClient = createQueryClient();
  // Without retrying failed queries: the error tests do not wait for the 3 retries.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Users />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}

export function setCsrfCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}
