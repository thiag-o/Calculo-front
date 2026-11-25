// Epic 7 simulated API (pnpm e2e): the reference campaign workflows (the campaign, the defects and the empties, in schema 4),
// the preview and "Calcular", and the executions with what this epic adds: the pre-validation with the decision
// (`awaiting_decision`, Prosseguir and Cancelar), the counts of the Fonte blocks, the scope and its overlap
// (`409 scope_already_delivered` and `confirm_overlap`), the schedules fired by a simulated scheduler, the reference files
// with the simulation and its comparison, the allowed values by query and the bell. In memory, one per test. It answers
// `/v1/workflows...`, `/v1/formula-language`, `/v1/datasets...`, `/v1/executions...`, `/v1/schedules...` and
// `/v1/notifications...`; the others (session, sign-in, preflight) go on to the epic 2 simulation (`route.fallback()`).
//
// Answers like the contract (../backend/contracts/openapi.yaml, the one of B166) and the backend plan (Contratos,
// "Pré-validação, agendamento e arquivo de referência"). No worker nor scheduler runs by itself: the test moves each
// execution (`SimulatedWorker`) and fires each schedule at its marked hour (`SimulatedScheduler`), so every phase is seen
// without waiting for a clock.
//
// What the simulation decides where the contract does not say (only the simulated mode depends on it):
// - the empty row of the empties (`ignored`, no trace) has no `result_key` and no error code;
// - the diff of a comparison follows the order of the batch, then the lines of the file the batch did not read;
// - the messages of the errors by line of a reference file and of a schedule that failed are this simulation's.
import { createHash, randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Response, Route } from '@playwright/test';
import { runUnit } from '../../epic-4/support/engine';
import type { CatalogDataset } from '../../epic-5/support/campaign';
import { CAMPAIGN_DEFINITION_6, DEFECTS_DEFINITION } from '../../epic-6/support/campaign';
import { resolveParameters } from '../../epic-6/support/engine';
import { EXAMPLES, type ErrorBody, type Schemas, type Session } from '../../support/contract';
import { API_ROUTES, isApiCall } from '../../support/simulated-api';
import { CAMPAIGN_WORKFLOW, DEFECTS_WORKFLOW, EMPTIES_DEFINITION, EMPTIES_WORKFLOW, businessTimeZone, epic7VariablesOf, zonedParts } from './campaign';
import {
  EPIC7_CATALOG,
  analysisOf,
  checkAllowedValues,
  compare,
  preValidation,
  previewOf,
  queryValues,
  readReferenceFile,
  resolveRun,
  runBatch,
  scopeHash,
  sourceCounts,
  unitRunOf,
  type BatchRecord,
  type Comparison,
  type ParameterValues,
  type ReadReferenceFile,
} from './engine';

type Definition = Schemas['WorkflowDefinition'];
type Parameter = Schemas['WorkflowParameter'];
type UserRef = Schemas['UserRef'];
type Execution = Schemas['Execution'];
type ExecutionStatus = Schemas['ExecutionStatus'];
type Schedule = Schemas['Schedule'];
type Analysis = Schemas['Analysis'];

const ERRORS = EXAMPLES;
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const RESULT_KEY = /^[0-9a-f]{64}$/;
const NAME_MAX = 200;
const SCHEDULE_NAME_MAX = 100;
const SAMPLE_MAX = 100;
const DEFAULT_SAMPLE = 20;
/** The records of a chunk (`FLUXO_RUN_CHUNK_SIZE` is 1.000 in the backend; small here, so the campaign takes 3 chunks). */
export const CHUNK_SIZE = 25;
const RECORDS_PAGE = 50;
const LIST_PAGE = 50;
const NOTIFICATIONS_PAGE = 20;
const OUTPUT_DAYS = 7;
const DECISION_HOURS = 24;
const MAX_SCHEDULES = 20;
const MAX_REFERENCE_FILES = 20;
const FINAL: ReadonlySet<ExecutionStatus> = new Set(['completed', 'completed_with_errors', 'aborted', 'cancelled']);
const TIME = /^([01]\d|2[0-3]):([0-5]\d)$/;
/** Who created the workflows in the backend: `prepare-local`, with the demonstration Admin. */
const PREPARE_LOCAL: UserRef = { id: '7d0c1f6e-0000-4000-8000-0000000000a1', name: 'Administradora Demonstração' };

/** The relatives that serve each type (contract, `RelativeDefault`); lists have none. */
const RELATIVES_BY_TYPE: Readonly<Partial<Record<Parameter['type'], readonly Schemas['RelativeDefault'][]>>> = {
  date: ['today', 'yesterday', 'first_day_of_current_month', 'first_day_of_previous_month', 'last_day_of_previous_month'],
  datetime: ['now'],
  period: ['current_month', 'previous_month', 'last_7_days', 'last_30_days'],
};

const ABORT_MESSAGES: Readonly<Partial<Record<Schemas['AbortReason'], string>>> = {
  error_limit_exceeded: ERRORS.ExecutionAborted.abort_reason.message,
  duplicate_record_key: 'A chave do registro se repete no lote. Nada foi calculado: corrija a origem ou a chave do registro.',
};

const EMPTY_DEFINITION: Definition = {
  schema_version: 4,
  kind: 'batch',
  settings: { error_policy: 'error', rounding: { scale: 2, mode: 'half_up' }, error_limit_percent: '5', trace_level: 'standard', pre_validation_alert_percent: '1' },
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
  values: ParameterValues;
  /** The scope (E7-6); null in a simulation, which never counts for the overlap. */
  scope: string | null;
  /** Every record of the batch, in the reading order; the first `done` were calculated. */
  records: BatchRecord[];
  done: number;
  /** What the pre-validation finds, set on the body when it ends. */
  check: Schemas['PreValidation'];
  /** The reference file of a simulation, as read at the upload. */
  file: ReadReferenceFile | null;
  comparison: Comparison | null;
  /** The delivered CSV (null until the delivery). */
  csv: string | null;
}

interface StoredSchedule {
  body: Omit<Schedule, 'current_draft_revision' | 'workflow_name'>;
  tenantId: string;
  /** The definition frozen at `draft_revision`. */
  definition: Definition;
}

interface StoredReferenceFile {
  body: Omit<Schemas['ReferenceFile'], 'last_comparison'>;
  tenantId: string;
  read: ReadReferenceFile;
}

interface StoredNotification {
  body: Omit<Schemas['Notification'], 'read'>;
  tenantId: string;
  readBy: Set<string>;
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
 * The worker of the simulation, moved by the test: each step is one change the backend's worker makes (the load, the
 * pre-validation, one chunk at a time, the delivery or the comparison). The panel sees it at its next refresh (every 2 s).
 */
export interface SimulatedWorker {
  /** One step of the execution (the newest one when `id` is absent). */
  step(id?: string): void;
  /** Steps until a final state, or until it stops in `awaiting_decision` (a person decides). */
  finish(id?: string): void;
  /** The newest execution's id. */
  latest(): string;
}

/** The scheduler of the simulation (`fluxo scheduler --once` at the marked hour), moved by the test. */
export interface SimulatedScheduler {
  /**
   * Fires the schedule `name` (the newest with that name) at its `next_run_at`, as the backend's scheduler does when the
   * clock reaches it: it creates the execution, or records `skipped_overlap` or `failed` with the alert of the bell.
   */
  fire(name: string): void;
}

export class Epic7Simulation {
  readonly unexpected: string[] = [];
  readonly calls: ReceivedCall[] = [];

  private readonly workflows: StoredWorkflow[] = [];
  private readonly executions: StoredExecution[] = [];
  private readonly schedules: StoredSchedule[] = [];
  private readonly files: StoredReferenceFile[] = [];
  private readonly notifications: StoredNotification[] = [];
  private readonly sessions = new Map<BrowserContext, Promise<Caller | null>>();
  /** `workflow_id:result_key` → the last revision delivered in a CSV. */
  private readonly deliveries = new Map<string, number>();
  /** The tenant of the sessions, for what the scheduler creates (the simulation has one tenant). */
  private tenantId = '';

  readonly worker: SimulatedWorker = {
    step: (id) => this.step(this.execution(id)),
    finish: (id) => {
      const execution = this.execution(id);
      for (let guard = 0; guard < 1000 && !FINAL.has(execution.body.status) && execution.body.status !== 'awaiting_decision'; guard += 1) {
        this.step(execution);
      }
    },
    latest: () => this.execution().body.id,
  };

  readonly scheduler: SimulatedScheduler = {
    fire: (name) => this.fire(name),
  };

  constructor(
    private readonly shellOrigin: string,
    private readonly now: () => number = Date.now,
  ) {
    const created = this.now() - 60 * 60 * 1000;
    const seed = (name: string, objective: string, source: Definition) => {
      const definition = toVersion4(structuredClone(source));
      this.workflows.push({
        id: randomUUID(),
        name,
        objective,
        createdAt: created,
        createdBy: PREPARE_LOCAL,
        updatedAt: created,
        updatedBy: PREPARE_LOCAL,
        draft: { revision: 1, definition, analysis: analysisOf(definition), updatedAt: created, updatedBy: PREPARE_LOCAL },
      });
    };
    seed(CAMPAIGN_WORKFLOW, 'Pontos por item de nota fiscal: a campanha de referência dos épicos 5 a 9.', CAMPAIGN_DEFINITION_6);
    seed(DEFECTS_WORKFLOW, 'As regras da campanha sobre os itens com chave nula e chave repetida.', DEFECTS_DEFINITION);
    seed(EMPTIES_WORKFLOW, 'As regras da campanha sobre os itens com campos vazios, para o alerta da pré-validação.', EMPTIES_DEFINITION);
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
        .then((session: Session) => {
          this.tenantId = session.current_tenant?.id ?? this.tenantId;
          return { user: { id: session.user.id, name: session.user.name }, tenantId: session.current_tenant?.id ?? '', permissions: new Set(session.permissions) };
        })
        .catch(() => null),
    );
  }

  private async respond(route: Route, context: BrowserContext): Promise<void> {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const parts = url.pathname.split('/');
    const known = ['workflows', 'formula-language', 'datasets', 'executions', 'schedules', 'notifications'];
    if (method === 'OPTIONS' || !known.includes(parts[2] ?? '')) {
      await route.fallback();
      return;
    }
    // `/v1/notifications/read` is not an id.
    const ids: string[] = [];
    if (parts.length >= 4 && !(parts[2] === 'notifications' && parts[3] === 'read')) {
      ids.push(parts[3] ?? '');
      parts[3] = '{id}';
    }
    if (parts[2] === 'executions' && parts[4] === 'records' && parts.length >= 6) {
      ids.push(parts[5] ?? '');
      parts[5] = '{result_key}';
    }
    if (parts[2] === 'workflows' && parts[4] === 'reference-files' && parts.length >= 6) {
      ids.push(parts[5] ?? '');
      parts[5] = '{file_id}';
    }
    if (parts[2] === 'workflows' && parts[4] === 'parameters' && parts.length >= 6) {
      ids.push(decodeURIComponent(parts[5] ?? ''));
      parts[5] = '{name}';
    }
    const key = `${method} ${parts.join('/')}`;
    this.calls.push({ method, path: url.pathname, body: isMultipart(request) ? null : (readJson(request) ?? null) });
    const response =
      ids[0] !== undefined && !UUID.test(ids[0])
        ? problem(ERRORS.InvalidDataId)
        : key.includes('{result_key}') && !RESULT_KEY.test(ids[1] ?? '')
          ? problem(ERRORS.InvalidDataResultKey)
          : key.includes('{file_id}') && !UUID.test(ids[1] ?? '')
            ? problem(ERRORS.InvalidDataId)
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

  private handle(route: string, id: string, second: string, url: URL, request: Request, caller: Caller): RouteResponse {
    const can = (...permissions: string[]) => permissions.some((permission) => caller.permissions.has(permission));
    const denied = (...permissions: string[]) => (can(...permissions) ? null : problem(ERRORS.NoPermission));
    switch (route) {
      case 'GET /v1/formula-language':
        return denied('workflows.view') ?? json(200, EXAMPLES.FormulaLanguage);
      case 'GET /v1/datasets':
        return denied('connections.view') ?? json(200, { items: EPIC7_CATALOG.map(datasetBody) } satisfies Schemas['DatasetList']);
      case 'GET /v1/datasets/{id}': {
        const found = EPIC7_CATALOG.find((each) => each.id === id);
        return denied('connections.view') ?? (found ? json(200, datasetBody(found)) : problem(ERRORS.NotFound));
      }
      case 'GET /v1/datasets/{id}/variables': {
        const found = EPIC7_CATALOG.find((each) => each.id === id);
        return denied('connections.view') ?? (found ? json(200, { items: epic7VariablesOf(found) } satisfies Schemas['VariableList']) : problem(ERRORS.NotFound));
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
      case 'GET /v1/workflows/{id}/parameters/{name}/allowed-values':
        return denied('executions.trigger', 'executions.schedule', 'workflows.edit', 'simulations.run') ?? this.withWorkflow(id, (w) => this.allowedValues(w, second, url));
      case 'POST /v1/workflows/{id}/executions':
        return denied('executions.trigger') ?? this.withWorkflow(id, (w) => this.trigger(w, request, caller));
      case 'POST /v1/workflows/{id}/schedules':
        return denied('executions.schedule') ?? this.withWorkflow(id, (w) => this.createSchedule(w, request, caller));
      case 'GET /v1/workflows/{id}/reference-files':
        return denied('workflows.view') ?? this.withWorkflow(id, (w) => this.referenceFiles(w, caller));
      case 'POST /v1/workflows/{id}/reference-files':
        return denied('test_cases.edit') ?? this.withWorkflow(id, (w) => this.upload(w, request, caller));
      case 'DELETE /v1/workflows/{id}/reference-files/{file_id}':
        return denied('test_cases.edit') ?? this.withWorkflow(id, (w) => this.deleteFile(w, second, caller));
      case 'POST /v1/workflows/{id}/reference-files/{file_id}/simulations':
        return denied('simulations.run') ?? this.withWorkflow(id, (w) => this.simulate(w, second, request, caller));
      case 'GET /v1/schedules':
        return denied('executions.view') ?? this.scheduleList(url, caller);
      case 'GET /v1/schedules/{id}':
        return denied('executions.view') ?? this.withSchedule(id, caller, (s) => json(200, this.scheduleBody(s)));
      case 'PUT /v1/schedules/{id}':
        return denied('executions.schedule') ?? this.withSchedule(id, caller, (s) => this.updateSchedule(s, request));
      case 'DELETE /v1/schedules/{id}':
        return denied('executions.schedule') ?? this.withSchedule(id, caller, (s) => this.deleteSchedule(s));
      case 'GET /v1/executions':
        return denied('executions.view') ?? this.executionList(url, caller);
      case 'GET /v1/executions/{id}':
        return denied('executions.view') ?? this.withExecution(id, caller, (e) => json(200, e.body));
      case 'GET /v1/executions/{id}/definition':
        return this.withExecution(id, caller, (e) => this.traceDenied(e, can) ?? json(200, { draft_revision: e.body.draft_revision, definition: e.definition } satisfies Schemas['ExecutionDefinition']));
      case 'POST /v1/executions/{id}/cancel':
        return this.withExecution(id, caller, (e) => this.decideDenied(e, can) ?? this.cancel(e, caller));
      case 'POST /v1/executions/{id}/proceed':
        return this.withExecution(id, caller, (e) => this.decideDenied(e, can) ?? this.proceed(e, caller));
      case 'GET /v1/executions/{id}/output':
        return denied('executions.view') ?? this.withExecution(id, caller, (e) => this.output(e));
      case 'GET /v1/executions/{id}/records':
        return this.withExecution(id, caller, (e) => this.traceDenied(e, can) ?? this.records(e, url));
      case 'GET /v1/executions/{id}/records/{result_key}':
        return this.withExecution(id, caller, (e) => this.traceDenied(e, can) ?? this.record(e, second));
      case 'GET /v1/executions/{id}/comparison/records':
        return denied('simulations.run', 'traces.view') ?? this.withExecution(id, caller, (e) => this.comparisonRecords(e, url));
      case 'GET /v1/notifications':
        return denied('executions.view') ?? this.notificationList(url, caller);
      case 'POST /v1/notifications/read':
        return denied('executions.view') ?? this.markRead(request, caller);
      default:
        this.unexpected.push(route);
        return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, code: 'route_not_simulated' });
    }
  }

  /** The records, the trace and the frozen definition: `traces.view`; in a simulation, also `simulations.run`. */
  private traceDenied(execution: StoredExecution, can: (...permissions: string[]) => boolean): RouteResponse | null {
    const allowed = execution.body.mode === 'simulation' ? can('traces.view', 'simulations.run') : can('traces.view');
    return allowed ? null : problem(ERRORS.NoPermission);
  }

  /** Cancel and Prosseguir follow the mode: `executions.trigger` in a batch, `simulations.run` in a simulation. */
  private decideDenied(execution: StoredExecution, can: (...permissions: string[]) => boolean): RouteResponse | null {
    return can(execution.body.mode === 'simulation' ? 'simulations.run' : 'executions.trigger') ? null : problem(ERRORS.NoPermission);
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
      draft: { revision: 1, definition, analysis: analysisOf(definition), updatedAt: now, updatedBy: caller.user },
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
    const saved = toVersion4(definition);
    workflow.draft = { revision: workflow.draft.revision + 1, definition: saved, analysis: analysisOf(saved), updatedAt: now, updatedBy: caller.user };
    workflow.updatedAt = now;
    workflow.updatedBy = caller.user;
    return json(200, this.draftBody(workflow));
  }

  private analysis(request: Request): RouteResponse {
    const definition = readJson(request)?.definition;
    return isDefinition(definition) ? json(200, analysisOf(toVersion4(definition))) : problem(ERRORS.InvalidData);
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
    const resolved = resolveRun(definition.parameters ?? [], body?.parameters, new Date(this.now()));
    if (!resolved.ok) return problem(resolved.problem);
    return json(200, previewOf(definition, resolved.values, size));
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
    const resolved = resolveRun(definition.parameters ?? [], body?.parameters, new Date(this.now()));
    if (!resolved.ok) return problem(resolved.problem);
    if (isObject(inputs)) return json(200, runUnit(definition, analysis, inputs as Record<string, Schemas['Value']>));
    const trace = unitRunOf(definition, resolved.values, key as Record<string, unknown>);
    return trace ? json(200, trace) : problem(ERRORS.RecordNotFound);
  }

  /** `GET …/parameters/{name}/allowed-values` (E7-5): the values of the query of the saved draft, with `search`. */
  private allowedValues(workflow: StoredWorkflow, name: string, url: URL): RouteResponse {
    const search = url.searchParams.get('search') ?? '';
    if (search.length > 100) return problem(ERRORS.InvalidDataSearch);
    const parameter = workflow.draft.definition.parameters?.find((each) => each.name === name);
    if (!parameter) return problem(ERRORS.ParameterNotFound);
    const query = parameter.allowed_values;
    if (!query || Array.isArray(query)) return problem(ERRORS.AllowedValuesNotQuery);
    if (workflow.draft.analysis.problems.length > 0) return problem({ ...ERRORS.AllowedValuesDraftHasProblems, problems: workflow.draft.analysis.problems });
    const values = queryValues(query) ?? [];
    const wanted = search.trim().toLocaleLowerCase('pt-BR');
    const matching = values.filter((value) => (parameter.type === 'text' ? value.toLocaleLowerCase('pt-BR').includes(wanted) : value.startsWith(wanted)));
    return json(200, { values: matching.slice(0, 1000), truncated: matching.length > 1000 } satisfies Schemas['AllowedValues']);
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
    return { workflow_id: workflow.id, revision: draft.revision, definition: draft.definition, ...draft.analysis, updated_at: iso(draft.updatedAt), updated_by: draft.updatedBy };
  }

  /** The checks shared by the trigger, the simulation and a schedule: the saved revision, without problems, with a batch source. */
  private triggerable(workflow: StoredWorkflow, revision: unknown, noBatchSource: ErrorBody): RouteResponse | null {
    if (typeof revision !== 'number' || !Number.isInteger(revision) || revision < 1) {
      return problem({ ...ERRORS.InvalidData, fields: { revision: 'Informe a revisão do rascunho salvo.' } });
    }
    const { draft } = workflow;
    if (revision !== draft.revision) return problem({ ...ERRORS.DraftConflict, current_revision: draft.revision });
    if (draft.analysis.problems.length > 0) return problem({ ...ERRORS.ExecutionDraftHasProblems, problems: draft.analysis.problems });
    if (!draft.definition.root.batch_source) return problem(noBatchSource);
    return null;
  }

  // --- Executions ------------------------------------------------------------------------------------------------------

  /** The batch executions of the same scope, delivered or still running, newest first (E7-6). */
  private overlapping(workflowId: string, scope: string): StoredExecution[] {
    return this.executions
      .filter((each) => each.body.workflow_id === workflowId && each.scope === scope)
      .filter((each) => each.body.status === 'completed' || each.body.status === 'completed_with_errors' || !FINAL.has(each.body.status))
      .sort((a, b) => b.body.created_at.localeCompare(a.body.created_at));
  }

  private trigger(workflow: StoredWorkflow, request: Request, caller: Caller): RouteResponse {
    const body = readJson(request);
    const refused = this.triggerable(workflow, body?.revision, ERRORS.ExecutionNoBatchSource);
    if (refused) return refused;
    const now = new Date(this.now());
    const definition = workflow.draft.definition;
    const resolved = resolveRun(definition.parameters ?? [], body?.parameters, now);
    if (!resolved.ok) return problem(resolved.problem);
    const scope = scopeHash(caller.tenantId, workflow.id, resolved.values);
    const overlapping = this.overlapping(workflow.id, scope);
    if (overlapping.length > 0 && body?.confirm_overlap !== true) {
      return problem({
        ...ERRORS.ScopeAlreadyDelivered,
        overlapping: overlapping.slice(0, 5).map(({ body: each }) => ({
          id: each.id,
          status: each.status,
          created_at: each.created_at,
          finished_at: each.finished_at,
          triggered_by: each.triggered_by,
          schedule: each.schedule,
        })),
      });
    }
    const newest = overlapping[0];
    const execution = this.createExecution(workflow, caller.tenantId, resolved.values, now, {
      mode: 'batch',
      triggeredBy: caller.user,
      schedule: null,
      scope,
      overlapOf: newest ? { id: newest.body.id, created_at: newest.body.created_at } : null,
      file: null,
    });
    return json(202, execution.body);
  }

  private createExecution(
    workflow: StoredWorkflow,
    tenantId: string,
    values: ParameterValues,
    now: Date,
    origin: {
      mode: Schemas['ExecutionMode'];
      triggeredBy: UserRef | null;
      schedule: Schemas['ScheduleRef'] | null;
      scope: string | null;
      overlapOf: Schemas['ExecutionOverlap'] | null;
      file: StoredReferenceFile | null;
      /** The frozen definition of a schedule and its revision; without it, the saved draft now. */
      frozen?: { definition: Definition; revision: number };
      createdAt?: Date;
    },
  ): StoredExecution {
    const definition = structuredClone(origin.frozen?.definition ?? workflow.draft.definition);
    const run = runBatch(definition, values, tenantId, workflow.id);
    const createdAt = (origin.createdAt ?? now).toISOString();
    const execution: StoredExecution = {
      tenantId,
      definition,
      values,
      scope: origin.scope,
      records: run.records,
      done: 0,
      check: preValidation(run, definition.settings.pre_validation_alert_percent ?? '1'),
      file: origin.file?.read ?? null,
      comparison: null,
      csv: null,
      body: {
        id: randomUUID(),
        workflow_id: workflow.id,
        workflow_name: workflow.name,
        draft_revision: origin.frozen?.revision ?? workflow.draft.revision,
        workflow_version: null,
        mode: origin.mode,
        status: 'pending',
        abort_reason: null,
        cancel_requested_at: null,
        parameters: values,
        now: now.toISOString(),
        trace_level: definition.settings.trace_level ?? 'standard',
        error_limit_percent: definition.settings.error_limit_percent ?? '5',
        triggered_by: origin.triggeredBy,
        schedule: origin.schedule,
        created_at: createdAt,
        started_at: null,
        data_read_at: null,
        finished_at: null,
        next_retry_at: null,
        total_records: null,
        progress: { chunks_done: 0, records_done: 0 },
        totals: { read: 0, ok: 0, ok_with_warnings: 0, error: 0, ignored: 0, filtered: 0 },
        error_groups: [],
        output: { available: false, expires_at: null, rows: null },
        pre_validation: null,
        source_counts: [],
        overlap_of: origin.overlapOf,
        reference_file: origin.file ? { id: origin.file.body.id, name: origin.file.body.name } : null,
        comparison: null,
      },
    };
    this.executions.push(execution);
    return execution;
  }

  private withExecution(id: string, caller: Caller, then: (execution: StoredExecution) => RouteResponse): RouteResponse {
    const execution = this.executions.find((each) => each.body.id === id && each.tenantId === caller.tenantId);
    return execution ? then(execution) : problem(ERRORS.NotFound);
  }

  private executionList(url: URL, caller: Caller): RouteResponse {
    const workflowId = url.searchParams.get('workflow_id');
    const scheduleId = url.searchParams.get('schedule_id');
    const mode = url.searchParams.get('mode');
    const statuses = url.searchParams.getAll('status');
    const limit = Number(url.searchParams.get('limit') ?? LIST_PAGE);
    if (workflowId !== null && !UUID.test(workflowId)) return problem(ERRORS.InvalidDataWorkflowId);
    if (!Number.isInteger(limit) || limit < 1 || limit > 200) return problem(ERRORS.InvalidDataLimit);
    const offset = readCursor(url.searchParams.get('cursor'));
    if (offset === null) return problem(ERRORS.InvalidCursor);
    const items = this.executions
      .filter((each) => each.tenantId === caller.tenantId)
      .filter((each) => workflowId === null || each.body.workflow_id === workflowId)
      .filter((each) => scheduleId === null || each.body.schedule?.id === scheduleId)
      .filter((each) => mode === null || each.body.mode === mode)
      .filter((each) => statuses.length === 0 || statuses.includes(each.body.status))
      .map((each) => each.body)
      .sort((a, b) => b.created_at.localeCompare(a.created_at) || b.id.localeCompare(a.id));
    const page = items.slice(offset, offset + limit);
    const next = offset + limit < items.length ? writeCursor(offset + limit) : null;
    return json(200, { items: page, next_cursor: next } satisfies Schemas['ExecutionList']);
  }

  private cancel(execution: StoredExecution, caller: Caller): RouteResponse {
    const { body } = execution;
    if (FINAL.has(body.status)) return problem(ERRORS.ExecutionFinished);
    const now = iso(this.now());
    if (body.status === 'awaiting_decision' && body.pre_validation) {
      // In `awaiting_decision` the cancel is the decision itself: right away.
      body.pre_validation.decision = { choice: 'cancel', by: caller.user, at: now };
      body.cancel_requested_at = now;
      this.end(execution, 'cancelled');
    } else if (body.status === 'pending') {
      body.status = 'cancelled';
      body.cancel_requested_at = now;
      body.finished_at = now;
    } else {
      body.cancel_requested_at ??= now;
    }
    return json(202, body);
  }

  private proceed(execution: StoredExecution, caller: Caller): RouteResponse {
    const { body } = execution;
    if (body.status !== 'awaiting_decision' || !body.pre_validation) return problem(ERRORS.NotAwaitingDecision);
    body.pre_validation.decision = { choice: 'proceed', by: caller.user, at: iso(this.now()) };
    body.status = 'calculating';
    return json(202, body);
  }

  private output(execution: StoredExecution): RouteResponse {
    const { body } = execution;
    if (!body.output.available) return problem(ERRORS.OutputNotAvailable);
    return {
      status: 200,
      contentType: 'text/csv',
      body: execution.csv ?? '',
      headers: { 'content-disposition': `attachment; filename="execution-${body.id}.csv"`, 'access-control-expose-headers': 'Content-Disposition' },
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

  private comparisonRecords(execution: StoredExecution, url: URL): RouteResponse {
    if (!execution.comparison || execution.body.comparison === null) return problem(ERRORS.ComparisonNotAvailable);
    const outcomes = url.searchParams.getAll('outcome');
    const known: readonly string[] = ['equal', 'different', 'status_differs', 'missing_from_result', 'missing_from_file'];
    if (outcomes.some((outcome) => !known.includes(outcome))) return problem(ERRORS.InvalidDataOutcome);
    const offset = readCursor(url.searchParams.get('cursor'));
    if (offset === null) return problem(ERRORS.InvalidCursor);
    const matching = execution.comparison.records.filter((record) => outcomes.length === 0 || outcomes.includes(record.outcome));
    const next = offset + RECORDS_PAGE < matching.length ? writeCursor(offset + RECORDS_PAGE) : null;
    return json(200, { items: matching.slice(offset, offset + RECORDS_PAGE), next_cursor: next } satisfies Schemas['ComparisonRecordList']);
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
        body.status = 'pre_validating';
        body.total_records = execution.records.length;
        return;
      case 'pre_validating':
        this.preValidate(execution);
        return;
      case 'calculating':
        this.calculateChunk(execution);
        return;
      case 'delivering':
        this.deliver(execution);
        return;
      case 'comparing':
        this.compare(execution);
        return;
      default:
        // `awaiting_decision` waits for a person; `awaiting_source` does not happen here.
        return;
    }
  }

  /** The end of the pre-validation (E7-2, E7-3): blocked, waiting for a decision, going on alone (scheduled) or passed. */
  private preValidate(execution: StoredExecution): void {
    const { body } = execution;
    const check = structuredClone(execution.check);
    body.pre_validation = check;
    if (check.status === 'blocked') {
      this.end(execution, 'aborted', 'duplicate_record_key');
      return;
    }
    if (check.status === 'alerted') {
      const variables = check.empty_values.filter((each) => each.alert).map((each) => each.variable).join(', ');
      if (body.schedule) {
        check.decision = { choice: 'automatic', by: null, at: iso(this.now()) };
        this.notify(execution, 'pre_validation_alert', `${body.workflow_name}: a execução agendada seguiu com campos vazios acima do limite (${variables}).`);
      } else {
        check.decision_expires_at = iso(this.now() + DECISION_HOURS * 60 * 60 * 1000);
        body.status = 'awaiting_decision';
        this.notify(execution, 'awaiting_decision', `${body.workflow_name}: a pré-validação encontrou campos vazios acima do limite. Prossiga ou cancele na execução.`);
        return;
      }
    }
    body.status = 'calculating';
  }

  private calculateChunk(execution: StoredExecution): void {
    const { body } = execution;
    const chunk = execution.records.slice(execution.done, execution.done + CHUNK_SIZE);
    execution.done += chunk.length;
    body.progress = { chunks_done: body.progress.chunks_done + 1, records_done: execution.done };
    const calculated = execution.records.slice(0, execution.done);
    const count = (status: Schemas['UnitRunStatus']) => calculated.filter((record) => record.status === status).length;
    body.totals = { read: calculated.length, ok: count('ok'), ok_with_warnings: count('ok_with_warnings'), error: count('error'), ignored: count('ignored'), filtered: count('filtered') };
    body.error_groups = errorGroups(calculated, execution.definition);
    body.source_counts = sourceCounts(execution.definition, calculated);
    // The early check (E6-9), only in a batch: the errors already passed the limit over the whole batch.
    const total = body.total_records ?? calculated.length;
    if (body.mode === 'batch' && total > 0 && (body.totals.error / total) * 100 > Number(body.error_limit_percent)) {
      this.end(execution, 'aborted', 'error_limit_exceeded');
      return;
    }
    if (execution.done >= execution.records.length) body.status = body.mode === 'simulation' && execution.file ? 'comparing' : 'delivering';
  }

  /** The final check over the eligible records (without `ignored` and `filtered`) and the CSV. */
  private deliver(execution: StoredExecution): void {
    const { body } = execution;
    if (body.mode === 'simulation') {
      this.end(execution, body.totals.error > 0 ? 'completed_with_errors' : 'completed');
      return;
    }
    const eligible = body.totals.read - body.totals.ignored - body.totals.filtered;
    if (eligible > 0 && (body.totals.error / eligible) * 100 > Number(body.error_limit_percent)) {
      this.end(execution, 'aborted', 'error_limit_exceeded');
      return;
    }
    const delivered = execution.records.filter((record) => record.status === 'ok' || record.status === 'ok_with_warnings');
    execution.csv = this.csv(execution, delivered);
    body.output = { available: true, expires_at: iso(this.now() + OUTPUT_DAYS * 24 * 60 * 60 * 1000), rows: delivered.length };
    this.end(execution, body.totals.error > 0 ? 'completed_with_errors' : 'completed');
  }

  /** `comparing` (E7-11): the records against the reference file; the simulation then ends without delivery. */
  private compare(execution: StoredExecution): void {
    const { body } = execution;
    if (execution.file) {
      execution.comparison = compare(execution.records, execution.file, execution.tenantId, body.workflow_id);
      body.comparison = execution.comparison.summary;
    }
    this.end(execution, body.totals.error > 0 ? 'completed_with_errors' : 'completed');
  }

  private end(execution: StoredExecution, status: ExecutionStatus, reason?: Schemas['AbortReason']): void {
    const { body } = execution;
    body.status = status;
    body.finished_at = iso(this.now());
    body.next_retry_at = null;
    if (status === 'aborted' && reason) {
      const message = ABORT_MESSAGES[reason] ?? reason;
      body.abort_reason = { code: reason, message };
      this.notify(execution, 'execution_aborted', `${body.workflow_name}: ${message}`);
    }
    if (status === 'completed_with_errors' && body.mode === 'batch') {
      const errors = body.totals.error;
      this.notify(execution, 'execution_completed_with_errors', `${body.workflow_name}: ${errors} ${errors === 1 ? 'registro' : 'registros'} com erro. O CSV tem só os registros sem erro.`);
    }
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

  // --- Schedules (E7-7 to E7-9) ------------------------------------------------------------------------------------------

  private withSchedule(id: string, caller: Caller, then: (schedule: StoredSchedule) => RouteResponse): RouteResponse {
    const schedule = this.schedules.find((each) => each.body.id === id && each.tenantId === caller.tenantId);
    return schedule ? then(schedule) : problem(ERRORS.NotFound);
  }

  private scheduleBody(schedule: StoredSchedule): Schedule {
    const workflow = this.workflows.find((each) => each.id === schedule.body.workflow_id);
    return { ...schedule.body, workflow_name: workflow?.name ?? '', current_draft_revision: workflow?.draft.revision ?? schedule.body.draft_revision };
  }

  private scheduleList(url: URL, caller: Caller): RouteResponse {
    const workflowId = url.searchParams.get('workflow_id');
    if (workflowId !== null && !UUID.test(workflowId)) return problem(ERRORS.InvalidDataWorkflowId);
    const offset = readCursor(url.searchParams.get('cursor'));
    if (offset === null) return problem(ERRORS.InvalidCursor);
    const items = this.schedules
      .filter((each) => each.tenantId === caller.tenantId && (workflowId === null || each.body.workflow_id === workflowId))
      .map((each) => this.scheduleBody(each))
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR') || a.id.localeCompare(b.id));
    const next = offset + LIST_PAGE < items.length ? writeCursor(offset + LIST_PAGE) : null;
    return json(200, { items: items.slice(offset, offset + LIST_PAGE), next_cursor: next } satisfies Schemas['ScheduleList']);
  }

  /** The body of a creation or a change (`ScheduleData`): its form and the resolution of the parameters with `now`. */
  private readScheduleData(
    workflowId: string,
    request: Request,
    definitionFor: (revision: number) => RouteResponse | Definition,
    except?: string,
  ): RouteResponse | { data: Schemas['ScheduleData']; definition: Definition } {
    const body = readJson(request);
    const fields: Record<string, string> = {};
    const name = typeof body?.name === 'string' ? body.name.trim() : '';
    if (name === '' || name.length > SCHEDULE_NAME_MAX) fields.name = 'Informe um nome de 1 a 100 caracteres.';
    if (typeof body?.enabled !== 'boolean') fields.enabled = 'Informe se o agendamento está ativo.';
    const recurrence = readRecurrence(body?.recurrence);
    if (typeof recurrence === 'string') fields['recurrence'] = recurrence;
    const parameters = isObject(body?.parameters) ? (body.parameters as Record<string, Schemas['ScheduleParameter']>) : body?.parameters === undefined ? {} : null;
    if (parameters === null) fields.parameters = 'Envie os parâmetros por nome.';
    if (Object.keys(fields).length > 0) return problem({ ...ERRORS.InvalidData, fields });
    const key = name.toLocaleLowerCase('pt-BR');
    if (this.schedules.some((each) => each.body.workflow_id === workflowId && each.body.id !== except && each.body.name.toLocaleLowerCase('pt-BR') === key)) {
      return problem(ERRORS.ScheduleNameTaken);
    }
    const definition = definitionFor(Number(body?.revision));
    if (!isDefinitionValue(definition)) return definition;
    const resolved = resolveSchedule(definition.parameters ?? [], parameters ?? {}, new Date(this.now()), false);
    if (!resolved.ok) return problem(resolved.problem);
    return {
      data: { revision: Number(body?.revision), name, enabled: body?.enabled as boolean, recurrence: recurrence as Schemas['Recurrence'], parameters: parameters ?? {} },
      definition,
    };
  }

  private createSchedule(workflow: StoredWorkflow, request: Request, caller: Caller): RouteResponse {
    if (this.schedules.filter((each) => each.body.workflow_id === workflow.id).length >= MAX_SCHEDULES) return problem(ERRORS.TooManySchedules);
    const read = this.readScheduleData(workflow.id, request, (revision) => this.triggerable(workflow, revision, ERRORS.ScheduleNoBatchSource) ?? workflow.draft.definition);
    if (!('data' in read)) return read;
    const now = this.now();
    const schedule: StoredSchedule = {
      tenantId: caller.tenantId,
      definition: structuredClone(read.definition),
      body: {
        id: randomUUID(),
        workflow_id: workflow.id,
        name: read.data.name,
        enabled: read.data.enabled,
        recurrence: read.data.recurrence,
        timezone: businessTimeZone(),
        parameters: read.data.parameters,
        draft_revision: workflow.draft.revision,
        next_run_at: read.data.enabled ? nextRun(read.data.recurrence, new Date(now)) : null,
        last_run: null,
        created_by: caller.user,
        created_at: iso(now),
        updated_at: iso(now),
      },
    };
    this.schedules.push(schedule);
    return json(201, this.scheduleBody(schedule));
  }

  private updateSchedule(schedule: StoredSchedule, request: Request): RouteResponse {
    const workflow = this.workflows.find((each) => each.id === schedule.body.workflow_id)!;
    const read = this.readScheduleData(
      workflow.id,
      request,
      (revision) =>
        revision === schedule.body.draft_revision ? schedule.definition : (this.triggerable(workflow, revision, ERRORS.ScheduleNoBatchSource) ?? workflow.draft.definition),
      schedule.body.id,
    );
    if (!('data' in read)) return read;
    const now = this.now();
    if (read.data.revision !== schedule.body.draft_revision) {
      schedule.definition = structuredClone(read.definition);
      schedule.body.draft_revision = read.data.revision;
    }
    Object.assign(schedule.body, {
      name: read.data.name,
      enabled: read.data.enabled,
      recurrence: read.data.recurrence,
      parameters: read.data.parameters,
      next_run_at: read.data.enabled ? nextRun(read.data.recurrence, new Date(now)) : null,
      updated_at: iso(now),
    });
    return json(200, this.scheduleBody(schedule));
  }

  private deleteSchedule(schedule: StoredSchedule): RouteResponse {
    this.schedules.splice(this.schedules.indexOf(schedule), 1);
    return { status: 204, contentType: 'application/json', body: undefined };
  }

  /** One trigger of the scheduler (E7-9): at `next_run_at`, the "now" of the relatives and of the execution. */
  private fire(name: string): void {
    const schedule = [...this.schedules].reverse().find((each) => each.body.name === name);
    if (!schedule) throw new Error(`O agendamento ${name} não existe na simulação.`);
    if (!schedule.body.enabled || schedule.body.next_run_at === null) throw new Error(`O agendamento ${name} está desativado.`);
    const workflow = this.workflows.find((each) => each.id === schedule.body.workflow_id)!;
    const scheduledFor = new Date(schedule.body.next_run_at);
    const firedAt = new Date(Math.max(this.now(), scheduledFor.getTime()));
    const ref = { id: schedule.body.id, name: schedule.body.name };
    const record = (outcome: Schemas['ScheduleRunOutcome'], executionId: string | null, message: string | null) => {
      schedule.body.last_run = { scheduled_for: scheduledFor.toISOString(), fired_at: firedAt.toISOString(), outcome, execution_id: executionId, message };
      schedule.body.next_run_at = nextRun(schedule.body.recurrence, firedAt);
    };
    const resolved = resolveSchedule(schedule.definition.parameters ?? [], schedule.body.parameters, scheduledFor, true);
    if (!resolved.ok) {
      const message = 'um parâmetro ficou sem valor ou fora dos valores permitidos';
      record('failed', null, `${message[0]!.toUpperCase()}${message.slice(1)}.`);
      this.notifyWorkflow(schedule.tenantId, workflow, null, ref, 'schedule_failed', `${schedule.body.name} (${workflow.name}): ${message}.`);
      return;
    }
    const scope = scopeHash(schedule.tenantId, workflow.id, resolved.values);
    if (this.overlapping(workflow.id, scope).length > 0) {
      record('skipped_overlap', null, 'O escopo já foi entregue ou está em execução.');
      this.notifyWorkflow(
        schedule.tenantId,
        workflow,
        null,
        ref,
        'schedule_skipped',
        `${schedule.body.name} (${workflow.name}): o escopo já foi entregue. Para entregar de novo, use Executar lote.`,
      );
      return;
    }
    const execution = this.createExecution(workflow, schedule.tenantId, resolved.values, scheduledFor, {
      mode: 'batch',
      triggeredBy: null,
      schedule: ref,
      scope,
      overlapOf: null,
      file: null,
      frozen: { definition: schedule.definition, revision: schedule.body.draft_revision },
      createdAt: firedAt,
    });
    record('triggered', execution.body.id, null);
  }

  // --- Reference files (E7-10) and simulations (E7-11) -------------------------------------------------------------------

  private fileBody(file: StoredReferenceFile): Schemas['ReferenceFile'] {
    const last = this.executions
      .filter((each) => each.body.reference_file?.id === file.body.id)
      .sort((a, b) => b.body.created_at.localeCompare(a.body.created_at))[0];
    return {
      ...file.body,
      last_comparison: last
        ? { execution_id: last.body.id, status: last.body.status, equal_percent: last.body.comparison?.equal_percent ?? null, finished_at: last.body.finished_at }
        : null,
    };
  }

  private referenceFiles(workflow: StoredWorkflow, caller: Caller): RouteResponse {
    const items = this.files
      .filter((each) => each.tenantId === caller.tenantId && each.body.workflow_id === workflow.id)
      .sort((a, b) => b.body.uploaded_at.localeCompare(a.body.uploaded_at))
      .map((each) => this.fileBody(each));
    return json(200, { items } satisfies Schemas['ReferenceFileList']);
  }

  private upload(workflow: StoredWorkflow, request: Request, caller: Caller): RouteResponse {
    const part = readMultipartFile(request);
    if (!part || part.name === '' || part.name.length > 255 || /[\u0000-\u001f]/.test(part.name)) {
      return problem({ ...ERRORS.InvalidData, fields: { file: 'Envie o arquivo no campo file, com um nome de até 255 caracteres.' } });
    }
    if (this.files.filter((each) => each.body.workflow_id === workflow.id).length >= MAX_REFERENCE_FILES) return problem(ERRORS.TooManyReferenceFiles);
    const { definition, analysis } = workflow.draft;
    if (!definition.root.batch_source) return problem(ERRORS.ReferenceFileNoBatchSource);
    const text = part.content.toString('utf8');
    const read = readReferenceFile(text, definition, analysis);
    if ('errors' in read) return problem({ ...ERRORS.InvalidReferenceFile, fields: read.errors });
    const file: StoredReferenceFile = {
      tenantId: caller.tenantId,
      read,
      body: {
        id: randomUUID(),
        workflow_id: workflow.id,
        name: part.name,
        size_bytes: part.content.length,
        sha256: createHash('sha256').update(part.content).digest('hex'),
        records: read.lines.length,
        key_columns: read.keyColumns,
        field_columns: read.fieldColumns,
        has_status: read.hasStatus,
        uploaded_by: caller.user,
        uploaded_at: iso(this.now()),
      },
    };
    this.files.push(file);
    return json(201, this.fileBody(file));
  }

  private deleteFile(workflow: StoredWorkflow, fileId: string, caller: Caller): RouteResponse {
    const file = this.files.find((each) => each.body.id === fileId && each.body.workflow_id === workflow.id && each.tenantId === caller.tenantId);
    if (!file) return problem(ERRORS.NotFound);
    this.files.splice(this.files.indexOf(file), 1);
    return { status: 204, contentType: 'application/json', body: undefined };
  }

  private simulate(workflow: StoredWorkflow, fileId: string, request: Request, caller: Caller): RouteResponse {
    const file = this.files.find((each) => each.body.id === fileId && each.body.workflow_id === workflow.id && each.tenantId === caller.tenantId);
    if (!file) return problem(ERRORS.NotFound);
    const body = readJson(request);
    const refused = this.triggerable(workflow, body?.revision, ERRORS.ExecutionNoBatchSource);
    if (refused) return refused;
    const definition = workflow.draft.definition;
    const source = definition.root.batch_source!;
    const outputs = new Set(definition.root.output.fields.map((field) => field.name));
    const sameKey = file.read.keyColumns.length === source.key.length && source.key.every((name) => file.read.keyColumns.includes(name));
    if (!sameKey || file.read.fieldColumns.some((name) => !outputs.has(name))) return problem(ERRORS.ReferenceFileMismatch);
    const now = new Date(this.now());
    const resolved = resolveRun(definition.parameters ?? [], body?.parameters, now);
    if (!resolved.ok) return problem(resolved.problem);
    const execution = this.createExecution(workflow, caller.tenantId, resolved.values, now, {
      mode: 'simulation',
      triggeredBy: caller.user,
      schedule: null,
      scope: null,
      overlapOf: null,
      file,
    });
    return json(202, execution.body);
  }

  // --- The bell (E7-13) ----------------------------------------------------------------------------------------------------

  private notify(execution: StoredExecution, kind: Schemas['NotificationKind'], detail: string): void {
    const workflow = this.workflows.find((each) => each.id === execution.body.workflow_id)!;
    this.notifyWorkflow(execution.tenantId, workflow, { id: execution.body.id }, execution.body.schedule, kind, detail);
  }

  private notifyWorkflow(
    tenantId: string,
    workflow: StoredWorkflow,
    execution: Schemas['ExecutionRef'] | null,
    schedule: Schemas['ScheduleRef'] | null,
    kind: Schemas['NotificationKind'],
    detail: string,
  ): void {
    const titles: Readonly<Record<Schemas['NotificationKind'], string>> = {
      awaiting_decision: 'Execução aguarda decisão',
      pre_validation_alert: 'Alerta na pré-validação',
      execution_aborted: 'Execução abortada',
      execution_completed_with_errors: 'Execução com erros',
      schedule_failed: 'Agendamento não disparou',
      schedule_skipped: 'Agendamento não executou',
    };
    // A new alert is always newer than the last one, even within the same millisecond.
    const last = this.notifications.at(-1)?.body.created_at;
    const created = Math.max(this.now(), last ? Date.parse(last) + 1 : 0);
    this.notifications.push({
      tenantId: tenantId || this.tenantId,
      readBy: new Set(),
      body: { id: randomUUID(), kind, title: titles[kind], detail, created_at: iso(created), workflow: { id: workflow.id, name: workflow.name }, execution, schedule },
    });
  }

  private notificationList(url: URL, caller: Caller): RouteResponse {
    const unreadOnly = url.searchParams.get('unread_only');
    if (unreadOnly !== null && unreadOnly !== 'true' && unreadOnly !== 'false') return problem(ERRORS.InvalidDataUnreadOnly);
    const offset = readCursor(url.searchParams.get('cursor'));
    if (offset === null) return problem(ERRORS.InvalidCursor);
    const mine = this.notifications
      .filter((each) => each.tenantId === caller.tenantId)
      .map((each) => ({ ...each.body, read: each.readBy.has(caller.user.id) }))
      .sort((a, b) => b.created_at.localeCompare(a.created_at));
    const items = unreadOnly === 'true' ? mine.filter((each) => !each.read) : mine;
    const next = offset + NOTIFICATIONS_PAGE < items.length ? writeCursor(offset + NOTIFICATIONS_PAGE) : null;
    return json(200, {
      items: items.slice(offset, offset + NOTIFICATIONS_PAGE),
      next_cursor: next,
      unread_count: mine.filter((each) => !each.read).length,
    } satisfies Schemas['NotificationList']);
  }

  private markRead(request: Request, caller: Caller): RouteResponse {
    const body = readJson(request);
    const ids = Array.isArray(body?.ids) ? body.ids.filter((id): id is string => typeof id === 'string') : null;
    const all = body?.all === true;
    if (!all && (ids === null || ids.length < 1 || ids.length > 100)) return problem({ ...ERRORS.InvalidData, fields: { ids: 'Envie de 1 a 100 alertas, ou all.' } });
    for (const each of this.notifications) {
      if (each.tenantId === caller.tenantId && (all || ids?.includes(each.body.id))) each.readBy.add(caller.user.id);
    }
    return { status: 204, contentType: 'application/json', body: undefined };
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

/**
 * The values of a schedule's parameters (E7-7): the fixed ones as sent, the relative ones resolved by `now` (the marked hour
 * at a trigger); a relative that does not serve the type is `422 invalid_parameter`. The query of the allowed values is
 * only checked at a trigger (`atTrigger`).
 */
function resolveSchedule(declared: readonly Parameter[], parameters: Record<string, Schemas['ScheduleParameter']>, now: Date, atTrigger: boolean) {
  const invalid: Record<string, string> = {};
  const sent: Record<string, Schemas['ParameterValue']> = {};
  const withRelatives = declared.map((parameter) => {
    const given = parameters[parameter.name];
    if (!given) return parameter;
    if (given.kind === 'fixed') {
      sent[parameter.name] = given.value;
      return parameter;
    }
    const relatives = parameter.list ? [] : (RELATIVES_BY_TYPE[parameter.type] ?? []);
    if (!relatives.includes(given.value)) invalid[parameter.name] = 'Este valor relativo não serve ao tipo do parâmetro.';
    return { ...parameter, default: { kind: 'relative' as const, value: given.value } };
  });
  for (const name of Object.keys(parameters)) {
    if (!declared.some((parameter) => parameter.name === name)) invalid[name] = 'O workflow não tem este parâmetro.';
  }
  if (Object.keys(invalid).length > 0) return { ok: false as const, problem: { ...ERRORS.InvalidParameter, fields: invalid } };
  const resolved = resolveParameters(withRelatives, sent, now);
  if (!resolved.ok || !atTrigger) return resolved;
  return checkAllowedValues(declared, resolved.values);
}

/** The recurrence of the body, or why it is not one. */
function readRecurrence(value: unknown): Schemas['Recurrence'] | string {
  if (!isObject(value) || typeof value.time !== 'string' || !TIME.test(value.time)) return 'Informe o horário como HH:MM, de 00:00 a 23:59.';
  if (value.kind === 'daily') return { kind: 'daily', time: value.time };
  if (value.kind === 'weekly') {
    const days = value.weekdays;
    if (!Array.isArray(days) || days.length === 0 || days.length > 7 || new Set(days).size !== days.length || !days.every((day) => Number.isInteger(day) && day >= 1 && day <= 7)) {
      return 'Escolha de 1 a 7 dias da semana, sem repetição.';
    }
    return { kind: 'weekly', time: value.time, weekdays: days as number[] };
  }
  if (value.kind === 'monthly') {
    const day = value.day;
    if (day !== 'last' && !(Number.isInteger(day) && (day as number) >= 1 && (day as number) <= 28)) return 'Escolha um dia de 1 a 28 ou o último dia.';
    return { kind: 'monthly', time: value.time, day: day as number | 'last' };
  }
  return 'Use uma recorrência diária, semanal ou mensal.';
}

/** The instant (UTC) of a local date and hour in the business time zone. */
function zonedInstant(year: number, month: number, day: number, hour: number, minute: number): number {
  const guess = Date.UTC(year, month - 1, day, hour, minute);
  const local = zonedParts(new Date(guess), businessTimeZone());
  const offset = Date.UTC(local.year, local.month - 1, local.day, local.hour, local.minute) - guess;
  return guess - offset;
}

/** The first marked hour after `after`, in UTC (E7-9). */
function nextRun(recurrence: Schemas['Recurrence'], after: Date): string {
  const [hour, minute] = recurrence.time.split(':').map(Number) as [number, number];
  const today = zonedParts(after, businessTimeZone());
  for (let offset = 0; offset < 400; offset += 1) {
    const date = new Date(Date.UTC(today.year, today.month - 1, today.day + offset));
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    const weekday = ((date.getUTCDay() + 6) % 7) + 1;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    const marked =
      recurrence.kind === 'daily' ||
      (recurrence.kind === 'weekly' && recurrence.weekdays.includes(weekday)) ||
      (recurrence.kind === 'monthly' && (recurrence.day === 'last' ? day === last : day === recurrence.day));
    const instant = zonedInstant(year, month, day, hour, minute);
    if (marked && instant > after.getTime()) return new Date(instant).toISOString();
  }
  throw new Error('A simulação não achou o próximo horário do agendamento.');
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

function isDefinitionValue(value: RouteResponse | Definition): value is Definition {
  return 'schema_version' in value;
}

/** The shape the simulation needs (the backend checks the whole schema). */
function isDefinition(value: unknown): value is Definition {
  if (!isObject(value)) return false;
  const definition = value as Partial<Definition>;
  return (
    [1, 2, 3, 4].includes(definition.schema_version as number) &&
    definition.kind === 'batch' &&
    Array.isArray(definition.root?.inputs) &&
    Array.isArray(definition.root?.nodes) &&
    Array.isArray(definition.root?.output?.fields)
  );
}

/** What the backend stores: versions 1 to 3 are read as 4, with `parameters` and the new `settings` at their defaults. */
function toVersion4(definition: Definition): Definition {
  return {
    ...definition,
    schema_version: 4,
    settings: {
      ...definition.settings,
      error_limit_percent: definition.settings.error_limit_percent ?? '5',
      trace_level: definition.settings.trace_level ?? 'standard',
      pre_validation_alert_percent: definition.settings.pre_validation_alert_percent ?? '1',
    },
    parameters: Array.isArray(definition.parameters) ? definition.parameters : [],
  };
}

const iso = (instant: number) => new Date(instant).toISOString();

function json(status: number, body: unknown): RouteResponse {
  return { status, contentType: 'application/json', body };
}

function problem(example: ErrorBody | Schemas['DraftConflictProblem'] | Schemas['DraftRunConflictProblem'] | Schemas['UnitRunRejectedProblem'] | Schemas['TriggerConflictProblem']): RouteResponse {
  return { status: example.status, contentType: 'application/problem+json', body: example };
}

function isMultipart(request: Request): boolean {
  return (request.headers()['content-type'] ?? '').startsWith('multipart/form-data');
}

function readJson(request: Request): Record<string, unknown> | undefined {
  if (isMultipart(request)) return undefined;
  try {
    const body: unknown = request.postDataJSON();
    return isObject(body) ? body : undefined;
  } catch {
    return undefined;
  }
}

/** The `file` part of a `multipart/form-data` body: its file name and its bytes. */
function readMultipartFile(request: Request): { name: string; content: Buffer } | null {
  const boundary = /boundary=(?:"([^"]+)"|([^;\s]+))/.exec(request.headers()['content-type'] ?? '');
  const body = request.postDataBuffer();
  const mark = boundary?.[1] ?? boundary?.[2];
  if (!mark || !body) return null;
  const text = body.toString('latin1');
  for (const part of text.split(`--${mark}`)) {
    const split = part.indexOf('\r\n\r\n');
    if (split < 0) continue;
    const headers = part.slice(0, split);
    if (!/name="file"/.test(headers)) continue;
    const name = /filename="([^"]*)"/.exec(headers)?.[1] ?? '';
    const content = part.slice(split + 4).replace(/\r\n$/, '');
    return { name: Buffer.from(name, 'latin1').toString('utf8'), content: Buffer.from(content, 'latin1') };
  }
  return null;
}
