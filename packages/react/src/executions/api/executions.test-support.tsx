// Support for the execution screen tests (not a test and not shipped in the package): API simulated per route, data from
// the contract examples (e2e/support/contract.ts, epic 6), the providers the screens need and the browser features jsdom
// lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { cleanup, render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { afterEach, vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';

afterEach(cleanup);

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

/** The Operator: sees and triggers executions. */
export const OPERATOR_PERMISSIONS = ['workflows.view', 'executions.view', 'executions.trigger'];
/** The Approver or the Auditor: only sees them. */
export const VIEWER_PERMISSIONS = ['workflows.view', 'executions.view'];

export function session(permissions: readonly string[]): Schemas['Session'] {
  const tenant = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
  return {
    user: { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza', email: 'ana@exemplo.com' },
    tenants: [tenant],
    current_tenant: tenant,
    permissions: [...permissions],
  };
}

export const WORKFLOW_ID = '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70';
export const OTHER_WORKFLOW_ID = '0e1f2a3b-4c5d-4e6f-8a9b-0c1d2e3f4a5b';
const ANA = { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' };

type Execution = Schemas['Execution'];

let sequence = 0;
/** An execution as in the contract example `ExecutionPending`; the rest comes from `partial`. */
export function execution(partial: Partial<Execution> = {}): Execution {
  sequence += 1;
  return {
    id: `6a7b8c9d-0e1f-4a2b-8c3d-${String(sequence).padStart(12, '0')}`,
    workflow_id: WORKFLOW_ID,
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    status: 'pending',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: { periodo: { start: '2026-10-01', end: '2026-10-31' }, categorias: ['A', 'B'], meta_minima: '100.00' },
    now: '2026-11-21T15:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: ANA,
    created_at: '2026-11-21T15:00:00Z',
    started_at: null,
    data_read_at: null,
    finished_at: null,
    next_retry_at: null,
    total_records: null,
    progress: { chunks_done: 0, records_done: 0 },
    totals: { read: 0, ok: 0, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
    error_groups: [],
    output: { available: false, expires_at: null, rows: null },
    ...partial,
  };
}

/** A finished execution (`completed`): 4m 12s, 1.180 records ok (with the 20 with warnings) and 0 with error. */
export function completed(partial: Partial<Execution> = {}): Execution {
  return execution({
    status: 'completed',
    started_at: '2026-11-21T15:00:05Z',
    data_read_at: '2026-11-21T15:00:06Z',
    finished_at: '2026-11-21T15:04:17Z',
    next_retry_at: null,
    total_records: 1180,
    progress: { chunks_done: 3, records_done: 1180 },
    totals: { read: 1180, ok: 1160, ok_with_warnings: 20, error: 0, ignored: 0, filtered: 0 },
    output: { available: true, expires_at: '2026-11-28T15:04:17Z', rows: 1180 },
    ...partial,
  });
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** A page of the execution list. */
export function page(items: readonly Execution[], nextCursor: string | null = null): Response {
  return json({ items, next_cursor: nextCursor });
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
 * A route without a configured response answers 599 (it becomes `unexpected_response` on screen). `GET /v1/session`
 * starts with the given permissions (the Operator's by default).
 */
export function simulateApi(permissions: readonly string[] = OPERATOR_PERMISSIONS) {
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

export interface Screen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders a screen with the API (cookie mode), the product QueryClient (without retries) and the module root. */
export function renderScreen(screenElement: ReactElement, options: { advanceTimers?: (ms: number) => unknown } = {}): Screen {
  // No pause between actions: the default (a macrotask per keystroke or click) piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null, ...(options.advanceTimers ? { advanceTimers: options.advanceTimers } : {}) });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{screenElement}</QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}

/** The saved draft (`GET /v1/workflows/{id}/draft`) at a revision, with the declared parameters and the problems. */
export function savedDraft(
  revision: number,
  parameters: Schemas['WorkflowParameter'][] = [],
  problems: Schemas['WorkflowProblem'][] = [],
): Schemas['Draft'] {
  return {
    workflow_id: WORKFLOW_ID,
    revision,
    definition: {
      schema_version: 3,
      kind: 'batch',
      settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
      parameters,
      root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } },
    },
    problems,
    symbols: [],
    dependencies: [],
    order: [],
    groups: [],
    updated_at: '2026-11-21T14:00:00Z',
    updated_by: ANA,
  };
}

/** A declared parameter, with the plain defaults (optional, no default, no allowed values). */
export function parameter(
  name: string,
  type: Schemas['ParameterType'],
  extra: Partial<Schemas['WorkflowParameter']> = {},
): Schemas['WorkflowParameter'] {
  return { name, type, required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...extra };
}

/** A problem of the saved draft. */
export function draftProblem(message = '@categoria não existe entre os parâmetros. Você quis dizer @categorias?'): Schemas['WorkflowProblem'] {
  return { code: 'unknown_parameter', message, path: 'root.nodes[0].filters[0].values[0]', node_id: 'produto', start: null, end: null, suggestion: 'categorias' };
}
