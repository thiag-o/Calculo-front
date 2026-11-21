// Support for the tests of the values on the canvas (not a test and not shipped in the package): the canvas beside the
// "Calcular" tab, as in the editor, on a module QueryClient with a session, and the API simulated (the analysis, the save
// of the draft, which a test may hold, and the unit run).
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../../api';
import { FluxoRoot } from '../../../design-system';
import { DraftEditorProvider, useDraftEditor, type WorkflowDefinition } from '../../draft';
import { UnitRunPanel } from '../../unit-run';
import { session } from '../../unit-run/unit-run.test-support';
// The layout React Flow needs in jsdom (measures, ResizeObserver, pointer capture).
import { API } from '../canvas.test-support';
import { WorkflowCanvas } from '../WorkflowCanvas';

export { session };

function json(body: unknown): Response {
  return new Response(JSON.stringify(body), { headers: { 'Content-Type': 'application/json' } });
}

/** The module's QueryClient with the session (the editor opens only after it). */
export function moduleQueryClient(): QueryClient {
  const queryClient = createQueryClient();
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  queryClient.setQueryData(['session'], session());
  return queryClient;
}

export interface SimulatedApi {
  /** The answer to the next unit runs. */
  answerRuns: (trace: Schemas['UnitRunTrace'] | (() => Promise<Response>)) => void;
  /** Holds the next save of the draft until `release` is called. */
  holdNextSave: () => { release: () => void };
}

/** fetch simulated for the draft: the analysis answers with its data, each save gives the next revision. */
export function simulateApi(draft: Schemas['Draft']): SimulatedApi {
  let revision = draft.revision;
  let run: Schemas['UnitRunTrace'] | (() => Promise<Response>) | null = null;
  let held: Promise<void> | null = null;
  vi.stubGlobal(
    'fetch',
    vi.fn(async (request: Request) => {
      const { pathname } = new URL(request.url);
      if (request.method === 'GET' && pathname === '/v1/session') return json(session());
      if (request.method === 'POST' && pathname.endsWith('/draft/analysis')) {
        const { problems, symbols, dependencies, order, groups } = draft;
        return json({ problems, symbols, dependencies, order, groups });
      }
      if (request.method === 'PUT' && pathname.endsWith('/draft')) {
        const wait = held;
        held = null;
        if (wait) await wait;
        revision += 1;
        const body = (await request.clone().json()) as { definition: WorkflowDefinition };
        return json({ ...draft, definition: body.definition, revision });
      }
      if (request.method === 'POST' && pathname.endsWith('/draft/unit-runs') && run) return typeof run === 'function' ? run() : json(run);
      return new Response('rota não simulada', { status: 599 });
    }),
  );
  return {
    answerRuns: (trace) => {
      run = trace;
    },
    holdNextSave: () => {
      let release = () => {};
      held = new Promise<void>((resolve) => {
        release = resolve;
      });
      return { release };
    },
  };
}

/** The draft as the panels see it. */
export interface Probe {
  definition: WorkflowDefinition;
  undo: () => void;
}

function ProbePanel({ probe }: { probe: Probe }) {
  const editor = useDraftEditor();
  probe.definition = editor.definition;
  probe.undo = editor.undo;
  return null;
}

export interface EditorScreen {
  user: UserEvent;
  probe: Probe;
  unmount: () => void;
}

/** The canvas and the "Calcular" tab inside the draft context, on `queryClient` (opening the editor again reuses it). */
export function renderEditor(draft: Schemas['Draft'], queryClient: QueryClient): EditorScreen {
  const probe: Probe = { definition: draft.definition, undo: () => {} };
  const user = userEvent.setup({ delay: null });
  const { unmount } = render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <DraftEditorProvider draft={draft} readOnly={false}>
            <ProbePanel probe={probe} />
            <section className="fc-editor" aria-label="Editor">
              <WorkflowCanvas />
              <UnitRunPanel />
            </section>
          </DraftEditorProvider>
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, probe, unmount };
}
