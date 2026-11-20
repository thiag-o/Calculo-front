// Support for the properties tests (not a test and not shipped in the package): the draft of the contract example, the
// providers of the editor, the API simulated per route and a probe that shows the definition the panel changed.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useEffect, type ReactNode } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { DraftEditorProvider, useDraftEditor, type DraftEditorValue, type EditorItem, type WorkflowDefinition } from '../draft';
import { PropertiesPanel } from './PropertiesPanel';

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

/** The draft of the contract example, shortened: a linear input, a Múltiplo, a Decision Table, two Calculations and the output. */
export function exampleDraft(changes: Partial<Schemas['Draft']> = {}): Schemas['Draft'] {
  return structuredClone({
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
            results: [{ name: 'fator', type: 'decimal', scale: 4, default_value: null }],
            rules: [{ when: ['"A"'], then: ['0.15'] }],
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
            description: 'Pontos do item na campanha',
            position: { x: 480, y: 0 },
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
      { name: 'pontuacoes', type: null, scale: null, cardinality: 'multiple', list: null, origin: 'input', node_id: null },
      { name: 'valor_compra', type: 'decimal', scale: 2, cardinality: 'multiple', list: 'pontuacoes', origin: 'input', node_id: null },
      { name: 'taxa', type: 'decimal', scale: 4, cardinality: 'multiple', list: 'pontuacoes', origin: 'input', node_id: null },
      { name: 'fator', type: 'decimal', scale: 4, cardinality: 'linear', list: null, origin: 'decision_table', node_id: 'td_elegibilidade' },
      {
        name: 'pontos_historico',
        type: 'decimal',
        scale: 2,
        cardinality: 'linear',
        list: null,
        origin: 'calculation',
        node_id: 'calc_historico',
      },
      { name: 'pontos', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_pontos' },
    ],
    dependencies: [
      { node_id: 'td_elegibilidade', reads: ['categoria'] },
      { node_id: 'calc_historico', reads: ['taxa', 'valor_compra'] },
      { node_id: 'calc_pontos', reads: ['fator', 'valor_item'] },
    ],
    order: ['td_elegibilidade', 'calc_historico', 'calc_pontos'],
    updated_at: '2026-11-18T14:05:00Z',
    updated_by: BRUNO,
    ...changes,
  } satisfies Schemas['Draft']);
}

/** A problem of the contract, at `path`. */
export function problem(code: Schemas['ProblemCode'], message: string, path: string | null, nodeId: string | null = null): Schemas['WorkflowProblem'] {
  return { code, message, path, node_id: nodeId, start: null, end: null, suggestion: null };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/**
 * The API of the editor: the analysis answers `analysis` (no problems by default) and the save answers the next revision.
 * Returns the bodies sent to each route.
 */
export function simulateApi(
  analysis: (definition: WorkflowDefinition) => Schemas['Analysis'] | 'pending' = () => ({ problems: [], symbols: [], dependencies: [], order: [] }),
) {
  const bodies: { route: string; body: { definition: WorkflowDefinition } }[] = [];
  let revision = 3;
  const simulatedFetch = vi.fn(async (request: Request) => {
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
    const body = request.method === 'GET' ? undefined : JSON.parse(await request.clone().text());
    bodies.push({ route, body });
    if (route.endsWith('/draft/analysis')) {
      const result = analysis(body.definition);
      // 'pending': the analysis never comes back.
      return result === 'pending' ? new Promise<Response>(() => {}) : json(result);
    }
    if (request.method === 'PUT' && route.endsWith('/draft')) {
      revision += 1;
      const result = analysis(body.definition);
      return json({ ...exampleDraft(), revision, definition: body.definition, ...(result === 'pending' ? {} : result) });
    }
    return new Response(`rota não simulada: ${route}`, { status: 599 });
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return {
    analysisBodies: () => bodies.filter((call) => call.route.endsWith('/draft/analysis')).map((call) => call.body.definition),
  };
}

/** The editor value of the last render, for the identity checks (`toBe`, ADR 0044). */
let latestEditor: DraftEditorValue | null = null;

/** Shows the definition being edited and selects `item` (and `field`) when it mounts. */
function Probe({ item, field }: { item?: EditorItem; field?: string }) {
  const editor = useDraftEditor();
  latestEditor = editor;
  const { definition, select, undo } = editor;
  useEffect(() => {
    if (item) select(item, field ?? null);
    // Only on mount: the selection afterwards is the panel's.
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
  decisionTable?: Parameters<typeof PropertiesPanel>[0]['decisionTable'];
  extra?: ReactNode;
}

/** Renders the Propriedades panel over the draft, with the editor's providers. */
export function renderPanel({ draft = exampleDraft(), readOnly = false, item, field, decisionTable, extra }: RenderOptions = {}) {
  // No pause between actions: the default piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null });
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const { unmount } = render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={readOnly}>
            <Probe item={item} field={field} />
            <PropertiesPanel decisionTable={decisionTable} />
            {extra}
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, unmount, editor: () => latestEditor! };
}

/** The definition on screen (the probe's). */
export function currentDefinition(): WorkflowDefinition {
  return JSON.parse(screen.getByRole('status', { name: 'Definição' }).textContent ?? '{}') as WorkflowDefinition;
}
