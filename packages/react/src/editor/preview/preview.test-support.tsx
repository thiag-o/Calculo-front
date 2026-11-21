// Support for the "Prévia" tests (not a test and not shipped in the package): the API simulated per route, a draft with
// the batch source, Fonte blocks and a group, the previews of the contract examples and the providers the tab needs.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, notifyManager, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { DraftEditorProvider, useDraftEditor } from '../draft';
import { PreviewPanel } from './PreviewPanel';

notifyManager.setScheduler((callback) => queueMicrotask(callback));

export const API = 'https://api.teste';
export const WORKFLOW_ID = '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f';
export const DRAFT_ROUTE = `GET /v1/workflows/${WORKFLOW_ID}/draft`;
export const SAVE_ROUTE = `PUT /v1/workflows/${WORKFLOW_ID}/draft`;
export const ANALYSIS_ROUTE = `POST /v1/workflows/${WORKFLOW_ID}/draft/analysis`;
export const PREVIEW_ROUTE = `POST /v1/workflows/${WORKFLOW_ID}/draft/previews`;

const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };
const DATASET_ITENS = '6d1f0e2a-3b4c-4d5e-8f6a-7b8c9d0e1f2a';
const DATASET_PRODUTOS = '7e2a1f3b-4c5d-4e6f-9a7b-8c9d0e1f2a3b';
const DATASET_CAMPANHA = '8f3b2a4c-5d6e-4f7a-8b8c-9d0e1f2a3b4c';
const DATASET_FATORES = '9a4c3b5d-6e7f-4a8b-9c9d-0e1f2a3b4c5d';

function variable(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

export function session(userId = '5f0c2a8e-4b1d-4c3e-9a77-1d2e3f4a5b6c'): Schemas['Session'] {
  const tenant = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
  return {
    user: { id: userId, name: 'Ana Souza', email: 'ana@exemplo.com' },
    tenants: [tenant],
    current_tenant: tenant,
    permissions: ['workflows.view', 'workflows.edit'],
  };
}

type DefinitionNode = Schemas['WorkflowDefinition']['root']['nodes'][number];

const PRODUTOS: DefinitionNode = {
  id: 'produto',
  type: 'source',
  name: 'Produtos',
  description: null,
  position: { x: 0, y: 0 },
  mode: 'linear',
  dataset_id: DATASET_PRODUTOS,
  links: [{ variable: 'cod_prod', column_variable_id: variable(20) }],
  filters: [],
  order_by: [{ variable_id: variable(20), direction: 'asc' }],
  no_match: 'error',
  multiple_rows: 'accept_first',
  exists: null,
  outputs: [{ variable_id: variable(21), name: 'categoria' }],
};

const CAMPANHA: DefinitionNode = {
  id: 'campanha',
  type: 'source',
  name: 'Produtos da campanha',
  description: null,
  position: { x: 0, y: 160 },
  mode: 'filter',
  dataset_id: DATASET_CAMPANHA,
  links: [{ variable: 'cod_prod', column_variable_id: variable(30) }],
  filters: [],
  exists: true,
};

const FATORES: DefinitionNode = {
  id: 'fatores',
  type: 'source',
  name: 'Fatores',
  description: null,
  position: { x: 0, y: 320 },
  mode: 'linear',
  dataset_id: DATASET_FATORES,
  links: [],
  filters: [],
  order_by: [{ variable_id: variable(40), direction: 'asc' }],
  no_match: 'error',
  multiple_rows: 'error',
  exists: null,
  outputs: [{ variable_id: variable(41), name: 'fator' }],
};

const PONTUACAO: DefinitionNode = {
  id: 'grp_pontuacao',
  type: 'group',
  name: 'Pontuação',
  description: null,
  position: { x: 240, y: 0 },
  collapsed: false,
  nodes: [
    {
      id: 'calc_pontos',
      type: 'calculation',
      name: 'Pontos',
      description: null,
      position: { x: 0, y: 0 },
      expression: 'ARRED(valor_item * fator, 2)',
      output: { name: 'pontos', type: 'decimal', scale: 2 },
      rounding_mode: null,
      error_policy: null,
      default_value: null,
    },
  ],
  outputs: ['pontos'],
};

function symbol(name: string, type: Schemas['DataType'], origin: Schemas['SymbolOrigin'], nodeId: string | null, scale: number | null = null): Schemas['Symbol'] {
  return { name, type, scale, cardinality: 'linear', list: null, origin, node_id: nodeId, group_id: null };
}

/** The draft of the reference campaign: batch source of the invoice items, three Fonte blocks and the "Pontuação" group. */
export const DRAFT: Schemas['Draft'] = {
  workflow_id: WORKFLOW_ID,
  revision: 3,
  definition: {
    schema_version: 2,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
    root: {
      batch_source: {
        dataset_id: DATASET_ITENS,
        key: ['nf_id', 'item_seq'],
        filters: [],
        order_by: [{ variable: 'data_emissao', direction: 'asc' }],
        outputs: [
          { variable_id: variable(1), name: 'nf_id' },
          { variable_id: variable(2), name: 'item_seq' },
          { variable_id: variable(3), name: 'cod_prod' },
          { variable_id: variable(4), name: 'valor_item' },
          { variable_id: variable(5), name: 'data_emissao' },
        ],
      },
      inputs: [],
      nodes: [PRODUTOS, CAMPANHA, FATORES, PONTUACAO],
      output: { fields: [{ name: 'pontos_item', variable: 'pontos' }] },
    },
  },
  problems: [],
  symbols: [
    symbol('nf_id', 'integer', 'batch_source', null),
    symbol('item_seq', 'integer', 'batch_source', null),
    symbol('cod_prod', 'text', 'batch_source', null),
    symbol('valor_item', 'decimal', 'batch_source', null, 2),
    symbol('data_emissao', 'date', 'batch_source', null),
    symbol('categoria', 'text', 'source', 'produto'),
    symbol('fator', 'decimal', 'source', 'fatores', 4),
    symbol('pontos', 'decimal', 'calculation', 'calc_pontos', 2),
  ],
  dependencies: [{ node_id: 'calc_pontos', reads: ['fator', 'valor_item'] }],
  order: ['produto', 'campanha', 'fatores', 'grp_pontuacao'],
  groups: [{ node_id: 'grp_pontuacao', inputs: ['fator', 'valor_item'], outputs: ['pontos'], order: ['calc_pontos'] }],
  updated_at: '2026-11-18T14:05:00Z',
  updated_by: BRUNO,
};

/** The same draft without the batch source (declared inputs, as in epic 4). */
export const DRAFT_WITHOUT_BATCH_SOURCE: Schemas['Draft'] = {
  ...DRAFT,
  definition: { ...DRAFT.definition, root: { ...DRAFT.definition.root, batch_source: null } },
};

export const PROBLEM: Schemas['WorkflowProblem'] = {
  code: 'type_mismatch',
  message: 'Esperava um número, mas categoria é um texto.',
  path: 'root.nodes[3].nodes[0].expression',
  node_id: 'calc_pontos',
  start: 6,
  end: 15,
  suggestion: null,
};

/** The preview of the draft: counts per Fonte block and the example records per group (the root first). */
export const PREVIEW: Schemas['Preview'] = {
  counted_records: 500,
  total_known: false,
  sources: [
    {
      node_id: 'produto',
      mode: 'linear',
      found: 480,
      no_match: 12,
      multiple_rows: 8,
      max_rows: 3,
      no_match_keys: [
        { nf_id: '17', item_seq: '2' },
        { nf_id: '23', item_seq: '1' },
      ],
      multiple_rows_keys: [{ nf_id: '12', item_seq: '3' }],
      kept: null,
      filtered: null,
      rows: [{ categoria: 'A' }, { categoria: 'B' }],
    },
    {
      node_id: 'campanha',
      mode: 'filter',
      found: null,
      no_match: null,
      multiple_rows: null,
      max_rows: null,
      no_match_keys: [],
      multiple_rows_keys: [],
      kept: 450,
      filtered: 50,
      rows: [{ cod_prod: 'P-001' }, { cod_prod: 'P-002' }],
    },
    {
      node_id: 'fatores',
      mode: 'linear',
      found: 1480,
      no_match: 0,
      multiple_rows: 0,
      max_rows: 1,
      no_match_keys: [],
      multiple_rows_keys: [],
      kept: null,
      filtered: null,
      rows: [{ fator: '0.1500' }],
    },
  ],
  groups: [
    {
      node_id: null,
      records: [
        {
          record_key: { nf_id: '10', item_seq: '1' },
          status: 'ok',
          inputs: { nf_id: '10', item_seq: '1', cod_prod: 'P-001', valor_item: '1500.00', data_emissao: '2026-10-05' },
          outputs: { pontos_item: '225.00' },
        },
        {
          record_key: { nf_id: '10', item_seq: '2' },
          status: 'filtered',
          inputs: { nf_id: '10', item_seq: '2', cod_prod: 'P-207', valor_item: '80.00', data_emissao: '2026-10-05' },
          outputs: {},
        },
      ],
    },
    {
      node_id: 'grp_pontuacao',
      records: [
        {
          record_key: { nf_id: '10', item_seq: '1' },
          status: 'ok',
          inputs: { fator: '0.1500', valor_item: '1500.00' },
          outputs: { pontos: '225.00' },
        },
      ],
    },
  ],
  error: null,
};

function readError(nodeId: string | null, code: Schemas['FailureCode'], message: string): Schemas['Preview'] {
  return { counted_records: 0, total_known: false, sources: [], groups: [], error: { node_id: nodeId, code, message, values: {} } };
}

/** The read errors of the contract examples (`PreviewSchemaDrift`, `PreviewSourceReadDenied`, `PreviewParameterTableRows`). */
export const SCHEMA_DRIFT = readError(null, 'schema_drift', '`ItensNF.vl_itm` não existe mais na origem.');
export const SOURCE_READ_DENIED = readError(
  'produto',
  'source_read_denied',
  'O usuário da conexão não pode ler o dataset Produtos. Peça a permissão de leitura (SELECT) a quem cuida do banco.',
);
export const PARAMETER_TABLE_ROWS = readError(
  'fatores',
  'parameter_table_rows',
  'A tabela de parâmetros Fatores tem 2 linhas depois dos filtros; ela precisa de exatamente 1.',
);

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
  queues.set(ANALYSIS_ROUTE, [json({ problems: [], symbols: DRAFT.symbols, dependencies: DRAFT.dependencies, order: DRAFT.order, groups: DRAFT.groups })]);
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

/** A test panel beside the tab, as the canvas will be: shows the selection and renames "Produtos" (a pending change). */
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
            root: { ...current.root, nodes: current.root.nodes.map((node) => (node.id === 'produto' ? { ...node, name: 'Produtos do ERP' } : node)) },
          }))
        }
      >
        Renomear Produtos
      </button>
      <button
        type="button"
        onClick={() => change((current) => ({ ...current, root: { ...current.root, nodes: current.root.nodes.filter((node) => node.id !== 'fatores') } }))}
      >
        Remover Fatores
      </button>
    </div>
  );
}

export interface TabScreen {
  user: UserEvent;
  queryClient: QueryClient;
  unmount: () => void;
  /** Mounts the tab again (as the bottom panel does when its tab opens again). */
  remount: () => void;
}

/** Renders the "Prévia" tab inside the draft context, with the API (cookie mode) and the module root. */
export function renderTab(
  { draft = DRAFT, readOnly = false, queryClient = testQueryClient() }: { draft?: Schemas['Draft']; readOnly?: boolean; queryClient?: QueryClient } = {},
): TabScreen {
  const user = userEvent.setup({ delay: null });
  // The editor screen opens only after the session (EditorScreen): the tab never starts without it.
  if (queryClient.getQueryData(['session']) === undefined) queryClient.setQueryData(['session'], session());
  const tree = (key: number) => (
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={readOnly}>
            <EditorProbe />
            <PreviewPanel key={key} />
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>
  );
  let mounts = 0;
  const { unmount, rerender } = render(tree(mounts));
  return { user, queryClient, unmount, remount: () => rerender(tree(++mounts)) };
}
