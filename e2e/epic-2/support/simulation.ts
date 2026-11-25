// Epic 2 simulated API (pnpm e2e): cookie and token sessions, users, roles, reset link, API
// keys, authorized domains, embedding, access audit and security settings, in memory, one per test.
//
// Answers like the contract (../backend/contracts/openapi.yaml) and like the backend domain (permission catalog, initial
// roles, sign-in and password rules, audit detail text), with the contract's error examples. Keeps the
// state across the pages of a test: the Admin creates a user on one page and the person signs in on another.
import { randomBytes, randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Route } from '@playwright/test';
import { isApiCall, API_ROUTES } from '../../support/simulated-api';
import { EXAMPLES, type ErrorBody, type Schemas, type Session } from '../../support/contract';

type PermissionCode = Schemas['PermissionCode'];
type SecurityField = keyof Schemas['SecuritySettingsUpdate'];

const ERRORS = EXAMPLES;

/** The backend catalog (`identidade/dominio/permissions.py` and the names of `GET /v1/permissions`), in its order. */
const PERMISSION_CATALOG: readonly Schemas['Permission'][] = [
  { code: 'users.manage', name: 'Gerenciar usuários', category: 'Administração', sensitive: false },
  { code: 'roles.manage', name: 'Gerenciar papéis', category: 'Administração', sensitive: false },
  { code: 'integration.manage', name: 'Gerenciar integração', category: 'Administração', sensitive: false },
  { code: 'security.manage', name: 'Gerenciar segurança', category: 'Administração', sensitive: true },
  { code: 'connections.view', name: 'Ver conexões', category: 'Dados', sensitive: false },
  { code: 'connections.manage', name: 'Gerenciar conexões', category: 'Dados', sensitive: false },
  { code: 'credentials.manage', name: 'Gerenciar credenciais', category: 'Dados', sensitive: true },
  { code: 'datasets.manage', name: 'Gerenciar datasets', category: 'Dados', sensitive: false },
  { code: 'free_sql.use', name: 'Usar SQL livre', category: 'Dados', sensitive: false },
  { code: 'variables.manage', name: 'Gerenciar variáveis', category: 'Dados', sensitive: false },
  { code: 'workflows.view', name: 'Ver workflows', category: 'Workflows', sensitive: false },
  { code: 'workflows.edit', name: 'Editar workflows', category: 'Workflows', sensitive: false },
  { code: 'test_cases.edit', name: 'Editar testes', category: 'Workflows', sensitive: false },
  {
    code: 'client_test_cases.edit',
    name: 'Aceitar alteração de teste de origem cliente',
    category: 'Workflows',
    sensitive: true,
  },
  { code: 'versions.submit', name: 'Enviar versão para revisão', category: 'Workflows', sensitive: false },
  { code: 'versions.approve', name: 'Aprovar versão', category: 'Workflows', sensitive: true },
  { code: 'versions.publish', name: 'Publicar versão', category: 'Workflows', sensitive: false },
  { code: 'executions.view', name: 'Ver execuções', category: 'Execuções', sensitive: false },
  { code: 'executions.trigger', name: 'Disparar execuções', category: 'Execuções', sensitive: false },
  { code: 'executions.schedule', name: 'Agendar execuções', category: 'Execuções', sensitive: false },
  { code: 'executions.reprocess', name: 'Reprocessar execução', category: 'Execuções', sensitive: true },
  { code: 'errors.ignore', name: 'Ignorar erro', category: 'Execuções', sensitive: true },
  { code: 'simulations.run', name: 'Rodar simulação', category: 'Execuções', sensitive: false },
  { code: 'states.view', name: 'Ver estados', category: 'Estados', sensitive: false },
  { code: 'states.adjust', name: 'Ajustar estado', category: 'Estados', sensitive: true },
  { code: 'audit.view', name: 'Ver auditoria', category: 'Auditoria', sensitive: false },
  { code: 'traces.view', name: 'Ver traces', category: 'Auditoria', sensitive: false },
];

const CODES: readonly PermissionCode[] = PERMISSION_CATALOG.map((permission) => permission.code);
const ADMIN = 'Admin';

/** The roles created in every new tenant (the backend's `INITIAL_ROLES`). The Admin is the fixed one, with all permissions. */
const INITIAL_ROLES: Readonly<Record<string, readonly PermissionCode[]>> = {
  [ADMIN]: CODES,
  Integrador: PERMISSION_CATALOG.filter((permission) => permission.category === 'Dados').map((permission) => permission.code),
  Configurador: [
    'workflows.view',
    'workflows.edit',
    'test_cases.edit',
    'versions.submit',
    'simulations.run',
    'connections.view',
    'executions.view',
  ],
  Aprovador: ['workflows.view', 'versions.approve', 'versions.publish', 'client_test_cases.edit', 'simulations.run', 'executions.view'],
  Operador: [
    'workflows.view',
    'executions.view',
    'executions.trigger',
    'executions.schedule',
    'executions.reprocess',
    'errors.ignore',
    'states.view',
    'states.adjust',
  ],
  Auditor: CODES.filter((code) => code.endsWith('.view')),
};

/** Default and (inclusive) bounds of each tenant security parameter (contract, `GET /v1/settings/security`). */
const SECURITY: Readonly<Record<SecurityField, { default: number; min: number; max: number }>> = {
  inactivity_minutes: { default: 480, min: 15, max: 1440 },
  max_duration_days: { default: 7, min: 1, max: 30 },
  min_password_length: { default: 12, min: 8, max: 64 },
  link_validity_hours: { default: 24, min: 1, max: 72 },
  token_validity_minutes: { default: 15, min: 5, max: 60 },
};
const SECURITY_FIELDS = Object.keys(SECURITY) as SecurityField[];

const EVENT_TYPES = [
  'login_succeeded',
  'login_failed',
  'login_locked',
  'logout',
  'tenant_switched',
  'reset_link_generated',
  'password_reset',
  'api_key_created',
  'api_key_revoked',
  'embed_token_issued',
  'role_updated',
  'user_updated',
  'security_updated',
] as const;
type EventType = (typeof EVENT_TYPES)[number];

/** System sign-in rules (G4): 5 consecutive failures lock the e-mail for 15 minutes. */
const ATTEMPTS_UNTIL_LOCK = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 50;
const IP = '127.0.0.1';

const CSRF_COOKIE = 'fc_csrf';
const SESSION_COOKIE = 'fc_session';
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Resources with `{id}` in the path (`/v1/<resource>/{id}...`). */
const WITH_ID = new Set(['roles', 'users', 'api-keys', 'authorized-domains']);

/** An account that already exists when the test starts (like the `prepare-local` ones). */
export interface InitialAccount {
  email: string;
  password: string;
  name: string;
  /** Tenant name → name of the user's role in it. */
  roles: Readonly<Record<string, string>>;
}

interface User {
  id: string;
  email: string;
  name: string;
  password: string | null;
  /** Host app `external_id`, for the user created by embedding. */
  externalId: string | null;
  lastTenant: string | null;
}

interface Member {
  tenantId: string;
  userId: string;
  roles: Set<string>;
  active: boolean;
}

interface Role {
  id: string;
  tenantId: string;
  name: string;
  permissions: PermissionCode[];
  fixed: boolean;
}

interface Tenant {
  id: string;
  name: string;
  security: Record<SecurityField, number>;
}

interface ApiKey {
  id: string;
  tenantId: string;
  name: string;
  prefix: string;
  key: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface AuthorizedDomain {
  id: string;
  tenantId: string;
  origin: string;
  createdAt: number;
}

interface ResetLink {
  token: string;
  userId: string;
  tenantId: string;
  expiresAt: number;
  used: boolean;
}

interface StoredAccessEvent {
  id: string;
  order: number;
  occurredAt: number;
  type: EventType;
  userId: string | null;
  email: string;
  detail: string | null;
  tenantId: string | null;
}

interface CookieSession {
  userId: string;
  tenantId: string;
  csrf: string;
}

interface EmbedToken {
  userId: string;
  tenantId: string;
  expiresAt: number;
}

/** Who calls: the user, the tenant and their permissions in that tenant. */
interface Auth {
  user: User;
  tenantId: string;
  permissions: ReadonlySet<string>;
  mode: 'cookie' | 'token';
}

interface RouteResponse {
  status: number;
  contentType: 'application/json' | 'application/problem+json';
  body: unknown;
}

/**
 * The epic 2 API in memory. Every call to `/v1/...` outside the shell origin lands here (`install`); the cookie
 * session is kept per browser context, like the cookie. A route outside the contract answers 501 and is kept in
 * `unexpected`; the fixture fails the test if there is any.
 */
export class Epic2Simulation {
  readonly unexpected: string[] = [];

  private readonly tenants: Tenant[] = [];
  private readonly users: User[] = [];
  private readonly members: Member[] = [];
  private readonly roles: Role[] = [];
  private readonly apiKeys: ApiKey[] = [];
  private readonly authorizedDomains: AuthorizedDomain[] = [];
  private readonly links: ResetLink[] = [];
  private readonly events: StoredAccessEvent[] = [];
  private readonly sessions = new Map<BrowserContext, CookieSession>();
  private readonly tokens = new Map<string, EmbedToken>();
  /** E-mail (case-insensitive) → instants of the failures since the last success. */
  private readonly failures = new Map<string, number[]>();

  constructor(
    accounts: readonly InitialAccount[],
    /** Shell address: the base of the reset link (the backend's `FLUXO_SHELL_URL`). */
    private readonly shellUrl: string,
    private readonly now: () => number = Date.now,
  ) {
    for (const name of new Set(accounts.flatMap((account) => Object.keys(account.roles)))) this.createTenant(name);
    for (const account of accounts) {
      const user = this.createUser(account.email, account.name, account.password, null);
      for (const [tenantName, roleName] of Object.entries(account.roles)) {
        const tenant = this.tenants.find((t) => t.name === tenantName);
        const role = this.roles.find((p) => p.tenantId === tenant?.id && p.name === roleName);
        if (!tenant || !role) throw new Error(`Conta inicial com tenant ou papel desconhecido: ${account.email}.`);
        this.members.push({ tenantId: tenant.id, userId: user.id, roles: new Set([role.id]), active: true });
      }
    }
  }

  /** Turns the simulation on for a page (and its context): every call to `/v1/...` outside the shell origin lands here. */
  async install(page: Page): Promise<void> {
    const context = page.context();
    const shellOrigin = new URL(this.shellUrl).origin;
    await page.route(API_ROUTES, (route) =>
      isApiCall(route, shellOrigin) ? this.respond(route, context) : route.fallback(),
    );
  }

  // --- Entrada -------------------------------------------------------------------------------------------------------

  private async respond(route: Route, context: BrowserContext): Promise<void> {
    const request = route.request();
    const method = request.method().toUpperCase();
    const cors = {
      'access-control-allow-origin': request.headers().origin ?? this.shellUrl,
      'access-control-allow-credentials': 'true',
      vary: 'Origin',
    };
    if (method === 'OPTIONS') {
      await route.fulfill({
        status: 204,
        headers: {
          ...cors,
          'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
          'access-control-allow-headers': 'authorization, content-type, x-csrf-token',
        },
      });
      return;
    }
    const response = await this.handle(method, new URL(request.url()), request, context);
    await route.fulfill({
      status: response.status,
      headers: { ...cors, ...(response.body === undefined ? {} : { 'content-type': response.contentType }) },
      body: response.body === undefined ? undefined : JSON.stringify(response.body),
    });
  }

  private async handle(method: string, url: URL, request: Request, context: BrowserContext): Promise<RouteResponse> {
    const parts = url.pathname.split('/');
    let id: string | undefined;
    if (parts.length >= 4 && WITH_ID.has(parts[2] ?? '')) {
      id = parts[3];
      parts[3] = '{id}';
    }
    const route = `${method} ${parts.join('/')}`;
    if (id !== undefined && !UUID.test(id)) return problem(ERRORS.InvalidDataId);
    const withId = id ?? '';

    // Public and sign-in routes.
    switch (route) {
      case 'GET /v1/health':
        return json(200, { status: 'ok' } satisfies Schemas['Health']);
      case 'POST /v1/session':
        return this.signIn(request, context);
      case 'POST /v1/password-reset/verification':
        return this.verifyLink(request);
      case 'POST /v1/password-reset':
        return this.resetPassword(request);
      case 'POST /v1/embed/sessions':
        return this.issueEmbedToken(request);
    }

    const known = AUTHENTICATED_ROUTES.has(route);
    if (!known) {
      this.unexpected.push(route);
      return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, code: 'route_not_simulated' });
    }

    const who = this.authenticate(method, request, context);
    if (isResponse(who)) return who;

    switch (route) {
      case 'GET /v1/session':
        return json(200, this.sessionBody(who));
      case 'DELETE /v1/session':
        return this.signOut(who, context);
      case 'PUT /v1/session/tenant':
        return this.switchTenant(who, request, context);
      case 'GET /v1/notifications':
        // The bell (F130, mounted by F131) and the "Próxima execução" of the overview read these two; the contract's examples serve.
        return json(200, EXAMPLES.NotificationList);
      case 'GET /v1/schedules':
        return json(200, EXAMPLES.ScheduleList);
      case 'GET /v1/workflows':
        // The Início lists the recent workflows (F57); the epic 2 tests do not create any.
        return require(who, ['workflows.view']) ?? json(200, { items: [], next_cursor: null } satisfies Schemas['WorkflowList']);
      case 'GET /v1/permissions':
        return require(who, ['roles.manage']) ?? json(200, { items: PERMISSION_CATALOG });
      case 'GET /v1/roles':
        return require(who, ['roles.manage', 'users.manage']) ?? json(200, { items: this.tenantRoles(who.tenantId) });
      case 'POST /v1/roles':
        return require(who, ['roles.manage']) ?? this.createRole(who, request);
      case 'GET /v1/roles/{id}':
        return require(who, ['roles.manage']) ?? this.getRole(who, withId);
      case 'PUT /v1/roles/{id}':
        return require(who, ['roles.manage']) ?? this.updateRole(who, withId, request);
      case 'DELETE /v1/roles/{id}':
        return require(who, ['roles.manage']) ?? this.deleteRole(who, withId);
      case 'GET /v1/users':
        return require(who, ['users.manage']) ?? this.listUsers(who, url);
      case 'POST /v1/users':
        return require(who, ['users.manage']) ?? this.createMember(who, request);
      case 'GET /v1/users/{id}':
        return require(who, ['users.manage']) ?? this.getUser(who, withId);
      case 'PUT /v1/users/{id}':
        return require(who, ['users.manage']) ?? this.updateMember(who, withId, request);
      case 'POST /v1/users/{id}/password-reset':
        return require(who, ['users.manage']) ?? this.generateLink(who, withId);
      case 'GET /v1/api-keys':
        return require(who, ['integration.manage']) ?? this.listApiKeys(who);
      case 'POST /v1/api-keys':
        return require(who, ['integration.manage']) ?? this.createApiKey(who, request);
      case 'DELETE /v1/api-keys/{id}':
        return require(who, ['integration.manage']) ?? this.revokeApiKey(who, withId);
      case 'GET /v1/authorized-domains':
        return require(who, ['integration.manage']) ?? this.listAuthorizedDomains(who);
      case 'POST /v1/authorized-domains':
        return require(who, ['integration.manage']) ?? this.createAuthorizedDomain(who, request);
      case 'DELETE /v1/authorized-domains/{id}':
        return require(who, ['integration.manage']) ?? this.deleteAuthorizedDomain(who, withId);
      case 'GET /v1/audit/access-events':
        return require(who, ['audit.view']) ?? this.listAccessEvents(who, url);
      case 'GET /v1/settings/security':
        return require(who, ['security.manage']) ?? json(200, this.securityBody(who.tenantId));
      case 'PUT /v1/settings/security':
        return require(who, ['security.manage']) ?? this.updateSecurity(who, request);
      default:
        throw new Error(`Rota autenticada sem tratamento: ${route}`);
    }
  }

  /**
   * With `Authorization: Bearer`, the embed token, only from an authorized domain of its tenant; without it, the cookie
   * session of this context, with the `X-CSRF-Token` on mutations.
   */
  private authenticate(method: string, request: Request, context: BrowserContext): Auth | RouteResponse {
    const headers = request.headers();
    const authorization = headers.authorization ?? '';
    if (authorization.startsWith('Bearer ')) {
      const token = this.tokens.get(authorization.slice('Bearer '.length));
      if (!token || this.now() >= token.expiresAt) return problem(ERRORS.NoSession);
      const user = this.userById(token.userId);
      const member = this.member(token.tenantId, token.userId);
      if (!user || !member?.active) return problem(ERRORS.NoSession);
      const origin = headers.origin;
      if (!this.authorizedDomains.some((d) => d.tenantId === token.tenantId && d.origin === origin)) {
        return problem(ERRORS.OriginNotAuthorized);
      }
      return { user, tenantId: token.tenantId, permissions: this.permissionsOf(member), mode: 'token' };
    }

    const session = this.sessions.get(context);
    const user = session ? this.userById(session.userId) : undefined;
    const member = session ? this.member(session.tenantId, session.userId) : undefined;
    if (!session || !user || !member?.active) return problem(ERRORS.NoSession);
    if (CSRF_METHODS.has(method) && headers['x-csrf-token'] !== session.csrf) return problem(ERRORS.InvalidCsrf);
    return { user, tenantId: session.tenantId, permissions: this.permissionsOf(member), mode: 'cookie' };
  }

  // --- Session (epic 1, with the audit) ------------------------------------------------------------------------------

  /** `POST /v1/session`: order of the contract's rejections (415/422, lock 423, credentials 401). */
  private async signIn(request: Request, context: BrowserContext): Promise<RouteResponse> {
    if (!isJson(request)) return problem(ERRORS.InvalidContentType);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const { email, password: password } = body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      const fields: Record<string, string> = {};
      if (typeof email !== 'string') fields.email = 'Informe o e-mail.';
      if (typeof password !== 'string') fields.password = 'Informe a senha.';
      return problem({ ...ERRORS.InvalidData, fields: fields });
    }

    const now = this.now();
    const emailKey = email.toLocaleLowerCase('en-US');
    const user = this.userByEmail(email);
    const audit = (type: EventType, tenantId: string | null = null, detail: string | null = null) =>
      this.audit({ type: type, email, userId: user?.id ?? null, tenantId, detail: detail });

    const lockEnd = this.unlocksAt(emailKey, now);
    if (lockEnd !== null) {
      const unlocksAt = new Date(lockEnd).toISOString();
      audit('login_locked', null, `Bloqueado até ${unlocksAt}.`);
      return problem({ ...ERRORS.LoginLocked, unlocks_at: unlocksAt });
    }

    const tenants = user && user.password !== null && user.password === password ? this.tenantsOf(user.id) : [];
    const initial = tenants.find((t) => t.id === user?.lastTenant) ?? tenants[0];
    if (!user || !initial) {
      this.failures.set(emailKey, [...(this.failures.get(emailKey) ?? []), now]);
      audit('login_failed');
      return problem(ERRORS.InvalidCredentials);
    }

    this.failures.delete(emailKey);
    const session: CookieSession = { userId: user.id, tenantId: initial.id, csrf: randomUUID() };
    this.sessions.set(context, session);
    user.lastTenant = initial.id;
    // The two sign-in cookies (contract, SetCookieLogin), on the API host.
    const requestOrigin = new URL(request.url()).origin;
    await context.addCookies([
      { name: SESSION_COOKIE, value: randomUUID(), url: requestOrigin, httpOnly: true, sameSite: 'Lax' },
      { name: CSRF_COOKIE, value: session.csrf, url: requestOrigin, sameSite: 'Lax' },
    ]);
    audit('login_succeeded', initial.id);
    return json(200, this.sessionBody({ user, tenantId: initial.id, permissions: new Set(), mode: 'cookie' }));
  }

  private async signOut(who: Auth, context: BrowserContext): Promise<RouteResponse> {
    if (who.mode !== 'cookie') return problem(ERRORS.NoSession);
    this.sessions.delete(context);
    await context.clearCookies({ name: SESSION_COOKIE });
    await context.clearCookies({ name: CSRF_COOKIE });
    this.audit({ type: 'logout', email: who.user.email, userId: who.user.id, tenantId: who.tenantId });
    return empty();
  }

  private switchTenant(who: Auth, request: Request, context: BrowserContext): RouteResponse {
    const session = this.sessions.get(context);
    if (who.mode !== 'cookie' || !session) return problem(ERRORS.NoSession);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const tenantId = body.tenant_id;
    if (typeof tenantId !== 'string' || !UUID.test(tenantId)) return problem(ERRORS.InvalidData);
    if (!this.tenantsOf(who.user.id).some((t) => t.id === tenantId)) return problem(ERRORS.NoTenantAccess);
    session.tenantId = tenantId;
    who.user.lastTenant = tenantId;
    this.audit({ type: 'tenant_switched', email: who.user.email, userId: who.user.id, tenantId });
    return json(200, this.sessionBody({ ...who, tenantId }));
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

  private sessionBody({ user, tenantId, mode }: Auth): Session {
    const tenants = mode === 'token' ? this.tenants.filter((t) => t.id === tenantId) : this.tenantsOf(user.id);
    const current = tenants.find((t) => t.id === tenantId);
    const member = this.member(tenantId, user.id);
    if (!current || !member) throw new Error(`Sessão sem tenant: ${user.email}`);
    return {
      user: { id: user.id, name: user.name, email: user.email },
      tenants: tenants.map(tenantSummary),
      current_tenant: tenantSummary(current),
      permissions: [...this.permissionsOf(member)].sort(),
    };
  }

  // --- Roles --------------------------------------------------------------------------------------------------------

  private createRole(who: Auth, request: Request): RouteResponse {
    const data = readRoleData(request);
    if (isResponse(data)) return data;
    if (this.rolesOf(who.tenantId).some((p) => sameName(p.name, data.name))) return problem(ERRORS.RoleAlreadyExists);
    const role: Role = { id: randomUUID(), tenantId: who.tenantId, name: data.name, permissions: data.permissions, fixed: false };
    this.roles.push(role);
    this.auditActor(who, 'role_updated', `Papel ${role.name} criado com: ${permissionList(role.permissions)}.`);
    return json(201, this.roleBody(role));
  }

  private getRole(who: Auth, id: string): RouteResponse {
    const role = this.rolesOf(who.tenantId).find((p) => p.id === id);
    return role ? json(200, this.roleBody(role)) : problem(ERRORS.NotFound);
  }

  private updateRole(who: Auth, id: string, request: Request): RouteResponse {
    const role = this.rolesOf(who.tenantId).find((p) => p.id === id);
    if (!role) return problem(ERRORS.NotFound);
    if (role.fixed) return problem(ERRORS.FixedRole);
    const data = readRoleData(request);
    if (isResponse(data)) return data;
    if (this.rolesOf(who.tenantId).some((p) => p.id !== id && sameName(p.name, data.name))) return problem(ERRORS.RoleAlreadyExists);
    role.name = data.name;
    role.permissions = data.permissions;
    this.auditActor(who, 'role_updated', `Papel ${role.name} alterado: ${permissionList(role.permissions)}.`);
    return json(200, this.roleBody(role));
  }

  private deleteRole(who: Auth, id: string): RouteResponse {
    const role = this.rolesOf(who.tenantId).find((p) => p.id === id);
    if (!role) return problem(ERRORS.NotFound);
    if (role.fixed) return problem(ERRORS.FixedRole);
    if (this.members.some((m) => m.roles.has(id))) return problem(ERRORS.RoleInUse);
    this.roles.splice(this.roles.indexOf(role), 1);
    this.auditActor(who, 'role_updated', `Papel ${role.name} removido.`);
    return empty();
  }

  private tenantRoles(tenantId: string): Schemas['Role'][] {
    return [...this.rolesOf(tenantId)].sort((a, b) => compareNames(a.name, b.name)).map((role) => this.roleBody(role));
  }

  private roleBody(role: Role): Schemas['Role'] {
    return {
      id: role.id,
      name: role.name,
      permissions: [...role.permissions].sort(),
      fixed: role.fixed,
      user_count: this.members.filter((m) => m.roles.has(role.id)).length,
    };
  }

  // --- Users and reset link --------------------------------------------------------------------------------

  private listUsers(who: Auth, url: URL): RouteResponse {
    const memberDetails = this.members
      .filter((m) => m.tenantId === who.tenantId)
      .map((m) => this.userBody(m))
      .sort((a, b) => compareNames(a.name, b.name) || a.id.localeCompare(b.id));
    return paginate(memberDetails, url);
  }

  private getUser(who: Auth, id: string): RouteResponse {
    const member = this.member(who.tenantId, id);
    return member ? json(200, this.userBody(member)) : problem(ERRORS.NotFound);
  }

  /** `POST /v1/users`: an e-mail from another tenant reuses the user (without changing the name); from the same one, 409. */
  private createMember(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const fields: Record<string, string> = {};
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (!EMAIL.test(email)) fields.email = 'Informe um e-mail válido.';
    if (name === '') fields.name = 'Informe o nome.';
    const roles = textList(body.roles);
    if (roles === undefined) fields.roles = 'Informe uma lista de papéis.';
    if (Object.keys(fields).length > 0 || roles === undefined) return problem({ ...ERRORS.InvalidData, fields: fields });
    if (!roles.every((id) => this.rolesOf(who.tenantId).some((p) => p.id === id))) return problem(ERRORS.UnknownRole);

    const existing = this.userByEmail(email);
    if (existing && this.member(who.tenantId, existing.id)) return problem(ERRORS.UserAlreadyExists);
    const user = existing ?? this.createUser(email, name, null, null);
    const member: Member = { tenantId: who.tenantId, userId: user.id, roles: new Set(roles), active: true };
    this.members.push(member);
    this.auditActor(who, 'user_updated', `Usuário ${user.email} acrescentado com os papéis: ${this.roleNames(member)}.`);
    return json(201, this.userBody(member));
  }

  /** `PUT /v1/users/{id}`: name, roles and status; the tenant is never left without an active Admin. */
  private updateMember(who: Auth, id: string, request: Request): RouteResponse {
    const member = this.member(who.tenantId, id);
    const user = this.userById(id);
    if (!member || !user) return problem(ERRORS.NotFound);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const fields: Record<string, string> = {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') fields.name = 'Informe o nome.';
    const roles = textList(body.roles);
    if (roles === undefined) fields.roles = 'Informe uma lista de papéis.';
    if (typeof body.active !== 'boolean') fields.active = 'Informe se o usuário está ativo.';
    if (Object.keys(fields).length > 0 || roles === undefined || typeof body.active !== 'boolean') {
      return problem({ ...ERRORS.InvalidData, fields: fields });
    }
    if (!roles.every((p) => this.rolesOf(who.tenantId).some((role) => role.id === p))) return problem(ERRORS.UnknownRole);
    const admin = this.rolesOf(who.tenantId).find((p) => p.fixed);
    const staysAdmin = body.active && admin !== undefined && roles.includes(admin.id);
    const otherAdmin = this.members.some(
      (m) => m.tenantId === who.tenantId && m.userId !== id && m.active && admin !== undefined && m.roles.has(admin.id),
    );
    if (!staysAdmin && !otherAdmin) return problem(ERRORS.LastAdmin);

    user.name = name;
    member.roles = new Set(roles);
    member.active = body.active;
    if (!member.active) {
      for (const [context, session] of this.sessions) {
        if (session.userId === id && session.tenantId === who.tenantId) this.sessions.delete(context);
      }
    }
    this.auditActor(who, 'user_updated', `Usuário ${user.email} alterado.`);
    return json(200, this.userBody(member));
  }

  /** `POST /v1/users/{id}/password-reset`: single-use link; a new link invalidates the user's previous ones. */
  private generateLink(who: Auth, id: string): RouteResponse {
    const member = this.member(who.tenantId, id);
    const target = this.userById(id);
    if (!member || !target) return problem(ERRORS.NotFound);
    if (!member.active) return problem(ERRORS.InactiveUser);
    if (target.externalId !== null) return problem(ERRORS.ExternalUser);
    for (const link of this.links) if (link.userId === id) link.used = true;
    const link: ResetLink = {
      token: secret(),
      userId: id,
      tenantId: who.tenantId,
      expiresAt: this.now() + this.security(who.tenantId).link_validity_hours * 60 * 60 * 1000,
      used: false,
    };
    this.links.push(link);
    this.auditActor(who, 'reset_link_generated', `Link de redefinição para ${target.email} (${target.id}).`);
    return json(201, {
      link: `${this.shellUrl}/reset-password?token=${link.token}`,
      expires_at: new Date(link.expiresAt).toISOString(),
    } satisfies Schemas['ResetLink']);
  }

  /** `POST /v1/password-reset/verification` (public): the largest minimum password among the user's tenants, without using the link. */
  private verifyLink(request: Request): RouteResponse {
    if (!isJson(request)) return problem(ERRORS.InvalidContentType);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    if (typeof body.token !== 'string') return problem(ERRORS.InvalidDataToken);
    const link = this.validLink(body.token);
    if (!link) return problem(ERRORS.InvalidLink);
    return json(200, {
      min_password_length: this.minPasswordLengthOf(link.userId),
      expires_at: new Date(link.expiresAt).toISOString(),
    } satisfies Schemas['VerifiedLink']);
  }

  /** `POST /v1/password-reset` (public): replaces the password, uses the link and ends the user's sessions. */
  private resetPassword(request: Request): RouteResponse {
    if (!isJson(request)) return problem(ERRORS.InvalidContentType);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    if (typeof body.token !== 'string') return problem(ERRORS.InvalidDataToken);
    if (typeof body.new_password !== 'string') return problem(ERRORS.InvalidDataNewPassword);
    const link = this.validLink(body.token);
    const user = link ? this.userById(link.userId) : undefined;
    if (!link || !user) return problem(ERRORS.InvalidLink);

    const minimum = this.minPasswordLengthOf(user.id);
    if (Array.from(body.new_password).length < minimum) {
      return problem({ ...ERRORS.InvalidPassword, fields: { new_password: `A senha precisa ter pelo menos ${minimum} caracteres.` } });
    }
    if (body.new_password.toLocaleLowerCase('en-US').includes(user.email.toLocaleLowerCase('en-US'))) {
      return problem({ ...ERRORS.InvalidPassword, fields: { new_password: 'A senha não pode conter o e-mail.' } });
    }
    user.password = body.new_password;
    link.used = true;
    for (const [context, session] of this.sessions) if (session.userId === user.id) this.sessions.delete(context);
    this.audit({ type: 'password_reset', email: user.email, userId: user.id, tenantId: link.tenantId });
    return empty();
  }

  private validLink(token: string): ResetLink | undefined {
    return this.links.find((link) => link.token === token && !link.used && this.now() < link.expiresAt);
  }

  private minPasswordLengthOf(userId: string): number {
    const minimums = this.tenantsOf(userId).map((t) => this.security(t.id).min_password_length);
    return Math.max(SECURITY.min_password_length.default, ...minimums);
  }

  private userBody(member: Member): Schemas['User'] {
    const user = this.userById(member.userId);
    if (!user) throw new Error(`Membro sem usuário: ${member.userId}`);
    const roles = this.rolesOf(member.tenantId)
      .filter((p) => member.roles.has(p.id))
      .sort((a, b) => compareNames(a.name, b.name))
      .map((p) => ({ id: p.id, name: p.name }));
    return { id: user.id, email: user.email, name: user.name, roles: roles, active: member.active, external: user.externalId !== null };
  }

  private roleNames(member: Member): string {
    const names = this.rolesOf(member.tenantId)
      .filter((p) => member.roles.has(p.id))
      .map((p) => p.name)
      .sort(compareNames);
    return names.join(', ') || 'nenhum';
  }

  // --- Integration: API keys, authorized domains and embedding ------------------------------------------------

  private listApiKeys(who: Auth): RouteResponse {
    const items = this.apiKeys
      .filter((c) => c.tenantId === who.tenantId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(
        (c): Schemas['ApiKey'] => ({
          id: c.id,
          name: c.name,
          prefix: c.prefix,
          created_at: iso(c.createdAt),
          last_used_at: c.lastUsedAt === null ? null : iso(c.lastUsedAt),
          revoked_at: c.revokedAt === null ? null : iso(c.revokedAt),
        }),
      );
    return json(200, { items: items, next_cursor: null } satisfies Schemas['ApiKeyList']);
  }

  private createApiKey(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') return problem({ ...ERRORS.InvalidData, fields: { name: 'Informe o nome.' } });
    const value = `fc_${secret()}`;
    const apiKey: ApiKey = {
      id: randomUUID(),
      tenantId: who.tenantId,
      name: name,
      prefix: value.slice(0, 11),
      key: value,
      createdAt: this.now(),
      lastUsedAt: null,
      revokedAt: null,
    };
    this.apiKeys.push(apiKey);
    this.auditActor(who, 'api_key_created', `Chave ${apiKey.prefix} (${apiKey.name}).`);
    return json(201, { id: apiKey.id, name: apiKey.name, prefix: apiKey.prefix, key: apiKey.key } satisfies Schemas['CreatedApiKey']);
  }

  /** Revoking an already revoked key also answers 204. */
  private revokeApiKey(who: Auth, id: string): RouteResponse {
    const apiKey = this.apiKeys.find((c) => c.id === id && c.tenantId === who.tenantId);
    if (!apiKey) return problem(ERRORS.NotFound);
    if (apiKey.revokedAt === null) {
      apiKey.revokedAt = this.now();
      this.auditActor(who, 'api_key_revoked', `Chave ${apiKey.prefix} (${apiKey.name}).`);
    }
    return empty();
  }

  private listAuthorizedDomains(who: Auth): RouteResponse {
    const items = this.authorizedDomains
      .filter((d) => d.tenantId === who.tenantId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((d): Schemas['AuthorizedDomain'] => ({ id: d.id, origin: d.origin, created_at: iso(d.createdAt) }));
    return json(200, { items: items } satisfies Schemas['AuthorizedDomainList']);
  }

  private createAuthorizedDomain(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    if (typeof body.origin !== 'string') return problem(ERRORS.InvalidDataOrigin);
    const origin = normalizeOrigin(body.origin);
    if (origin === undefined) return problem(ERRORS.InvalidOrigin);
    if (this.authorizedDomains.some((d) => d.tenantId === who.tenantId && d.origin === origin)) return problem(ERRORS.AuthorizedDomainAlreadyExists);
    const authorizedDomain: AuthorizedDomain = { id: randomUUID(), tenantId: who.tenantId, origin: origin, createdAt: this.now() };
    this.authorizedDomains.push(authorizedDomain);
    return json(201, { id: authorizedDomain.id, origin: origin, created_at: iso(authorizedDomain.createdAt) } satisfies Schemas['AuthorizedDomain']);
  }

  private deleteAuthorizedDomain(who: Auth, id: string): RouteResponse {
    const index = this.authorizedDomains.findIndex((d) => d.id === id && d.tenantId === who.tenantId);
    if (index === -1) return problem(ERRORS.NotFound);
    this.authorizedDomains.splice(index, 1);
    return empty();
  }

  /**
   * `POST /v1/embed/sessions` (`Authorization: ApiKey <key>`): creates or updates the external user of the
   * `external_id` in the key's tenant, with the roles by name (never the Admin), and returns the token.
   */
  private issueEmbedToken(request: Request): RouteResponse {
    const authorization = request.headers().authorization ?? '';
    const apiKey = authorization.startsWith('ApiKey ')
      ? this.apiKeys.find((c) => c.key === authorization.slice('ApiKey '.length) && c.revokedAt === null)
      : undefined;
    if (!apiKey) return problem(ERRORS.InvalidApiKey);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    const externalId = text(body.external_id);
    const email = text(body.email);
    const name = text(body.name);
    const roleNames = textList(body.roles);
    const fields: Record<string, string> = {};
    if (externalId === '') fields.external_id = 'Campo obrigatório.';
    if (email === '') fields.email = 'Campo obrigatório.';
    if (name === '') fields.name = 'Campo obrigatório.';
    if (roleNames === undefined) fields.roles = 'Informe uma lista de papéis.';
    if (Object.keys(fields).length > 0 || roleNames === undefined) return problem({ ...ERRORS.InvalidData, fields: fields });

    const ofTenant = this.rolesOf(apiKey.tenantId);
    if (roleNames.some((n) => ofTenant.some((p) => p.fixed && sameName(p.name, n)))) return problem(ERRORS.RoleNotAllowed);
    const roles = roleNames.map((n) => ofTenant.find((p) => sameName(p.name, n)));
    if (roles.some((p) => p === undefined)) return problem(ERRORS.UnknownRole);

    let user = this.users.find((u) => u.externalId === `${apiKey.tenantId}:${externalId}`);
    const owner = this.userByEmail(email);
    if (owner && owner !== user) return problem(ERRORS.EmailInUse);
    user ??= this.createUser(email, name, null, `${apiKey.tenantId}:${externalId}`);
    user.email = email;
    user.name = name;
    let member = this.member(apiKey.tenantId, user.id);
    if (member && !member.active) return problem(ERRORS.InactiveEmbedUser);
    const admin = ofTenant.find((p) => p.fixed);
    const ids = new Set(roles.map((p) => p?.id ?? ''));
    if (member && admin && member.roles.has(admin.id)) ids.add(admin.id);
    if (member) member.roles = ids;
    else {
      member = { tenantId: apiKey.tenantId, userId: user.id, roles: ids, active: true };
      this.members.push(member);
    }

    const now = this.now();
    const token = secret();
    const expiresAt = now + this.security(apiKey.tenantId).token_validity_minutes * 60 * 1000;
    this.tokens.set(token, { userId: user.id, tenantId: apiKey.tenantId, expiresAt });
    apiKey.lastUsedAt = now;
    this.audit({
      type: 'embed_token_issued',
      email,
      userId: user.id,
      tenantId: apiKey.tenantId,
      detail: `Chave ${apiKey.prefix}; id externo ${externalId}.`,
    });
    return json(201, { token, expires_at: iso(expiresAt) } satisfies Schemas['EmbedToken']);
  }

  // --- Access audit ------------------------------------------------------------------------------------------

  /**
   * `GET /v1/audit/access-events`: the tenant's events and the tenantless ones (sign-in failure and lock) of one of its members,
   * from newest to oldest, with the filters `type` (repeated), `since` (inclusive) and `until` (exclusive).
   */
  private listAccessEvents(who: Auth, url: URL): RouteResponse {
    const types = url.searchParams.getAll('type');
    const unknown = types.find((type) => !(EVENT_TYPES as readonly string[]).includes(type));
    if (unknown !== undefined) {
      return problem({ ...ERRORS.InvalidEventType, fields: { type: `Tipo desconhecido: '${unknown}'.` } });
    }
    const since = instant(url.searchParams.get('since'));
    const until = instant(url.searchParams.get('until'));
    if (since === null || until === null) return problem(ERRORS.InvalidData);
    if (since !== undefined && until !== undefined && since > until) {
      return problem({ ...ERRORS.InvalidData, fields: { until: 'Informe um fim depois do início.' } });
    }
    const events = this.events
      .filter(
        (e) =>
          e.tenantId === who.tenantId ||
          (e.tenantId === null && e.userId !== null && this.member(who.tenantId, e.userId) !== undefined),
      )
      .filter((e) => types.length === 0 || types.includes(e.type))
      .filter((e) => (since === undefined || e.occurredAt >= since) && (until === undefined || e.occurredAt < until))
      .sort((a, b) => b.occurredAt - a.occurredAt || b.order - a.order)
      .map(
        (e): Schemas['AccessEvent'] => ({
          id: e.id,
          occurred_at: iso(e.occurredAt),
          type: e.type,
          user_id: e.userId,
          provided_email: e.email,
          ip: IP,
          detail: e.detail,
        }),
      );
    return paginate(events, url);
  }

  private audit(event: { type: EventType; email: string; userId: string | null; tenantId: string | null; detail?: string | null }) {
    this.events.push({ id: randomUUID(), order: this.events.length, occurredAt: this.now(), detail: null, ...event });
  }

  /** Event of whoever made the change (the Admin), as the backend records access changes. */
  private auditActor(who: Auth, type: EventType, detail: string) {
    this.audit({ type: type, email: who.user.email, userId: who.user.id, tenantId: who.tenantId, detail: detail });
  }

  // --- Security settings -------------------------------------------------------------------------------------

  private securityBody(tenantId: string): Schemas['SecuritySettings'] {
    const values = this.security(tenantId);
    return Object.fromEntries(
      SECURITY_FIELDS.map((field) => [field, { value: values[field], ...SECURITY[field] }]),
    ) as Schemas['SecuritySettings'];
  }

  /** `PUT /v1/settings/security`: the five integers; out of range, 422 with all fields and nothing saved. */
  private updateSecurity(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const types: Record<string, string> = {};
    const outOfRange: Record<string, string> = {};
    const newOnes = { ...this.security(who.tenantId) };
    for (const field of SECURITY_FIELDS) {
      const value = body[field];
      if (typeof value !== 'number' || !Number.isInteger(value)) types[field] = 'Informe um número inteiro.';
      else if (value < SECURITY[field].min || value > SECURITY[field].max) {
        outOfRange[field] = `Informe um valor de ${SECURITY[field].min} a ${SECURITY[field].max}.`;
      } else newOnes[field] = value;
    }
    if (Object.keys(types).length > 0) return problem({ ...ERRORS.InvalidDataSecurity, fields: types });
    if (Object.keys(outOfRange).length > 0) return problem({ ...ERRORS.ValueOutOfRange, fields: outOfRange });

    const tenant = this.tenants.find((t) => t.id === who.tenantId);
    if (!tenant) throw new Error(`Tenant desconhecido: ${who.tenantId}`);
    // Like the backend: `field: old → new` for each field that changed, and nothing is audited if nothing changed.
    const changes = SECURITY_FIELDS.filter((field) => newOnes[field] !== tenant.security[field]).map(
      (field) => `${field}: ${tenant.security[field]} → ${newOnes[field]}`,
    );
    if (changes.length > 0) {
      tenant.security = newOnes;
      this.auditActor(who, 'security_updated', `${changes.join('; ')}.`);
    }
    return json(200, this.securityBody(who.tenantId));
  }

  private security(tenantId: string): Record<SecurityField, number> {
    const tenant = this.tenants.find((t) => t.id === tenantId);
    if (!tenant) throw new Error(`Tenant desconhecido: ${tenantId}`);
    return tenant.security;
  }

  // --- Dados ---------------------------------------------------------------------------------------------------------

  private createTenant(name: string): Tenant {
    const tenant: Tenant = {
      id: randomUUID(),
      name: name,
      security: Object.fromEntries(SECURITY_FIELDS.map((field) => [field, SECURITY[field].default])) as Record<SecurityField, number>,
    };
    this.tenants.push(tenant);
    for (const [roleName, permissions] of Object.entries(INITIAL_ROLES)) {
      this.roles.push({ id: randomUUID(), tenantId: tenant.id, name: roleName, permissions: [...permissions], fixed: roleName === ADMIN });
    }
    return tenant;
  }

  private createUser(email: string, name: string, password: string | null, externalId: string | null): User {
    const user: User = { id: randomUUID(), email, name: name, password: password, externalId, lastTenant: null };
    this.users.push(user);
    return user;
  }
  private userById(id: string): User | undefined {
    return this.users.find((u) => u.id === id);
  }

  private userByEmail(email: string): User | undefined {
    const key = email.trim().toLocaleLowerCase('en-US');
    return this.users.find((u) => u.email.toLocaleLowerCase('en-US') === key);
  }

  private member(tenantId: string, userId: string): Member | undefined {
    return this.members.find((m) => m.tenantId === tenantId && m.userId === userId);
  }

  /** The tenants where the user is active, by name. */
  private tenantsOf(userId: string): Tenant[] {
    return this.tenants
      .filter((t) => this.member(t.id, userId)?.active === true)
      .sort((a, b) => compareNames(a.name, b.name));
  }

  private rolesOf(tenantId: string): Role[] {
    return this.roles.filter((p) => p.tenantId === tenantId);
  }

  private permissionsOf(member: Member): Set<string> {
    const permissions = new Set<string>();
    for (const role of this.rolesOf(member.tenantId)) {
      if (member.roles.has(role.id)) for (const code of role.permissions) permissions.add(code);
    }
    return permissions;
  }
}

const AUTHENTICATED_ROUTES = new Set([
  'GET /v1/session',
  'GET /v1/workflows',
  'GET /v1/notifications',
  'GET /v1/schedules',
  'DELETE /v1/session',
  'PUT /v1/session/tenant',
  'GET /v1/permissions',
  'GET /v1/roles',
  'POST /v1/roles',
  'GET /v1/roles/{id}',
  'PUT /v1/roles/{id}',
  'DELETE /v1/roles/{id}',
  'GET /v1/users',
  'POST /v1/users',
  'GET /v1/users/{id}',
  'PUT /v1/users/{id}',
  'POST /v1/users/{id}/password-reset',
  'GET /v1/api-keys',
  'POST /v1/api-keys',
  'DELETE /v1/api-keys/{id}',
  'GET /v1/authorized-domains',
  'POST /v1/authorized-domains',
  'DELETE /v1/authorized-domains/{id}',
  'GET /v1/audit/access-events',
  'GET /v1/settings/security',
  'PUT /v1/settings/security',
]);

/** `403 no_permission` if the caller has none of the permissions (the contract's alternative requirements). */
function require(who: Auth, codes: readonly PermissionCode[]): RouteResponse | undefined {
  return codes.some((code) => who.permissions.has(code)) ? undefined : problem(ERRORS.NoPermission);
}

/** Name and permissions of `POST` and `PUT /v1/roles`, or the 422. */
function readRoleData(request: Request): { name: string; permissions: PermissionCode[] } | RouteResponse {
  const body = readJson(request);
  if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
  const name = typeof body.name === 'string' ? body.name.trim() : '';
  const permissions = Array.isArray(body.permissions) ? body.permissions : undefined;
  const fields: Record<string, string> = {};
  if (name === '') fields.name = 'Informe o nome do papel.';
  if (!permissions || !permissions.every((p) => typeof p === 'string' && (CODES as readonly string[]).includes(p))) {
    fields.permissions = 'Informe permissões do catálogo.';
  }
  if (Object.keys(fields).length > 0 || !permissions) return problem({ ...ERRORS.InvalidData, fields: fields });
  return { name: name, permissions: [...new Set(permissions as PermissionCode[])] };
}

function textList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((id) => typeof id === 'string') ? [...new Set(value as string[])] : undefined;
}

/** `https?://host[:port]` in lower case, without trailing slash and without the default port; `undefined` out of format. */
function normalizeOrigin(value: string): string | undefined {
  const origin = value.trim();
  if (!/^https?:\/\/[^\s/?#@]+\/?$/i.test(origin)) return undefined;
  try {
    const url = new URL(origin);
    return url.hostname === '' ? undefined : url.origin.toLowerCase();
  } catch {
    return undefined;
  }
}

/** A page of `{items, next_cursor}` by `limit` (1 to 200, default 50) and by `cursor` (the position, as text). */
function paginate<T>(items: readonly T[], url: URL): RouteResponse {
  const limitText = url.searchParams.get('limit');
  const limit = limitText === null ? DEFAULT_LIMIT : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return problem(ERRORS.InvalidDataLimit);
  const cursor = url.searchParams.get('cursor');
  const start = cursor === null ? 0 : Number(cursor);
  if (!Number.isInteger(start) || start < 0 || start > items.length) return problem(ERRORS.InvalidCursor);
  const end = start + limit;
  return json(200, { items: items.slice(start, end), next_cursor: end < items.length ? String(end) : null });
}

/** An ISO 8601 instant of the query: `undefined` if absent, `null` if malformed. */
function instant(value: string | null): number | undefined | null {
  if (value === null || value === '') return undefined;
  const when = Date.parse(value);
  return Number.isNaN(when) ? null : when;
}

function tenantSummary(tenant: Tenant): Schemas['TenantSummary'] {
  return { id: tenant.id, name: tenant.name };
}

function compareNames(a: string, b: string): number {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'base' });
}

/** Names unique in the tenant, ignoring case and the spaces at the ends. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function permissionList(permissions: readonly string[]): string {
  return [...permissions].sort().join(', ') || 'nenhuma';
}

function secret(): string {
  return randomBytes(24).toString('base64url');
}

function iso(instantMs: number): string {
  return new Date(instantMs).toISOString();
}

function json(status: number, body: unknown): RouteResponse {
  return { status, contentType: 'application/json', body };
}

function empty(): RouteResponse {
  return { status: 204, contentType: 'application/json', body: undefined };
}

function problem(example: ErrorBody): RouteResponse {
  return { status: example.status, contentType: 'application/problem+json', body: example };
}

function isResponse(value: object): value is RouteResponse {
  return 'body' in value && 'status' in value;
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
