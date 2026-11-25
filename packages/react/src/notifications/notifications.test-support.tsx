// Support for the bell tests (not a test and not shipped in the package): API simulated per route, alerts shaped like the
// contract example `NotificationList` (e2e/support/contract.ts, epic 7), and the providers the bell needs.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../api';
import { FluxoRoot } from '../design-system';

afterEach(cleanup);

if (!('ResizeObserver' in globalThis)) {
  globalThis.ResizeObserver = class {
    observe() {}
    unobserve() {}
    disconnect() {}
  };
}

export const API = 'https://api.teste';
export const LIST = 'GET /v1/notifications';
export const READ = 'POST /v1/notifications/read';

export const WORKFLOW = { id: '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70', name: 'Pontuação de exemplo' };

type Notification = Schemas['Notification'];

/** Minutes ago, as an ISO instant (keeps "há N min" independent of the day the test runs). */
export function minutesAgo(minutes: number): string {
  return new Date(Date.now() - minutes * 60_000).toISOString();
}

let sequence = 0;
/** An alert like the contract example (`awaiting_decision`, unread, with the execution); the rest comes from `partial`. */
export function alert(partial: Partial<Notification> = {}): Notification {
  sequence += 1;
  const suffix = String(sequence).padStart(12, '0');
  return {
    id: `0f1a2b3c-4d5e-4f6a-8b7c-${suffix}`,
    kind: 'awaiting_decision',
    title: 'Execução aguarda decisão',
    detail: 'Pontuação de exemplo: a pré-validação encontrou campos vazios acima do limite. Prossiga ou cancele na execução.',
    created_at: minutesAgo(5),
    read: false,
    workflow: WORKFLOW,
    execution: { id: `6a7b8c9d-0e1f-4a2b-8c3d-${suffix}` },
    schedule: null,
    ...partial,
  };
}

/** One alert of each kind, with the titles and details of backend Contratos, "Sino". */
export function oneOfEachKind(): Notification[] {
  return [
    alert({ kind: 'awaiting_decision', title: 'Execução aguarda decisão', created_at: minutesAgo(5) }),
    alert({
      kind: 'pre_validation_alert',
      title: 'Alerta na pré-validação',
      detail: 'Pontuação de exemplo: a execução agendada seguiu com campos vazios acima do limite (cod_prod).',
      schedule: { id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e03', name: 'Fechamento mensal' },
      created_at: minutesAgo(10),
    }),
    alert({
      kind: 'execution_aborted',
      title: 'Execução abortada',
      detail: 'Pontuação de exemplo: a fonte ItensNF não respondeu.',
      created_at: minutesAgo(15),
    }),
    alert({
      kind: 'execution_completed_with_errors',
      title: 'Execução com erros',
      detail: 'Pontuação de exemplo: 12 registros com erro. O CSV tem só os registros sem erro.',
      read: true,
      created_at: minutesAgo(20),
    }),
    alert({
      kind: 'schedule_failed',
      title: 'Agendamento não disparou',
      detail: 'Conferência semanal (Pontuação de exemplo): o parâmetro meta_minima é obrigatório e ficou sem valor.',
      execution: null,
      schedule: { id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e02', name: 'Conferência semanal' },
      created_at: minutesAgo(25),
    }),
    alert({
      kind: 'schedule_skipped',
      title: 'Agendamento não executou',
      detail: 'Fechamento mensal (Pontuação de exemplo): o escopo já foi entregue. Para entregar de novo, use Executar lote.',
      execution: null,
      schedule: { id: '8c9d0e1f-2a3b-4c4d-8e5f-6a7b8c9d0e03', name: 'Fechamento mensal' },
      read: true,
      created_at: minutesAgo(30),
    }),
  ];
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** A page of the bell, with the unread count (by default, the unread ones on the page). */
export function page(items: readonly Notification[], options: { unread?: number; nextCursor?: string | null } = {}): Response {
  return json({
    items,
    next_cursor: options.nextCursor ?? null,
    unread_count: options.unread ?? items.filter((item) => !item.read).length,
  });
}

/** The `204` of `POST /v1/notifications/read`. */
export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** problem+json error of the contract. */
export function problem(status: number, code: string): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, code }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type RouteResponse = Response | Promise<Response> | ((request: Request) => Response | Promise<Response>);

/**
 * fetch simulated per route ("METHOD /path", without the query). Each route has a queue of responses: the last one
 * repeats. A route without a configured response answers 599 (it becomes `unexpected_response` on screen).
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

export interface Screen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders with the API (cookie mode), the product QueryClient (without retries) and the module root. */
export function renderScreen(element: ReactElement, options: { advanceTimers?: (ms: number) => unknown } = {}): Screen {
  // No pause between actions: the default (a macrotask per keystroke or click) piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null, ...(options.advanceTimers ? { advanceTimers: options.advanceTimers } : {}) });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{element}</QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}
