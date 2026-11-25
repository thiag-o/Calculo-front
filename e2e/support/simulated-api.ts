// Simulated API of `simulated` mode (pnpm e2e): intercepts the shell's calls to `/v1/...` with `page.route` and answers
// as the contract says, with the error examples of `contract.ts`. Keeps state like the backend (session, CSRF token,
// sign-in failures per e-mail), so the same tests serve real mode.
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Route } from '@playwright/test';
import { EXAMPLES, type ErrorBody, type Schemas, type Session } from './contract';

type TenantSummary = Schemas['TenantSummary'];

/**
 * The filter of the simulated routes, as a glob (text) and not a function: Playwright checks the glob without going through
 * the test process, and only calls to `/v1/` reach `respond`. With a function, each of the ~40 modules the Vite dev server
 * serves on every page opened went to the test process and back before going on (about 115 round trips in the audit
 * test, measured in F39). `isApiCall` refines the glob: only `/v1/...` and outside the shell origin.
 */
export const API_ROUTES = '**/v1/**';

/** The call is to the API (`/v1/...`) and not to the shell itself. */
export function isApiCall(route: Route, shellOrigin: string): boolean {
  const url = new URL(route.request().url());
  return url.pathname.startsWith('/v1/') && url.origin !== shellOrigin;
}

/** A simulation account: credentials, user and permissions per tenant. */
export interface SimulatedAccount {
  email: string;
  password: string;
  name: string;
  id: string;
  /** Tenant → the user's permissions in it. */
  tenants: ReadonlyArray<{ tenant: TenantSummary; permissions: readonly string[] }>;
}

/** Backend sign-in rules (G4 and D3–D8): 5 consecutive failures lock the e-mail for 15 minutes. */
const ATTEMPTS_UNTIL_LOCK = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;

const CSRF_COOKIE = 'fc_csrf';
const SESSION_COOKIE = 'fc_session';
const CSRF_HEADER = 'x-csrf-token';

interface OpenSession {
  account: SimulatedAccount;
  currentTenantId: string;
  csrf: string;
}

/** Request received by the simulation, for the test to check what the shell sent. */
export interface ReceivedRequest {
  method: string;
  path: string;
  headers: Record<string, string>;
}

function compareName(a: TenantSummary, b: TenantSummary): number {
  return a.name.localeCompare(b.name, 'pt-BR');
}

/**
 * The epic 1 API (`/v1/health`, `/v1/session`, `/v1/session/tenant`), in memory, one per test.
 * A route outside the contract answers 501 and is kept in `unexpected`; the fixture fails the test if there is any.
 */
/** The workflows of the tenant: none (the epic 1 tests do not create any). */
const EMPTY_WORKFLOW_LIST = { items: [], next_cursor: null } satisfies Schemas['WorkflowList'];

export class SimulatedApi {
  readonly received: ReceivedRequest[] = [];
  readonly unexpected: string[] = [];

  private session: OpenSession | null = null;
  /** E-mail (case-insensitive) → instants of the failures since the last success. */
  private readonly failures = new Map<string, number[]>();
  /** E-mail → last tenant used (the new session starts in it). */
  private readonly lastTenant = new Map<string, string>();

  constructor(
    private readonly accounts: readonly SimulatedAccount[],
    private readonly now: () => number = Date.now,
  ) {}

  /** Turns the simulation on for the page: every call to `/v1/...` outside the shell origin lands here. */
  async install(page: Page, shellOrigin: string): Promise<void> {
    const context = page.context();
    await page.route(API_ROUTES, (route) =>
      isApiCall(route, shellOrigin) ? this.respond(route, context, shellOrigin) : route.fallback(),
    );
  }

  private async respond(route: Route, context: BrowserContext, shellOrigin: string): Promise<void> {
    const request = route.request();
    const url = new URL(request.url());
    const method = request.method().toUpperCase();
    const cors = corsHeaders(request, shellOrigin);

    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
          'access-control-allow-headers': 'content-type, x-csrf-token',
        },
      });
      return;
    }

    this.received.push({ method, path: url.pathname, headers: await request.allHeaders() });
    const response = await this.handle(method, url.pathname, request, context);
    await route.fulfill({
      status: response.status,
      headers: { ...cors, ...(response.body === undefined ? {} : { 'content-type': response.contentType }) },
      body: response.body === undefined ? undefined : JSON.stringify(response.body),
    });
  }

  private async handle(method: string, path: string, request: Request, context: BrowserContext): Promise<RouteResponse> {
    const route = `${method} ${path}`;
    switch (route) {
      case 'GET /v1/health':
        return json(200, { status: 'ok' } satisfies Schemas['Health']);
      case 'POST /v1/session':
        return this.signIn(request, context);
      case 'GET /v1/session':
        return this.session ? json(200, this.sessionBody(this.session)) : problem(EXAMPLES.NoSession);
      case 'DELETE /v1/session':
        return this.signOut(request, context);
      case 'PUT /v1/session/tenant':
        return this.switchTenant(request);
      case 'GET /v1/workflows':
        // The Início lists the recent workflows (F57); these tests do not look at them.
        return this.session ? json(200, EMPTY_WORKFLOW_LIST) : problem(EXAMPLES.NoSession);
      case 'GET /v1/notifications':
        // The bell (F130) and the "Próxima execução" of the overview (F131) read these two; the contract's examples serve.
        return this.session ? json(200, EXAMPLES.NotificationList) : problem(EXAMPLES.NoSession);
      case 'GET /v1/schedules':
        return this.session ? json(200, EXAMPLES.ScheduleList) : problem(EXAMPLES.NoSession);
      default:
        this.unexpected.push(route);
        return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, code: 'route_not_simulated' });
    }
  }

  /** `POST /v1/session`: order of the contract's rejections (415/422, lock 423, credentials 401). */
  private async signIn(request: Request, context: BrowserContext): Promise<RouteResponse> {
    if (!isJson(request)) return problem(EXAMPLES.InvalidContentType);
    const body = readJson(request);
    if (body === undefined) return problem(EXAMPLES.InvalidDataMalformedJson);
    const fields: Record<string, string> = {};
    if (typeof body.email !== 'string') fields.email = 'Informe o e-mail.';
    if (typeof body.password !== 'string') fields.password = 'Informe a senha.';
    if (Object.keys(fields).length > 0) return problem({ ...EXAMPLES.InvalidData, fields: fields });
    const email = body.email as string;
    const password = body.password as string;

    const now = this.now();
    const emailKey = email.toLocaleLowerCase('en-US');
    const lockEnd = this.unlocksAt(emailKey, now);
    if (lockEnd !== null) {
      return problem({ ...EXAMPLES.LoginLocked, unlocks_at: new Date(lockEnd).toISOString() });
    }

    const account = this.accounts.find((c) => c.email.toLocaleLowerCase('en-US') === emailKey);
    if (!account || account.password !== password) {
      this.failures.set(emailKey, [...(this.failures.get(emailKey) ?? []), now]);
      return problem(EXAMPLES.InvalidCredentials);
    }

    this.failures.delete(emailKey);
    const tenants = [...account.tenants.map((t) => t.tenant)].sort(compareName);
    const last = this.lastTenant.get(emailKey);
    const initial = tenants.find((t) => t.id === last) ?? tenants[0];
    if (!initial) return problem(EXAMPLES.InvalidCredentials);

    this.session = { account, currentTenantId: initial.id, csrf: randomUUID() };
    // The two sign-in cookies (contract, SetCookieLogin), on the API host.
    const requestOrigin = new URL(request.url()).origin;
    await context.addCookies([
      { name: SESSION_COOKIE, value: randomUUID(), url: requestOrigin, httpOnly: true, sameSite: 'Lax' },
      { name: CSRF_COOKIE, value: this.session.csrf, url: requestOrigin, sameSite: 'Lax' },
    ]);
    return json(200, this.sessionBody(this.session));
  }

  /** `DELETE /v1/session`: requires CSRF; deletes the session and both cookies. */
  private async signOut(request: Request, context: BrowserContext): Promise<RouteResponse> {
    if (!this.session) return problem(EXAMPLES.NoSession);
    if (!csrfMatches(request, this.session)) return problem(EXAMPLES.InvalidCsrf);
    this.session = null;
    await context.clearCookies({ name: SESSION_COOKIE });
    await context.clearCookies({ name: CSRF_COOKIE });
    return { status: 204, contentType: 'application/json', body: undefined };
  }

  /** `PUT /v1/session/tenant`: requires session and CSRF; only to one of the user's tenants. */
  private switchTenant(request: Request): RouteResponse {
    const session = this.session;
    if (!session) return problem(EXAMPLES.NoSession);
    if (!csrfMatches(request, session)) return problem(EXAMPLES.InvalidCsrf);
    if (!isJson(request)) return problem(EXAMPLES.InvalidDataMalformedJson);
    const body = readJson(request);
    if (body === undefined) return problem(EXAMPLES.InvalidDataMalformedJson);
    const tenantId = body.tenant_id;
    if (typeof tenantId !== 'string' || !UUID.test(tenantId)) return problem(EXAMPLES.InvalidData);
    if (!session.account.tenants.some((t) => t.tenant.id === tenantId)) return problem(EXAMPLES.NoTenantAccess);
    session.currentTenantId = tenantId;
    this.lastTenant.set(session.account.email.toLocaleLowerCase('en-US'), tenantId);
    return json(200, this.sessionBody(session));
  }

  /** Same as the backend domain's `unlocks_at`: the 5th consecutive failure locks for 15 min, counted from it. */
  private unlocksAt(emailKey: string, now: number): number | null {
    let end: number | null = null;
    let consecutive = 0;
    for (const failure of [...(this.failures.get(emailKey) ?? [])].sort((a, b) => a - b)) {
      if (end !== null) {
        if (failure < end) continue;
        end = null;
      }
      consecutive += 1;
      if (consecutive >= ATTEMPTS_UNTIL_LOCK) {
        end = failure + LOCK_DURATION_MS;
        consecutive = 0;
      }
    }
    return end !== null && now < end ? end : null;
  }

  private sessionBody({ account, currentTenantId }: OpenSession): Session {
    const tenants = [...account.tenants].sort((a, b) => compareName(a.tenant, b.tenant));
    const current = tenants.find((t) => t.tenant.id === currentTenantId) ?? tenants[0];
    if (!current) throw new Error(`Conta simulada sem tenant: ${account.email}`);
    return {
      user: { id: account.id, name: account.name, email: account.email },
      tenants: tenants.map((t) => t.tenant),
      current_tenant: current.tenant,
      permissions: [...current.permissions],
    };
  }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

interface RouteResponse {
  status: number;
  contentType: 'application/json' | 'application/problem+json';
  body: unknown;
}

function json(status: number, body: unknown): RouteResponse {
  return { status, contentType: 'application/json', body };
}

function problem(example: ErrorBody): RouteResponse {
  return { status: example.status, contentType: 'application/problem+json', body: example };
}

function corsHeaders(request: Request, shellOrigin: string): Record<string, string> {
  return {
    'access-control-allow-origin': request.headers().origin ?? shellOrigin,
    'access-control-allow-credentials': 'true',
    vary: 'Origin',
  };
}

function isJson(request: Request): boolean {
  const type = request.headers()['content-type'] ?? '';
  return type.split(';')[0]?.trim().toLowerCase() === 'application/json';
}

function readJson(request: Request): Record<string, unknown> | undefined {
  try {
    const body: unknown = request.postDataJSON();
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}

function csrfMatches(request: Request, session: OpenSession): boolean {
  return request.headers()[CSRF_HEADER] === session.csrf;
}
