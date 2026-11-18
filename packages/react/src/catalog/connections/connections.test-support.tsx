// Support for the connections screen tests (not a test and not shipped in the package): API simulated per route, data from the
// contract, the providers the screen needs and the browser features jsdom lacks (used by Radix).
// Repeats the simulateApi of the admin screens; a shared test support would be a task of its own.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { Connections } from '.';

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

/** The password typed in the tests: it must never show up in the cache nor in the DOM after saving or cancelling. */
export const SECRET = 'senha-Secreta-#2026';

/** Local date (in the time zone of whoever runs the test), as ISO/UTC like the API sends. */
export function localIso(year: number, month: number, day: number, hour = 12, minute = 0): string {
  return new Date(year, month - 1, day, hour, minute).toISOString();
}

/** Permissions of the initial roles (design.md §4): the Integrador manages everything; the Configurador only views. */
export const INTEGRATOR = ['connections.view', 'connections.manage', 'credentials.manage'];
export const MANAGER_WITHOUT_CREDENTIALS = ['connections.view', 'connections.manage'];
export const VIEWER = ['connections.view'];

const TENANT = { id: '00000000-0000-0000-0000-00000000000a', name: 'Matriz' };

export function session(permissions: readonly string[]): Schemas['Session'] {
  return {
    user: { id: '00000000-0000-0000-0000-000000000001', name: 'Ana Beatriz Souza', email: 'ana@exemplo.com' },
    tenants: [TENANT],
    current_tenant: TENANT,
    permissions: [...permissions],
  };
}

export const OK_TEST: Schemas['ConnectionTestResult'] = {
  ok: true,
  tested_at: localIso(2026, 11, 15, 9, 5),
  duration_ms: 182,
  server_version: 'PostgreSQL 16.4',
  tls: true,
  read_only: true,
  error: null,
};

export const FAILED_TEST: Schemas['ConnectionTestResult'] = {
  ok: false,
  tested_at: localIso(2026, 11, 14, 18, 30),
  duration_ms: 5000,
  server_version: null,
  tls: null,
  read_only: null,
  error: { code: 'connection_timeout', message: 'O banco não respondeu a tempo.' },
};

/** The same OK test as seen without `credentials.manage`: only `ok`, `tested_at` and `error` (D34 of the back). */
export const REDUCED_OK_TEST: Schemas['ConnectionTestResult'] = {
  ...OK_TEST,
  duration_ms: null,
  server_version: null,
  tls: null,
  read_only: null,
};

export const ERP: Schemas['Connection'] = {
  id: '50000000-0000-0000-0000-000000000001',
  name: 'ERP de faturamento',
  type: 'postgres',
  created_at: localIso(2026, 11, 2, 10, 0),
  updated_at: localIso(2026, 11, 15, 9, 5),
  last_test: OK_TEST,
  target: { host: 'db.erp.exemplo.com.br', port: 5432, database: 'faturamento', username: 'leitura_fluxo' },
};

export const CRM: Schemas['Connection'] = {
  id: '50000000-0000-0000-0000-000000000002',
  name: 'CRM corporativo de relacionamento com distribuidores e representantes',
  type: 'sqlserver',
  created_at: localIso(2026, 11, 3, 14, 0),
  updated_at: localIso(2026, 11, 14, 18, 30),
  last_test: FAILED_TEST,
  target: { host: 'crm.interno', port: 1433, database: 'crm', username: 'fluxo' },
};

export const NEW: Schemas['Connection'] = {
  id: '50000000-0000-0000-0000-000000000003',
  name: 'Estoque',
  type: 'postgres',
  created_at: localIso(2026, 11, 16, 8, 0),
  updated_at: localIso(2026, 11, 16, 8, 0),
  last_test: null,
  target: { host: 'estoque.interno', port: 5432, database: 'estoque', username: 'leitura' },
};

export const CONNECTIONS = [ERP, CRM, NEW];

/** A connection as seen without `credentials.manage`: no target and the reduced last test. */
export function withoutCredentials(connection: Schemas['Connection']): Schemas['Connection'] {
  const lastTest = connection.last_test;
  return {
    ...connection,
    target: null,
    last_test: lastTest
      ? { ...lastTest, duration_ms: null, server_version: null, tls: null, read_only: null }
      : null,
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** Response without body (204), like the deletion. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** problem+json error of the contract. */
export function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, code, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type RouteResponse = Response | Promise<Response> | ((request: Request) => Response | Promise<Response>);

/**
 * fetch simulated per route ("METHOD /path"). Each route has a queue of responses: the last one repeats.
 * A route without a configured response answers 599 (it becomes `unexpected_response` on screen).
 */
export function simulateApi(permissions: readonly string[] = INTEGRATOR) {
  const queues = new Map<string, RouteResponse[]>();
  const calls: Request[] = [];
  queues.set('GET /v1/session', [json(session(permissions))]);
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
      return calls.filter((call) => `${call.method} ${new URL(call.url).pathname}` === route);
    },
    /** Everything sent to the API, as text, to look for the password. */
    allCalls(): Request[] {
      return calls;
    },
  };
}

export type SimulatedApi = ReturnType<typeof simulateApi>;

/** A response that only arrives when the test calls `release`. */
export function pendingResponse(response: () => Response) {
  let release: () => void = () => {};
  const promise = new Promise<Response>((resolve) => {
    release = () => resolve(response());
  });
  return { promise, release: () => release() };
}

export interface ConnectionsScreen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders the screen (by default, the whole `<Connections>`) with the API (cookie mode), the product QueryClient and the root. */
export function renderConnections(screen: ReactElement = <Connections />): ConnectionsScreen {
  const user = userEvent.setup({ delay: null });
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

/** Everything the QueryClient keeps (query data and mutation state), as text, to look for secrets. */
export function cacheContent(queryClient: QueryClient): string {
  return JSON.stringify({
    queries: queryClient.getQueryCache().getAll().map((query) => ({ key: query.queryKey, data: query.state.data })),
    mutations: queryClient.getMutationCache().getAll().map((mutation) => mutation.state),
  });
}

/** Types a value into a field the way a person pastes it (click and paste): much faster than key by key. */
export async function write(user: UserEvent, field: HTMLElement, value: string): Promise<void> {
  await user.click(field);
  await user.paste(value);
}

/** The JSON body of a request. */
export async function bodyOf(request: Request | undefined): Promise<unknown> {
  if (!request) throw new Error('a requisição não foi feita');
  return JSON.parse(await request.clone().text()) as unknown;
}
