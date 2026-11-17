// Support for the integration screen tests (not a test and not shipped in the package): API simulated per route, data from the
// contract, the providers the screen needs and the browser features jsdom lacks (used by Radix).
// Repeats the simulateApi of the users and roles screens; a shared test support would be a task of its own.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { Integration } from '.';

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

/** Local date (in the time zone of whoever runs the test), as ISO/UTC like the API sends. */
export function localIso(year: number, month: number, day: number, time = 12, minute = 0): string {
  return new Date(year, month - 1, day, time, minute).toISOString();
}

export const PORTAL_API_KEY: Schemas['ApiKey'] = {
  id: '30000000-0000-0000-0000-000000000001',
  name: 'Portal do cliente',
  prefix: 'fc_3k9Q',
  created_at: localIso(2026, 11, 2),
  last_used_at: localIso(2026, 11, 15, 9, 5),
  revoked_at: null,
};
export const ERP_API_KEY: Schemas['ApiKey'] = {
  id: '30000000-0000-0000-0000-000000000002',
  name: 'Integração do ERP corporativo de faturamento, conciliação e repasses',
  prefix: 'fc_Zp71',
  created_at: localIso(2026, 11, 10),
  last_used_at: null,
  revoked_at: null,
};
export const OLD_API_KEY: Schemas['ApiKey'] = {
  id: '30000000-0000-0000-0000-000000000003',
  name: 'Portal antigo',
  prefix: 'fc_a0b1',
  created_at: localIso(2026, 1, 5),
  last_used_at: localIso(2026, 3, 1, 18, 30),
  revoked_at: localIso(2026, 3, 2),
};
export const API_KEYS = [PORTAL_API_KEY, ERP_API_KEY, OLD_API_KEY];

export const APP_AUTHORIZED_DOMAIN: Schemas['AuthorizedDomain'] = {
  id: '40000000-0000-0000-0000-000000000001',
  origin: 'https://app.exemplo.com.br',
  created_at: localIso(2026, 11, 3),
};
export const LOCAL_AUTHORIZED_DOMAIN: Schemas['AuthorizedDomain'] = {
  id: '40000000-0000-0000-0000-000000000002',
  origin: 'http://localhost:5274',
  created_at: localIso(2026, 11, 14),
};
export const AUTHORIZED_DOMAINS = [APP_AUTHORIZED_DOMAIN, LOCAL_AUTHORIZED_DOMAIN];

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Response without body (204), like revoking and deleting. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
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

export interface IntegrationScreen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders the screen (by default, the whole `<Integration>`) with the API (cookie mode), the product QueryClient and the root. */
export function renderIntegration(screen: ReactElement = <Integration />): IntegrationScreen {
  const user = userEvent.setup();
  const queryClient = createQueryClient();
  // Without retrying failed queries: the error tests do not wait for the 3 retries.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{screen}</QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}

export function setCsrfCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}

/** Everything the QueryClient keeps (query data and mutation state), as text, to look for secrets. */
export function cacheContent(queryClient: QueryClient): string {
  return JSON.stringify({
    queries: queryClient.getQueryCache().getAll().map((query) => ({ key: query.queryKey, data: query.state.data })),
    mutations: queryClient.getMutationCache().getAll().map((mutation) => mutation.state),
  });
}
