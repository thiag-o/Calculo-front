// Support for the reference files tests (not a test and not shipped in the package): API simulated per route (fetch), the
// upload simulated (XMLHttpRequest, which reports the progress), data from the contract examples (`ReferenceFile`,
// `ReferenceFileUploaded`, `InvalidReferenceFile`, `ReferenceFileMismatch`), the providers the screen needs and the browser
// features jsdom lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { afterEach, vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { TestCases } from '../TestCases';

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

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
export const WORKFLOW_ID = '4d0e2f3a-8b9c-4d5e-8f1a-2b3c4d5e6f70';

/** The Configurator: sees the workflow, edits the tests and simulates. */
export const CONFIGURATOR_PERMISSIONS = ['workflows.view', 'workflows.edit', 'test_cases.edit', 'simulations.run', 'executions.view'];
/** The Approver: simulates, but does not edit the tests. */
export const APPROVER_PERMISSIONS = ['workflows.view', 'simulations.run', 'executions.view', 'traces.view'];
/** Edits the tests, but does not simulate. */
export const EDITOR_PERMISSIONS = ['workflows.view', 'test_cases.edit'];
/** The Auditor: only sees. */
export const VIEWER_PERMISSIONS = ['workflows.view', 'executions.view'];

export const LIST_ROUTE = `GET /v1/workflows/${WORKFLOW_ID}/reference-files`;
export const DRAFT_ROUTE = `GET /v1/workflows/${WORKFLOW_ID}/draft`;
export const UPLOAD_URL = `${API}/v1/workflows/${WORKFLOW_ID}/reference-files`;

export function deleteRoute(fileId: string) {
  return `DELETE /v1/workflows/${WORKFLOW_ID}/reference-files/${fileId}`;
}

export function simulationRoute(fileId: string) {
  return `POST /v1/workflows/${WORKFLOW_ID}/reference-files/${fileId}/simulations`;
}

export function session(permissions: readonly string[]): Schemas['Session'] {
  const tenant = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
  return {
    user: { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza', email: 'ana@exemplo.com' },
    tenants: [tenant],
    current_tenant: tenant,
    permissions: [...permissions],
  };
}

const ANA = { id: '5e6f7a8b-9c0d-4e1f-8a2b-3c4d5e6f7a8b', name: 'Ana Souza' };

/** Contract example `ReferenceFile`: the October file, already compared at 100%. */
export const COMPARED_FILE: Schemas['ReferenceFile'] = {
  id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a01',
  workflow_id: WORKFLOW_ID,
  name: 'esperado-outubro.csv',
  size_bytes: 152,
  sha256: '6f1e3a5c7b9d2e4f6a8c0b2d4e6f8a1c3e5b7d9f0a2c4e6b8d1f3a5c7e9b0d2f',
  records: 2,
  key_columns: ['nf_id', 'item_seq'],
  field_columns: ['pontos', 'elegivel'],
  has_status: true,
  uploaded_by: ANA,
  uploaded_at: '2026-11-24T15:50:00Z',
  last_comparison: {
    execution_id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c14',
    status: 'completed',
    equal_percent: '100.00',
    finished_at: '2026-11-24T16:10:06Z',
  },
};

/** Contract example `ReferenceFileUploaded`: the November file, just uploaded, without comparison. */
export const NEW_FILE: Schemas['ReferenceFile'] = {
  id: '9e0f1a2b-3c4d-4e5f-8a6b-7c8d9e0f1a02',
  workflow_id: WORKFLOW_ID,
  name: 'esperado-novembro.csv',
  size_bytes: 98,
  sha256: '1a3c5e7b9d0f2a4c6e8b1d3f5a7c9e0b2d4f6a8c1e3b5d7f9a0c2e4b6d8f1a3c',
  records: 2,
  key_columns: ['nf_id', 'item_seq'],
  field_columns: ['pontos'],
  has_status: false,
  uploaded_by: ANA,
  uploaded_at: '2026-11-24T18:10:00Z',
  last_comparison: null,
};

/** The fields of the contract example `InvalidReferenceFile`: three line errors, without the values. */
export const THREE_LINE_ERRORS = {
  'linha 12, coluna pontos': 'Use número com ponto, como 225.00.',
  'linha 15, coluna item_seq': 'Preencha todas as partes da chave do registro.',
  'linha 21, coluna nf_id': 'Chave repetida no arquivo: já apareceu na linha 9.',
};

export const MISMATCH_DETAIL = 'As colunas do arquivo não batem mais com o workflow. Envie o arquivo de novo.';

/** A declared parameter, with the plain defaults (optional, no default, no allowed values). */
export function parameter(
  name: string,
  type: Schemas['ParameterType'],
  extra: Partial<Schemas['WorkflowParameter']> = {},
): Schemas['WorkflowParameter'] {
  return { name, type, required: false, list: false, scale: null, default: null, allowed_values: null, description: null, ...extra };
}

/** A problem of the saved draft. */
export function draftProblem(message = 'meta_minima não existe neste ponto do fluxo.'): Schemas['WorkflowProblem'] {
  return { code: 'unknown_variable', message, path: 'root.nodes[0].formula', node_id: 'pontos', start: null, end: null, suggestion: null };
}

/** The saved draft (`GET /v1/workflows/{id}/draft`) at a revision, with the declared parameters and the problems. */
export function savedDraft(
  revision: number,
  parameters: Schemas['WorkflowParameter'][] = [],
  problems: Schemas['WorkflowProblem'][] = [],
): Schemas['Draft'] {
  return {
    workflow_id: WORKFLOW_ID,
    revision,
    definition: {
      schema_version: 4,
      kind: 'batch',
      settings: {
        error_policy: 'error',
        rounding: { scale: 2, mode: 'half_up' },
        error_limit_percent: '5',
        trace_level: 'standard',
        pre_validation_alert_percent: '1',
      },
      parameters,
      root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } },
    },
    problems,
    symbols: [],
    dependencies: [],
    order: [],
    groups: [],
    updated_at: '2026-11-24T14:00:00Z',
    updated_by: ANA,
  };
}

/** The simulation created (contract example `ExecutionSimulationPending`, in short). */
export function simulation(partial: Partial<Schemas['Execution']> = {}): Schemas['Execution'] {
  return {
    id: '6a7b8c9d-0e1f-4a2b-8c3d-4e5f6a7b8c20',
    workflow_id: WORKFLOW_ID,
    workflow_name: 'Pontuação de exemplo',
    draft_revision: 5,
    workflow_version: null,
    status: 'pending',
    abort_reason: null,
    cancel_requested_at: null,
    parameters: { meta_minima: '100.00' },
    now: '2026-11-24T16:00:00Z',
    trace_level: 'standard',
    error_limit_percent: '5',
    triggered_by: ANA,
    created_at: '2026-11-24T16:00:00Z',
    started_at: null,
    data_read_at: null,
    finished_at: null,
    next_retry_at: null,
    total_records: null,
    progress: { chunks_done: 0, records_done: 0 },
    totals: { read: 0, ok: 0, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
    error_groups: [],
    output: { available: false, expires_at: null, rows: null },
    mode: 'simulation',
    schedule: null,
    pre_validation: null,
    source_counts: [],
    overlap_of: null,
    reference_file: { id: COMPARED_FILE.id, name: COMPARED_FILE.name },
    comparison: null,
    ...partial,
  };
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** The list of reference files. */
export function fileList(items: readonly Schemas['ReferenceFile'][]): Response {
  return json({ items });
}

/** problem+json body of the contract. */
export function problemBody(status: number, code: string, extra: Record<string, unknown> = {}) {
  return { type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, code, ...extra };
}

/** problem+json error of the contract. */
export function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(JSON.stringify(problemBody(status, code, extra)), {
    status,
    headers: { 'Content-Type': 'application/problem+json' },
  });
}

type RouteResponse = Response | Promise<Response> | ((request: Request) => Response | Promise<Response>);

/**
 * fetch simulated per route ("METHOD /path", without the query). Each route has a queue of responses: the last one repeats.
 * A route without a configured response answers 599 (it becomes `unexpected_response` on screen).
 */
export function simulateApi(permissions: readonly string[] = CONFIGURATOR_PERMISSIONS) {
  const queues = new Map<string, RouteResponse[]>();
  const calls: Request[] = [];
  queues.set('GET /v1/session', [json(session(permissions))]);
  const simulatedFetch = vi.fn(async (request: Request) => {
    calls.push(request.clone());
    const url = new URL(request.url);
    const route = `${request.method} ${url.pathname}`;
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
    /** The requests made to a route ("METHOD /path"), in order. */
    callsTo(route: string): Request[] {
      return calls.filter((req) => `${req.method} ${new URL(req.url).pathname}` === route);
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

/** One upload seen by the simulated XMLHttpRequest. The test decides the progress and the answer. */
export class SimulatedUpload {
  method = '';
  url = '';
  headers: Record<string, string> = {};
  withCredentials = false;
  responseType = '';
  status = 0;
  responseText = '';
  body: unknown;
  readonly upload = new EventTarget();
  private readonly events = new EventTarget();

  addEventListener(type: string, listener: EventListener) {
    this.events.addEventListener(type, listener);
  }
  open(method: string, url: string) {
    this.method = method;
    this.url = url;
  }
  setRequestHeader(name: string, value: string) {
    this.headers[name] = value;
  }
  send(body: unknown) {
    this.body = body;
    SimulatedUpload.sent.push(this);
  }
  abort() {
    this.events.dispatchEvent(new Event('abort'));
  }

  /** The file sent in the `file` field. */
  get file(): File | null {
    const value = this.body instanceof FormData ? this.body.get('file') : null;
    return value instanceof File ? value : null;
  }
  /** Part of the body went out. */
  progress(loaded: number, total: number) {
    act(() => {
      this.upload.dispatchEvent(new ProgressEvent('progress', { loaded, total, lengthComputable: true }));
    });
  }
  /** The API answers. */
  respond(status: number, body: unknown) {
    act(() => {
      this.status = status;
      this.responseText = typeof body === 'string' ? body : JSON.stringify(body);
      this.events.dispatchEvent(new Event('load'));
    });
  }

  static sent: SimulatedUpload[] = [];
}

/** Replaces XMLHttpRequest by `SimulatedUpload`; `nth` waits for an upload. */
export function simulateUploads() {
  SimulatedUpload.sent = [];
  vi.stubGlobal('XMLHttpRequest', SimulatedUpload);
  return {
    get sent(): readonly SimulatedUpload[] {
      return SimulatedUpload.sent;
    },
    /** Waits for the `count`-th upload (the mutation starts it asynchronously) and returns it. */
    async nth(count: number): Promise<SimulatedUpload> {
      await waitFor(() => {
        if (SimulatedUpload.sent.length < count) throw new Error(`o envio ${count} não foi feito`);
      });
      return SimulatedUpload.sent[count - 1]!;
    },
  };
}

/** A file with the given name and size (the size is faked: nothing that big is kept in memory). */
export function fileOf(name: string, size = 152, type = 'text/csv'): File {
  const file = new File(['nf_id,item_seq,pontos'], name, { type });
  Object.defineProperty(file, 'size', { value: size });
  return file;
}

/** Drops files on an element, as the browser does when they are dragged from the computer. */
export function dropFiles(target: Element, files: File[]) {
  const dataTransfer = { files, types: ['Files'], dropEffect: 'none' };
  fireEvent.dragEnter(target, { dataTransfer });
  fireEvent.dragOver(target, { dataTransfer });
  fireEvent.drop(target, { dataTransfer });
}

export interface Screen {
  user: UserEvent;
  queryClient: QueryClient;
  onOpenExecution: ReturnType<typeof vi.fn<(id: string) => void>>;
  /** Shows another workflow on the same mounted screen (as the host does when the route changes). */
  showWorkflow: (workflowId: string) => void;
}

/** Renders the Testes screen of the workflow with the API (cookie mode), the product QueryClient and the module root. */
export function renderTestCases(): Screen {
  // No pause between actions: the default piles up when the machine is busy (F43).
  const user = userEvent.setup({ delay: null });
  const queryClient = createQueryClient();
  // Without retrying failed queries: the error tests do not wait for the 3 retries.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  const onOpenExecution = vi.fn<(id: string) => void>();
  const screenOf = (workflowId: string) => (
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <TestCases workflowId={workflowId} onOpenExecution={onOpenExecution} />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>
  );
  const { rerender } = render(screenOf(WORKFLOW_ID));
  return { user, queryClient, onOpenExecution, showWorkflow: (workflowId) => rerender(screenOf(workflowId)) };
}
