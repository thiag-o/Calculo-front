// Support for the Decision Table tests (not a test and not shipped in the package): a draft with one Decision Table, the
// API simulated for the analysis and the save, and the providers the editor panels need.
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, notifyManager } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { DraftEditorProvider, useDraftEditor, type EditorItem, type WorkflowDefinition } from '../draft';
import type { DecisionTableNode } from './tableModel';

// TanStack Query notifies the screen through setTimeout(0); a microtask works with any clock.
notifyManager.setScheduler((callback) => queueMicrotask(callback));

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
export const TABLE_ID = 'td_elegibilidade';
const BRUNO = { id: '8a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d', name: 'Bruno Lima' };

/** The Decision Table of the contract example "Pontuação", shortened: two conditions, two results and three rules. */
export function table(changes: Partial<DecisionTableNode> = {}): DecisionTableNode {
  return {
    id: TABLE_ID,
    type: 'decision_table',
    name: 'Elegibilidade',
    description: null,
    position: { x: 0, y: 0 },
    hit_policy: 'first',
    rounding_mode: null,
    error_policy: null,
    conditions: [{ expression: 'categoria' }, { expression: 'meta_atingida' }],
    results: [
      { name: 'elegivel', type: 'boolean', default_value: null },
      { name: 'fator', type: 'decimal', scale: 4, default_value: null },
    ],
    rules: [
      { when: ['"A"', 'verdadeiro'], then: ['verdadeiro', '0.15'] },
      { when: ['"B"', ''], then: ['verdadeiro', '0.10'] },
      { when: ['-', '-'], then: ['falso', '0'] },
    ],
    ...changes,
  };
}

/** `n` rules with distinct cells (for the big table). */
export function manyRules(count: number, columns: { when: number; then: number }): DecisionTableNode['rules'] {
  return Array.from({ length: count }, (_, row) => ({
    when: Array.from({ length: columns.when }, (_, column) => `${row + 1}${column}`),
    then: Array.from({ length: columns.then }, (_, column) => `${row + 1}.${column}`),
  }));
}

export function definitionWith(node: DecisionTableNode, errorPolicy: Schemas['ErrorPolicy'] = 'error'): WorkflowDefinition {
  return {
    schema_version: 1,
    kind: 'batch',
    settings: { error_policy: errorPolicy, rounding: { scale: 2, mode: 'half_up' } },
    root: {
      batch_source: null,
      inputs: [
        { name: 'categoria', cardinality: 'linear', type: 'text' },
        { name: 'meta_atingida', cardinality: 'linear', type: 'boolean' },
      ],
      nodes: [
        {
          id: 'calc_antes',
          type: 'calculation',
          name: 'Antes',
          description: null,
          position: { x: -240, y: 0 },
          expression: '1',
          output: { name: 'resultado_1', type: 'integer' },
          rounding_mode: null,
          error_policy: null,
          default_value: null,
        },
        node,
      ],
      output: { fields: [] },
    },
  };
}

export function draftWith(
  node: DecisionTableNode,
  problems: Schemas['WorkflowProblem'][] = [],
  errorPolicy: Schemas['ErrorPolicy'] = 'error',
): Schemas['Draft'] {
  return {
    workflow_id: WORKFLOW_ID,
    revision: 3,
    definition: definitionWith(node, errorPolicy),
    problems,
    symbols: [],
    dependencies: [],
    order: [],
    groups: [],
    updated_at: '2026-11-18T14:05:00Z',
    updated_by: BRUNO,
  };
}

/** A problem of the table at `rest` (the path after `root.nodes[1]`, where the table is). */
export function problemAt(rest: string, message: string, code: Schemas['WorkflowProblem']['code'] = 'type_mismatch'): Schemas['WorkflowProblem'] {
  return { code, message, path: `root.nodes[1]${rest}`, node_id: TABLE_ID, start: null, end: null, suggestion: null };
}

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The draft being edited, as the panels see it (read after each render). */
export interface Probe {
  definition: WorkflowDefinition;
  table: () => DecisionTableNode;
  select: (item: EditorItem, field?: string | null) => void;
  undo: () => void;
  /** Whether the history has a step to undo. */
  canUndo: boolean;
}

function ProbePanel({ probe }: { probe: Probe }) {
  const editor = useDraftEditor();
  probe.definition = editor.definition;
  probe.select = editor.select;
  probe.undo = editor.undo;
  probe.canUndo = editor.canUndo;
  return null;
}

export interface Rendered {
  user: UserEvent;
  probe: Probe;
  unmount: () => void;
}

/**
 * Renders the panels inside the draft context. The analysis answers with the draft's problems (they stay while the test
 * edits); the save answers with the draft.
 */
export function renderWithDraft(
  panels: ReactNode,
  {
    node = table(),
    problems = [],
    readOnly = false,
    workflowErrorPolicy = 'error',
  }: {
    node?: DecisionTableNode;
    problems?: Schemas['WorkflowProblem'][];
    readOnly?: boolean;
    workflowErrorPolicy?: Schemas['ErrorPolicy'];
  } = {},
): Rendered {
  const draft = draftWith(node, problems, workflowErrorPolicy);
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const { pathname } = new URL(request.url);
      if (request.method === 'POST' && pathname.endsWith('/draft/analysis')) return json({ problems, symbols: [] });
      if (request.method === 'PUT' && pathname.endsWith('/draft')) return json({ ...draft, revision: draft.revision + 1 });
      return new Response('rota não simulada', { status: 599 });
    }),
  );
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const probe: Probe = {
    definition: draft.definition,
    table: () => probe.definition.root.nodes.find((candidate) => candidate.id === TABLE_ID) as DecisionTableNode,
    select: () => {},
    undo: () => {},
    canUndo: false,
  };
  const user = userEvent.setup({ delay: null });
  const { unmount } = render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={readOnly}>
            <ProbePanel probe={probe} />
            {panels}
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, probe, unmount };
}

/** The cells of the table as text, rule by rule (conditions, then results). */
export function cellsOf(node: DecisionTableNode): string[][] {
  return node.rules.map((rule) => [...rule.when, ...rule.then]);
}
