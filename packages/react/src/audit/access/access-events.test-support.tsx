// Support for the access screen tests (not a test and not shipped in the package): API simulated per route, data from the
// contract, the providers the screen needs and the browser features jsdom lacks (used by Radix).
// Repeats the simulateApi of the Admin screens; a shared test support would be a task of its own.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { AccessEvents } from '.';

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
export const ACCESS_EVENTS_ROUTE = 'GET /v1/auditoria/acessos';

/** Local date (in the time zone of whoever runs the test), as ISO/UTC like the API sends. */
export function localIso(year: number, month: number, day: number, time = 0, minute = 0): string {
  return new Date(year, month - 1, day, time, minute).toISOString();
}

type AccessEvent = Schemas['EventoAcesso'];

let sequence = 0;
/** A contract event; the rest comes from `partial`. */
export function event(partial: Partial<AccessEvent> = {}): AccessEvent {
  sequence += 1;
  return {
    id: `50000000-0000-0000-0000-${String(sequence).padStart(12, '0')}`,
    ocorrido_em: localIso(2026, 11, 15, 9, 5),
    tipo: 'login_ok',
    usuario_id: '10000000-0000-0000-0000-000000000001',
    email_informado: 'ana.souza@exemplo.com.br',
    ip: '203.0.113.7',
    detalhe: null,
    ...partial,
  };
}

export const ANA_LOGIN = event({
  ocorrido_em: localIso(2026, 11, 15, 9, 5),
  tipo: 'login_ok',
  email_informado: 'ana.souza@exemplo.com.br',
  ip: '203.0.113.7',
});
export const BRUNO_FAILURE = event({
  ocorrido_em: localIso(2026, 11, 14, 18, 30),
  tipo: 'login_falhou',
  usuario_id: null,
  email_informado: 'bruno.lima.da.silva.gerente.regional@exemplo-distribuidora.com.br',
  ip: '2001:db8:85a3::8a2e:370:7334',
  detalhe: 'senha incorreta',
});
export const BRUNO_LOCK = event({
  ocorrido_em: localIso(2026, 11, 14, 18, 31),
  tipo: 'login_bloqueado',
  email_informado: 'bruno.lima.da.silva.gerente.regional@exemplo-distribuidora.com.br',
  ip: null,
  detalhe: null,
});

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** A page of the event list. */
export function pageResponse(items: readonly AccessEvent[], nextCursor: string | null = null): Response {
  return json({ itens: items, proximo_cursor: nextCursor });
}

/** problem+json error of the contract. */
export function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, codigo: code, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type RouteResponse = Response | Promise<Response> | ((request: Request) => Response | Promise<Response>);

/**
 * fetch simulated per route ("METHOD /path"). Each route has a queue of responses: the last one repeats.
 * A route without a configured response answers 599 (it becomes `resposta_inesperada` on screen).
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
    /** The search params of the requests made to a route ("METHOD /path"), in order. */
    fetchesOf(route: string): URLSearchParams[] {
      return calls
        .filter((req) => `${req.method} ${new URL(req.url).pathname}` === route)
        .map((req) => new URL(req.url).searchParams);
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

export interface AccessEventsScreen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders the screen (by default, `<AccessEvents>`) with the API (cookie mode), the product QueryClient and the root. */
export function renderAccessEvents(screen: ReactElement = <AccessEvents />): AccessEventsScreen {
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
