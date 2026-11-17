// Support for the datasets screens tests (not a test and not shipped in the package): API simulated per route, data from
// the contract, the providers the screens need and the browser features jsdom lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import type { ReactElement } from 'react';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider, type Schemas } from '../../api';
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

/** Everything the Integrator has in the catalog. */
export const ALL_PERMISSIONS = ['connections.view', 'connections.manage', 'credentials.manage', 'datasets.manage', 'free_sql.use', 'variables.manage'];
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

export const POSTGRES: Schemas['Connection'] = {
  id: '40000000-0000-0000-0000-000000000001',
  name: 'Postgres de exemplo',
  type: 'postgres',
  created_at: '2026-11-10T12:00:00Z',
  updated_at: '2026-11-10T12:00:00Z',
  last_test: null,
  target: null,
};
export const SQL_SERVER: Schemas['Connection'] = {
  ...POSTGRES,
  id: '40000000-0000-0000-0000-000000000002',
  name: 'ERP SQL Server',
  type: 'sqlserver',
};

export const EXCEL_FILE: Schemas['ExcelFile'] = {
  id: '50000000-0000-0000-0000-000000000001',
  file_name: 'metas-2026.xlsx',
  size_bytes: 20480,
  sha256: 'a'.repeat(64),
  uploaded_at: '2026-11-12T10:00:00Z',
  sheets: [],
};

export const ITEM_COLUMNS: Schemas['Column'][] = [
  { name: 'nf_id', source_type: 'integer', type: 'integer', scale: null, nullable: false },
  { name: 'vl_itm', source_type: 'numeric(12,2)', type: 'decimal', scale: 2, nullable: true },
  { name: 'busca', source_type: 'tsvector', type: null, scale: null, nullable: true },
];

export const TABLE_DATASET: Schemas['Dataset'] = {
  id: '60000000-0000-0000-0000-000000000001',
  name: 'Itens de nota fiscal',
  type: 'table',
  connection_id: POSTGRES.id,
  schema_name: 'public',
  object_name: 'itens_nf',
  sql: null,
  excel_file_id: null,
  sheet: null,
  columns: ITEM_COLUMNS,
  columns_refreshed_at: '2026-11-14T12:05:00Z',
};
export const SQL_DATASET: Schemas['Dataset'] = {
  id: '60000000-0000-0000-0000-000000000002',
  name: 'Campanhas ativas',
  type: 'sql',
  connection_id: SQL_SERVER.id,
  schema_name: null,
  object_name: null,
  sql: 'SELECT id, nome FROM campanhas WHERE ativa = 1',
  excel_file_id: null,
  sheet: null,
  columns: [{ name: 'id', source_type: 'int', type: 'integer', scale: null, nullable: false }],
  columns_refreshed_at: '2026-11-15T09:00:00Z',
};
export const EXCEL_DATASET: Schemas['Dataset'] = {
  id: '60000000-0000-0000-0000-000000000003',
  name: 'Metas por vendedor',
  type: 'excel',
  connection_id: null,
  schema_name: null,
  object_name: null,
  sql: null,
  excel_file_id: EXCEL_FILE.id,
  sheet: 'Vendas',
  columns: [],
  columns_refreshed_at: '2026-11-16T08:30:00Z',
};

export function object(name: string, type: 'table' | 'view' = 'table', schemaName = 'public'): Schemas['DatabaseObject'] {
  return { schema_name: schemaName, name, type };
}

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

type RouteResponse = Response | Promise<Response> | ((request: Request) => Response | Promise<Response>);

/**
 * fetch simulated per route ("METHOD /path", without the query). Each route has a queue of responses: the last one repeats.
 * A route without a configured response answers 599 (it becomes `unexpected_response` on screen). `GET /v1/session`
 * starts with every catalog permission.
 */
export function simulateApi(permissions: readonly string[] = ALL_PERMISSIONS) {
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

export interface Screen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders a screen with the API (cookie mode), the product QueryClient and the module root. */
export function renderScreen(screenElement: ReactElement): Screen {
  const user = userEvent.setup();
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

export function setCsrfCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}

/** A variable over `vl_itm` of the table dataset. */
export const ITEM_VALUE_VARIABLE: Schemas['Variable'] = {
  id: '70000000-0000-0000-0000-000000000001',
  dataset_id: TABLE_DATASET.id,
  column: 'vl_itm',
  name: 'valor_item',
  type: 'decimal',
  scale: 2,
};
