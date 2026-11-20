// Support for the canvas and layers tests (not a test and not shipped in the package): the layout React Flow needs in
// jsdom, a draft of the example with its analysis, and the providers the editor panels need.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { DraftEditorProvider, useDraftEditor, type EditorItem, type EditorSelection, type WorkflowDefinition } from '../draft';

// TanStack Query notifies the screen through setTimeout(0); a microtask works with any clock.
notifyManager.setScheduler((callback) => queueMicrotask(callback));

// React Flow measures the nodes (offsetWidth/offsetHeight, ResizeObserver) before showing them and drawing the links;
// jsdom has no layout. Every element measures 200 × 80 and the observer reports right away.
class ImmediateResizeObserver {
  constructor(private readonly callback: ResizeObserverCallback) {}
  observe(target: Element) {
    this.callback([{ target, contentRect: target.getBoundingClientRect() } as ResizeObserverEntry], this as unknown as ResizeObserver);
  }
  unobserve() {}
  disconnect() {}
}
globalThis.ResizeObserver = ImmediateResizeObserver as unknown as typeof ResizeObserver;

class Matrix {
  m22: number;
  constructor(transform?: string) {
    const scale = transform?.match(/scale\(([\d.]+)\)/)?.[1];
    this.m22 = scale === undefined ? 1 : Number(scale);
  }
}
(globalThis as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly ??= Matrix;
Object.defineProperties(HTMLElement.prototype, {
  offsetWidth: { configurable: true, get: () => 200 },
  offsetHeight: { configurable: true, get: () => 80 },
});
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
(SVGElement.prototype as SVGElement & { getBBox?: () => DOMRect }).getBBox ??= () => ({ x: 0, y: 0, width: 0, height: 0 }) as DOMRect;
// React Flow drags with d3-drag, which follows the pointer through `event.view` (the window, in a browser). The events
// of user-event and fireEvent come with `view` null in jsdom.
const view = Object.getOwnPropertyDescriptor(UIEvent.prototype, 'view');
Object.defineProperty(UIEvent.prototype, 'view', {
  configurable: true,
  get(this: UIEvent) {
    return (view?.get?.call(this) as Window | null | undefined) ?? document.defaultView;
  },
});

export const API = 'https://api.teste';
export const WORKFLOW_ID = '3c9d1e2f-7a8b-4c5d-9e0f-1a2b3c4d5e6f';
const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };

/**
 * The "Pontuação" example: three inputs (one multiple, with a field), a Decision Table that reads `categoria`, a
 * Calculation that reads its `fator` and `valor_item`, another that adds up the list field, and the output `pontos`.
 */
export function exampleDefinition(): WorkflowDefinition {
  return {
    schema_version: 1,
    kind: 'batch',
    settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
    root: {
      inputs: [
        { name: 'valor_item', cardinality: 'linear', type: 'decimal', scale: 2 },
        { name: 'categoria', cardinality: 'linear', type: 'text' },
        { name: 'compras', cardinality: 'multiple', fields: [{ name: 'valor_compra', type: 'decimal', scale: 2 }] },
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
        {
          id: 'calc_total',
          type: 'calculation',
          name: 'Total de compras',
          description: null,
          position: { x: 240, y: 160 },
          expression: 'SOMA(valor_compra[])',
          output: { name: 'total_compras', type: 'decimal', scale: 2 },
          rounding_mode: null,
          error_policy: null,
          default_value: null,
        },
      ],
      output: { fields: [{ name: 'pontos', variable: 'pontos' }] },
    },
  };
}

/** The symbols and dependencies the analysis gives to the example. */
export const EXAMPLE_SYMBOLS: Schemas['Symbol'][] = [
  { name: 'valor_item', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'input', node_id: null },
  { name: 'categoria', type: 'text', scale: null, cardinality: 'linear', list: null, origin: 'input', node_id: null },
  { name: 'compras', type: null, scale: null, cardinality: 'multiple', list: null, origin: 'input', node_id: null },
  { name: 'valor_compra', type: 'decimal', scale: 2, cardinality: 'multiple', list: 'compras', origin: 'input', node_id: null },
  { name: 'fator', type: 'decimal', scale: 4, cardinality: 'linear', list: null, origin: 'decision_table', node_id: 'td_elegibilidade' },
  { name: 'pontos', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_pontos' },
  { name: 'total_compras', type: 'decimal', scale: 2, cardinality: 'linear', list: null, origin: 'calculation', node_id: 'calc_total' },
];

export const EXAMPLE_DEPENDENCIES: Schemas['Dependency'][] = [
  { node_id: 'td_elegibilidade', reads: ['categoria'] },
  { node_id: 'calc_pontos', reads: ['fator', 'valor_item'] },
  { node_id: 'calc_total', reads: ['valor_compra'] },
];

/** A problem of the "Pontos" formula (the contract example `AnalysisTypeMismatch`). */
export const TYPE_MISMATCH: Schemas['WorkflowProblem'] = {
  code: 'type_mismatch',
  message: 'categoria é texto e não entra em conta.',
  path: 'root.nodes[1].expression',
  node_id: 'calc_pontos',
  start: 6,
  end: 15,
  suggestion: null,
};

export function exampleDraft(changes: Partial<Schemas['Draft']> = {}): Schemas['Draft'] {
  return {
    workflow_id: WORKFLOW_ID,
    revision: 3,
    definition: exampleDefinition(),
    problems: [],
    symbols: EXAMPLE_SYMBOLS,
    dependencies: EXAMPLE_DEPENDENCIES,
    order: ['td_elegibilidade', 'calc_pontos', 'calc_total'],
    updated_at: '2026-11-18T14:05:00Z',
    updated_by: BRUNO,
    ...changes,
  };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The draft being edited, as the panels see it (read after each render). */
export interface Probe {
  definition: WorkflowDefinition;
  selection: EditorSelection;
  select: (item: EditorItem, field?: string | null) => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
}

function ProbePanel({ probe }: { probe: Probe }) {
  const editor = useDraftEditor();
  probe.definition = editor.definition;
  probe.selection = editor.selection;
  probe.select = editor.select;
  probe.undo = editor.undo;
  probe.redo = editor.redo;
  probe.canUndo = editor.canUndo;
  return null;
}

export interface Rendered {
  user: UserEvent;
  probe: Probe;
  unmount: () => void;
  /** Renders again with the editor read-only (or not), as when the permission is lost while the screen is open. */
  setReadOnly: (readOnly: boolean) => void;
}

export interface RenderOptions {
  draft?: Schemas['Draft'];
  readOnly?: boolean;
  /** Every analysis of a change fails (500), as when the API is down. */
  failAnalysis?: boolean;
}

/**
 * Renders the panels inside the draft context and an editor-like frame (`.fc-editor` with the Propriedades panel, which
 * has one field). The analysis answers with the draft's problems, symbols and dependencies; the save with the draft.
 */
export function renderWithDraft(panels: ReactNode, { draft = exampleDraft(), readOnly = false, failAnalysis = false }: RenderOptions = {}): Rendered {
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const { pathname } = new URL(request.url);
      if (request.method === 'POST' && pathname.endsWith('/draft/analysis')) {
        if (failAnalysis) return json({ type: 'about:blank', title: 'Erro interno', status: 500, code: 'internal_error' }, 500);
        return json({ problems: draft.problems, symbols: draft.symbols, dependencies: draft.dependencies, order: draft.order });
      }
      if (request.method === 'PUT' && pathname.endsWith('/draft')) return json({ ...draft, revision: draft.revision + 1 });
      return new Response('rota não simulada', { status: 599 });
    }),
  );
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const probe: Probe = {
    definition: draft.definition,
    selection: { item: { type: 'workflow' }, field: null },
    select: () => {},
    undo: () => {},
    redo: () => {},
    canUndo: false,
  };
  const user = userEvent.setup({ delay: null });
  const tree = (readOnly: boolean) => (
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={readOnly}>
            <ProbePanel probe={probe} />
            <section className="fc-editor" aria-label="Editor">
              {panels}
              <aside className="fc-editor-properties" aria-label="Propriedades">
                <label>
                  Nome do item
                  <input />
                </label>
              </aside>
            </section>
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>
  );
  const { unmount, rerender } = render(tree(readOnly));
  return { user, probe, unmount, setReadOnly: (value) => rerender(tree(value)) };
}

export function blockOf(definition: WorkflowDefinition, id: string) {
  return definition.root.nodes.find((node) => node.id === id);
}
