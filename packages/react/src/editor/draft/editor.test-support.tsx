// Support for the editor tests (not a test and not shipped in the package): API simulated per route, the draft of the
// contract example, the providers the screen needs and a test panel that edits the draft like the real panels will.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, notifyManager, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { useState, type ReactElement } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { useProblemCounts } from '../problems';
import { useDraftEditor } from './DraftEditor';

// TanStack Query notifies the screen through setTimeout(0); with the fake clock of the timing tests, that notice would
// stay in the fake clock. A microtask works with both clocks.
notifyManager.setScheduler((callback) => queueMicrotask(callback));

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
export const WORKFLOW_ID = '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f';
export const DRAFT_ROUTE = `GET /v1/workflows/${WORKFLOW_ID}/draft`;
export const SAVE_ROUTE = `PUT /v1/workflows/${WORKFLOW_ID}/draft`;
export const ANALYSIS_ROUTE = `POST /v1/workflows/${WORKFLOW_ID}/draft/analysis`;
export const WORKFLOW_ROUTE = `GET /v1/workflows/${WORKFLOW_ID}`;

/** The Configurator: edits workflows. */
export const EDITOR_PERMISSIONS = ['workflows.view', 'workflows.edit'];
/** The Operator or the Auditor: only sees them. */
export const VIEWER_PERMISSIONS = ['workflows.view'];

const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };

export function session(permissions: readonly string[]): Schemas['Session'] {
  const tenant = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
  return {
    user: { id: '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c', name: 'Ana Souza', email: 'ana@exemplo.com' },
    tenants: [tenant],
    current_tenant: tenant,
    permissions: [...permissions],
  };
}

export const WORKFLOW: Schemas['Workflow'] = {
  id: WORKFLOW_ID,
  name: 'Pontuação de exemplo',
  objective: 'Calcula os pontos de cada item da nota na campanha.',
  kind: 'batch',
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
  draft: { revision: 3, updated_at: '2026-11-18T14:05:00Z', updated_by: BRUNO, node_count: 2, problem_count: 0 },
  created_at: '2026-11-18T13:40:00Z',
  created_by: BRUNO,
};

/** The draft of the contract example `Draft`, shortened: two inputs, two Calculations and the output. */
export const DRAFT: Schemas['Draft'] = {
  workflow_id: WORKFLOW_ID,
  revision: 3,
  definition: {
    schema_version: 1,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
    root: {
      inputs: [
        { name: 'valor_item', cardinality: 'linear', type: 'decimal', scale: 2 },
        { name: 'categoria', cardinality: 'linear', type: 'text' },
      ],
      nodes: [
        {
          id: 'td_elegibilidade',
          type: 'decision_table',
          name: 'Elegibilidade',
          description: null,
          position: { x: 0, y: 0 },
          hit_policy: 'first',
          rounding_mode: null,
          error_policy: null,
          conditions: [{ expression: 'categoria' }],
          results: [{ name: 'fator', type: 'decimal', scale: 4, default_value: null }],
          rules: [{ when: ['"A"'], then: ['0.15'] }],
        },
        {
          id: 'calc_pontos',
          type: 'calculation',
          name: 'Pontos',
          description: null,
          position: { x: 240, y: 0 },
          expression: 'ARRED(valor_item * fator, 2)',
          output: { name: 'pontos', type: 'decimal', scale: 2 },
          rounding_mode: null,
          error_policy: null,
          default_value: null,
        },
      ],
      output: { fields: [{ name: 'pontos', variable: 'pontos' }] },
    },
  },
  problems: [],
  symbols: [
    { name: 'valor_item', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'input', node_id: null },
    { name: 'categoria', type: 'text', scale: null, cardinality: 'linear', list: null, origin: 'input', node_id: null },
    { name: 'fator', type: 'decimal', scale: 4, cardinality: 'linear', list: null, origin: 'decision_table', node_id: 'td_elegibilidade' },
    { name: 'pontos', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_pontos' },
  ],
  dependencies: [
    { node_id: 'td_elegibilidade', reads: ['categoria'] },
    { node_id: 'calc_pontos', reads: ['fator', 'valor_item'] },
  ],
  order: ['td_elegibilidade', 'calc_pontos'],
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
};

/** The problem of the contract example `AnalysisTypeMismatch`. */
export const TYPE_MISMATCH: Schemas['WorkflowProblem'] = {
  code: 'type_mismatch',
  message: 'categoria é texto e não entra em conta.',
  path: 'root.nodes[1].expression',
  node_id: 'calc_pontos',
  start: 6,
  end: 15,
  suggestion: null,
};

/** The draft with the expression changed and the result of the analysis or save. */
export function draftWith(changes: Partial<Schemas['Draft']> & { expression?: string } = {}): Schemas['Draft'] {
  const { expression, ...rest } = changes;
  const draft: Schemas['Draft'] = structuredClone({ ...DRAFT, ...rest });
  if (expression !== undefined) draft.definition = setExpression(draft.definition, expression);
  return draft;
}

/** The definition with another formula in `calc_pontos`. */
export function setExpression(definition: Schemas['WorkflowDefinition'], expression: string): Schemas['WorkflowDefinition'] {
  return {
    ...definition,
    root: {
      ...definition.root,
      nodes: definition.root.nodes.map((node) => (node.id === 'calc_pontos' && node.type === 'calculation' ? { ...node, expression } : node)),
    },
  };
}

export function expressionOf(definition: Schemas['WorkflowDefinition']): string | undefined {
  const node = definition.root.nodes.find((candidate) => candidate.id === 'calc_pontos');
  return node?.type === 'calculation' ? node.expression : undefined;
}

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
 * fetch simulated per route ("METHOD /path", without the query). Each route has a queue of responses: the last one
 * repeats. A route without a configured response answers 599 (it becomes `unexpected_response` on screen). The session
 * starts with `permissions`, the workflow and the draft with the examples above.
 */
export function simulateApi(permissions: readonly string[] = EDITOR_PERMISSIONS) {
  const queues = new Map<string, RouteResponse[]>();
  const calls: { route: string; body: unknown }[] = [];
  queues.set('GET /v1/session', [json(session(permissions))]);
  queues.set(WORKFLOW_ROUTE, [json(WORKFLOW)]);
  queues.set(DRAFT_ROUTE, [json(DRAFT)]);
  const simulatedFetch = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    const text = request.method === 'GET' ? '' : await request.clone().text();
    calls.push({ route, body: text ? JSON.parse(text) : undefined });
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
    /** The bodies sent to a route, in order. */
    bodiesTo(route: string): unknown[] {
      return calls.filter((call) => call.route === route).map((call) => call.body);
    },
    callCount(route: string): number {
      return calls.filter((call) => call.route === route).length;
    },
    /** Whether `fetch` was called for the route (synchronous: counts the call before the body is read). */
    calledTimes(route: string): number {
      return simulatedFetch.mock.calls.filter(([request]) => `${request.method} ${new URL(request.url).pathname}` === route).length;
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
  unmount: () => void;
}

/** Renders a screen with the API (cookie mode), the product QueryClient and the module root. */
export function renderScreen(screenElement: ReactElement, queryClient: QueryClient = testQueryClient()): Screen {
  // No pause between actions: the default (a macrotask per keystroke or click) piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null });
  const { unmount } = render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{screenElement}</QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient, unmount };
}

/** The product QueryClient, without retrying failed queries: the error tests do not wait for the 3 retries. */
export function testQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return queryClient;
}

export function setCsrfCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}

/**
 * A test panel that edits the draft as the real panels will: the formula of "Pontos" (each change a step, or merged with
 * `merge`), the selection, the problem count of the block and "Salvar agora" (`flush`).
 */
export function DraftProbe({ merge = false }: { merge?: boolean }) {
  const editor = useDraftEditor();
  const counts = useProblemCounts();
  const [flushed, setFlushed] = useState('');
  const { item, field } = editor.selection;
  return (
    <div>
      <label>
        Fórmula de Pontos
        <textarea
          value={expressionOf(editor.definition) ?? ''}
          readOnly={editor.readOnly}
          onChange={(event) =>
            editor.change((current) => setExpression(current, event.target.value), merge ? { mergeKey: 'root.nodes[1].expression' } : undefined)
          }
        />
      </label>
      <output aria-label="Seleção">{`${item.type === 'node' ? `node:${item.id}` : item.type} ${field ?? '-'}`}</output>
      <output aria-label="Problemas em Pontos">{String(counts.byNode.get('calc_pontos') ?? 0)}</output>
      <button type="button" onClick={() => void editor.flush().then((revision) => setFlushed(String(revision)))}>
        Salvar agora
      </button>
      <output aria-label="Revisão salva">{flushed}</output>
    </div>
  );
}
