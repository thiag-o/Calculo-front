// Epic 4 simulated API (pnpm e2e): workflows, drafts, analysis, unit run and the formula language, in memory, one per
// test. It answers only `/v1/workflows...` and `/v1/formula-language`; the others (session, sign-in, preflight) go on to
// the epic 2 simulation, which keeps the session (`route.fallback()`).
//
// Answers like the contract (../backend/contracts/openapi.yaml) and like the backend domain: optimistic revision of the
// draft (`409 draft_conflict`), problems that do not stop the save, "Calcular" only on the saved draft without problems,
// `workflows.edit` on the mutations and `workflows.edit` or `simulations.run` on "Calcular". The tenant starts with the
// workflow "Pontuação de exemplo" of the backend's `prepare-local`, with the draft of the contract example.
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Response, Route } from '@playwright/test';
import { EXAMPLE_DRAFT_DEFINITION, EXAMPLES, type ErrorBody, type Schemas, type Session } from '../../support/contract';
import { API_ROUTES, isApiCall } from '../../support/simulated-api';
import { analyze, runUnit, type Analysis } from './engine';

type Definition = Schemas['WorkflowDefinition'];
type Workflow = Schemas['Workflow'];
type Draft = Schemas['Draft'];
type UserRef = Schemas['UserRef'];

const ERRORS = EXAMPLES;

/** The name of the sample workflow `prepare-local` creates (backend plan, B71). */
export const SAMPLE_WORKFLOW = 'Pontuação de exemplo';

/** The definition of a new workflow (contract, `WorkflowDefinition`). */
const EMPTY_DEFINITION = {
  ...EXAMPLES.DraftEmpty.definition,
  root: { ...EXAMPLES.DraftEmpty.definition.root, batch_source: null },
} as Definition;

const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 200;
const OBJECTIVE_MAX = 1000;
const DEFAULT_LIMIT = 50;
/** Who created the sample workflow in the backend: `prepare-local`, with the demonstration Admin. */
const PREPARE_LOCAL: UserRef = { id: '7d0c1f6e-0000-4000-8000-0000000000a1', name: 'Administradora Demonstração' };

interface StoredWorkflow {
  id: string;
  name: string;
  objective: string | null;
  createdAt: number;
  createdBy: UserRef;
  updatedAt: number;
  updatedBy: UserRef;
  draft: { revision: number; definition: Definition; analysis: Analysis; updatedAt: number; updatedBy: UserRef };
}

/** Who calls, from the session the epic 2 simulation answered on this context. */
interface Caller {
  user: UserRef;
  permissions: ReadonlySet<string>;
}

interface RouteResponse {
  status: number;
  contentType: 'application/json' | 'application/problem+json';
  body: unknown;
}

/** A mutation the shell sent (method and path), for the tests to check that nothing was written. */
export interface ReceivedMutation {
  method: string;
  path: string;
}

export class WorkflowSimulation {
  readonly unexpected: string[] = [];
  readonly mutations: ReceivedMutation[] = [];

  private readonly workflows: StoredWorkflow[] = [];
  /** The last session read on each context (`GET /v1/session`, sign-in, tenant switch): who calls and their permissions. */
  private readonly sessions = new Map<BrowserContext, Promise<Caller | null>>();

  constructor(
    private readonly shellOrigin: string,
    private readonly now: () => number = Date.now,
  ) {
    const created = this.now() - 60 * 60 * 1000;
    const definition = structuredClone(EXAMPLE_DRAFT_DEFINITION);
    this.workflows.push({
      id: randomUUID(),
      name: SAMPLE_WORKFLOW,
      objective: EXAMPLES.Workflow.objective,
      createdAt: created,
      createdBy: PREPARE_LOCAL,
      updatedAt: created,
      updatedBy: PREPARE_LOCAL,
      draft: { revision: 1, definition, analysis: analyze(definition), updatedAt: created, updatedBy: PREPARE_LOCAL },
    });
  }

  /** Turns the simulation on for a page: workflow calls land here; the rest goes on to the previous routes. */
  async install(page: Page): Promise<void> {
    const context = page.context();
    page.on('response', (response) => this.watchSession(response, context));
    await page.route(API_ROUTES, (route) =>
      isApiCall(route, this.shellOrigin) ? this.respond(route, context) : route.fallback(),
    );
  }

  /** Keeps who is signed in on the context, from the session responses the epic 2 simulation gives. */
  private watchSession(response: Response, context: BrowserContext): void {
    const url = new URL(response.url());
    const method = response.request().method();
    if (url.origin === this.shellOrigin || !url.pathname.startsWith('/v1/session')) return;
    if (method === 'DELETE') {
      this.sessions.set(context, Promise.resolve(null));
      return;
    }
    if (response.status() !== 200 || method === 'OPTIONS') return;
    this.sessions.set(
      context,
      response
        .json()
        .then((session: Session) => ({ user: { id: session.user.id, name: session.user.name }, permissions: new Set(session.permissions) }))
        .catch(() => null),
    );
  }

  // --- Entrada -------------------------------------------------------------------------------------------------------

  private async respond(route: Route, context: BrowserContext): Promise<void> {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const parts = url.pathname.split('/');
    // Preflight and the routes of the other epics: the epic 2 simulation answers.
    if (method === 'OPTIONS' || (parts[2] !== 'workflows' && parts[2] !== 'formula-language')) {
      await route.fallback();
      return;
    }
    let id: string | undefined;
    if (parts.length >= 4) {
      id = parts[3];
      parts[3] = '{id}';
    }
    const key = `${method} ${parts.join('/')}`;
    if (CSRF_METHODS.has(method)) this.mutations.push({ method, path: url.pathname });
    const response =
      id !== undefined && !UUID.test(id)
        ? problem(ERRORS.InvalidDataId)
        : await this.authenticated(method, request, context, (caller) => this.handle(key, id ?? '', url, request, caller));
    await route.fulfill({
      status: response.status,
      headers: {
        'access-control-allow-origin': request.headers().origin ?? this.shellOrigin,
        'access-control-allow-credentials': 'true',
        vary: 'Origin',
        ...(response.body === undefined ? {} : { 'content-type': response.contentType }),
      },
      body: response.body === undefined ? undefined : JSON.stringify(response.body),
    });
  }

  /** The session of the context and, on mutations, the session cookie and the CSRF token equal to the `fc_csrf` cookie. */
  private async authenticated(
    method: string,
    request: Request,
    context: BrowserContext,
    then: (caller: Caller) => RouteResponse,
  ): Promise<RouteResponse> {
    const caller = await this.sessions.get(context);
    if (!caller) return problem(ERRORS.NoSession);
    if (CSRF_METHODS.has(method)) {
      const cookies = await context.cookies(new URL(request.url()).origin);
      const session = cookies.find((cookie) => cookie.name === 'fc_session');
      const csrf = cookies.find((cookie) => cookie.name === 'fc_csrf');
      if (!session) return problem(ERRORS.NoSession);
      if (csrf === undefined || request.headers()['x-csrf-token'] !== csrf.value) return problem(ERRORS.InvalidCsrf);
    }
    return then(caller);
  }

  private handle(route: string, id: string, url: URL, request: Request, caller: Caller): RouteResponse {
    const can = (...permissions: string[]) => permissions.some((permission) => caller.permissions.has(permission));
    const view = can('workflows.view') ? null : problem(ERRORS.NoPermission);
    const edit = can('workflows.edit') ? null : problem(ERRORS.NoPermission);
    switch (route) {
      case 'GET /v1/formula-language':
        return view ?? json(200, EXAMPLES.FormulaLanguage);
      case 'GET /v1/notifications':
        // The bell (F130, mounted by F131) and the "Próxima execução" of the overview read these two; the contract's examples serve.
        return json(200, EXAMPLES.NotificationList);
      case 'GET /v1/schedules':
        return json(200, EXAMPLES.ScheduleList);
      case 'GET /v1/workflows':
        return view ?? this.list(url);
      case 'POST /v1/workflows':
        return edit ?? this.create(request, caller);
      case 'GET /v1/workflows/{id}':
        return view ?? this.withWorkflow(id, (w) => json(200, this.workflowBody(w)));
      case 'PUT /v1/workflows/{id}':
        return edit ?? this.withWorkflow(id, (w) => this.update(w, request, caller));
      case 'DELETE /v1/workflows/{id}':
        return edit ?? this.withWorkflow(id, (w) => this.remove(w));
      case 'GET /v1/workflows/{id}/draft':
        return view ?? this.withWorkflow(id, (w) => json(200, this.draftBody(w)));
      case 'PUT /v1/workflows/{id}/draft':
        return edit ?? this.withWorkflow(id, (w) => this.saveDraft(w, request, caller));
      case 'POST /v1/workflows/{id}/draft/analysis':
        return edit ?? this.withWorkflow(id, () => this.analysis(request));
      case 'POST /v1/workflows/{id}/draft/unit-runs':
        return can('workflows.edit', 'simulations.run')
          ? this.withWorkflow(id, (w) => this.unitRun(w, request))
          : problem(ERRORS.NoPermission);
      default:
        this.unexpected.push(route);
        return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, code: 'route_not_simulated' });
    }
  }

  // --- Workflows -----------------------------------------------------------------------------------------------------

  private withWorkflow(id: string, then: (workflow: StoredWorkflow) => RouteResponse): RouteResponse {
    const workflow = this.workflows.find((w) => w.id === id);
    return workflow ? then(workflow) : problem(ERRORS.NotFound);
  }

  /** The most recently changed first; `name` filters by part of the name, ignoring case. One page is enough here. */
  private list(url: URL): RouteResponse {
    const name = url.searchParams.get('name')?.trim().toLocaleLowerCase('pt-BR') ?? '';
    const limit = Number(url.searchParams.get('limit') ?? DEFAULT_LIMIT);
    const items = this.workflows
      .filter((w) => w.name.toLocaleLowerCase('pt-BR').includes(name))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, limit)
      .map((w) => this.summary(w));
    return json(200, { items, next_cursor: null } satisfies Schemas['WorkflowList']);
  }

  private create(request: Request, caller: Caller): RouteResponse {
    const body = readJson(request);
    const fields = workflowFields(body);
    if (fields.problem) return fields.problem;
    if (this.nameTaken(fields.name)) return problem(ERRORS.WorkflowExists);
    const now = this.now();
    const definition = structuredClone(EMPTY_DEFINITION);
    const workflow: StoredWorkflow = {
      id: randomUUID(),
      name: fields.name,
      objective: fields.objective,
      createdAt: now,
      createdBy: caller.user,
      updatedAt: now,
      updatedBy: caller.user,
      draft: { revision: 1, definition, analysis: analyze(definition), updatedAt: now, updatedBy: caller.user },
    };
    this.workflows.push(workflow);
    return json(201, this.workflowBody(workflow));
  }

  private update(workflow: StoredWorkflow, request: Request, caller: Caller): RouteResponse {
    const fields = workflowFields(readJson(request));
    if (fields.problem) return fields.problem;
    if (this.nameTaken(fields.name, workflow.id)) return problem(ERRORS.WorkflowExists);
    workflow.name = fields.name;
    workflow.objective = fields.objective;
    workflow.updatedAt = this.now();
    workflow.updatedBy = caller.user;
    return json(200, this.workflowBody(workflow));
  }

  private remove(workflow: StoredWorkflow): RouteResponse {
    this.workflows.splice(this.workflows.indexOf(workflow), 1);
    return { status: 204, contentType: 'application/json', body: undefined };
  }

  /** Same name ignoring case and the spaces at the ends (like the backend). */
  private nameTaken(name: string, except?: string): boolean {
    const key = name.trim().toLocaleLowerCase('pt-BR');
    return this.workflows.some((w) => w.id !== except && w.name.trim().toLocaleLowerCase('pt-BR') === key);
  }

  // --- Draft ---------------------------------------------------------------------------------------------------------

  /** `PUT .../draft`: on the current revision only (`409 draft_conflict` with the current one); problems do not stop it. */
  private saveDraft(workflow: StoredWorkflow, request: Request, caller: Caller): RouteResponse {
    const body = readJson(request);
    const definition = body?.definition;
    if (typeof body?.revision !== 'number' || !isDefinition(definition)) return problem(ERRORS.InvalidData);
    if (body.revision !== workflow.draft.revision) {
      return problem({ ...ERRORS.DraftConflict, current_revision: workflow.draft.revision });
    }
    const now = this.now();
    const saved = toVersion4(definition);
    workflow.draft = { revision: workflow.draft.revision + 1, definition: saved, analysis: analyze(saved), updatedAt: now, updatedBy: caller.user };
    workflow.updatedAt = now;
    workflow.updatedBy = caller.user;
    return json(200, this.draftBody(workflow));
  }

  private analysis(request: Request): RouteResponse {
    const definition = readJson(request)?.definition;
    return isDefinition(definition) ? json(200, analyze(definition)) : problem(ERRORS.InvalidData);
  }

  /** `POST .../draft/unit-runs`: the saved draft of that revision, without problems. */
  private unitRun(workflow: StoredWorkflow, request: Request): RouteResponse {
    const body = readJson(request);
    const inputs = body?.inputs;
    if (typeof body?.revision !== 'number' || inputs === null || typeof inputs !== 'object' || Array.isArray(inputs)) {
      return problem(ERRORS.InvalidData);
    }
    if (body.revision !== workflow.draft.revision) {
      return problem({ ...ERRORS.DraftConflict, current_revision: workflow.draft.revision });
    }
    const { definition, analysis } = workflow.draft;
    if (analysis.problems.length > 0) return problem({ ...ERRORS.DraftHasProblems, problems: analysis.problems });
    return json(200, runUnit(definition, analysis, inputs as Record<string, Schemas['Value']>));
  }

  // --- Bodies --------------------------------------------------------------------------------------------------------

  private summary(workflow: StoredWorkflow): Schemas['WorkflowSummary'] {
    const { draft } = workflow;
    return {
      id: workflow.id,
      name: workflow.name,
      objective: workflow.objective,
      kind: 'batch',
      updated_at: iso(workflow.updatedAt),
      updated_by: workflow.updatedBy,
      draft: {
        revision: draft.revision,
        updated_at: iso(draft.updatedAt),
        updated_by: draft.updatedBy,
        node_count: draft.definition.root.nodes.length,
        problem_count: draft.analysis.problems.length,
      },
    };
  }

  private workflowBody(workflow: StoredWorkflow): Workflow {
    return { ...this.summary(workflow), created_at: iso(workflow.createdAt), created_by: workflow.createdBy };
  }

  private draftBody(workflow: StoredWorkflow): Draft {
    const { draft } = workflow;
    return {
      workflow_id: workflow.id,
      revision: draft.revision,
      definition: draft.definition,
      ...draft.analysis,
      updated_at: iso(draft.updatedAt),
      updated_by: draft.updatedBy,
    };
  }
}

/** Name (1 to 200, trimmed) and objective (up to 1,000, or null) of `NewWorkflow` and `WorkflowUpdate`. */
function workflowFields(
  body: Record<string, unknown> | undefined,
): { name: string; objective: string | null; problem?: undefined } | { problem: RouteResponse } {
  const name = typeof body?.name === 'string' ? body.name.trim() : '';
  const objective = body?.objective;
  const fields: Record<string, string> = {};
  if (name === '' || name.length > NAME_MAX) fields.name = 'Informe um nome de 1 a 200 caracteres.';
  if (objective !== undefined && objective !== null && (typeof objective !== 'string' || objective.length > OBJECTIVE_MAX)) {
    fields.objective = 'Use até 1.000 caracteres no objetivo.';
  }
  if (Object.keys(fields).length > 0) return { problem: problem({ ...ERRORS.InvalidData, fields }) };
  return { name, objective: typeof objective === 'string' && objective.trim() !== '' ? objective.trim() : null };
}

/** The shape the simulation needs (the backend checks the whole schema with Pydantic). */
function isDefinition(value: unknown): value is Definition {
  if (value === null || typeof value !== 'object') return false;
  const definition = value as Partial<Definition>;
  return (
    (definition.schema_version === 1 || definition.schema_version === 2 || definition.schema_version === 3 || definition.schema_version === 4) &&
    definition.kind === 'batch' &&
    Array.isArray(definition.root?.inputs) &&
    Array.isArray(definition.root?.nodes) &&
    Array.isArray(definition.root?.output?.fields)
  );
}

/**
 * What the backend stores: the drafts of versions 1 to 3 are read as 4, with `parameters` always present and the new
 * `settings` fields at their defaults (the error limit of 5 %, the standard trace and the 1 % pre-validation alert); what the draft already has is kept.
 */
function toVersion4(definition: Definition): Definition {
  const stored: Partial<Definition['settings']> = definition.settings;
  return {
    ...definition,
    schema_version: 4,
    settings: {
      ...definition.settings,
      error_limit_percent: stored.error_limit_percent ?? '5',
      trace_level: stored.trace_level ?? 'standard',
      pre_validation_alert_percent: stored.pre_validation_alert_percent ?? '1',
    },
    parameters: Array.isArray(definition.parameters) ? definition.parameters : [],
  };
}

const iso = (instant: number) => new Date(instant).toISOString();

function json(status: number, body: unknown): RouteResponse {
  return { status, contentType: 'application/json', body };
}

function problem(example: ErrorBody | Schemas['DraftConflictProblem'] | Schemas['UnitRunRejectedProblem']): RouteResponse {
  return { status: example.status, contentType: 'application/problem+json', body: example };
}

function readJson(request: Request): Record<string, unknown> | undefined {
  try {
    const body: unknown = request.postDataJSON();
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
