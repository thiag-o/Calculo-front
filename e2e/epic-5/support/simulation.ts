// Epic 5 simulated API (pnpm e2e): the reference campaign catalog (datasets and variables) and the workflows in schema 2,
// with the draft, the analysis, the preview and "Calcular" by record (or by typed values), in memory, one per test. It
// answers only `/v1/workflows...`, `/v1/formula-language` and `/v1/datasets...`; the others (session, sign-in,
// preflight) go on to the epic 2 simulation, which keeps the session (`route.fallback()`).
//
// Answers like the contract (../backend/contracts/openapi.yaml): optimistic revision of the draft (`409 draft_conflict`),
// problems that do not stop the save, the preview and "Calcular" only on the saved draft without problems
// (`409 draft_has_problems`), `409 no_batch_source`, `404 record_not_found`, `workflows.edit` on the mutations,
// `workflows.edit` or `simulations.run` on the preview and "Calcular", and `connections.view` on the catalog. The tenant
// starts with the workflow "Campanha de referência" of the backend's `prepare-local`.
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Response, Route } from '@playwright/test';
import { EXAMPLES, type ErrorBody, type Schemas, type Session } from '../../support/contract';
import { API_ROUTES, isApiCall } from '../../support/simulated-api';
import { runUnit } from '../../epic-4/support/engine';
import { CAMPAIGN_DEFINITION, CAMPAIGN_WORKFLOW, CATALOG, variablesOf } from './campaign';
import { analyze, findRecord, preview, runRecord, type Analysis } from './engine';

type Definition = Schemas['WorkflowDefinition'];
type UserRef = Schemas['UserRef'];

const ERRORS = EXAMPLES;
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const NAME_MAX = 200;
const SAMPLE_MAX = 100;
const DEFAULT_SAMPLE = 20;
/** Who created the campaign workflow in the backend: `prepare-local`, with the demonstration Admin. */
const PREPARE_LOCAL: UserRef = { id: '7d0c1f6e-0000-4000-8000-0000000000a1', name: 'Administradora Demonstração' };

/** A new workflow (contract, `WorkflowDefinition`): no batch source, no inputs, no nodes. */
const EMPTY_DEFINITION: Definition = {
  schema_version: 2,
  kind: 'batch',
  settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' } },
  root: { batch_source: null, inputs: [], nodes: [], output: { fields: [] } },
};

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

interface Caller {
  user: UserRef;
  permissions: ReadonlySet<string>;
}

interface RouteResponse {
  status: number;
  contentType: 'application/json' | 'application/problem+json';
  body: unknown;
}

/** A request the shell sent to the workflow routes (method, path and body), for the tests to check what went. */
export interface ReceivedCall {
  method: string;
  path: string;
  body: unknown;
}

export class CampaignSimulation {
  readonly unexpected: string[] = [];
  readonly calls: ReceivedCall[] = [];

  private readonly workflows: StoredWorkflow[] = [];
  private readonly sessions = new Map<BrowserContext, Promise<Caller | null>>();

  constructor(
    private readonly shellOrigin: string,
    private readonly now: () => number = Date.now,
  ) {
    const created = this.now() - 60 * 60 * 1000;
    const definition = structuredClone(CAMPAIGN_DEFINITION);
    this.workflows.push({
      id: randomUUID(),
      name: CAMPAIGN_WORKFLOW,
      objective: 'Pontos por item de nota fiscal: a campanha de referência dos épicos 5 a 9.',
      createdAt: created,
      createdBy: PREPARE_LOCAL,
      updatedAt: created,
      updatedBy: PREPARE_LOCAL,
      draft: { revision: 1, definition, analysis: analyze(definition), updatedAt: created, updatedBy: PREPARE_LOCAL },
    });
  }

  async install(page: Page): Promise<void> {
    const context = page.context();
    page.on('response', (response) => this.watchSession(response, context));
    await page.route(API_ROUTES, (route) => (isApiCall(route, this.shellOrigin) ? this.respond(route, context) : route.fallback()));
  }

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

  private async respond(route: Route, context: BrowserContext): Promise<void> {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const parts = url.pathname.split('/');
    if (method === 'OPTIONS' || !['workflows', 'formula-language', 'datasets'].includes(parts[2] ?? '')) {
      await route.fallback();
      return;
    }
    let id: string | undefined;
    if (parts.length >= 4) {
      id = parts[3];
      parts[3] = '{id}';
    }
    const key = `${method} ${parts.join('/')}`;
    this.calls.push({ method, path: url.pathname, body: readJson(request) ?? null });
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

  private async authenticated(method: string, request: Request, context: BrowserContext, then: (caller: Caller) => RouteResponse): Promise<RouteResponse> {
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
    const run = can('workflows.edit', 'simulations.run') ? null : problem(ERRORS.NoPermission);
    const catalog = can('connections.view') ? null : problem(ERRORS.NoPermission);
    switch (route) {
      case 'GET /v1/formula-language':
        return view ?? json(200, EXAMPLES.FormulaLanguage);
      case 'GET /v1/datasets':
        return catalog ?? json(200, { items: CATALOG.map(datasetBody) } satisfies Schemas['DatasetList']);
      case 'GET /v1/datasets/{id}': {
        const found = CATALOG.find((each) => each.id === id);
        return catalog ?? (found ? json(200, datasetBody(found)) : problem(ERRORS.NotFound));
      }
      case 'GET /v1/datasets/{id}/variables': {
        const found = CATALOG.find((each) => each.id === id);
        return catalog ?? (found ? json(200, { items: variablesOf(found) } satisfies Schemas['VariableList']) : problem(ERRORS.NotFound));
      }
      case 'GET /v1/workflows':
        return view ?? this.list(url);
      case 'POST /v1/workflows':
        return edit ?? this.create(request, caller);
      case 'GET /v1/workflows/{id}':
        return view ?? this.withWorkflow(id, (w) => json(200, this.workflowBody(w)));
      case 'GET /v1/workflows/{id}/draft':
        return view ?? this.withWorkflow(id, (w) => json(200, this.draftBody(w)));
      case 'PUT /v1/workflows/{id}/draft':
        return edit ?? this.withWorkflow(id, (w) => this.saveDraft(w, request, caller));
      case 'POST /v1/workflows/{id}/draft/analysis':
        return edit ?? this.withWorkflow(id, () => this.analysis(request));
      case 'POST /v1/workflows/{id}/draft/previews':
        return run ?? this.withWorkflow(id, (w) => this.preview(w, request));
      case 'POST /v1/workflows/{id}/draft/unit-runs':
        return run ?? this.withWorkflow(id, (w) => this.unitRun(w, request));
      default:
        this.unexpected.push(route);
        return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, code: 'route_not_simulated' });
    }
  }

  private withWorkflow(id: string, then: (workflow: StoredWorkflow) => RouteResponse): RouteResponse {
    const workflow = this.workflows.find((w) => w.id === id);
    return workflow ? then(workflow) : problem(ERRORS.NotFound);
  }

  private list(url: URL): RouteResponse {
    const name = url.searchParams.get('name')?.trim().toLocaleLowerCase('pt-BR') ?? '';
    const items = this.workflows
      .filter((w) => w.name.toLocaleLowerCase('pt-BR').includes(name))
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .map((w) => this.summary(w));
    return json(200, { items, next_cursor: null } satisfies Schemas['WorkflowList']);
  }

  private create(request: Request, caller: Caller): RouteResponse {
    const name = typeof readJson(request)?.name === 'string' ? (readJson(request)?.name as string).trim() : '';
    if (name === '' || name.length > NAME_MAX) return problem({ ...ERRORS.InvalidData, fields: { name: 'Informe um nome de 1 a 200 caracteres.' } });
    const key = name.toLocaleLowerCase('pt-BR');
    if (this.workflows.some((w) => w.name.toLocaleLowerCase('pt-BR') === key)) return problem(ERRORS.WorkflowExists);
    const now = this.now();
    const definition = structuredClone(EMPTY_DEFINITION);
    const workflow: StoredWorkflow = {
      id: randomUUID(),
      name,
      objective: null,
      createdAt: now,
      createdBy: caller.user,
      updatedAt: now,
      updatedBy: caller.user,
      draft: { revision: 1, definition, analysis: analyze(definition), updatedAt: now, updatedBy: caller.user },
    };
    this.workflows.push(workflow);
    return json(201, this.workflowBody(workflow));
  }

  private saveDraft(workflow: StoredWorkflow, request: Request, caller: Caller): RouteResponse {
    const body = readJson(request);
    const definition = body?.definition;
    if (typeof body?.revision !== 'number' || !isDefinition(definition)) return problem(ERRORS.InvalidData);
    if (body.revision !== workflow.draft.revision) return problem({ ...ERRORS.DraftConflict, current_revision: workflow.draft.revision });
    const now = this.now();
    // The save is always in schema 2 (Contratos, E5-1).
    const saved = { ...definition, schema_version: 2 as const };
    workflow.draft = { revision: workflow.draft.revision + 1, definition: saved, analysis: analyze(saved), updatedAt: now, updatedBy: caller.user };
    workflow.updatedAt = now;
    workflow.updatedBy = caller.user;
    return json(200, this.draftBody(workflow));
  }

  private analysis(request: Request): RouteResponse {
    const definition = readJson(request)?.definition;
    return isDefinition(definition) ? json(200, analyze(definition)) : problem(ERRORS.InvalidData);
  }

  /** The checks shared by the preview and "Calcular": the revision saved now, without problems. */
  private runnable(workflow: StoredWorkflow, revision: unknown): RouteResponse | null {
    if (typeof revision !== 'number') return problem(ERRORS.InvalidData);
    if (revision !== workflow.draft.revision) return problem({ ...ERRORS.DraftConflict, current_revision: workflow.draft.revision });
    const { problems } = workflow.draft.analysis;
    if (problems.length > 0) return problem({ ...ERRORS.PreviewDraftHasProblems, problems });
    return null;
  }

  private preview(workflow: StoredWorkflow, request: Request): RouteResponse {
    const body = readJson(request);
    const size = body?.sample_size ?? DEFAULT_SAMPLE;
    if (typeof size !== 'number' || !Number.isInteger(size) || size < 1 || size > SAMPLE_MAX) return problem(ERRORS.InvalidDataPreview);
    const refused = this.runnable(workflow, body?.revision);
    if (refused) return refused;
    const { definition, analysis } = workflow.draft;
    if (!definition.root.batch_source) return problem(ERRORS.NoBatchSource);
    return json(200, preview(definition, analysis, size));
  }

  private unitRun(workflow: StoredWorkflow, request: Request): RouteResponse {
    const body = readJson(request);
    const key = body?.record_key;
    const inputs = body?.inputs;
    const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);
    if (isObject(key) === isObject(inputs)) return problem(ERRORS.InvalidData);
    const refused = this.runnable(workflow, body?.revision);
    if (refused) return refused;
    const { definition, analysis } = workflow.draft;
    // The format must match the workflow: the key with the batch source, the values without it.
    if (isObject(key) !== (definition.root.batch_source !== null && definition.root.batch_source !== undefined)) return problem(ERRORS.InvalidData);
    if (isObject(inputs)) return json(200, runUnit(definition, analysis, inputs as Record<string, Schemas['Value']>));
    const record = findRecord(definition, key as Record<string, unknown>);
    return record ? json(200, runRecord(definition, analysis, record)) : problem(ERRORS.RecordNotFound);
  }

  private summary(workflow: StoredWorkflow): Schemas['WorkflowSummary'] {
    const { draft } = workflow;
    const count = (nodes: Definition['root']['nodes']): number => nodes.reduce((total, node) => total + 1 + (node.type === 'group' ? count(node.nodes) : 0), 0);
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
        node_count: count(draft.definition.root.nodes),
        problem_count: draft.analysis.problems.length,
      },
    };
  }

  private workflowBody(workflow: StoredWorkflow): Schemas['Workflow'] {
    return { ...this.summary(workflow), created_at: iso(workflow.createdAt), created_by: workflow.createdBy };
  }

  private draftBody(workflow: StoredWorkflow): Schemas['Draft'] {
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

function datasetBody(dataset: (typeof CATALOG)[number]): Schemas['Dataset'] {
  return {
    id: dataset.id,
    name: dataset.name,
    type: dataset.type,
    connection_id: dataset.connection ? '7c5c0000-0000-4000-8000-00000000c0' + (dataset.connection.startsWith('SQL') ? '02' : '01') : null,
    schema_name: dataset.schema,
    object_name: dataset.object,
    sql: null,
    excel_file_id: dataset.type === 'excel' ? '7c5e0000-0000-4000-8000-0000000000e1' : null,
    sheet: dataset.sheet,
    columns: dataset.columns.map((column) => ({ name: column.name, source_type: column.sourceType, type: column.type, scale: column.scale, nullable: false })),
    columns_refreshed_at: '2026-11-20T12:00:00Z',
  };
}

/** The shape the simulation needs (the backend checks the whole schema). */
function isDefinition(value: unknown): value is Definition {
  if (value === null || typeof value !== 'object') return false;
  const definition = value as Partial<Definition>;
  return (
    (definition.schema_version === 1 || definition.schema_version === 2) &&
    definition.kind === 'batch' &&
    Array.isArray(definition.root?.inputs) &&
    Array.isArray(definition.root?.nodes) &&
    Array.isArray(definition.root?.output?.fields)
  );
}

const iso = (instant: number) => new Date(instant).toISOString();

function json(status: number, body: unknown): RouteResponse {
  return { status, contentType: 'application/json', body };
}

function problem(example: ErrorBody | Schemas['DraftConflictProblem'] | Schemas['DraftRunConflictProblem'] | Schemas['UnitRunRejectedProblem']): RouteResponse {
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
