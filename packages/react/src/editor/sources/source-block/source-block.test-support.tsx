// Support for the Source block tests (not a test and not shipped in the package): a draft with the batch source, a Linear
// and a Filtro block, the catalog and the editor simulated per route, and a probe that shows the definition being edited.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../../api';
import { FluxoRoot } from '../../../design-system';
import { DraftEditorProvider, useDraftEditor, type WorkflowDefinition } from '../../draft';
import { SourceBlockProperties } from './SourceBlockProperties';
import { findSourceNode, type SourceNode } from './sourceNode';

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
const WORKFLOW_ID = '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f';
const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };

export const ITENS = '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01';
export const PRODUTOS = '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02';
export const CAMPANHA = '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c03';
export const PRODUTOS_2024 = '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c04';
export const SEM_VARIAVEIS = '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c05';

function variable(id: string, dataset: string, name: string, type: Schemas['DataType'], scale: number | null = null): Schemas['Variable'] {
  return { id, dataset_id: dataset, column: name.toUpperCase(), name, type, scale };
}

/** The variables of each dataset of the catalog. */
export const VARIABLES: Record<string, Schemas['Variable'][]> = {
  [PRODUTOS]: [
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e11', PRODUTOS, 'codigo', 'text'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e12', PRODUTOS, 'vigencia_inicio', 'date'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e13', PRODUTOS, 'categoria', 'text'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e14', PRODUTOS, 'preco', 'decimal', 2),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e15', PRODUTOS, 'ativo', 'boolean'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e16', PRODUTOS, 'estoque', 'integer'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e17', PRODUTOS, 'atualizado_em', 'datetime'),
  ],
  [CAMPANHA]: [
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e21', CAMPANHA, 'cod_prod', 'text'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e22', CAMPANHA, 'ativo', 'boolean'),
  ],
  [PRODUTOS_2024]: [
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e31', PRODUTOS_2024, 'codigo', 'text'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e33', PRODUTOS_2024, 'categoria', 'text'),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e34', PRODUTOS_2024, 'margem', 'decimal', 4),
    // Namesakes of another type or places: they do not take the place of the ones of Produtos.
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e35', PRODUTOS_2024, 'preco', 'decimal', 4),
    variable('9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e36', PRODUTOS_2024, 'estoque', 'text'),
  ],
  [SEM_VARIAVEIS]: [],
};

/** The id of a variable of `dataset` by its name. */
export function variableId(dataset: string, name: string): string {
  const found = VARIABLES[dataset]?.find((item) => item.name === name);
  if (!found) throw new Error(`sem a variável ${name}`);
  return found.id;
}

function dataset(id: string, name: string, type: Schemas['Dataset']['type']): Schemas['Dataset'] {
  return {
    id,
    name,
    type,
    connection_id: type === 'excel' ? null : 'c0a1b2c3-d4e5-4f60-8a7b-9c0d1e2f3a4b',
    schema_name: type === 'table' ? 'public' : null,
    object_name: type === 'table' ? name.toLowerCase() : null,
    sql: type === 'sql' ? 'SELECT 1' : null,
    excel_file_id: type === 'excel' ? 'e0a1b2c3-d4e5-4f60-8a7b-9c0d1e2f3a4b' : null,
    sheet: type === 'excel' ? 'Plan1' : null,
    columns: [],
    columns_refreshed_at: '2026-11-18T10:00:00Z',
  };
}

export const DATASETS: Schemas['Dataset'][] = [
  dataset(ITENS, 'Itens NF', 'table'),
  dataset(PRODUTOS, 'Produtos', 'table'),
  dataset(CAMPANHA, 'Produtos da campanha', 'sql'),
  dataset(PRODUTOS_2024, 'Produtos 2024', 'excel'),
  dataset(SEM_VARIAVEIS, 'Sem variáveis', 'sql'),
];

function symbol(
  name: string,
  type: Schemas['DataType'],
  origin: Schemas['SymbolOrigin'],
  nodeId: string | null = null,
  groupId: string | null = null,
): Schemas['Symbol'] {
  return { name, type, scale: type === 'decimal' ? 2 : null, cardinality: 'linear', list: null, origin, node_id: nodeId, group_id: groupId };
}

/** The Linear "Produto": linked by `cod_prod`, ordered by the start of validity (newest first), bringing `categoria`. */
export function produto(changes: Partial<SourceNode> = {}): SourceNode {
  return {
    id: 'produto',
    type: 'source',
    name: 'Produto',
    description: null,
    position: { x: 0, y: 0 },
    mode: 'linear',
    dataset_id: PRODUTOS,
    links: [{ variable: 'cod_prod', column_variable_id: variableId(PRODUTOS, 'codigo') }],
    filters: [],
    order_by: [{ variable_id: variableId(PRODUTOS, 'vigencia_inicio'), direction: 'desc' }],
    no_match: 'error',
    multiple_rows: 'error',
    exists: null,
    outputs: [{ variable_id: variableId(PRODUTOS, 'categoria'), name: 'categoria' }],
    ...changes,
  };
}

/** The Filtro "Produtos da campanha", as the API sends it (without the fields only a Linear has). */
export function campanha(): SourceNode {
  const node: SourceNode = {
    id: 'campanha',
    type: 'source',
    name: 'Produtos da campanha',
    description: null,
    position: { x: 0, y: 160 },
    mode: 'filter',
    dataset_id: CAMPANHA,
    links: [{ variable: 'cod_prod', column_variable_id: variableId(CAMPANHA, 'cod_prod') }],
    filters: [{ variable_id: variableId(CAMPANHA, 'ativo'), operator: '=', values: ['verdadeiro'] }],
    exists: true,
    no_match: 'error',
    multiple_rows: 'error',
  };
  // The contract has no `no_match` nor `multiple_rows` in a Filtro; the generated type asks for them (they have a default).
  Reflect.deleteProperty(node, 'no_match');
  Reflect.deleteProperty(node, 'multiple_rows');
  return node;
}

/** A draft (schema v2) with the batch source, the Linear "Produto", the Filtro "Produtos da campanha" and a Calculation. */
export function sourceDraft(nodes: SourceNode[] = [produto(), campanha()], changes: Partial<Schemas['Draft']> = {}): Schemas['Draft'] {
  return {
    workflow_id: WORKFLOW_ID,
    revision: 3,
    definition: {
      schema_version: 2,
      kind: 'batch',
      settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
      root: {
        batch_source: {
          dataset_id: ITENS,
          key: ['nf_id'],
          filters: [],
          order_by: [{ variable: 'nf_id', direction: 'asc' }],
          outputs: [
            { variable_id: 'a0a1b2c3-d4e5-4f60-8a7b-9c0d1e2f3a41', name: 'nf_id' },
            { variable_id: 'a0a1b2c3-d4e5-4f60-8a7b-9c0d1e2f3a42', name: 'cod_prod' },
            { variable_id: 'a0a1b2c3-d4e5-4f60-8a7b-9c0d1e2f3a43', name: 'loja_id' },
            { variable_id: 'a0a1b2c3-d4e5-4f60-8a7b-9c0d1e2f3a44', name: 'valor_item' },
          ],
        },
        inputs: [],
        nodes: [
          ...nodes,
          {
            id: 'calc_pontos',
            type: 'calculation',
            name: 'Pontos',
            description: null,
            position: { x: 240, y: 0 },
            expression: 'valor_item * 0.1',
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
      symbol('nf_id', 'text', 'batch_source'),
      symbol('cod_prod', 'text', 'batch_source'),
      symbol('loja_id', 'integer', 'batch_source'),
      symbol('valor_item', 'decimal', 'batch_source'),
      symbol('categoria', 'text', 'source', 'produto'),
      symbol('pontos', 'decimal', 'calculation', 'calc_pontos'),
      symbol('meta', 'decimal', 'source', 'fonte_meta', 'grp_metas'),
    ],
    dependencies: [],
    order: ['produto', 'campanha', 'calc_pontos'],
    groups: [],
    updated_at: '2026-11-21T10:15:00Z',
    updated_by: BRUNO,
    ...changes,
  };
}

/** A problem of the contract, at `path`. */
export function problem(code: Schemas['ProblemCode'], message: string, path: string | null, nodeId: string | null = null): Schemas['WorkflowProblem'] {
  return { code, message, path, node_id: nodeId, start: null, end: null, suggestion: null };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

function problemResponse(status: number, code: string): Response {
  return new Response(JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: 'Erro.', code }), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

export interface CatalogSimulation {
  /** `GET /v1/datasets`: the list, `'error'` (500) or `'pending'` (never answers). */
  datasets?: Schemas['Dataset'][] | 'error' | 'pending';
  /** `GET /v1/datasets/{id}/variables` of each dataset: the list, `'error'` or `'pending'`. */
  variables?: Record<string, Schemas['Variable'][] | 'error' | 'pending'>;
}

/** The catalog and the editor's analysis and save (the analysis answers no problems). */
export function simulateApi({ datasets = DATASETS, variables = VARIABLES }: CatalogSimulation = {}) {
  const simulatedFetch = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    if (route === 'GET /v1/datasets') {
      if (datasets === 'pending') return new Promise<Response>(() => {});
      return datasets === 'error' ? problemResponse(500, 'internal_error') : json({ items: datasets });
    }
    const match = /^GET \/v1\/datasets\/([^/]+)\/variables$/.exec(route);
    if (match) {
      const items = variables[match[1]!];
      if (items === 'pending') return new Promise<Response>(() => {});
      if (items === undefined) return problemResponse(404, 'not_found');
      return items === 'error' ? problemResponse(500, 'internal_error') : json({ items });
    }
    if (route.endsWith('/draft/analysis')) return json({ problems: [], symbols: [], dependencies: [], order: [], groups: [] });
    if (request.method === 'PUT' && route.endsWith('/draft')) {
      const body = JSON.parse(await request.clone().text());
      return json({ ...sourceDraft(), revision: body.revision + 1, definition: body.definition });
    }
    return new Response(`rota não simulada: ${route}`, { status: 599 });
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return simulatedFetch;
}

/** Shows the definition being edited and the Source block `id` in it. */
function Probe({ id }: { id: string }) {
  const { definition, undo } = useDraftEditor();
  const node = findSourceNode(definition, id);
  return (
    <>
      <output aria-label="Definição">{JSON.stringify(definition)}</output>
      <button type="button" onClick={undo}>
        Desfazer
      </button>
      {node ? <SourceBlockProperties key={node.id} node={node} /> : null}
    </>
  );
}

export interface RenderOptions {
  draft?: Schemas['Draft'];
  readOnly?: boolean;
  /** The Source block shown. Default: `produto`. */
  id?: string;
}

/** Renders the properties of a Source block over the draft, with the editor's providers. */
export function renderSource({ draft = sourceDraft(), readOnly = false, id = 'produto' }: RenderOptions = {}): { user: UserEvent } {
  // No pause between actions: the default piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={readOnly}>
            <Probe id={id} />
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user };
}

/** The definition on screen (the probe's). */
export function currentDefinition(): WorkflowDefinition {
  // By the label and not by the role: while a dialog is open, the rest of the module is hidden from assistive technology.
  const probe = document.querySelector('output[aria-label="Definição"]');
  if (!probe) throw new Error('sem a definição na tela');
  return JSON.parse(probe.textContent ?? '{}') as WorkflowDefinition;
}

/** The Source block `id` of the definition on screen. */
export function currentSource(id = 'produto'): SourceNode {
  const node = findSourceNode(currentDefinition(), id);
  if (!node) throw new Error(`sem o bloco Fonte ${id}`);
  return node;
}

/** The accessible name of a field: its label, and what it belongs to in parentheses. */
export function scoped(label: string, scope?: string): RegExp | string {
  return scope ? `${label} (${scope})` : new RegExp(`^${label.replace(/[()]/g, '\\$&')}( \\(.+\\))?$`);
}

/** Opens the select `name` and picks `option`. */
export async function choose(user: UserEvent, name: RegExp | string, option: string | RegExp) {
  await user.click(screen.getByRole('combobox', { name }));
  await user.click(await screen.findByRole('option', { name: option }));
}
