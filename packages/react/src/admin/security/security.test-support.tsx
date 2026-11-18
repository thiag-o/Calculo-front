// Support for the security screen tests (not a test and not shipped in the package): API simulated per route, data from the
// contract, the providers the screen needs and the browser features jsdom lacks (used by Radix).
import '@testing-library/jest-dom/vitest';
import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { render } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { vi } from 'vitest';
import { createQueryClient, ApiProvider, type Schemas } from '../../api';
import { FluxoRoot } from '../../design-system';
import { Security } from '.';

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

/** Tenant that never changed the parameters: the contract defaults (G4), with the bounds of the GET table. */
export const DEFAULTS: Schemas['SecuritySettings'] = {
  inactivity_minutes: { value: 480, default: 480, min: 15, max: 1440 },
  max_duration_days: { value: 7, default: 7, min: 1, max: 30 },
  min_password_length: { value: 12, default: 12, min: 8, max: 64 },
  link_validity_hours: { value: 24, default: 24, min: 1, max: 72 },
  token_validity_minutes: { value: 15, default: 15, min: 5, max: 60 },
};

/** Tenant that already changed two parameters. */
export const ADJUSTED: Schemas['SecuritySettings'] = {
  ...DEFAULTS,
  inactivity_minutes: { ...DEFAULTS.inactivity_minutes, value: 60 },
  min_password_length: { ...DEFAULTS.min_password_length, value: 16 },
};

/** The settings with other values in force (the rest the same). */
export function withValues(
  base: Schemas['SecuritySettings'],
  values: Partial<Record<keyof Schemas['SecuritySettings'], number>>,
): Schemas['SecuritySettings'] {
  const result = { ...base };
  for (const [field, value] of Object.entries(values) as [keyof Schemas['SecuritySettings'], number][]) {
    result[field] = { ...base[field], value: value };
  }
  return result;
}

export function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

/** problem+json error of the contract. */
export function problem(status: number, code: string, extra: Record<string, unknown> = {}): Response {
  return new Response(
    JSON.stringify({ type: 'about:blank', title: 'Erro', status, detail: `Texto do servidor para ${code}.`, code: code, ...extra }),
    { status, headers: { 'Content-Type': 'application/problem+json' } },
  );
}

type RouteResponse = Response | Promise<Response> | ((request: Request) => Response | Promise<Response>);

/**
 * fetch simulated per route ("METHOD /path"). Each route has a queue of responses: the last one repeats.
 * A route without a configured response answers 599 (it becomes `unexpected_response` on screen).
 */
export function simulateApi() {
  const queues = new Map<string, RouteResponse[]>();
  const calls: Request[] = [];
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

export interface SecurityScreen {
  user: UserEvent;
  queryClient: QueryClient;
}

/** Renders the screen with the API (cookie mode), the product QueryClient and the module root. */
export function renderSecurity(): SecurityScreen {
  const user = userEvent.setup({ delay: null }); // no pause between actions: the default piles up on a busy machine (F43)
  const queryClient = createQueryClient();
  // Without retrying failed queries: the error tests do not wait for the 3 retries.
  queryClient.setDefaultOptions({ queries: { retry: false }, mutations: { retry: false } });
  render(
    <FluxoRoot theme="light">
      <ApiProvider apiUrl={API}>
        <QueryClientProvider client={queryClient}>
          <Security />
        </QueryClientProvider>
      </ApiProvider>
    </FluxoRoot>,
  );
  return { user, queryClient };
}

export function setCsrfCookie(value: string) {
  document.cookie = `fc_csrf=${value}; path=/`;
}
