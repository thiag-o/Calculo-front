// Epic 6 simulated API (pnpm e2e): the reference campaign workflows in schema 3, with the run parameters in the analysis,
// the preview and "Calcular", and the batch executions (trigger, list, panel, records, trace, frozen definition, CSV and
// cancel), in memory, one per test. It answers `/v1/workflows...`, `/v1/formula-language`, `/v1/datasets...` and
// `/v1/executions...`; the others (session, sign-in, preflight) go on to the epic 2 simulation (`route.fallback()`).
//
// Answers like the contract (../backend/contracts/openapi.yaml, the one of B154): the trigger runs the saved draft at
// its revision (`409 draft_conflict`, `409 draft_has_problems`, `409 no_batch_source`, `422 missing_parameter` and
// `invalid_parameter`), the execution goes `pending` → `loading` → `calculating` (chunk by chunk) → `delivering` → a final
// state, with `awaiting_source` in place of a phase while the source is down, the error limit over the eligible records
// (E6-9), the cancel (`409 execution_finished`), the records 50 per page, the stored trace, the frozen definition and the
// CSV (`404 output_not_available`). Permissions: `executions.trigger` to trigger and cancel, `executions.view` for the
// list, the panel and the CSV, `traces.view` for the records, the trace and the frozen definition.
//
// No worker runs by itself: the test moves each execution (`SimulatedWorker`), so every phase is seen without waiting
// for a clock. The tenant starts with the two workflows `prepare-local` creates in this epic (campaign.ts).
import { randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Response, Route } from '@playwright/test';
import { runUnit } from '../../epic-4/support/engine';
import { CATALOG, ITEMS, type CatalogDataset } from '../../epic-5/support/campaign';
import { EXAMPLES, LEGACY_SETTINGS, type ErrorBody, type Schemas, type Session } from '../../support/contract';
import { API_ROUTES, isApiCall } from '../../support/simulated-api';
import { CAMPAIGN_DEFINITION_6, CAMPAIGN_WORKFLOW, DEFECTS, DEFECTS_DEFINITION, DEFECTS_WORKFLOW, ITEMS_WITH_DATE, epic6VariablesOf } from './campaign';
import { analyzeDefinition, previewWith, resolveParameters, runBatch, runKeyWith, type Analysis, type BatchRecord } from './engine';

type Definition = Schemas['WorkflowDefinition'];
type UserRef = Schemas['UserRef'];
type Execution = Schemas['Execution'];
type ExecutionStatus = Schemas['ExecutionStatus'];

const ERRORS = EXAMPLES;
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESULT_KEY = /^[0-9a-f]{64}$/;
const NAME_MAX = 200;
const SAMPLE_MAX = 100;
const DEFAULT_SAMPLE = 20;
/** The records of a chunk (`FLUXO_RUN_CHUNK_SIZE` is 1.000 in the backend; small here, so the campaign takes 3 chunks). */
export const CHUNK_SIZE = 25;
const RECORDS_PAGE = 50;
const LIST_PAGE = 50;
const RETRY_SECONDS = 30;
const OUTPUT_DAYS = 7;
const FINAL: ReadonlySet<ExecutionStatus> = new Set(['completed', 'completed_with_errors', 'aborted', 'cancelled']);
/** Who created the workflows in the backend: `prepare-local`, with the demonstration Admin. */
const PREPARE_LOCAL: UserRef = { id: '7d0c1f6e-0000-4000-8000-0000000000a1', name: 'Administradora Demonstração' };

const EMPTY_DEFINITION: Definition = {
  schema_version: 3,
  kind: 'batch',
  settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard' },
  parameters: [],
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

interface StoredExecution {
  body: Execution;
  tenantId: string;
  definition: Definition;
  /** Every record of the batch, in the reading order; the first `done` were calculated. */
  records: BatchRecord[];
  done: number;
  /** The phase `awaiting_source` stands in for. */
  waitingIn: 'loading' | 'calculating' | null;
  /** The delivered CSV (null until the delivery). */
  csv: string | null;
}

interface Caller {
  user: UserRef;
  tenantId: string;
  permissions: ReadonlySet<string>;
}

interface RouteResponse {
  status: number;
  contentType: 'application/json' | 'application/problem+json' | 'text/csv';
  body: unknown;
  headers?: Record<string, string>;
}

/** A request the module sent (method, path and body), for the tests to check what went. */
export interface ReceivedCall {
  method: string;
  path: string;
  body: unknown;
}

/**
 * The worker of the simulation, moved by the test: each step is one change the backend's worker makes (one chunk at a
 * time). The panel sees it at its next refresh (every 2 s).
 */
export interface SimulatedWorker {
  /** One step of the execution (the newest one when `id` is absent). */
  step(id?: string): void;
  /** Steps until a final state. */
  finish(id?: string): void;
  /** The batch source goes down: the next step of a running execution goes to `awaiting_source`. */
  sourceDown(): void;
  /** The batch source is back: the next step leaves `awaiting_source`. */
  sourceUp(): void;
  /**
   * The next read of the execution (`GET /v1/executions/{id}`) answers `403 no_permission`, as when the permission is
   * taken away with the panel open (a 4xx is not retried by the module).
   */
  failNextRead(): void;
  /** How many times the module read the execution (`GET /v1/executions/{id}`). */
  reads(id?: string): number;
  /** The newest execution's id. */
  latest(): string;
}

export class Epic6Simulation {
  readonly unexpected: string[] = [];
  readonly calls: ReceivedCall[] = [];

  private readonly workflows: StoredWorkflow[] = [];
  private readonly executions: StoredExecution[] = [];
  private readonly sessions = new Map<BrowserContext, Promise<Caller | null>>();
  /** `workflow_id:result_key` → the last revision delivered in a CSV. */
  private readonly deliveries = new Map<string, number>();
  private readonly readCounts = new Map<string, number>();
  private sourceIsDown = false;
  private failRead = false;

  readonly worker: SimulatedWorker = {
    step: (id) => this.step(this.execution(id)),
    finish: (id) => {
      const execution = this.execution(id);
      for (let guard = 0; guard < 1000 && !FINAL.has(execution.body.status); guard += 1) this.step(execution);
      if (!FINAL.has(execution.body.status)) throw new Error('A execução simulada não chegou a um estado final (a fonte está fora do ar?).');
    },
    sourceDown: () => {
      this.sourceIsDown = true;
    },
    sourceUp: () => {
      this.sourceIsDown = false;
    },
    failNextRead: () => {
      this.failRead = true;
    },
    reads: (id) => this.readCounts.get(this.execution(id).body.id) ?? 0,
    latest: () => this.execution().body.id,
  };

  constructor(
    private readonly shellOrigin: string,
    private readonly now: () => number = Date.now,
  ) {
    const created = this.now() - 60 * 60 * 1000;
    const seed = (name: string, objective: string, source: Definition, legacySettings = false) => {
      const definition = structuredClone(source);
      // The legacy form: the real API served the reference campaign with `settings` lacking the two settings of the version 3
      // (D44), whatever the contract says; the editor reads their defaults, and the first save writes both.
      if (legacySettings) {
        definition.settings = structuredClone(LEGACY_SETTINGS);
      }
      this.workflows.push({
        id: randomUUID(),
        name,
        objective,
        createdAt: created,
        createdBy: PREPARE_LOCAL,
        updatedAt: created,
        updatedBy: PREPARE_LOCAL,
        draft: { revision: 1, definition, analysis: analyzeDefinition(definition), updatedAt: created, updatedBy: PREPARE_LOCAL },
      });
    };
    seed(CAMPAIGN_WORKFLOW, 'Pontos por item de nota fiscal: a campanha de referência dos épicos 5 a 9.', CAMPAIGN_DEFINITION_6, true);
    seed(DEFECTS_WORKFLOW, 'As regras da campanha sobre os itens com chave nula e chave repetida.', DEFECTS_DEFINITION);
  }

  async install(page: Page): Promise<void> {
    const context = page.context();
    page.on('response', (response) => this.watchSession(response, context));
    await page.route(API_ROUTES, (route) => (isApiCall(route, this.shellOrigin) ? this.respond(route, context) : route.fallback()));
  }

  private execution(id?: string): StoredExecution {
    const found = id === undefined ? this.executions.at(-1) : this.executions.find((each) => each.body.id === id);
    if (!found) throw new Error(id === undefined ? 'Nenhuma execução foi disparada na simulação.' : `A execução ${id} não existe na simulação.`);
    return found;
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
        .then((session: Session) => ({
          user: { id: session.user.id, name: session.user.name },
          tenantId: session.current_tenant?.id ?? '',
          permissions: new Set(session.permissions),
        }))
        .catch(() => null),
    );
  }

  private async respond(route: Route, context: BrowserContext): Promise<void> {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const parts = url.pathname.split('/');
    if (method === 'OPTIONS' || !['workflows', 'formula-language', 'datasets', 'executions'].includes(parts[2] ?? '')) {
      await route.fallback();
      return;
    }
    const ids: string[] = [];
    if (parts.length >= 4) {
      ids.push(parts[3] ?? '');
      parts[3] = '{id}';
    }
    if (parts[2] === 'executions' && parts[4] === 'records' && parts.length >= 6) {
      ids.push(parts[5] ?? '');
      parts[5] = '{result_key}';
    }
    const key = `${method} ${parts.join('/')}`;
    this.calls.push({ method, path: url.pathname, body: readJson(request) ?? null });
    if (key === 'GET /v1/executions/{id}') {
      this.readCounts.set(ids[0] ?? '', (this.readCounts.get(ids[0] ?? '') ?? 0) + 1);
    }
    const failed = key === 'GET /v1/executions/{id}' && this.failRead;
    if (failed) this.failRead = false;
    const response = failed
      ? problem(ERRORS.NoPermission)
      : ids[0] !== undefined && !UUID.test(ids[0])
        ? problem(ERRORS.InvalidDataId)
        : ids[1] !== undefined && !RESULT_KEY.test(ids[1])
          ? problem(ERRORS.InvalidDataResultKey)
          : await this.authenticated(method, request, context, (caller) => this.handle(key, ids[0] ?? '', ids[1] ?? '', url, request, caller));
    const body = response.body === undefined ? undefined : response.contentType === 'text/csv' ? String(response.body) : JSON.stringify(response.body);
    await route.fulfill({
      status: response.status,
      headers: {
        'access-control-allow-origin': request.headers().origin ?? this.shellOrigin,
        'access-control-allow-credentials': 'true',
        vary: 'Origin',
        ...(response.body === undefined ? {} : { 'content-type': response.contentType }),
        ...response.headers,
      },
      body,
    });
  }

  private async authenticated(method: string, request: Request, context: BrowserContext, then: (caller: Caller) => RouteResponse): Promise<RouteResponse> {
    const caller = await this.sessions.get(context);
    if (!caller) return problem(ERRORS.NoSession);
    // The embedded module (host app page) sends a Bearer token and no cookie: no CSRF there.
    const bearer = (request.headers().authorization ?? '').startsWith('Bearer ');
    if (CSRF_METHODS.has(method) && !bearer) {
      const cookies = await context.cookies(new URL(request.url()).origin);
      const session = cookies.find((cookie) => cookie.name === 'fc_session');
      const csrf = cookies.find((cookie) => cookie.name === 'fc_csrf');
      if (!session) return problem(ERRORS.NoSession);
      if (csrf === undefined || request.headers()['x-csrf-token'] !== csrf.value) return problem(ERRORS.InvalidCsrf);
    }
    return then(caller);
  }

  private handle(route: string, id: string, resultKey: string, url: URL, request: Request, caller: Caller): RouteResponse {
    const can = (...permissions: string[]) => permissions.some((permission) => caller.permissions.has(permission));
    const denied = (...permissions: string[]) => (can(...permissions) ? null : problem(ERRORS.NoPermission));
    switch (route) {
      case 'GET /v1/formula-language':
        return denied('workflows.view') ?? json(200, EXAMPLES.FormulaLanguage);
      case 'GET /v1/datasets':
        return denied('connections.view') ?? json(200, { items: this.catalog().map(datasetBody) } satisfies Schemas['DatasetList']);
      case 'GET /v1/datasets/{id}': {
        const found = this.catalog().find((each) => each.id === id);
        return denied('connections.view') ?? (found ? json(200, datasetBody(found)) : problem(ERRORS.NotFound));
      }
      case 'GET /v1/datasets/{id}/variables': {
        const found = this.catalog().find((each) => each.id === id);
        return denied('connections.view') ?? (found ? json(200, { items: epic6VariablesOf(found) } satisfies Schemas['VariableList']) : problem(ERRORS.NotFound));
      }
      case 'GET /v1/workflows':
        return denied('workflows.view') ?? this.list(url);
      case 'POST /v1/workflows':
        return denied('workflows.edit') ?? this.create(request, caller);
      case 'GET /v1/workflows/{id}':
        return denied('workflows.view') ?? this.withWorkflow(id, (w) => json(200, this.workflowBody(w)));
      case 'GET /v1/workflows/{id}/draft':
        return denied('workflows.view') ?? this.withWorkflow(id, (w) => json(200, this.draftBody(w)));
      case 'PUT /v1/workflows/{id}/draft':
        return denied('workflows.edit') ?? this.withWorkflow(id, (w) => this.saveDraft(w, request, caller));
      case 'POST /v1/workflows/{id}/draft/analysis':
        return denied('workflows.edit') ?? this.withWorkflow(id, () => this.analysis(request));
      case 'POST /v1/workflows/{id}/draft/previews':
        return denied('workflows.edit', 'simulations.run') ?? this.withWorkflow(id, (w) => this.preview(w, request));
      case 'POST /v1/workflows/{id}/draft/unit-runs':
        return denied('workflows.edit', 'simulations.run') ?? this.withWorkflow(id, (w) => this.unitRun(w, request));
      case 'POST /v1/workflows/{id}/executions':
        return denied('executions.trigger') ?? this.withWorkflow(id, (w) => this.trigger(w, request, caller));
      case 'GET /v1/executions':
        return denied('executions.view') ?? this.executionList(url, caller);
      case 'GET /v1/executions/{id}':
        return denied('executions.view') ?? this.withExecution(id, caller, (e) => json(200, e.body));
      case 'GET /v1/executions/{id}/definition':
        return denied('traces.view') ?? this.withExecution(id, caller, (e) => json(200, { draft_revision: e.body.draft_revision, definition: e.definition } satisfies Schemas['ExecutionDefinition']));
      case 'POST /v1/executions/{id}/cancel':
        return denied('executions.trigger') ?? this.withExecution(id, caller, (e) => this.cancel(e));
      case 'GET /v1/executions/{id}/output':
        return denied('executions.view') ?? this.withExecution(id, caller, (e) => this.output(e));
      case 'GET /v1/executions/{id}/records':
        return denied('traces.view') ?? this.withExecution(id, caller, (e) => this.records(e, url));
      case 'GET /v1/executions/{id}/records/{result_key}':
        return denied('traces.view') ?? this.withExecution(id, caller, (e) => this.record(e, resultKey));
      default:
        this.unexpected.push(route);
        return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, code: 'route_not_simulated' });
    }
  }

  private catalog(): CatalogDataset[] {
    return [...CATALOG.map((dataset) => (dataset.id === ITEMS.id ? ITEMS_WITH_DATE : dataset)), DEFECTS];
  }

  // --- Workflows -------------------------------------------------------------------------------------------------------

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
    const sent = readJson(request)?.name;
    const name = typeof sent === 'string' ? sent.trim() : '';
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
      draft: { revision: 1, definition, analysis: analyzeDefinition(definition), updatedAt: now, updatedBy: caller.user },
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
    const saved = toVersion3(definition);
    workflow.draft = { revision: workflow.draft.revision + 1, definition: saved, analysis: analyzeDefinition(saved), updatedAt: now, updatedBy: caller.user };
    workflow.updatedAt = now;
    workflow.updatedBy = caller.user;
    return json(200, this.draftBody(workflow));
  }

  private analysis(request: Request): RouteResponse {
    const definition = readJson(request)?.definition;
    return isDefinition(definition) ? json(200, analyzeDefinition(toVersion3(definition))) : problem(ERRORS.InvalidData);
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
    const { definition } = workflow.draft;
    if (!definition.root.batch_source) return problem(ERRORS.NoBatchSource);
    const resolved = resolveParameters(definition.parameters ?? [], body?.parameters, new Date(this.now()));
    if (!resolved.ok) return problem(resolved.problem);
    return json(200, previewWith(definition, resolved.values, size));
  }

  private unitRun(workflow: StoredWorkflow, request: Request): RouteResponse {
    const body = readJson(request);
    const key = body?.record_key;
    const inputs = body?.inputs;
    if (isObject(key) === isObject(inputs)) return problem(ERRORS.InvalidData);
    const refused = this.runnable(workflow, body?.revision);
    if (refused) return refused;
    const { definition, analysis } = workflow.draft;
    if (isObject(key) !== (definition.root.batch_source !== null && definition.root.batch_source !== undefined)) return problem(ERRORS.InvalidData);
    const resolved = resolveParameters(definition.parameters ?? [], body?.parameters, new Date(this.now()));
    if (!resolved.ok) return problem(resolved.problem);
    if (isObject(inputs)) return json(200, runUnit(definition, analysis, inputs as Record<string, Schemas['Value']>));
    const trace = runKeyWith(definition, resolved.values, key as Record<string, unknown>);
    return trace ? json(200, trace) : problem(ERRORS.RecordNotFound);
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

  // --- Executions ------------------------------------------------------------------------------------------------------

  private trigger(workflow: StoredWorkflow, request: Request, caller: Caller): RouteResponse {
    const body = readJson(request);
    const revision = body?.revision;
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
      return problem({ ...ERRORS.InvalidData, fields: { revision: 'Informe a revisão do rascunho salvo.' } });
    }
    const { draft } = workflow;
    if (revision !== draft.revision) return problem({ ...ERRORS.DraftConflict, current_revision: draft.revision });
    if (draft.analysis.problems.length > 0) return problem({ ...ERRORS.ExecutionDraftHasProblems, problems: draft.analysis.problems });
    if (!draft.definition.root.batch_source) return problem(ERRORS.ExecutionNoBatchSource);
    const now = new Date(this.now());
    const resolved = resolveParameters(draft.definition.parameters ?? [], body?.parameters, now);
    if (!resolved.ok) return problem(resolved.problem);

    const definition = structuredClone(draft.definition);
    const id = randomUUID();
    const execution: StoredExecution = {
      tenantId: caller.tenantId,
      definition,
      records: runBatch(definition, resolved.values, caller.tenantId, workflow.id),
      done: 0,
      waitingIn: null,
      csv: null,
      body: {
        id,
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        draft_revision: draft.revision,
        workflow_version: null,
        status: 'pending',
        abort_reason: null,
        cancel_requested_at: null,
        parameters: resolved.values,
        now: now.toISOString(),
        trace_level: definition.settings.trace_level ?? 'standard',
        error_limit_percent: definition.settings.error_limit_percent ?? '5',
        triggered_by: caller.user,
        created_at: now.toISOString(),
        started_at: null,
        data_read_at: null,
        finished_at: null,
        next_retry_at: null,
        total_records: null,
        progress: { chunks_done: 0, records_done: 0 },
        totals: { read: 0, ok: 0, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
        error_groups: [],
        output: { available: false, expires_at: null, rows: null },
      },
    };
    this.executions.push(execution);
    return json(202, execution.body);
  }

  private withExecution(id: string, caller: Caller, then: (execution: StoredExecution) => RouteResponse): RouteResponse {
    const execution = this.executions.find((each) => each.body.id === id && each.tenantId === caller.tenantId);
    return execution ? then(execution) : problem(ERRORS.NotFound);
  }

  private executionList(url: URL, caller: Caller): RouteResponse {
    const workflowId = url.searchParams.get('workflow_id');
    const statuses = url.searchParams.getAll('status');
    const limit = Number(url.searchParams.get('limit') ?? LIST_PAGE);
    if (workflowId !== null && !UUID.test(workflowId)) return problem({ ...ERRORS.InvalidData, fields: { workflow_id: 'Informe um identificador válido.' } });
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) return problem(ERRORS.InvalidDataLimit);
    const offset = readCursor(url.searchParams.get('cursor'));
    if (offset === null) return problem(ERRORS.InvalidCursor);
    const items = this.executions
      .filter((each) => each.tenantId === caller.tenantId)
      .filter((each) => workflowId === null || each.body.workflow_id === workflowId)
      .filter((each) => statuses.length === 0 || statuses.includes(each.body.status))
      .map((each) => each.body)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const page = items.slice(offset, offset + limit);
    const next = offset + limit < items.length ? writeCursor(offset + limit) : null;
    return json(200, { items: page, next_cursor: next } satisfies Schemas['ExecutionList']);
  }

  private cancel(execution: StoredExecution): RouteResponse {
    const { body } = execution;
    if (FINAL.has(body.status)) return problem(ERRORS.ExecutionFinished);
    const now = iso(this.now());
    if (body.status === 'pending') {
      body.status = 'cancelled';
      body.cancel_requested_at = now;
      body.finished_at = now;
    } else {
      body.cancel_requested_at ??= now;
    }
    return json(202, body);
  }

  private output(execution: StoredExecution): RouteResponse {
    const { body } = execution;
    if (!body.output.available) return problem(ERRORS.OutputNotAvailable);
    return {
      status: 200,
      contentType: 'text/csv',
      body: execution.csv ?? '',
      headers: {
        'content-disposition': `attachment; filename="execution-${body.id}.csv"`,
        'access-control-expose-headers': 'Content-Disposition',
      },
    };
  }

  private records(execution: StoredExecution, url: URL): RouteResponse {
    const statuses = url.searchParams.getAll('status');
    const nodeId = url.searchParams.get('node_id');
    const withoutNode = url.searchParams.get('without_node') === 'true';
    const code = url.searchParams.get('code');
    if (nodeId !== null && withoutNode) return problem({ ...ERRORS.InvalidData, fields: { without_node: 'Use node_id ou without_node, não os dois.' } });
    const offset = readCursor(url.searchParams.get('cursor'));
    if (offset === null) return problem(ERRORS.InvalidCursor);
    const matching = execution.records
      .slice(0, execution.done)
      .filter((record) => statuses.length === 0 || statuses.includes(record.status))
      .filter((record) => nodeId === null || record.errorNodeId === nodeId)
      .filter((record) => !withoutNode || (record.errorCode !== null && record.errorNodeId === null))
      .filter((record) => code === null || record.errorCode === code);
    const items = matching.slice(offset, offset + RECORDS_PAGE).map((record) => ({
      result_key: record.resultKey,
      record_key: record.recordKey,
      status: record.status,
      error_node_id: record.errorNodeId,
      error_code: record.errorCode,
    }));
    const next = offset + RECORDS_PAGE < matching.length ? writeCursor(offset + RECORDS_PAGE) : null;
    return json(200, { items, next_cursor: next } satisfies Schemas['ExecutionRecordList']);
  }

  private record(execution: StoredExecution, resultKey: string): RouteResponse {
    const record = execution.records.slice(0, execution.done).find((each) => each.resultKey === resultKey);
    if (!record?.trace) return problem(ERRORS.ExecutionRecordNotFound);
    const { trace } = record;
    const minimal = execution.body.trace_level === 'minimal';
    return json(200, {
      execution_id: execution.body.id,
      trace_level: execution.body.trace_level,
      record_key: trace.record_key ?? {},
      status: trace.status,
      input_hash: trace.input_hash,
      output_hash: trace.output_hash,
      outputs: minimal ? null : trace.outputs,
      trace: minimal ? null : trace,
    } satisfies Schemas['ExecutionRecord']);
  }

  // --- The worker ------------------------------------------------------------------------------------------------------

  private step(execution: StoredExecution): void {
    const { body } = execution;
    if (FINAL.has(body.status)) return;
    const now = iso(this.now());
    if (body.cancel_requested_at !== null) {
      this.end(execution, 'cancelled');
      return;
    }
    switch (body.status) {
      case 'pending':
        body.status = 'loading';
        body.started_at = now;
        body.data_read_at = now;
        return;
      case 'loading':
        if (this.wait(execution, 'loading')) return;
        body.status = 'calculating';
        body.total_records = execution.records.length;
        return;
      case 'awaiting_source':
        if (this.sourceIsDown) {
          body.next_retry_at = iso(this.now() + RETRY_SECONDS * 1000);
          return;
        }
        body.status = execution.waitingIn ?? 'loading';
        body.next_retry_at = null;
        execution.waitingIn = null;
        if (body.status === 'loading') body.total_records = null;
        return;
      case 'calculating':
        if (this.wait(execution, 'calculating')) return;
        this.calculateChunk(execution);
        return;
      case 'delivering':
        this.deliver(execution);
        return;
      default:
        return;
    }
  }

  /** With the source down, the phase waits (`awaiting_source`) and the next attempt is in 30 s. */
  private wait(execution: StoredExecution, phase: 'loading' | 'calculating'): boolean {
    if (!this.sourceIsDown) return false;
    execution.waitingIn = phase;
    execution.body.status = 'awaiting_source';
    execution.body.next_retry_at = iso(this.now() + RETRY_SECONDS * 1000);
    return true;
  }

  private calculateChunk(execution: StoredExecution): void {
    const { body } = execution;
    const chunk = execution.records.slice(execution.done, execution.done + CHUNK_SIZE);
    execution.done += chunk.length;
    body.progress = { chunks_done: body.progress.chunks_done + 1, records_done: execution.done };
    const calculated = execution.records.slice(0, execution.done);
    const count = (status: Schemas['UnitRunStatus']) => calculated.filter((record) => record.status === status).length;
    body.totals = {
      read: calculated.length,
      ok: count('ok'),
      ok_with_warnings: count('ok_with_warnings'),
      error: count('error'),
      ignored: count('ignored'),
      filtered: count('filtered'),
    };
    body.error_groups = errorGroups(calculated, execution.definition);
    // The early check (E6-9): the errors already passed the limit over the whole batch.
    const total = body.total_records ?? calculated.length;
    if (total > 0 && (body.totals.error / total) * 100 > Number(body.error_limit_percent)) {
      this.end(execution, 'aborted');
      return;
    }
    if (execution.done >= execution.records.length) body.status = 'delivering';
  }

  /** The final check over the eligible records (without `ignored` and `filtered`) and the CSV. */
  private deliver(execution: StoredExecution): void {
    const { body } = execution;
    const eligible = body.totals.read - body.totals.ignored - body.totals.filtered;
    if (eligible > 0 && (body.totals.error / eligible) * 100 > Number(body.error_limit_percent)) {
      this.end(execution, 'aborted');
      return;
    }
    const delivered = execution.records.filter((record) => record.status === 'ok' || record.status === 'ok_with_warnings');
    execution.csv = this.csv(execution, delivered);
    body.output = { available: true, expires_at: iso(this.now() + OUTPUT_DAYS * 24 * 60 * 60 * 1000), rows: delivered.length };
    this.end(execution, body.totals.error > 0 ? 'completed_with_errors' : 'completed');
  }

  private end(execution: StoredExecution, status: ExecutionStatus): void {
    const { body } = execution;
    body.status = status;
    body.finished_at = iso(this.now());
    body.next_retry_at = null;
    if (status === 'aborted') body.abort_reason = { code: 'error_limit_exceeded', message: ERRORS.ExecutionAborted.abort_reason.message };
  }

  /** The CSV of the contract (`GET …/output`): RFC 4180, `\r\n`, numbers as exact text, booleans `true`/`false`. */
  private csv(execution: StoredExecution, delivered: readonly BatchRecord[]): string {
    const { body, definition } = execution;
    const keys = definition.root.batch_source?.key ?? [];
    const fields = definition.root.output.fields.map((field) => field.name);
    const lines = [['result_key', 'revision', 'run_id', 'workflow_version', 'status', ...keys, ...fields, '_warnings']];
    for (const record of delivered) {
      const id = `${body.workflow_id}:${record.resultKey ?? ''}`;
      const revision = (this.deliveries.get(id) ?? 0) + 1;
      this.deliveries.set(id, revision);
      const warnings = [...new Set(record.trace?.warnings.map((warning) => warning.code) ?? [])].join('|');
      lines.push([
        record.resultKey ?? '',
        String(revision),
        body.id,
        '',
        record.status,
        ...keys.map((name) => record.recordKey[name] ?? ''),
        ...fields.map((name) => csvValue(record.trace?.outputs[name] ?? null)),
        warnings,
      ]);
    }
    return lines.map((line) => line.map(csvField).join(',')).join('\r\n') + '\r\n';
  }
}

/** The errors summed by node and code, from the largest; the node name from the frozen definition. */
function errorGroups(records: readonly BatchRecord[], definition: Definition): Schemas['ErrorGroup'][] {
  const groups = new Map<string, Schemas['ErrorGroup']>();
  for (const record of records) {
    if (record.status !== 'error' || record.errorCode === null) continue;
    const key = `${record.errorNodeId ?? ''}:${record.errorCode}`;
    const group = groups.get(key) ?? { node_id: record.errorNodeId, node_name: nodeName(definition.root.nodes, record.errorNodeId), code: record.errorCode, count: 0 };
    group.count += 1;
    groups.set(key, group);
  }
  return [...groups.values()].sort((a, b) => b.count - a.count);
}

function nodeName(nodes: Definition['root']['nodes'], id: string | null): string | null {
  if (id === null) return null;
  for (const node of nodes) {
    if (node.id === id) return node.name;
    if (node.type === 'group') {
      const inner = nodeName(node.nodes, id);
      if (inner) return inner;
    }
  }
  return null;
}

function csvValue(value: Schemas['Value']): string {
  if (value === null) return '';
  if (typeof value === 'boolean') return value ? 'true' : 'false';
  return typeof value === 'string' ? value : JSON.stringify(value);
}

function csvField(text: string): string {
  return /[",\r\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

/** The cursor of a page: the position of its first item, as an opaque text. */
function writeCursor(offset: number): string {
  return Buffer.from(`p:${offset}`, 'utf8').toString('base64url');
}

/** The position of a cursor (0 without one); `null` for a cursor this simulation did not make. */
function readCursor(cursor: string | null): number | null {
  if (cursor === null) return 0;
  const match = /^p:(\d+)$/.exec(Buffer.from(cursor, 'base64url').toString('utf8'));
  return match ? Number(match[1]) : null;
}

function datasetBody(dataset: CatalogDataset): Schemas['Dataset'] {
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

const isObject = (value: unknown): value is Record<string, unknown> => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The shape the simulation needs (the backend checks the whole schema). */
function isDefinition(value: unknown): value is Definition {
  if (!isObject(value)) return false;
  const definition = value as Partial<Definition>;
  return (
    (definition.schema_version === 1 || definition.schema_version === 2 || definition.schema_version === 3) &&
    definition.kind === 'batch' &&
    Array.isArray(definition.root?.inputs) &&
    Array.isArray(definition.root?.nodes) &&
    Array.isArray(definition.root?.output?.fields)
  );
}

/** What the backend stores: versions 1 and 2 are read as 3, with `parameters` and the two new `settings` at their defaults. */
function toVersion3(definition: Definition): Definition {
  return {
    ...definition,
    schema_version: 3,
    settings: {
      ...definition.settings,
      error_limit_percent: definition.settings.error_limit_percent ?? '5',
      trace_level: definition.settings.trace_level ?? 'standard',
    },
    parameters: Array.isArray(definition.parameters) ? definition.parameters : [],
  };
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
    return isObject(body) ? body : undefined;
  } catch {
    return undefined;
  }
}
