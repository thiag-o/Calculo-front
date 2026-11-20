// Support for the Overview tests (not a test and not shipped in the package): API simulated per route, data from the
// contract examples, the providers the screen needs and the browser features jsdom lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';

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

/** The Configurator: sees and edits workflows. */
export const EDITOR_PERMISSIONS = ['workflows.view', 'workflows.edit'];
/** The Operator or the Auditor: only sees them. */
export const VIEWER_PERMISSIONS = ['workflows.view'];

export function session(permissions: readonly string[]): Schemas['Session'] {
  const tenant = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
  return {
    user: { id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c', name: 'Ana Souza', email: 'ana@exemplo.com' },
    tenants: [tenant],
    current_tenant: tenant,
    permissions: [...permissions],
  };
}

const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };
const ANA = { id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c', name: 'Ana Souza' };

/** "Pontuação de exemplo" (contract example `Workflow`): 3 blocks, revision 3, changed by Bruno, no problem. */
export const SCORING: Schemas['Workflow'] = {
  id: '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f',
  name: 'Pontuação de exemplo',
  objective: 'Calcula os pontos de cada item da nota na campanha.',
  kind: 'batch',
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
  draft: { revision: 3, updated_at: '2026-11-18T14:05:00Z', updated_by: BRUNO, node_count: 3, problem_count: 0 },
  created_at: '2026-11-18T13:40:00Z',
  created_by: ANA,
};

/** "Bônus de metas": no objective, 1 block and 2 problems in the draft. */
export const BONUS: Schemas['Workflow'] = {
  ...SCORING,
  id: '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b',
  name: 'Bônus de metas',
  objective: null,
  draft: { revision: 1, updated_at: '2026-11-18T14:05:00Z', updated_by: ANA, node_count: 1, problem_count: 2 },
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
 * fetch simulated per route ("METHOD /path", without the query). Each route has a queue of responses: the last one repeats.
 * A route without a configured response answers 599 (it becomes `unexpected_response` on screen).
 */
export function simulateApi(permissions: readonly string[] = EDITOR_PERMISSIONS) {
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

export interface Screen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders a screen with the API (cookie mode), the product QueryClient and the module root. */
export function renderScreen(screenElement: ReactElement, queryClient: QueryClient = testQueryClient()): Screen {
  // No pause between actions: the default (a macrotask per keystroke or click) piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{screenElement}</QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}

/** The product QueryClient, without retrying failed queries: the error tests do not wait for the 3 retries. */
export function testQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return queryClient;
}
