// Support for the vertical's tests (not a test and not shipped in the package): API simulated per route, contract responses,
// sample screens and the browser features jsdom lacks (controllable ResizeObserver, pointer capture).
import { vi } from 'vitest';
import type { Session } from '../session';
import type { ScreenDefinition } from './screens';

export const API = 'https://api.teste';

export const HEADQUARTERS_TENANT = { id: '00000000-0000-0000-0000-00000000000a', nome: 'Matriz' };
export const BRANCH_TENANT = { id: '00000000-0000-0000-0000-00000000000b', nome: 'Filial Nordeste e Centro-Oeste' };

export const headquartersSession: Session = {
  usuario: { id: '00000000-0000-0000-0000-000000000001', nome: 'Ana Beatriz Souza', email: 'ana@exemplo.com' },
  tenants: [HEADQUARTERS_TENANT, BRANCH_TENANT],
  tenant_atual: HEADQUARTERS_TENANT,
  permissoes: ['workflows.ver', 'execucoes.ver'],
};

export const branchSession: Session = { ...headquartersSession, tenant_atual: BRANCH_TENANT, permissoes: ['auditoria.ver'] };

export const oneTenantSession: Session = { ...headquartersSession, tenants: [HEADQUARTERS_TENANT] };

// Sessions per initial role (backend/docs/plano.md, initial roles), for the real <FluxoCalculo> screens.
export const ADMIN_PERMISSIONS = [
  'workflows.ver',
  'workflows.editar',
  'execucoes.ver',
  'conexoes.ver',
  'auditoria.ver',
  'traces.ver',
  'usuarios.gerenciar',
  'papeis.gerenciar',
  'integracao.gerenciar',
  'seguranca.gerenciar',
];
export const CONFIGURATOR_PERMISSIONS = [
  'workflows.ver',
  'workflows.editar',
  'testes.editar',
  'versao.enviar_revisao',
  'simulacao.rodar',
  'conexoes.ver',
  'execucoes.ver',
];
export const AUDITOR_PERMISSIONS = ['workflows.ver', 'conexoes.ver', 'execucoes.ver', 'auditoria.ver', 'traces.ver'];

/** Session in the Matriz tenant with the given permissions. */
export function sessionWith(permissions: string[]): Session {
  return { ...headquartersSession, permissoes: permissions };
}

/** Sample screens: one open, one for `workflows.ver` and one for `auditoria.ver`. */
export const testScreens: readonly ScreenDefinition[] = [
  { id: 'home', label: 'Início', path: 'home', icon: null, content: <h1>Tela Início</h1> },
  {
    id: 'workflows',
    label: 'Workflows',
    path: 'workflows',
    icon: null,
    permission: 'workflows.ver',
    content: <h1>Tela Workflows</h1>,
  },
  {
    id: 'audit',
    label: 'Auditoria',
    path: 'audit',
    icon: null,
    permission: 'auditoria.ver',
    content: <h1>Tela Auditoria</h1>,
  },
];

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export function noContent(): Response {
  return new Response(null, { status: 204 });
}

/** problem+json error of the contract. */
export function problem(status: number, code: string): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, codigo: code }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type RouteResponse = Response | Promise<Response>;
type RouteTable = Record<string, RouteResponse | ((request: Request) => RouteResponse)>;

export type SimulatedFetch = ReturnType<typeof vi.fn<(request: Request) => Promise<Response>>>;

/**
 * Replaces the global fetch with a simulated API: each key is "METHOD /path" and applies to all calls, until it is
 * replaced with `set`. An unexpected route answers 404. Undo with `vi.unstubAllGlobals()`.
 */
export function simulateApi(routes: RouteTable) {
  const current: RouteTable = { ...routes };
  const simulatedFetch: SimulatedFetch = vi.fn(async (request: Request) => {
    const routeKey = `${request.method} ${new URL(request.url).pathname}`;
    const response = current[routeKey];
    if (response === undefined) return problem(404, 'nao_encontrado');
    // A Response can only be read once: each call gets a copy.
    const ready = await (typeof response === 'function' ? response(request) : response);
    return ready.clone();
  });
  vi.stubGlobal('fetch', simulatedFetch);
  return {
    simulatedFetch,
    set(newOnes: RouteTable) {
      Object.assign(current, newOnes);
    },
    /** The requests made, as "METHOD /path". */
    calls: () => simulatedFetch.mock.calls.map(([req]) => `${req.method} ${new URL(req.url).pathname}`),
    request(index: number): Request {
      const call = simulatedFetch.mock.calls[index];
      if (!call) throw new Error(`o fetch não foi chamado ${index + 1} vez(es)`);
      return call[0];
    },
  };
}

/** A response that only arrives when the test says so. */
export function pendingResponse() {
  let deliver: (response: Response) => void = () => undefined;
  const promise = new Promise<Response>((resolver) => {
    deliver = resolver;
  });
  return { promise, deliver };
}

// Controllable ResizeObserver: the shell layout measures its own width (estilos.md §15).
let simulatedWidth = 1440;
const observed = new Set<{ target: Element; notify: ResizeObserverCallback; observer: ResizeObserver }>();

class SimulatedResizeObserver implements ResizeObserver {
  #notify: ResizeObserverCallback;
  constructor(notify: ResizeObserverCallback) {
    this.#notify = notify;
  }
  observe(target: Element) {
    const record = { target, notify: this.#notify, observer: this };
    observed.add(record);
    reportWidth(record);
  }
  unobserve(target: Element) {
    for (const record of observed) if (record.observer === this && record.target === target) observed.delete(record);
  }
  disconnect() {
    for (const record of observed) if (record.observer === this) observed.delete(record);
  }
}

function reportWidth(record: { target: Element; notify: ResizeObserverCallback; observer: ResizeObserver }) {
  const input = { target: record.target, contentRect: { width: simulatedWidth, height: 800 } } as ResizeObserverEntry;
  record.notify([input], record.observer);
}

globalThis.ResizeObserver = SimulatedResizeObserver;

/** Changes the width the ResizeObserver reports and notifies the observers. */
export function simulateWidth(width: number) {
  simulatedWidth = width;
  for (const record of [...observed]) reportWidth(record);
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
