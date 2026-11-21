// Support for the batch source tests (not a test and not shipped in the package): the catalog datasets and variables, a
// draft with and without the batch source, the API simulated per route (catalog, analysis and save) and the editor's
// providers, with a probe that shows the definition being edited.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../../api';
import { FluxoRoot } from '../../../design-system';
import { DraftEditorProvider, useDraftEditor, type EditorItem, type WorkflowDefinition } from '../../draft';

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
const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };

const COLUMNS_READ_AT = '2026-11-18T10:00:00Z';

export const ITEMS_DATASET: Schemas['Dataset'] = {
  id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c01',
  name: 'Itens de nota fiscal',
  type: 'table',
  connection_id: '40000000-0000-0000-0000-000000000001',
  schema_name: 'public',
  object_name: 'itens_nf',
  sql: null,
  excel_file_id: null,
  sheet: null,
  columns: [],
  columns_refreshed_at: COLUMNS_READ_AT,
};
export const SALES_DATASET: Schemas['Dataset'] = {
  ...ITEMS_DATASET,
  id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c02',
  name: 'Vendas do mês',
  type: 'sql',
  schema_name: null,
  object_name: null,
  sql: 'select * from vendas',
};
export const GOALS_DATASET: Schemas['Dataset'] = {
  ...ITEMS_DATASET,
  id: '7b1e4c2a-0d3f-4a5b-8c6d-1e2f3a4b5c03',
  name: 'Metas por loja',
  type: 'excel',
  connection_id: null,
  schema_name: null,
  object_name: null,
  excel_file_id: '50000000-0000-0000-0000-000000000001',
  sheet: 'Metas',
};
export const DATASETS = [ITEMS_DATASET, SALES_DATASET, GOALS_DATASET];

function variable(id: number, column: string, name: string, type: Schemas['DataType'], scale: number | null = null): Schemas['Variable'] {
  return { id: `9d2f5e3b-1a4c-4b6d-9e7f-2a3b4c5d6e0${id}`, dataset_id: ITEMS_DATASET.id, column, name, type, scale };
}

export const NF_ID = variable(1, 'nf_id', 'nf_id', 'integer');
export const ITEM_SEQ = variable(2, 'item_seq', 'item_seq', 'integer');
export const ITEM_VALUE = variable(3, 'vl_itm', 'valor_item', 'decimal', 2);
export const STATUS = variable(4, 'st', 'status', 'text');
export const ISSUED_AT = variable(5, 'dt_emissao', 'data_emissao', 'date');
export const ITEM_VARIABLES = [NF_ID, ITEM_SEQ, ITEM_VALUE, STATUS, ISSUED_AT];

/** The batch source of the contract example: items of an invoice, by invoice and item, ordered by the issue date. */
export function exampleBatchSource(changes: Partial<Schemas['BatchSource']> = {}): Schemas['BatchSource'] {
  return {
    dataset_id: ITEMS_DATASET.id,
    key: ['nf_id', 'item_seq'],
    filters: [{ variable: 'status', operator: '=', values: ['"A"'] }],
    order_by: [{ variable: 'data_emissao', direction: 'asc' }],
    outputs: [
      { variable_id: NF_ID.id, name: 'nf_id' },
      { variable_id: ITEM_SEQ.id, name: 'item_seq' },
      { variable_id: ITEM_VALUE.id, name: 'valor_item' },
      { variable_id: STATUS.id, name: 'status' },
      { variable_id: ISSUED_AT.id, name: 'data_emissao' },
    ],
    ...changes,
  };
}

/** A draft with one Calculation over `valor_item`; with `batchSource`, fed by it, otherwise by two declared inputs. */
export function exampleDraft({
  batchSource = null,
  problems = [],
}: { batchSource?: Schemas['BatchSource'] | null; problems?: Schemas['WorkflowProblem'][] } = {}): Schemas['Draft'] {
  return structuredClone({
    workflow_id: WORKFLOW_ID,
    revision: 3,
    definition: {
      schema_version: batchSource ? 2 : 1,
      kind: 'batch',
      settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
      root: {
        batch_source: batchSource,
        inputs: batchSource
          ? []
          : [
              { name: 'valor_item', cardinality: 'linear', type: 'decimal', scale: 2 },
              { name: 'categoria', cardinality: 'linear', type: 'text' },
            ],
        nodes: [
          {
            id: 'calc_pontos',
            type: 'calculation',
            name: 'Pontos',
            description: null,
            position: { x: 0, y: 0 },
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
    problems,
    symbols: [],
    dependencies: [{ node_id: 'calc_pontos', reads: ['valor_item'] }],
    order: ['calc_pontos'],
    groups: [],
    updated_at: '2026-11-18T14:05:00Z',
    updated_by: BRUNO,
  } satisfies Schemas['Draft']);
}

/** A problem of the contract, at `path`. */
export function problem(code: Schemas['ProblemCode'], message: string, path: string | null): Schemas['WorkflowProblem'] {
  return { code, message, path, node_id: null, start: null, end: null, suggestion: null };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export interface CatalogAnswers {
  /** `GET /v1/datasets`: the list, an error status or `'pending'` (never comes back). */
  datasets?: Schemas['Dataset'][] | number | 'pending';
  /** `GET /v1/datasets/{id}/variables`, by dataset. */
  variables?: Record<string, Schemas['Variable'][] | number>;
}

/** The API: the catalog (`answers`), the analysis (no problems) and the save (the next revision). */
export function simulateApi({ datasets = DATASETS, variables = { [ITEMS_DATASET.id]: ITEM_VARIABLES } }: CatalogAnswers = {}) {
  const requests: string[] = [];
  let revision = 3;
  const simulatedFetch = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    requests.push(route);
    if (route === 'GET /v1/datasets') {
      if (datasets === 'pending') return new Promise<Response>(() => {});
      if (typeof datasets === 'number') return json({ type: 'about:blank', title: 'Erro', status: datasets, detail: 'Falha ao ler o catálogo.', code: 'internal_error' }, datasets);
      return json({ items: datasets });
    }
    const match = /^GET \/v1\/datasets\/([^/]+)\/variables$/.exec(route);
    if (match) {
      const answer = variables[match[1]!] ?? [];
      if (typeof answer === 'number') return json({ type: 'about:blank', title: 'Erro', status: answer, detail: 'Falha ao ler as variáveis.', code: 'internal_error' }, answer);
      return json({ items: answer });
    }
    if (route.endsWith('/draft/analysis')) return json({ problems: [], symbols: [], dependencies: [], order: [], groups: [] });
    if (request.method === 'PUT' && route.endsWith('/draft')) {
      const body = JSON.parse(await request.clone().text()) as { definition: WorkflowDefinition };
      revision += 1;
      return json({ ...exampleDraft(), revision, definition: body.definition, problems: [], symbols: [] });
    }
    return new Response(`rota não simulada: ${route}`, { status: 599 });
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return { requests: () => [...requests] };
}

/** Shows the definition being edited and selects `item` (and `field`) when it mounts. */
function Probe({ item, field }: { item?: EditorItem; field?: string }) {
  const { definition, select, undo } = useDraftEditor();
  useEffect(() => {
    if (item) select(item, field ?? null);
    // Only on mount: the selection afterwards is the panel's.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return (
    <>
      <output aria-label="Definição">{JSON.stringify(definition)}</output>
      <button type="button" onClick={undo}>
        Desfazer
      </button>
    </>
  );
}

export interface RenderOptions {
  draft?: Schemas['Draft'];
  readOnly?: boolean;
  item?: EditorItem;
  field?: string;
}

/** Renders `ui` over the draft, with the editor's providers. */
export function renderWithDraft(ui: ReactNode, { draft = exampleDraft(), readOnly = false, item, field }: RenderOptions = {}) {
  // No pause between actions: the default piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const result = render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={readOnly}>
            <Probe item={item} field={field} />
            {ui}
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, unmount: result.unmount };
}

/** The definition on screen (the probe's). */
export function currentDefinition(): WorkflowDefinition {
  return JSON.parse(screen.getByRole('status', { name: 'Definição' }).textContent ?? '{}') as WorkflowDefinition;
}
