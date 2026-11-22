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
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
    parameters: [],
    root: {
      batch_source: null,
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
  groups: [],
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
};

export const PROBLEM: Schemas['WorkflowProblem'] = {
  code: 'type_mismatch',
  message: 'Esperava um número, mas categoria é um texto.',
  path: 'root.nodes[2].expression',
  node_id: 'calc_pontos',
  start: 6,
  end: 15,
  suggestion: null,
};

const INPUT_HASH = 'sha256:75165c8bcd4ca4b534982d17cc7dd60932f8b98416eda295284fc4c82bc6e14f';
const OUTPUT_HASH = 'sha256:83590128dbe351da686faeeaf3010823a271e47971ff01329fa1f8b37fcc098f';

/** The `ok` unit run (the trace of the contract). */
export const RUN_OK: Schemas['UnitRunTrace'] = {
  status: 'ok',
  record_key: null,
  inputs: [],
  nodes: [
    {
      type: 'decision_table',
      node_id: 'td_elegibilidade',
      status: 'ok',
      values: { elegivel: true, fator: '0.1500' },
      matched_rule: 2,
      warnings: [],
      error: null,
    },
    { type: 'calculation', node_id: 'calc_historico', status: 'ok', values: { pontos_historico: '12.00' }, matched_rule: null, warnings: [], error: null },
    { type: 'calculation', node_id: 'calc_pontos', status: 'ok', values: { pontos: '1225.50' }, matched_rule: null, warnings: [], error: null },
  ],
  outputs: { pontos: '1225.50', elegivel: true },
  input_hash: INPUT_HASH,
  output_hash: OUTPUT_HASH,
  error: null,
  warnings: [],
};

/** `ok_with_warnings`: the history was null, and the policy left it empty with a warning. */
export const RUN_WARNINGS: Schemas['UnitRunTrace'] = {
  status: 'ok_with_warnings',
  record_key: null,
  inputs: [],
  nodes: [
    { ...RUN_OK.nodes[0]! },
    {
      type: 'calculation',
      node_id: 'calc_historico',
      status: 'warning',
      values: { pontos_historico: null },
      matched_rule: null,
      warnings: [{ code: 'null_result', message: 'O resultado foi nulo; o valor ficou vazio, como pede a política.' }],
      error: null,
    },
    { type: 'calculation', node_id: 'calc_pontos', status: 'ok', values: { pontos: null }, matched_rule: null, warnings: [], error: null },
  ],
  outputs: { pontos: null, elegivel: true },
  input_hash: INPUT_HASH,
  output_hash: OUTPUT_HASH,
  error: null,
  warnings: [],
};

/** `error`: no rule matched; the next blocks did not run. */
export const RUN_ERROR: Schemas['UnitRunTrace'] = {
  status: 'error',
  record_key: null,
  inputs: [],
  nodes: [
    {
      type: 'decision_table',
      node_id: 'td_elegibilidade',
      status: 'error',
      values: {},
      matched_rule: null,
      warnings: [],
      error: { code: 'no_rule_matched', message: 'Nenhuma regra casou com os valores do registro.' },
    },
    { type: 'calculation', node_id: 'calc_historico', status: 'not_run', values: {}, matched_rule: null, warnings: [], error: null },
    { type: 'calculation', node_id: 'calc_pontos', status: 'not_run', values: {}, matched_rule: null, warnings: [], error: null },
  ],
  outputs: {},
  input_hash: INPUT_HASH,
  output_hash: null,
  error: { node_id: 'td_elegibilidade', code: 'no_rule_matched', message: 'Nenhuma regra casou com os valores do registro.', values: {} },
  warnings: [],
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
      <button
        type="button"
        onClick={() =>
          change((current) => ({
            ...current,
            root: {
              ...current.root,
              nodes: current.root.nodes.map((node) => (node.id === 'calc_pontos' ? { ...node, name: 'Pontos renomeado' } : node)),
            },
          }))
        }
      >
        Renomear Pontos
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
  {
    draft = DRAFT,
    readOnly = false,
    queryClient = testQueryClient(),
  }: { draft?: Schemas['Draft']; readOnly?: boolean; queryClient?: QueryClient } = {},
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

// Epic 5: a workflow with a batch source (the contract's DraftWithSources, shortened), its preview and its traces.

const ORIGIN_ROW = { nf_id: '10', item_seq: '1' };

function batchSymbol(name: string, type: Schemas['DataType'], origin: Schemas['Symbol']['origin'] = 'batch_source'): Schemas['Symbol'] {
  return { name, type, scale: type === 'decimal' ? 2 : null, cardinality: 'linear', list: null, origin, node_id: null, group_id: null };
}

/** A workflow whose records come from "Itens NF" (key nf_id + item_seq), with a Source block and a group. */
export const DRAFT_WITH_SOURCES: Schemas['Draft'] = {
  ...DRAFT,
  revision: 4,
  definition: {
    schema_version: 2,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
    parameters: [],
    root: {
      batch_source: {
        dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
        key: ['nf_id', 'item_seq'],
        filters: [{ variable: 'status', operator: '=', values: ['"A"'] }],
        order_by: [{ variable: 'data_emissao', direction: 'asc' }],
        outputs: [
          { variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e01', name: 'nf_id' },
          { variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e02', name: 'item_seq' },
          { variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e03', name: 'cod_prod' },
          { variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e04', name: 'valor_item' },
        ],
      },
      inputs: [],
      nodes: [
        {
          id: 'produto',
          type: 'source',
          name: 'Produto',
          description: null,
          position: { x: 0, y: 0 },
          mode: 'linear',
          dataset_id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02',
          links: [{ variable: 'cod_prod', column_variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11' }],
          filters: [],
          order_by: [{ variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12', direction: 'desc' }],
          no_match: 'error',
          multiple_rows: 'error',
          exists: null,
          outputs: [{ variable_id: '9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13', name: 'categoria' }],
        },
        {
          id: 'grp_pontuacao',
          type: 'group',
          name: 'Pontuação',
          description: null,
          position: { x: 240, y: 0 },
          collapsed: false,
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
          outputs: ['elegivel', 'pontos'],
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
  symbols: [
    batchSymbol('nf_id', 'text'),
    batchSymbol('item_seq', 'integer'),
    batchSymbol('cod_prod', 'text'),
    batchSymbol('valor_item', 'decimal'),
    batchSymbol('categoria', 'text', 'source'),
  ],
  dependencies: [],
  order: ['produto', 'grp_pontuacao'],
  groups: [{ node_id: 'grp_pontuacao', inputs: ['categoria', 'valor_item'], outputs: ['elegivel', 'pontos'], order: ['td_elegibilidade', 'calc_pontos'] }],
};

/** The preview of the contract: two records in the sample of the root group (and one of a group, not offered). */
export const PREVIEW: Schemas['Preview'] = {
  counted_records: 500,
  total_known: false,
  sources: [],
  groups: [
    {
      node_id: null,
      records: [
        { record_key: { nf_id: '10', item_seq: '1' }, status: 'ok', inputs: {}, outputs: { pontos: '225.00' } },
        { record_key: { nf_id: '10', item_seq: '1500' }, status: 'filtered', inputs: {}, outputs: {} },
      ],
    },
    { node_id: 'grp_pontuacao', records: [{ record_key: { nf_id: '99', item_seq: '9' }, status: 'ok', inputs: {}, outputs: {} }] },
  ],
  error: null,
};

function origin(column: string, connection: string | null = 'ERP', dataset = 'Itens NF', rowKey: Record<string, string> | null = ORIGIN_ROW) {
  return { connection, dataset, column, row_key: rowKey };
}

/** The trace of the contract (`UnitRunTrace`): the record nf_id 10 · item_seq 1, with the group nested. */
export const TRACE_OK: Schemas['UnitRunTrace'] = {
  status: 'ok',
  record_key: { nf_id: '10', item_seq: '1' },
  inputs: [
    { variable: 'nf_id', value: '10', origin: origin('nf_id') },
    { variable: 'valor_item', value: '1500.00', origin: origin('vl_itm') },
    { variable: 'categoria', value: 'A', origin: origin('categoria', 'Cadastro', 'Produtos', { cod_prod: 'P-001' }) },
    { variable: 'cotacao', value: '5.10', origin: origin('cotacao', null, 'Cotações.xlsx', null) },
  ],
  nodes: [
    { type: 'source', node_id: 'produto', status: 'ok', values: { categoria: 'A' }, rows_found: 1, warnings: [], error: null },
    {
      type: 'group',
      node_id: 'grp_pontuacao',
      status: 'ok',
      inputs: { categoria: 'A', valor_item: '1500.00' },
      outputs: { elegivel: true, pontos: '225.00' },
      nodes: [
        { type: 'decision_table', node_id: 'td_elegibilidade', status: 'ok', values: { elegivel: true, fator: '0.1500' }, matched_rule: 1, warnings: [], error: null },
        { type: 'calculation', node_id: 'calc_pontos', status: 'ok', values: { pontos: '225.00' }, matched_rule: null, warnings: [], error: null },
      ],
    },
  ],
  outputs: { pontos: '225.00', elegivel: true },
  input_hash: 'sha256:77b0db21bf50cd73110d3ba398acc52c9d59e1ff5b3a3cb10d67e03f86560506',
  output_hash: 'sha256:83590128dbe351da686faeeaf3010823a271e47971ff01329fa1f8b37fcc098f',
  error: null,
  warnings: [],
};

const NOT_RUN_GROUP: Schemas['TraceGroupNode'] = { type: 'group', node_id: 'grp_pontuacao', status: 'not_run', inputs: {}, outputs: {}, nodes: [] };

/** `filtered`: out of the batch source filter; nothing ran after it. */
export const TRACE_FILTERED: Schemas['UnitRunTrace'] = {
  ...TRACE_OK,
  status: 'filtered',
  nodes: [{ type: 'source', node_id: 'produto', status: 'ok', values: { categoria: 'B' }, rows_found: 1, warnings: [], error: null }, NOT_RUN_GROUP],
  outputs: {},
  output_hash: null,
};

export const NO_MATCH_MESSAGE = 'Produto não achou linha para cod_prod P-999; o registro foi ignorado, como pede a política do bloco.';

/** `ignored`: the Source block found no row and its policy discards the record. */
export const TRACE_IGNORED: Schemas['UnitRunTrace'] = {
  ...TRACE_OK,
  status: 'ignored',
  nodes: [
    {
      type: 'source',
      node_id: 'produto',
      status: 'warning',
      values: { categoria: null },
      rows_found: 0,
      warnings: [{ code: 'no_match', message: NO_MATCH_MESSAGE }],
      error: null,
    },
    NOT_RUN_GROUP,
  ],
  outputs: {},
  output_hash: null,
  warnings: [{ node_id: 'produto', code: 'no_match', message: NO_MATCH_MESSAGE, values: { cod_prod: 'P-999' } }],
};

/** `error` of reading: the batch source column no longer exists (the error is of the batch source, `node_id` null). */
export const TRACE_SCHEMA_DRIFT: Schemas['UnitRunTrace'] = {
  ...TRACE_OK,
  status: 'error',
  inputs: [],
  nodes: [],
  outputs: {},
  output_hash: null,
  error: { node_id: null, code: 'schema_drift', message: '`ItensNF.vl_itm` não existe mais na origem.', values: {} },
};

/** `ok_with_warnings`: the Source block found 3 rows and took the first, as accepted. */
export const TRACE_WARNINGS: Schemas['UnitRunTrace'] = {
  ...TRACE_OK,
  status: 'ok_with_warnings',
  nodes: [
    {
      type: 'source',
      node_id: 'produto',
      status: 'warning',
      values: { categoria: 'A' },
      rows_found: 3,
      warnings: [{ code: 'multiple_rows', message: 'Produto achou 3 linhas; valeu a primeira pela ordenação.' }],
      error: null,
    },
    TRACE_OK.nodes[1]!,
  ],
};

/** `error` in a block inside the group: the error at the block, nested, and the record without outputs. */
export const TRACE_ERROR: Schemas['UnitRunTrace'] = {
  ...TRACE_OK,
  status: 'error',
  nodes: [
    TRACE_OK.nodes[0]!,
    {
      type: 'group',
      node_id: 'grp_pontuacao',
      status: 'error',
      inputs: { categoria: 'Z', valor_item: '1500.00' },
      outputs: {},
      nodes: [
        {
          type: 'decision_table',
          node_id: 'td_elegibilidade',
          status: 'error',
          values: {},
          matched_rule: null,
          warnings: [],
          error: { code: 'no_rule_matched', message: 'Nenhuma regra casou com os valores do registro.' },
        },
        { type: 'calculation', node_id: 'calc_pontos', status: 'not_run', values: {}, matched_rule: null, warnings: [], error: null },
      ],
    },
  ],
  outputs: {},
  output_hash: null,
  error: { node_id: 'td_elegibilidade', code: 'no_rule_matched', message: 'Nenhuma regra casou com os valores do registro.', values: { categoria: 'Z' } },
};

/**
 * The trace of the reference campaign as the real backend answers it (CK5): a Source block over a parameters table, with no
 * link, reads its row with `row_key` null (`TraceOrigin`), and the group has `inputs`, `outputs` and `nodes`, no `values`.
 */
export const TRACE_CAMPAIGN: Schemas['UnitRunTrace'] = {
  ...TRACE_OK,
  inputs: [
    ...TRACE_OK.inputs,
    { variable: 'teto_pontos_item', value: '150.00', origin: { connection: 'ERP', dataset: 'Parâmetros', column: 'teto_pontos_item', row_key: null } },
  ],
};
