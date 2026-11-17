// Epic 2 simulated API (pnpm e2e): cookie and token sessions, users, roles, reset link, API
// keys, authorized domains, embedding, access audit and security settings, in memory, one per test.
//
// Answers like the contract (../backend/contratos/openapi.yaml) and like the backend domain (permission catalog, initial
// roles, sign-in and password rules, audit detail text), with the contract's error examples. Keeps the
// state across the pages of a test: the Admin creates a user on one page and the person signs in on another.
import { randomBytes, randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Route } from '@playwright/test';
import { isApiCall, API_ROUTES } from '../../support/simulated-api';
import { EXAMPLES, type ErrorBody, type Schemas, type Session } from '../../support/contract';

type PermissionCode = Schemas['CodigoPermissao'];
type SecurityField = keyof Schemas['AlteracaoConfiguracaoSeguranca'];

const ERRORS = EXAMPLES;

/** The backend catalog (`identidade/dominio/permissoes.py` and the names of `GET /v1/permissoes`), in its order. */
const PERMISSION_CATALOG: readonly Schemas['Permissao'][] = [
  { codigo: 'usuarios.gerenciar', nome: 'Gerenciar usuários', grupo: 'Administração', sensivel: false },
  { codigo: 'papeis.gerenciar', nome: 'Gerenciar papéis', grupo: 'Administração', sensivel: false },
  { codigo: 'integracao.gerenciar', nome: 'Gerenciar integração', grupo: 'Administração', sensivel: false },
  { codigo: 'seguranca.gerenciar', nome: 'Gerenciar segurança', grupo: 'Administração', sensivel: true },
  { codigo: 'conexoes.ver', nome: 'Ver conexões', grupo: 'Dados', sensivel: false },
  { codigo: 'conexoes.gerenciar', nome: 'Gerenciar conexões', grupo: 'Dados', sensivel: false },
  { codigo: 'credenciais.gerenciar', nome: 'Gerenciar credenciais', grupo: 'Dados', sensivel: true },
  { codigo: 'datasets.gerenciar', nome: 'Gerenciar datasets', grupo: 'Dados', sensivel: false },
  { codigo: 'sql_livre.usar', nome: 'Usar SQL livre', grupo: 'Dados', sensivel: false },
  { codigo: 'variaveis.gerenciar', nome: 'Gerenciar variáveis', grupo: 'Dados', sensivel: false },
  { codigo: 'workflows.ver', nome: 'Ver workflows', grupo: 'Workflows', sensivel: false },
  { codigo: 'workflows.editar', nome: 'Editar workflows', grupo: 'Workflows', sensivel: false },
  { codigo: 'testes.editar', nome: 'Editar testes', grupo: 'Workflows', sensivel: false },
  {
    codigo: 'teste.alterar_origem_cliente',
    nome: 'Aceitar alteração de teste de origem cliente',
    grupo: 'Workflows',
    sensivel: true,
  },
  { codigo: 'versao.enviar_revisao', nome: 'Enviar versão para revisão', grupo: 'Workflows', sensivel: false },
  { codigo: 'versao.aprovar', nome: 'Aprovar versão', grupo: 'Workflows', sensivel: true },
  { codigo: 'versao.publicar', nome: 'Publicar versão', grupo: 'Workflows', sensivel: false },
  { codigo: 'execucoes.ver', nome: 'Ver execuções', grupo: 'Execuções', sensivel: false },
  { codigo: 'execucoes.disparar', nome: 'Disparar execuções', grupo: 'Execuções', sensivel: false },
  { codigo: 'execucoes.agendar', nome: 'Agendar execuções', grupo: 'Execuções', sensivel: false },
  { codigo: 'execucao.reprocessar', nome: 'Reprocessar execução', grupo: 'Execuções', sensivel: true },
  { codigo: 'erro.ignorar', nome: 'Ignorar erro', grupo: 'Execuções', sensivel: true },
  { codigo: 'simulacao.rodar', nome: 'Rodar simulação', grupo: 'Execuções', sensivel: false },
  { codigo: 'estados.ver', nome: 'Ver estados', grupo: 'Estados', sensivel: false },
  { codigo: 'estado.ajustar', nome: 'Ajustar estado', grupo: 'Estados', sensivel: true },
  { codigo: 'auditoria.ver', nome: 'Ver auditoria', grupo: 'Auditoria', sensivel: false },
  { codigo: 'traces.ver', nome: 'Ver traces', grupo: 'Auditoria', sensivel: false },
];

const CODES: readonly PermissionCode[] = PERMISSION_CATALOG.map((permission) => permission.codigo);
const ADMIN = 'Admin';

/** The roles created in every new tenant (the backend's `PAPEIS_INICIAIS`). The Admin is the fixed one, with all permissions. */
const INITIAL_ROLES: Readonly<Record<string, readonly PermissionCode[]>> = {
  [ADMIN]: CODES,
  Integrador: PERMISSION_CATALOG.filter((permission) => permission.grupo === 'Dados').map((permission) => permission.codigo),
  Configurador: [
    'workflows.ver',
    'workflows.editar',
    'testes.editar',
    'versao.enviar_revisao',
    'simulacao.rodar',
    'conexoes.ver',
    'execucoes.ver',
  ],
  Aprovador: ['workflows.ver', 'versao.aprovar', 'versao.publicar', 'teste.alterar_origem_cliente', 'simulacao.rodar', 'execucoes.ver'],
  Operador: [
    'workflows.ver',
    'execucoes.ver',
    'execucoes.disparar',
    'execucoes.agendar',
    'execucao.reprocessar',
    'erro.ignorar',
    'estados.ver',
    'estado.ajustar',
  ],
  Auditor: CODES.filter((code) => code.endsWith('.ver')),
};

/** Default and (inclusive) bounds of each tenant security parameter (contract, `GET /v1/configuracoes/seguranca`). */
const SECURITY: Readonly<Record<SecurityField, { padrao: number; minimo: number; maximo: number }>> = {
  inatividade_minutos: { padrao: 480, minimo: 15, maximo: 1440 },
  duracao_maxima_dias: { padrao: 7, minimo: 1, maximo: 30 },
  senha_minima: { padrao: 12, minimo: 8, maximo: 64 },
  validade_link_horas: { padrao: 24, minimo: 1, maximo: 72 },
  validade_token_minutos: { padrao: 15, minimo: 5, maximo: 60 },
};
const SECURITY_FIELDS = Object.keys(SECURITY) as SecurityField[];

const EVENT_TYPES = [
  'login_ok',
  'login_falhou',
  'login_bloqueado',
  'logout',
  'troca_tenant',
  'redefinicao_gerada',
  'senha_redefinida',
  'chave_api_criada',
  'chave_api_revogada',
  'token_incorporacao_emitido',
  'papel_alterado',
  'usuario_alterado',
  'seguranca_alterada',
] as const;
type EventType = (typeof EVENT_TYPES)[number];

/** System sign-in rules (G4): 5 consecutive failures lock the e-mail for 15 minutes. */
const ATTEMPTS_UNTIL_LOCK = 5;
const LOCK_DURATION_MS = 15 * 60 * 1000;
const DEFAULT_LIMIT = 50;
const IP = '127.0.0.1';

const CSRF_COOKIE = 'fc_csrf';
const SESSION_COOKIE = 'fc_sessao';
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Resources with `{id}` in the path (`/v1/<resource>/{id}...`). */
const WITH_ID = new Set(['papeis', 'usuarios', 'chaves-api', 'dominios-autorizados']);

/** An account that already exists when the test starts (like the `preparar-local` ones). */
export interface InitialAccount {
  email: string;
  senha: string;
  nome: string;
  /** Tenant name → name of the user's role in it. */
  papeis: Readonly<Record<string, string>>;
}

interface User {
  id: string;
  email: string;
  nome: string;
  senha: string | null;
  /** Host app `id_externo`, for the user created by embedding. */
  externalId: string | null;
  lastTenant: string | null;
}

interface Member {
  tenantId: string;
  userId: string;
  papeis: Set<string>;
  ativo: boolean;
}

interface Role {
  id: string;
  tenantId: string;
  nome: string;
  permissoes: PermissionCode[];
  fixo: boolean;
}

interface Tenant {
  id: string;
  nome: string;
  security: Record<SecurityField, number>;
}

interface ApiKey {
  id: string;
  tenantId: string;
  nome: string;
  prefixo: string;
  chave: string;
  createdAt: number;
  lastUsedAt: number | null;
  revokedAt: number | null;
}

interface AuthorizedDomain {
  id: string;
  tenantId: string;
  origem: string;
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
  tipo: EventType;
  userId: string | null;
  email: string;
  detalhe: string | null;
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
  permissoes: ReadonlySet<string>;
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
  private readonly papeis: Role[] = [];
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
    /** Shell address: the base of the reset link (the backend's `FLUXO_URL_CASCA`). */
    private readonly shellUrl: string,
    private readonly now: () => number = Date.now,
  ) {
    for (const name of new Set(accounts.flatMap((account) => Object.keys(account.papeis)))) this.createTenant(name);
    for (const account of accounts) {
      const user = this.createUser(account.email, account.nome, account.senha, null);
      for (const [tenantName, roleName] of Object.entries(account.papeis)) {
        const tenant = this.tenants.find((t) => t.nome === tenantName);
        const role = this.papeis.find((p) => p.tenantId === tenant?.id && p.nome === roleName);
        if (!tenant || !role) throw new Error(`Conta inicial com tenant ou papel desconhecido: ${account.email}.`);
        this.members.push({ tenantId: tenant.id, userId: user.id, papeis: new Set([role.id]), ativo: true });
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
    if (id !== undefined && !UUID.test(id)) return problem(ERRORS.DadosInvalidosId);
    const withId = id ?? '';

    // Public and sign-in routes.
    switch (route) {
      case 'GET /v1/saude':
        return json(200, { status: 'ok' } satisfies Schemas['Saude']);
      case 'POST /v1/sessao':
        return this.signIn(request, context);
      case 'POST /v1/redefinicao/verificacao':
        return this.verifyLink(request);
      case 'POST /v1/redefinicao':
        return this.resetPassword(request);
      case 'POST /v1/incorporacao/sessoes':
        return this.issueEmbedToken(request);
    }

    const known = AUTHENTICATED_ROUTES.has(route);
    if (!known) {
      this.unexpected.push(route);
      return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, codigo: 'rota_nao_simulada' });
    }

    const who = this.authenticate(method, request, context);
    if (isResponse(who)) return who;

    switch (route) {
      case 'GET /v1/sessao':
        return json(200, this.sessionBody(who));
      case 'DELETE /v1/sessao':
        return this.signOut(who, context);
      case 'PUT /v1/sessao/tenant':
        return this.switchTenant(who, request, context);
      case 'GET /v1/permissoes':
        return require(who, ['papeis.gerenciar']) ?? json(200, { itens: PERMISSION_CATALOG });
      case 'GET /v1/papeis':
        return require(who, ['papeis.gerenciar', 'usuarios.gerenciar']) ?? json(200, { itens: this.tenantRoles(who.tenantId) });
      case 'POST /v1/papeis':
        return require(who, ['papeis.gerenciar']) ?? this.createRole(who, request);
      case 'GET /v1/papeis/{id}':
        return require(who, ['papeis.gerenciar']) ?? this.getRole(who, withId);
      case 'PUT /v1/papeis/{id}':
        return require(who, ['papeis.gerenciar']) ?? this.updateRole(who, withId, request);
      case 'DELETE /v1/papeis/{id}':
        return require(who, ['papeis.gerenciar']) ?? this.deleteRole(who, withId);
      case 'GET /v1/usuarios':
        return require(who, ['usuarios.gerenciar']) ?? this.listUsers(who, url);
      case 'POST /v1/usuarios':
        return require(who, ['usuarios.gerenciar']) ?? this.createMember(who, request);
      case 'GET /v1/usuarios/{id}':
        return require(who, ['usuarios.gerenciar']) ?? this.getUser(who, withId);
      case 'PUT /v1/usuarios/{id}':
        return require(who, ['usuarios.gerenciar']) ?? this.updateMember(who, withId, request);
      case 'POST /v1/usuarios/{id}/redefinicao':
        return require(who, ['usuarios.gerenciar']) ?? this.generateLink(who, withId);
      case 'GET /v1/chaves-api':
        return require(who, ['integracao.gerenciar']) ?? this.listApiKeys(who);
      case 'POST /v1/chaves-api':
        return require(who, ['integracao.gerenciar']) ?? this.createApiKey(who, request);
      case 'DELETE /v1/chaves-api/{id}':
        return require(who, ['integracao.gerenciar']) ?? this.revokeApiKey(who, withId);
      case 'GET /v1/dominios-autorizados':
        return require(who, ['integracao.gerenciar']) ?? this.listAuthorizedDomains(who);
      case 'POST /v1/dominios-autorizados':
        return require(who, ['integracao.gerenciar']) ?? this.createAuthorizedDomain(who, request);
      case 'DELETE /v1/dominios-autorizados/{id}':
        return require(who, ['integracao.gerenciar']) ?? this.deleteAuthorizedDomain(who, withId);
      case 'GET /v1/auditoria/acessos':
        return require(who, ['auditoria.ver']) ?? this.listAccessEvents(who, url);
      case 'GET /v1/configuracoes/seguranca':
        return require(who, ['seguranca.gerenciar']) ?? json(200, this.securityBody(who.tenantId));
      case 'PUT /v1/configuracoes/seguranca':
        return require(who, ['seguranca.gerenciar']) ?? this.updateSecurity(who, request);
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
      if (!token || this.now() >= token.expiresAt) return problem(ERRORS.SemSessao);
      const user = this.userById(token.userId);
      const member = this.member(token.tenantId, token.userId);
      if (!user || !member?.ativo) return problem(ERRORS.SemSessao);
      const origin = headers.origin;
      if (!this.authorizedDomains.some((d) => d.tenantId === token.tenantId && d.origem === origin)) {
        return problem(ERRORS.OrigemNaoAutorizada);
      }
      return { user, tenantId: token.tenantId, permissoes: this.permissionsOf(member), mode: 'token' };
    }

    const session = this.sessions.get(context);
    const user = session ? this.userById(session.userId) : undefined;
    const member = session ? this.member(session.tenantId, session.userId) : undefined;
    if (!session || !user || !member?.ativo) return problem(ERRORS.SemSessao);
    if (CSRF_METHODS.has(method) && headers['x-csrf-token'] !== session.csrf) return problem(ERRORS.CsrfInvalido);
    return { user, tenantId: session.tenantId, permissoes: this.permissionsOf(member), mode: 'cookie' };
  }

  // --- Session (epic 1, with the audit) ------------------------------------------------------------------------------

  /** `POST /v1/sessao`: order of the contract's rejections (415/422, lock 423, credentials 401). */
  private async signIn(request: Request, context: BrowserContext): Promise<RouteResponse> {
    if (!isJson(request)) return problem(ERRORS.TipoConteudoInvalido);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    const { email, senha: password } = body;
    if (typeof email !== 'string' || typeof password !== 'string') {
      const fields: Record<string, string> = {};
      if (typeof email !== 'string') fields.email = 'Informe o e-mail.';
      if (typeof password !== 'string') fields.senha = 'Informe a senha.';
      return problem({ ...ERRORS.DadosInvalidos, campos: fields });
    }

    const now = this.now();
    const emailKey = email.toLocaleLowerCase('en-US');
    const user = this.userByEmail(email);
    const audit = (type: EventType, tenantId: string | null = null, detail: string | null = null) =>
      this.audit({ tipo: type, email, userId: user?.id ?? null, tenantId, detalhe: detail });

    const lockEnd = this.unlocksAt(emailKey, now);
    if (lockEnd !== null) {
      const unlocksAt = new Date(lockEnd).toISOString();
      audit('login_bloqueado', null, `Bloqueado até ${unlocksAt}.`);
      return problem({ ...ERRORS.LoginBloqueado, desbloqueia_em: unlocksAt });
    }

    const tenants = user && user.senha !== null && user.senha === password ? this.tenantsOf(user.id) : [];
    const initial = tenants.find((t) => t.id === user?.lastTenant) ?? tenants[0];
    if (!user || !initial) {
      this.failures.set(emailKey, [...(this.failures.get(emailKey) ?? []), now]);
      audit('login_falhou');
      return problem(ERRORS.CredenciaisInvalidas);
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
    audit('login_ok', initial.id);
    return json(200, this.sessionBody({ user, tenantId: initial.id, permissoes: new Set(), mode: 'cookie' }));
  }

  private async signOut(who: Auth, context: BrowserContext): Promise<RouteResponse> {
    if (who.mode !== 'cookie') return problem(ERRORS.SemSessao);
    this.sessions.delete(context);
    await context.clearCookies({ name: SESSION_COOKIE });
    await context.clearCookies({ name: CSRF_COOKIE });
    this.audit({ tipo: 'logout', email: who.user.email, userId: who.user.id, tenantId: who.tenantId });
    return empty();
  }

  private switchTenant(who: Auth, request: Request, context: BrowserContext): RouteResponse {
    const session = this.sessions.get(context);
    if (who.mode !== 'cookie' || !session) return problem(ERRORS.SemSessao);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    const tenantId = body.tenant_id;
    if (typeof tenantId !== 'string' || !UUID.test(tenantId)) return problem(ERRORS.DadosInvalidos);
    if (!this.tenantsOf(who.user.id).some((t) => t.id === tenantId)) return problem(ERRORS.SemAcessoAoTenant);
    session.tenantId = tenantId;
    who.user.lastTenant = tenantId;
    this.audit({ tipo: 'troca_tenant', email: who.user.email, userId: who.user.id, tenantId });
    return json(200, this.sessionBody({ ...who, tenantId }));
  }

  /** Same as the backend domain's `desbloqueia_em`: the 5th consecutive failure locks for 15 min, counted from it. */
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
      usuario: { id: user.id, nome: user.nome, email: user.email },
      tenants: tenants.map(tenantSummary),
      tenant_atual: tenantSummary(current),
      permissoes: [...this.permissionsOf(member)].sort(),
    };
  }

  // --- Roles --------------------------------------------------------------------------------------------------------

  private createRole(who: Auth, request: Request): RouteResponse {
    const data = readRoleData(request);
    if (isResponse(data)) return data;
    if (this.rolesOf(who.tenantId).some((p) => sameName(p.nome, data.nome))) return problem(ERRORS.PapelExistente);
    const role: Role = { id: randomUUID(), tenantId: who.tenantId, nome: data.nome, permissoes: data.permissoes, fixo: false };
    this.papeis.push(role);
    this.auditActor(who, 'papel_alterado', `Papel ${role.nome} criado com: ${permissionList(role.permissoes)}.`);
    return json(201, this.roleBody(role));
  }

  private getRole(who: Auth, id: string): RouteResponse {
    const role = this.rolesOf(who.tenantId).find((p) => p.id === id);
    return role ? json(200, this.roleBody(role)) : problem(ERRORS.NaoEncontrado);
  }

  private updateRole(who: Auth, id: string, request: Request): RouteResponse {
    const role = this.rolesOf(who.tenantId).find((p) => p.id === id);
    if (!role) return problem(ERRORS.NaoEncontrado);
    if (role.fixo) return problem(ERRORS.PapelFixo);
    const data = readRoleData(request);
    if (isResponse(data)) return data;
    if (this.rolesOf(who.tenantId).some((p) => p.id !== id && sameName(p.nome, data.nome))) return problem(ERRORS.PapelExistente);
    role.nome = data.nome;
    role.permissoes = data.permissoes;
    this.auditActor(who, 'papel_alterado', `Papel ${role.nome} alterado: ${permissionList(role.permissoes)}.`);
    return json(200, this.roleBody(role));
  }

  private deleteRole(who: Auth, id: string): RouteResponse {
    const role = this.rolesOf(who.tenantId).find((p) => p.id === id);
    if (!role) return problem(ERRORS.NaoEncontrado);
    if (role.fixo) return problem(ERRORS.PapelFixo);
    if (this.members.some((m) => m.papeis.has(id))) return problem(ERRORS.PapelEmUso);
    this.papeis.splice(this.papeis.indexOf(role), 1);
    this.auditActor(who, 'papel_alterado', `Papel ${role.nome} removido.`);
    return empty();
  }

  private tenantRoles(tenantId: string): Schemas['Papel'][] {
    return [...this.rolesOf(tenantId)].sort((a, b) => compareNames(a.nome, b.nome)).map((role) => this.roleBody(role));
  }

  private roleBody(role: Role): Schemas['Papel'] {
    return {
      id: role.id,
      nome: role.nome,
      permissoes: [...role.permissoes].sort(),
      fixo: role.fixo,
      total_usuarios: this.members.filter((m) => m.papeis.has(role.id)).length,
    };
  }

  // --- Users and reset link --------------------------------------------------------------------------------

  private listUsers(who: Auth, url: URL): RouteResponse {
    const memberDetails = this.members
      .filter((m) => m.tenantId === who.tenantId)
      .map((m) => this.userBody(m))
      .sort((a, b) => compareNames(a.nome, b.nome) || a.id.localeCompare(b.id));
    return paginate(memberDetails, url);
  }

  private getUser(who: Auth, id: string): RouteResponse {
    const member = this.member(who.tenantId, id);
    return member ? json(200, this.userBody(member)) : problem(ERRORS.NaoEncontrado);
  }

  /** `POST /v1/usuarios`: an e-mail from another tenant reuses the user (without changing the name); from the same one, 409. */
  private createMember(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    const fields: Record<string, string> = {};
    const email = typeof body.email === 'string' ? body.email.trim() : '';
    const name = typeof body.nome === 'string' ? body.nome.trim() : '';
    if (!EMAIL.test(email)) fields.email = 'Informe um e-mail válido.';
    if (name === '') fields.nome = 'Informe o nome.';
    const roles = textList(body.papeis);
    if (roles === undefined) fields.papeis = 'Informe uma lista de papéis.';
    if (Object.keys(fields).length > 0 || roles === undefined) return problem({ ...ERRORS.DadosInvalidos, campos: fields });
    if (!roles.every((id) => this.rolesOf(who.tenantId).some((p) => p.id === id))) return problem(ERRORS.PapelInexistente);

    const existing = this.userByEmail(email);
    if (existing && this.member(who.tenantId, existing.id)) return problem(ERRORS.UsuarioExistente);
    const user = existing ?? this.createUser(email, name, null, null);
    const member: Member = { tenantId: who.tenantId, userId: user.id, papeis: new Set(roles), ativo: true };
    this.members.push(member);
    this.auditActor(who, 'usuario_alterado', `Usuário ${user.email} acrescentado com os papéis: ${this.roleNames(member)}.`);
    return json(201, this.userBody(member));
  }

  /** `PUT /v1/usuarios/{id}`: name, roles and status; the tenant is never left without an active Admin. */
  private updateMember(who: Auth, id: string, request: Request): RouteResponse {
    const member = this.member(who.tenantId, id);
    const user = this.userById(id);
    if (!member || !user) return problem(ERRORS.NaoEncontrado);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    const fields: Record<string, string> = {};
    const name = typeof body.nome === 'string' ? body.nome.trim() : '';
    if (name === '') fields.nome = 'Informe o nome.';
    const roles = textList(body.papeis);
    if (roles === undefined) fields.papeis = 'Informe uma lista de papéis.';
    if (typeof body.ativo !== 'boolean') fields.ativo = 'Informe se o usuário está ativo.';
    if (Object.keys(fields).length > 0 || roles === undefined || typeof body.ativo !== 'boolean') {
      return problem({ ...ERRORS.DadosInvalidos, campos: fields });
    }
    if (!roles.every((p) => this.rolesOf(who.tenantId).some((role) => role.id === p))) return problem(ERRORS.PapelInexistente);
    const admin = this.rolesOf(who.tenantId).find((p) => p.fixo);
    const staysAdmin = body.ativo && admin !== undefined && roles.includes(admin.id);
    const otherAdmin = this.members.some(
      (m) => m.tenantId === who.tenantId && m.userId !== id && m.ativo && admin !== undefined && m.papeis.has(admin.id),
    );
    if (!staysAdmin && !otherAdmin) return problem(ERRORS.UltimoAdmin);

    user.nome = name;
    member.papeis = new Set(roles);
    member.ativo = body.ativo;
    if (!member.ativo) {
      for (const [context, session] of this.sessions) {
        if (session.userId === id && session.tenantId === who.tenantId) this.sessions.delete(context);
      }
    }
    this.auditActor(who, 'usuario_alterado', `Usuário ${user.email} alterado.`);
    return json(200, this.userBody(member));
  }

  /** `POST /v1/usuarios/{id}/redefinicao`: single-use link; a new link invalidates the user's previous ones. */
  private generateLink(who: Auth, id: string): RouteResponse {
    const member = this.member(who.tenantId, id);
    const target = this.userById(id);
    if (!member || !target) return problem(ERRORS.NaoEncontrado);
    if (!member.ativo) return problem(ERRORS.UsuarioInativo);
    if (target.externalId !== null) return problem(ERRORS.UsuarioExterno);
    for (const link of this.links) if (link.userId === id) link.used = true;
    const link: ResetLink = {
      token: secret(),
      userId: id,
      tenantId: who.tenantId,
      expiresAt: this.now() + this.security(who.tenantId).validade_link_horas * 60 * 60 * 1000,
      used: false,
    };
    this.links.push(link);
    this.auditActor(who, 'redefinicao_gerada', `Link de redefinição para ${target.email} (${target.id}).`);
    return json(201, {
      link: `${this.shellUrl}/redefinir?token=${link.token}`,
      expira_em: new Date(link.expiresAt).toISOString(),
    } satisfies Schemas['LinkRedefinicao']);
  }

  /** `POST /v1/redefinicao/verificacao` (public): the largest minimum password among the user's tenants, without using the link. */
  private verifyLink(request: Request): RouteResponse {
    if (!isJson(request)) return problem(ERRORS.TipoConteudoInvalido);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    if (typeof body.token !== 'string') return problem(ERRORS.DadosInvalidosToken);
    const link = this.validLink(body.token);
    if (!link) return problem(ERRORS.LinkInvalido);
    return json(200, {
      senha_minima: this.minPasswordLengthOf(link.userId),
      expira_em: new Date(link.expiresAt).toISOString(),
    } satisfies Schemas['LinkVerificado']);
  }

  /** `POST /v1/redefinicao` (public): replaces the password, uses the link and ends the user's sessions. */
  private resetPassword(request: Request): RouteResponse {
    if (!isJson(request)) return problem(ERRORS.TipoConteudoInvalido);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    if (typeof body.token !== 'string') return problem(ERRORS.DadosInvalidosToken);
    if (typeof body.nova_senha !== 'string') return problem(ERRORS.DadosInvalidosNovaSenha);
    const link = this.validLink(body.token);
    const user = link ? this.userById(link.userId) : undefined;
    if (!link || !user) return problem(ERRORS.LinkInvalido);

    const minimum = this.minPasswordLengthOf(user.id);
    if (Array.from(body.nova_senha).length < minimum) {
      return problem({ ...ERRORS.SenhaInvalida, campos: { nova_senha: `A senha precisa ter pelo menos ${minimum} caracteres.` } });
    }
    if (body.nova_senha.toLocaleLowerCase('en-US').includes(user.email.toLocaleLowerCase('en-US'))) {
      return problem({ ...ERRORS.SenhaInvalida, campos: { nova_senha: 'A senha não pode conter o e-mail.' } });
    }
    user.senha = body.nova_senha;
    link.used = true;
    for (const [context, session] of this.sessions) if (session.userId === user.id) this.sessions.delete(context);
    this.audit({ tipo: 'senha_redefinida', email: user.email, userId: user.id, tenantId: link.tenantId });
    return empty();
  }

  private validLink(token: string): ResetLink | undefined {
    return this.links.find((link) => link.token === token && !link.used && this.now() < link.expiresAt);
  }

  private minPasswordLengthOf(userId: string): number {
    const minimums = this.tenantsOf(userId).map((t) => this.security(t.id).senha_minima);
    return Math.max(SECURITY.senha_minima.padrao, ...minimums);
  }

  private userBody(member: Member): Schemas['Usuario'] {
    const user = this.userById(member.userId);
    if (!user) throw new Error(`Membro sem usuário: ${member.userId}`);
    const roles = this.rolesOf(member.tenantId)
      .filter((p) => member.papeis.has(p.id))
      .sort((a, b) => compareNames(a.nome, b.nome))
      .map((p) => ({ id: p.id, nome: p.nome }));
    return { id: user.id, email: user.email, nome: user.nome, papeis: roles, ativo: member.ativo, externo: user.externalId !== null };
  }

  private roleNames(member: Member): string {
    const names = this.rolesOf(member.tenantId)
      .filter((p) => member.papeis.has(p.id))
      .map((p) => p.nome)
      .sort(compareNames);
    return names.join(', ') || 'nenhum';
  }

  // --- Integration: API keys, authorized domains and embedding ------------------------------------------------

  private listApiKeys(who: Auth): RouteResponse {
    const items = this.apiKeys
      .filter((c) => c.tenantId === who.tenantId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map(
        (c): Schemas['ChaveApi'] => ({
          id: c.id,
          nome: c.nome,
          prefixo: c.prefixo,
          criada_em: iso(c.createdAt),
          ultimo_uso_em: c.lastUsedAt === null ? null : iso(c.lastUsedAt),
          revogada_em: c.revokedAt === null ? null : iso(c.revokedAt),
        }),
      );
    return json(200, { itens: items, proximo_cursor: null } satisfies Schemas['ListaChavesApi']);
  }

  private createApiKey(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    const name = typeof body.nome === 'string' ? body.nome.trim() : '';
    if (name === '') return problem({ ...ERRORS.DadosInvalidos, campos: { nome: 'Informe o nome.' } });
    const value = `fc_${secret()}`;
    const apiKey: ApiKey = {
      id: randomUUID(),
      tenantId: who.tenantId,
      nome: name,
      prefixo: value.slice(0, 11),
      chave: value,
      createdAt: this.now(),
      lastUsedAt: null,
      revokedAt: null,
    };
    this.apiKeys.push(apiKey);
    this.auditActor(who, 'chave_api_criada', `Chave ${apiKey.prefixo} (${apiKey.nome}).`);
    return json(201, { id: apiKey.id, nome: apiKey.nome, prefixo: apiKey.prefixo, chave: apiKey.chave } satisfies Schemas['ChaveApiCriada']);
  }

  /** Revoking an already revoked key also answers 204. */
  private revokeApiKey(who: Auth, id: string): RouteResponse {
    const apiKey = this.apiKeys.find((c) => c.id === id && c.tenantId === who.tenantId);
    if (!apiKey) return problem(ERRORS.NaoEncontrado);
    if (apiKey.revokedAt === null) {
      apiKey.revokedAt = this.now();
      this.auditActor(who, 'chave_api_revogada', `Chave ${apiKey.prefixo} (${apiKey.nome}).`);
    }
    return empty();
  }

  private listAuthorizedDomains(who: Auth): RouteResponse {
    const items = this.authorizedDomains
      .filter((d) => d.tenantId === who.tenantId)
      .sort((a, b) => b.createdAt - a.createdAt)
      .map((d): Schemas['DominioAutorizado'] => ({ id: d.id, origem: d.origem, criado_em: iso(d.createdAt) }));
    return json(200, { itens: items } satisfies Schemas['ListaDominiosAutorizados']);
  }

  private createAuthorizedDomain(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    if (typeof body.origem !== 'string') return problem(ERRORS.DadosInvalidosOrigem);
    const origin = normalizeOrigin(body.origem);
    if (origin === undefined) return problem(ERRORS.OrigemInvalida);
    if (this.authorizedDomains.some((d) => d.tenantId === who.tenantId && d.origem === origin)) return problem(ERRORS.DominioExistente);
    const authorizedDomain: AuthorizedDomain = { id: randomUUID(), tenantId: who.tenantId, origem: origin, createdAt: this.now() };
    this.authorizedDomains.push(authorizedDomain);
    return json(201, { id: authorizedDomain.id, origem: origin, criado_em: iso(authorizedDomain.createdAt) } satisfies Schemas['DominioAutorizado']);
  }

  private deleteAuthorizedDomain(who: Auth, id: string): RouteResponse {
    const index = this.authorizedDomains.findIndex((d) => d.id === id && d.tenantId === who.tenantId);
    if (index === -1) return problem(ERRORS.NaoEncontrado);
    this.authorizedDomains.splice(index, 1);
    return empty();
  }

  /**
   * `POST /v1/incorporacao/sessoes` (`Authorization: Chave <key>`): creates or updates the external user of the
   * `id_externo` in the key's tenant, with the roles by name (never the Admin), and returns the token.
   */
  private issueEmbedToken(request: Request): RouteResponse {
    const authorization = request.headers().authorization ?? '';
    const apiKey = authorization.startsWith('Chave ')
      ? this.apiKeys.find((c) => c.chave === authorization.slice('Chave '.length) && c.revokedAt === null)
      : undefined;
    if (!apiKey) return problem(ERRORS.ChaveInvalida);
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    const text = (value: unknown) => (typeof value === 'string' ? value.trim() : '');
    const externalId = text(body.id_externo);
    const email = text(body.email);
    const name = text(body.nome);
    const roleNames = textList(body.papeis);
    const fields: Record<string, string> = {};
    if (externalId === '') fields.id_externo = 'Campo obrigatório.';
    if (email === '') fields.email = 'Campo obrigatório.';
    if (name === '') fields.nome = 'Campo obrigatório.';
    if (roleNames === undefined) fields.papeis = 'Informe uma lista de papéis.';
    if (Object.keys(fields).length > 0 || roleNames === undefined) return problem({ ...ERRORS.DadosInvalidos, campos: fields });

    const ofTenant = this.rolesOf(apiKey.tenantId);
    if (roleNames.some((n) => ofTenant.some((p) => p.fixo && sameName(p.nome, n)))) return problem(ERRORS.PapelNaoPermitido);
    const roles = roleNames.map((n) => ofTenant.find((p) => sameName(p.nome, n)));
    if (roles.some((p) => p === undefined)) return problem(ERRORS.PapelInexistente);

    let user = this.users.find((u) => u.externalId === `${apiKey.tenantId}:${externalId}`);
    const owner = this.userByEmail(email);
    if (owner && owner !== user) return problem(ERRORS.EmailEmUso);
    user ??= this.createUser(email, name, null, `${apiKey.tenantId}:${externalId}`);
    user.email = email;
    user.nome = name;
    let member = this.member(apiKey.tenantId, user.id);
    if (member && !member.ativo) return problem(ERRORS.UsuarioInativoIncorporacao);
    const admin = ofTenant.find((p) => p.fixo);
    const ids = new Set(roles.map((p) => p?.id ?? ''));
    if (member && admin && member.papeis.has(admin.id)) ids.add(admin.id);
    if (member) member.papeis = ids;
    else {
      member = { tenantId: apiKey.tenantId, userId: user.id, papeis: ids, ativo: true };
      this.members.push(member);
    }

    const now = this.now();
    const token = secret();
    const expiresAt = now + this.security(apiKey.tenantId).validade_token_minutos * 60 * 1000;
    this.tokens.set(token, { userId: user.id, tenantId: apiKey.tenantId, expiresAt });
    apiKey.lastUsedAt = now;
    this.audit({
      tipo: 'token_incorporacao_emitido',
      email,
      userId: user.id,
      tenantId: apiKey.tenantId,
      detalhe: `Chave ${apiKey.prefixo}; id externo ${externalId}.`,
    });
    return json(201, { token, expira_em: iso(expiresAt) } satisfies Schemas['TokenIncorporacao']);
  }

  // --- Access audit ------------------------------------------------------------------------------------------

  /**
   * `GET /v1/auditoria/acessos`: the tenant's events and the tenantless ones (sign-in failure and lock) of one of its members,
   * from newest to oldest, with the filters `tipo` (repeated), `desde` (inclusive) and `ate` (exclusive).
   */
  private listAccessEvents(who: Auth, url: URL): RouteResponse {
    const types = url.searchParams.getAll('tipo');
    const unknown = types.find((type) => !(EVENT_TYPES as readonly string[]).includes(type));
    if (unknown !== undefined) {
      return problem({ ...ERRORS.TipoEventoInvalido, campos: { tipo: `Tipo desconhecido: '${unknown}'.` } });
    }
    const since = instant(url.searchParams.get('desde'));
    const until = instant(url.searchParams.get('ate'));
    if (since === null || until === null) return problem(ERRORS.DadosInvalidos);
    if (since !== undefined && until !== undefined && since > until) {
      return problem({ ...ERRORS.DadosInvalidos, campos: { ate: 'Informe um fim depois do início.' } });
    }
    const events = this.events
      .filter(
        (e) =>
          e.tenantId === who.tenantId ||
          (e.tenantId === null && e.userId !== null && this.member(who.tenantId, e.userId) !== undefined),
      )
      .filter((e) => types.length === 0 || types.includes(e.tipo))
      .filter((e) => (since === undefined || e.occurredAt >= since) && (until === undefined || e.occurredAt < until))
      .sort((a, b) => b.occurredAt - a.occurredAt || b.order - a.order)
      .map(
        (e): Schemas['EventoAcesso'] => ({
          id: e.id,
          ocorrido_em: iso(e.occurredAt),
          tipo: e.tipo,
          usuario_id: e.userId,
          email_informado: e.email,
          ip: IP,
          detalhe: e.detalhe,
        }),
      );
    return paginate(events, url);
  }

  private audit(event: { tipo: EventType; email: string; userId: string | null; tenantId: string | null; detalhe?: string | null }) {
    this.events.push({ id: randomUUID(), order: this.events.length, occurredAt: this.now(), detalhe: null, ...event });
  }

  /** Event of whoever made the change (the Admin), as the backend records access changes. */
  private auditActor(who: Auth, type: EventType, detail: string) {
    this.audit({ tipo: type, email: who.user.email, userId: who.user.id, tenantId: who.tenantId, detalhe: detail });
  }

  // --- Security settings -------------------------------------------------------------------------------------

  private securityBody(tenantId: string): Schemas['ConfiguracaoSeguranca'] {
    const values = this.security(tenantId);
    return Object.fromEntries(
      SECURITY_FIELDS.map((field) => [field, { valor: values[field], ...SECURITY[field] }]),
    ) as Schemas['ConfiguracaoSeguranca'];
  }

  /** `PUT /v1/configuracoes/seguranca`: the five integers; out of range, 422 with all fields and nothing saved. */
  private updateSecurity(who: Auth, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
    const types: Record<string, string> = {};
    const outOfRange: Record<string, string> = {};
    const newOnes = { ...this.security(who.tenantId) };
    for (const field of SECURITY_FIELDS) {
      const value = body[field];
      if (typeof value !== 'number' || !Number.isInteger(value)) types[field] = 'Informe um número inteiro.';
      else if (value < SECURITY[field].minimo || value > SECURITY[field].maximo) {
        outOfRange[field] = `Informe um valor de ${SECURITY[field].minimo} a ${SECURITY[field].maximo}.`;
      } else newOnes[field] = value;
    }
    if (Object.keys(types).length > 0) return problem({ ...ERRORS.DadosInvalidosSeguranca, campos: types });
    if (Object.keys(outOfRange).length > 0) return problem({ ...ERRORS.ValorForaDoLimite, campos: outOfRange });

    const tenant = this.tenants.find((t) => t.id === who.tenantId);
    if (!tenant) throw new Error(`Tenant desconhecido: ${who.tenantId}`);
    // Like the backend: `field: old → new` for each field that changed, and nothing is audited if nothing changed.
    const changes = SECURITY_FIELDS.filter((field) => newOnes[field] !== tenant.security[field]).map(
      (field) => `${field}: ${tenant.security[field]} → ${newOnes[field]}`,
    );
    if (changes.length > 0) {
      tenant.security = newOnes;
      this.auditActor(who, 'seguranca_alterada', `${changes.join('; ')}.`);
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
      nome: name,
      security: Object.fromEntries(SECURITY_FIELDS.map((field) => [field, SECURITY[field].padrao])) as Record<SecurityField, number>,
    };
    this.tenants.push(tenant);
    for (const [roleName, permissions] of Object.entries(INITIAL_ROLES)) {
      this.papeis.push({ id: randomUUID(), tenantId: tenant.id, nome: roleName, permissoes: [...permissions], fixo: roleName === ADMIN });
    }
    return tenant;
  }

  private createUser(email: string, name: string, password: string | null, externalId: string | null): User {
    const user: User = { id: randomUUID(), email, nome: name, senha: password, externalId, lastTenant: null };
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
      .filter((t) => this.member(t.id, userId)?.ativo === true)
      .sort((a, b) => compareNames(a.nome, b.nome));
  }

  private rolesOf(tenantId: string): Role[] {
    return this.papeis.filter((p) => p.tenantId === tenantId);
  }

  private permissionsOf(member: Member): Set<string> {
    const permissions = new Set<string>();
    for (const role of this.rolesOf(member.tenantId)) {
      if (member.papeis.has(role.id)) for (const code of role.permissoes) permissions.add(code);
    }
    return permissions;
  }
}

const AUTHENTICATED_ROUTES = new Set([
  'GET /v1/sessao',
  'DELETE /v1/sessao',
  'PUT /v1/sessao/tenant',
  'GET /v1/permissoes',
  'GET /v1/papeis',
  'POST /v1/papeis',
  'GET /v1/papeis/{id}',
  'PUT /v1/papeis/{id}',
  'DELETE /v1/papeis/{id}',
  'GET /v1/usuarios',
  'POST /v1/usuarios',
  'GET /v1/usuarios/{id}',
  'PUT /v1/usuarios/{id}',
  'POST /v1/usuarios/{id}/redefinicao',
  'GET /v1/chaves-api',
  'POST /v1/chaves-api',
  'DELETE /v1/chaves-api/{id}',
  'GET /v1/dominios-autorizados',
  'POST /v1/dominios-autorizados',
  'DELETE /v1/dominios-autorizados/{id}',
  'GET /v1/auditoria/acessos',
  'GET /v1/configuracoes/seguranca',
  'PUT /v1/configuracoes/seguranca',
]);

/** `403 sem_permissao` if the caller has none of the permissions (the contract's alternative requirements). */
function require(who: Auth, codes: readonly PermissionCode[]): RouteResponse | undefined {
  return codes.some((code) => who.permissoes.has(code)) ? undefined : problem(ERRORS.SemPermissao);
}

/** Name and permissions of `POST` and `PUT /v1/papeis`, or the 422. */
function readRoleData(request: Request): { nome: string; permissoes: PermissionCode[] } | RouteResponse {
  const body = readJson(request);
  if (body === undefined) return problem(ERRORS.DadosInvalidosJsonMalformado);
  const name = typeof body.nome === 'string' ? body.nome.trim() : '';
  const permissions = Array.isArray(body.permissoes) ? body.permissoes : undefined;
  const fields: Record<string, string> = {};
  if (name === '') fields.nome = 'Informe o nome do papel.';
  if (!permissions || !permissions.every((p) => typeof p === 'string' && (CODES as readonly string[]).includes(p))) {
    fields.permissoes = 'Informe permissões do catálogo.';
  }
  if (Object.keys(fields).length > 0 || !permissions) return problem({ ...ERRORS.DadosInvalidos, campos: fields });
  return { nome: name, permissoes: [...new Set(permissions as PermissionCode[])] };
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

/** A page of `{itens, proximo_cursor}` by `limite` (1 to 200, default 50) and by `cursor` (the position, as text). */
function paginate<T>(items: readonly T[], url: URL): RouteResponse {
  const limitText = url.searchParams.get('limite');
  const limit = limitText === null ? DEFAULT_LIMIT : Number(limitText);
  if (!Number.isInteger(limit) || limit < 1 || limit > 200) return problem(ERRORS.DadosInvalidosLimite);
  const cursor = url.searchParams.get('cursor');
  const start = cursor === null ? 0 : Number(cursor);
  if (!Number.isInteger(start) || start < 0 || start > items.length) return problem(ERRORS.CursorInvalido);
  const end = start + limit;
  return json(200, { itens: items.slice(start, end), proximo_cursor: end < items.length ? String(end) : null });
}

/** An ISO 8601 instant of the query: `undefined` if absent, `null` if malformed. */
function instant(value: string | null): number | undefined | null {
  if (value === null || value === '') return undefined;
  const when = Date.parse(value);
  return Number.isNaN(when) ? null : when;
}

function tenantSummary(tenant: Tenant): Schemas['TenantResumo'] {
  return { id: tenant.id, nome: tenant.nome };
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
