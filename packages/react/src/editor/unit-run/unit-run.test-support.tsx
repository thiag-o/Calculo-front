// Support for the "Calcular" tests (not a test and not shipped in the package): the API simulated per route, a draft with
// one input of each kind, the unit runs of the contract examples and the providers the tab needs.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, notifyManager, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { DraftEditorProvider, useDraftEditor } from '../draft';
import { UnitRunPanel } from './UnitRunPanel';

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
export const RUN_ROUTE = `POST /v1/workflows/${WORKFLOW_ID}/draft/unit-runs`;

const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };

export function session(userId = '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c'): Schemas['Session'] {
  const tenant = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
  return {
    user: { id: userId, name: 'Ana Souza', email: 'ana@exemplo.com' },
    tenants: [tenant],
    current_tenant: tenant,
    permissions: ['workflows.view', 'workflows.edit'],
  };
}

/** The draft of the contract example ("Pontuação"), with one more input of each kind for the form. */
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
        { name: 'meta_atingida', cardinality: 'linear', type: 'boolean' },
        { name: 'quantidade', cardinality: 'linear', type: 'integer' },
        { name: 'data_compra', cardinality: 'linear', type: 'date' },
        { name: 'momento', cardinality: 'linear', type: 'datetime' },
        {
          name: 'pontuacoes',
          cardinality: 'multiple',
          fields: [
            { name: 'valor_compra', type: 'decimal', scale: 2 },
            { name: 'taxa', type: 'decimal', scale: 4 },
          ],
        },
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
          results: [
            { name: 'elegivel', type: 'boolean', default_value: null },
            { name: 'fator', type: 'decimal', scale: 4, default_value: null },
          ],
          rules: [{ when: ['"A"'], then: ['verdadeiro', '0.15'] }],
        },
        {
          id: 'calc_historico',
          type: 'calculation',
          name: 'Pontos já ganhos',
          description: null,
          position: { x: 240, y: 0 },
          expression: 'SOMA(valor_compra[] * taxa[])',
          output: { name: 'pontos_historico', type: 'decimal', scale: 2 },
          rounding_mode: null,
          error_policy: null,
          default_value: null,
        },
        {
          id: 'calc_pontos',
          type: 'calculation',
          name: 'Pontos',
          description: null,
          position: { x: 480, y: 0 },
          expression: 'MÍN(ARRED(valor_item * fator, 2), 1000 - pontos_historico)',
          output: { name: 'pontos', type: 'decimal', scale: 2 },
          rounding_mode: null,
          error_policy: null,
          default_value: null,
        },
      ],
      output: {
        fields: [
          { name: 'pontos', variable: 'pontos' },
          { name: 'elegivel', variable: 'elegivel' },
        ],
      },
    },
  },
  problems: [],
  symbols: [],
  dependencies: [
    { node_id: 'td_elegibilidade', reads: ['categoria'] },
    { node_id: 'calc_historico', reads: ['pontuacoes'] },
    { node_id: 'calc_pontos', reads: ['fator', 'pontos_historico', 'valor_item'] },
  ],
  order: ['td_elegibilidade', 'calc_historico', 'calc_pontos'],
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
};

export const PROBLEM: Schemas['WorkflowProblem'] = {
  code: 'type_mismatch',
  message: 'categoria é texto e não entra em conta.',
  path: 'root.nodes[2].expression',
  node_id: 'calc_pontos',
  start: 6,
  end: 15,
  suggestion: null,
};

/** The `ok` unit run of the contract examples. */
export const RUN_OK: Schemas['UnitRun'] = {
  status: 'ok',
  outputs: [
    { name: 'pontos', value: '1225.50' },
    { name: 'elegivel', value: true },
  ],
  nodes: [
    {
      node_id: 'td_elegibilidade',
      status: 'ok',
      values: [
        { name: 'elegivel', value: true },
        { name: 'fator', value: '0.1500' },
      ],
      matched_rule: 2,
      warnings: [],
      error: null,
    },
    { node_id: 'calc_historico', status: 'ok', values: [{ name: 'pontos_historico', value: '12.00' }], matched_rule: null, warnings: [], error: null },
    { node_id: 'calc_pontos', status: 'ok', values: [{ name: 'pontos', value: '1225.50' }], matched_rule: null, warnings: [], error: null },
  ],
  error: null,
};

/** `ok_with_warnings`: the history was null, and the policy left it empty with a warning. */
export const RUN_WARNINGS: Schemas['UnitRun'] = {
  status: 'ok_with_warnings',
  outputs: [
    { name: 'pontos', value: null },
    { name: 'elegivel', value: true },
  ],
  nodes: [
    { ...RUN_OK.nodes[0]! },
    {
      node_id: 'calc_historico',
      status: 'warning',
      values: [{ name: 'pontos_historico', value: null }],
      matched_rule: null,
      warnings: [{ code: 'null_result', message: 'O resultado foi nulo; o valor ficou vazio, como pede a política.' }],
      error: null,
    },
    { node_id: 'calc_pontos', status: 'ok', values: [{ name: 'pontos', value: null }], matched_rule: null, warnings: [], error: null },
  ],
  error: null,
};

/** `error`: no rule matched; the next blocks did not run. */
export const RUN_ERROR: Schemas['UnitRun'] = {
  status: 'error',
  outputs: [],
  nodes: [
    {
      node_id: 'td_elegibilidade',
      status: 'error',
      values: [],
      matched_rule: null,
      warnings: [],
      error: { code: 'no_rule_matched', message: 'Nenhuma regra casou com os valores do registro.' },
    },
    { node_id: 'calc_historico', status: 'not_run', values: [], matched_rule: null, warnings: [], error: null },
    { node_id: 'calc_pontos', status: 'not_run', values: [], matched_rule: null, warnings: [], error: null },
  ],
  error: { node_id: 'td_elegibilidade', code: 'no_rule_matched', message: 'Nenhuma regra casou com os valores do registro.' },
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

type RouteResponse = Response | ((request: Request) => Response | Promise<Response>);

/** fetch simulated per route ("METHOD /path"); each route answers its queue in order, and the last one repeats. */
export function simulateApi() {
  const queues = new Map<string, RouteResponse[]>();
  const calls: { route: string; body: unknown }[] = [];
  queues.set('GET /v1/session', [json(session())]);
  queues.set(DRAFT_ROUTE, [json(DRAFT)]);
  queues.set(ANALYSIS_ROUTE, [json({ problems: [], symbols: [] })]);
  const simulatedFetch = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    const text = request.method === 'GET' ? '' : await request.clone().text();
    calls.push({ route, body: text ? JSON.parse(text) : undefined });
    const queue = queues.get(route);
    if (!queue || queue.length === 0) return new Response(`rota não simulada: ${route}`, { status: 599 });
    const next = queue.length > 1 ? queue.shift()! : queue[0]!;
    return typeof next === 'function' ? next(request) : next.clone();
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return {
    respond(route: string, ...responses: RouteResponse[]) {
      queues.set(route, responses);
    },
    bodiesTo(route: string): unknown[] {
      return calls.filter((call) => call.route === route).map((call) => call.body);
    },
    /** The routes called, in order. */
    routes(): string[] {
      return calls.map((call) => call.route);
    },
  };
}

export type SimulatedApi = ReturnType<typeof simulateApi>;

/** The product QueryClient, without retrying failed queries. */
export function testQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  return queryClient;
}

/**
 * A test panel beside the tab, as the canvas and the properties will be: shows the selection and changes the formula of
 * "Pontos" (a change waiting for the 2 s save).
 */
function EditorProbe() {
  const { selection, change } = useDraftEditor();
  return (
    <div>
      <output aria-label="Seleção">{selection.item.type === 'node' ? `node:${selection.item.id}` : selection.item.type}</output>
      <button
        type="button"
        onClick={() =>
          change((current) => ({
            ...current,
            root: {
              ...current.root,
              nodes: current.root.nodes.map((node) => (node.id === 'calc_pontos' && node.type === 'calculation' ? { ...node, expression: 'valor_item' } : node)),
            },
          }))
        }
      >
        Mudar a fórmula
      </button>
    </div>
  );
}

export interface TabScreen {
  user: UserEvent;
  queryClient: QueryClient;
  unmount: () => void;
}

/** Renders the "Calcular" tab inside the draft context, with the API (cookie mode) and the module root. */
export function renderTab(
  { draft = DRAFT, readOnly = false, queryClient = testQueryClient() }: { draft?: Schemas['Draft']; readOnly?: boolean; queryClient?: QueryClient } = {},
): TabScreen {
  const user = userEvent.setup({ delay: null });
  // The editor screen opens only after the session (EditorScreen): the tab never starts without it.
  if (queryClient.getQueryData(['session']) === undefined) queryClient.setQueryData(['session'], session());
  const { unmount } = render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={readOnly}>
            <EditorProbe />
            <UnitRunPanel />
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient, unmount };
}
