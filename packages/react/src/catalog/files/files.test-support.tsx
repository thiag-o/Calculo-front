// Support for the Excel files screens tests (not a test and not shipped in the package): API simulated per route (fetch), the
// upload simulated (XMLHttpRequest, which reports the progress), data from the contract, the providers the screens need and
// the browser features jsdom lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { act, fireEvent, render, waitFor } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { ApiProvider, createQueryClient, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';

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

/** The Integrator: sees the catalog and manages datasets (uploads files). */
export const MANAGER_PERMISSIONS = ['connections.view', 'connections.manage', 'credentials.manage', 'datasets.manage', 'variables.manage'];
/** The Configurator: sees the catalog, but does not manage datasets. */
export const READ_ONLY_PERMISSIONS = ['connections.view', 'workflows.view'];

export function session(permissions: readonly string[]): Schemas['Session'] {
  const tenant = { id: '20000000-0000-0000-0000-000000000001', name: 'Distribuidora Exemplo' };
  return {
    user: { id: '30000000-0000-0000-0000-000000000001', name: 'Ana Integradora', email: 'ana@exemplo.com' },
    tenants: [tenant],
    current_tenant: tenant,
    permissions: [...permissions],
  };
}

export const SALES_SHEET: Schemas['Sheet'] = {
  name: 'Vendas',
  sampled_rows: 1000,
  columns: [
    { name: 'vendedor', source_type: 'str', type: 'text', scale: null, nullable: false },
    { name: 'valor', source_type: 'float', type: 'decimal', scale: 2, nullable: true },
    { name: 'data_venda', source_type: 'datetime', type: 'date', scale: null, nullable: false },
  ],
};
export const GOALS_SHEET: Schemas['Sheet'] = {
  name: 'Metas',
  sampled_rows: 12,
  columns: [
    { name: 'mes', source_type: 'int', type: 'integer', scale: null, nullable: false },
    { name: 'meta', source_type: 'float', type: 'decimal', scale: 2, nullable: false },
  ],
};
export const EMPTY_SHEET: Schemas['Sheet'] = { name: 'Rascunho', sampled_rows: 0, columns: [] };

export const EXCEL_FILE: Schemas['ExcelFile'] = {
  id: '50000000-0000-0000-0000-000000000001',
  file_name: 'metas-2026.xlsx',
  size_bytes: 20480,
  sha256: 'ab'.repeat(32),
  uploaded_at: '2026-11-12T10:00:00Z',
  sheets: [SALES_SHEET, GOALS_SHEET],
};
export const OTHER_FILE: Schemas['ExcelFile'] = {
  id: '50000000-0000-0000-0000-000000000002',
  file_name: 'comissoes-outubro-revisada-pelo-financeiro.xlsx',
  size_bytes: 1_258_291,
  sha256: 'cd'.repeat(32),
  uploaded_at: '2026-11-15T18:30:00Z',
  sheets: [EMPTY_SHEET],
};

export const SHEET_DATASET: Schemas['Dataset'] = {
  id: '60000000-0000-0000-0000-000000000003',
  name: 'Vendas',
  type: 'excel',
  connection_id: null,
  schema_name: null,
  object_name: null,
  sql: null,
  excel_file_id: EXCEL_FILE.id,
  sheet: 'Vendas',
  columns: SALES_SHEET.columns,
  columns_refreshed_at: '2026-11-16T08:30:00Z',
};

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
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
export function simulateApi(permissions: readonly string[] = MANAGER_PERMISSIONS) {
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
      this.responseText = JSON.stringify(body);
      this.events.dispatchEvent(new Event('load'));
    });
  }
  /** No answer (network). */
  fail() {
    act(() => {
      this.events.dispatchEvent(new Event('error'));
    });
  }

  static sent: SimulatedUpload[] = [];
}

/** Replaces XMLHttpRequest by `SimulatedUpload`; `sent` lists the uploads in order. */
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
export function fileOf(name: string, size = 20480, type = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'): File {
  const file = new File(['conteudo'], name, { type });
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
}

/** Renders a screen with the API (cookie mode), the product QueryClient and the module root. */
export function renderScreen(screenElement: ReactElement): Screen {
  const user = userEvent.setup({ delay: null });
  const queryClient = createQueryClient();
  // Without retrying failed queries: the error tests do not wait for the 3 retries.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>{screenElement}</QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}
