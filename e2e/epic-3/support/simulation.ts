// Epic 3 simulated API (pnpm e2e): connections, objects and columns of the sample database, Excel files, datasets and
// variables, in memory, one per test. It answers only the catalog routes (`/v1/connections`, `/v1/excel-files`,
// `/v1/datasets`, `/v1/variables`); the others (session, sign-in, preflight) go on to the epic 2 simulation, which keeps
// the session (`route.fallback()`).
//
// Answers like the contract (../backend/contracts/openapi.yaml) and like the backend domain (test of the credential,
// read-only, variable rules), with the contract's error examples. The sample database is the backend's `postgres-sample`
// (docker/postgres-sample/init.sql): the same tables, view, columns and users. Like the backend, the stored credential
// never leaves the simulation: no response carries the password.
import { createHash, randomUUID } from 'node:crypto';
import type { BrowserContext, Page, Request, Route } from '@playwright/test';
import { API_ROUTES, isApiCall } from '../../support/simulated-api';
import { EXAMPLES, type ErrorBody, type Schemas } from '../../support/contract';
import type { Workbook } from './workbook';

type Connection = Schemas['Connection'];
type ConnectionType = Connection['type'];
type Credential = Schemas['Credential'];
type TestResult = Schemas['ConnectionTestResult'];
type TestError = NonNullable<TestResult['error']>;
type Column = Schemas['Column'];
type DataType = Schemas['DataType'];
type DatabaseObject = Schemas['DatabaseObject'];
type Dataset = Schemas['Dataset'];
type ExcelFile = Schemas['ExcelFile'];
type Variable = Schemas['Variable'];

const ERRORS = EXAMPLES;

/** Where the sample database is and its two users (the backend's `postgres-sample`). */
export interface SampleDatabase {
  host: string;
  port: number;
  database: string;
  /** `exemplo_leitura`: only SELECT. */
  readUser: { username: string; password: string };
  /** `exemplo_escrita`: may write; the connection with it is refused (`connection_not_read_only`). */
  writeUser: { username: string; password: string };
}

/** What the backend says about the write user (one item per privilege found). */
const WRITE_PRIVILEGES = [
  'INSERT em public.itens_nf',
  'INSERT em public.notas_fiscais',
  'INSERT em public.produtos',
  'UPDATE em public.itens_nf',
  'DELETE em public.itens_nf',
];

const SERVER_VERSION = 'PostgreSQL 17.6';

/** The fixed message of each test error (contract, `ConnectionTestError`). */
const TEST_MESSAGES: Readonly<Record<TestError['code'], TestError['message']>> = {
  connection_timeout: 'O banco não respondeu a tempo.',
  connection_refused: 'O banco recusou a conexão.',
  host_not_found: 'O endereço do banco não foi encontrado.',
  authentication_failed: 'O banco recusou o usuário ou a senha.',
  connection_without_tls: 'O banco não aceitou uma conexão com TLS, que é obrigatória.',
  connection_not_read_only: 'O usuário do banco pode alterar dados. Use um usuário só de leitura.',
  connection_target_not_allowed: 'Este endereço de banco não é permitido.',
};

/** The `422` of a creation or credential change whose test did not pass, by the test error. */
const TEST_PROBLEMS: Readonly<Record<TestError['code'], Schemas['ConnectionRejectedProblem']>> = {
  connection_timeout: ERRORS.ConnectionFailed,
  connection_refused: ERRORS.ConnectionRefused,
  host_not_found: ERRORS.HostNotFound,
  authentication_failed: ERRORS.AuthenticationFailed,
  connection_without_tls: ERRORS.ConnectionWithoutTls,
  connection_not_read_only: { ...ERRORS.ConnectionNotReadOnly, privileges: WRITE_PRIVILEGES },
  connection_target_not_allowed: ERRORS.TargetNotAllowed,
};

const column = (name: string, sourceType: string, type: DataType | null, scale: number | null, nullable: boolean): Column => ({
  name,
  source_type: sourceType,
  type,
  scale,
  nullable,
});
const integer = (name: string, nullable = false) => column(name, 'integer', 'integer', null, nullable);
const text = (name: string, nullable = false) => column(name, 'text', 'text', null, nullable);
const numeric = (name: string, precision: number, scale: number, nullable = false) =>
  column(name, `numeric(${precision},${scale})`, 'decimal', scale, nullable);

/** The tables and the view of `postgres-sample` (docker/postgres-sample/init.sql), with their columns in database order. */
const SAMPLE_OBJECTS: readonly (DatabaseObject & { columns: readonly Column[] })[] = [
  {
    schema_name: 'public',
    name: 'itens_nf',
    type: 'table',
    columns: [
      integer('id'),
      integer('nota_fiscal_id'),
      integer('produto_id'),
      numeric('quantidade', 12, 3),
      numeric('valor_unitario', 12, 2),
      numeric('desconto_percentual', 5, 2),
      numeric('valor_total', 14, 2),
    ],
  },
  {
    schema_name: 'public',
    name: 'notas_fiscais',
    type: 'table',
    columns: [
      integer('id'),
      integer('numero'),
      text('cliente'),
      column('emissao', 'date', 'date', null, false),
      numeric('valor_total', 14, 2),
      column('cancelada', 'boolean', 'boolean', null, false),
    ],
  },
  {
    schema_name: 'public',
    name: 'produtos',
    type: 'table',
    columns: [
      integer('id'),
      text('codigo'),
      text('descricao'),
      text('categoria'),
      numeric('preco_tabela', 12, 2),
      column('ativo', 'boolean', 'boolean', null, false),
    ],
  },
  {
    schema_name: 'public',
    name: 'vw_itens_campanha',
    type: 'view',
    columns: [
      integer('item_id', true),
      integer('numero_nota', true),
      text('cliente', true),
      column('emissao', 'date', 'date', null, true),
      text('codigo_produto', true),
      text('descricao_produto', true),
      text('categoria', true),
      numeric('quantidade', 12, 3, true),
      numeric('valor_unitario', 12, 2, true),
      numeric('desconto_percentual', 5, 2, true),
      numeric('valor_total', 14, 2, true),
    ],
  },
];

const CONNECTION_TYPES: readonly ConnectionType[] = ['postgres', 'sqlserver'];
const CREDENTIAL_FIELDS = ['host', 'port', 'database', 'username', 'password'] as const;
const DATA_TYPES: readonly DataType[] = ['text', 'integer', 'decimal', 'date', 'datetime', 'boolean'];
const VARIABLE_NAME = /^[a-z][a-z0-9_]{0,62}$/;
const SCALE_MAX = 38;
const MAX_FILE_BYTES = 20 * 1024 * 1024;
const DEFAULT_LIMIT = 50;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const CSRF_METHODS = new Set(['POST', 'PUT', 'PATCH', 'DELETE']);
/** The catalog resources; each one may have `{id}` as the next segment. */
const RESOURCES = new Set(['connections', 'excel-files', 'datasets', 'variables']);

interface StoredConnection {
  id: string;
  name: string;
  type: ConnectionType;
  /** The whole credential, kept like the backend keeps it (encrypted there); it never goes into a response. */
  credential: Credential;
  createdAt: number;
  updatedAt: number;
  lastTest: TestResult | null;
}

interface StoredFile {
  file: ExcelFile;
}

interface RouteResponse {
  status: number;
  contentType: 'application/json' | 'application/problem+json';
  body: unknown;
}

/**
 * The epic 3 catalog in memory. Who calls is the person signed in through the epic 2 simulation: mutations need the
 * `fc_session` cookie of the context and the `X-CSRF-Token` equal to the `fc_csrf` cookie (see `authenticate`). The epic 3
 * tests only use the demonstration Admin, who has every permission, so the routes do not check permissions here.
 */
export class CatalogSimulation {
  readonly unexpected: string[] = [];

  private readonly connections: StoredConnection[] = [];
  private readonly files: StoredFile[] = [];
  private readonly datasets: Dataset[] = [];
  private readonly variables: Variable[] = [];
  /** SHA-256 → the workbook the test sends, with the types the backend should infer. */
  private readonly workbooks = new Map<string, Workbook>();

  constructor(
    private readonly sample: SampleDatabase,
    private readonly shellOrigin: string,
    private readonly now: () => number = Date.now,
  ) {}

  /** A workbook the test is going to send: the upload of these bytes answers with its sheets and declared types. */
  registerWorkbook(workbook: Workbook): void {
    this.workbooks.set(workbook.sha256, workbook);
  }

  /** Turns the simulation on for a page: catalog calls land here; the rest goes on to the previous routes. */
  async install(page: Page): Promise<void> {
    const context = page.context();
    await page.route(API_ROUTES, (route) =>
      isApiCall(route, this.shellOrigin) ? this.respond(route, context) : route.fallback(),
    );
  }

  // --- Entrada -------------------------------------------------------------------------------------------------------

  private async respond(route: Route, context: BrowserContext): Promise<void> {
    const request = route.request();
    const method = request.method().toUpperCase();
    const url = new URL(request.url());
    const parts = url.pathname.split('/');
    // Preflight and the routes of the other epics: the epic 2 simulation answers.
    if (method === 'OPTIONS' || !RESOURCES.has(parts[2] ?? '')) {
      await route.fallback();
      return;
    }

    let id: string | undefined;
    if (parts.length >= 4 && !(parts[2] === 'connections' && parts[3] === 'tests')) {
      id = parts[3];
      parts[3] = '{id}';
    }
    const key = `${method} ${parts.join('/')}`;
    const response =
      id !== undefined && !UUID.test(id)
        ? problem(ERRORS.InvalidDataId)
        : ((await this.authenticate(method, request, context)) ?? this.handle(key, id ?? '', url, request));
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

  /**
   * On mutations, the session cookie and the CSRF token equal to the `fc_csrf` cookie (also on the multipart upload, sent
   * by XMLHttpRequest); `undefined` when the call may go on. Reads go on without the check: reading the cookies costs a
   * round trip to the browser on every call, and the session of the reads is already proved by the epic 1 and 2 tests.
   */
  private async authenticate(method: string, request: Request, context: BrowserContext): Promise<RouteResponse | undefined> {
    if (!CSRF_METHODS.has(method)) return undefined;
    const cookies = await context.cookies(new URL(request.url()).origin);
    const session = cookies.find((cookie) => cookie.name === 'fc_session');
    const csrf = cookies.find((cookie) => cookie.name === 'fc_csrf');
    if (!session) return problem(ERRORS.NoSession);
    if (csrf === undefined || request.headers()['x-csrf-token'] !== csrf.value) return problem(ERRORS.InvalidCsrf);
    return undefined;
  }

  private handle(route: string, id: string, url: URL, request: Request): RouteResponse {
    switch (route) {
      case 'GET /v1/notifications':
        // The bell (F130, mounted by F131) and the "Próxima execução" of the overview read these two; the contract's examples serve.
        return json(200, EXAMPLES.NotificationList);
      case 'GET /v1/schedules':
        return json(200, EXAMPLES.ScheduleList);
      case 'GET /v1/workflows':
        // The Início lists the recent workflows (F57); the epic 3 tests do not create any.
        return json(200, { items: [], next_cursor: null } satisfies Schemas['WorkflowList']);
      case 'GET /v1/connections':
        return json(200, { items: this.connections.map((c) => this.connectionBody(c)) } satisfies Schemas['ConnectionList']);
      case 'POST /v1/connections':
        return this.createConnection(request);
      case 'POST /v1/connections/tests':
        return this.testCredential(request);
      case 'GET /v1/connections/{id}':
        return this.withConnection(id, (c) => json(200, this.connectionBody(c)));
      case 'PUT /v1/connections/{id}':
        return this.withConnection(id, (c) => this.renameConnection(c, request));
      case 'DELETE /v1/connections/{id}':
        return this.withConnection(id, (c) => this.deleteConnection(c));
      case 'PUT /v1/connections/{id}/credential':
        return this.withConnection(id, (c) => this.updateCredential(c, request));
      case 'POST /v1/connections/{id}/test':
        return this.withConnection(id, (c) => {
          c.lastTest = this.test(c.type, c.credential);
          return json(200, c.lastTest);
        });
      case 'GET /v1/connections/{id}/objects':
        return this.withConnection(id, (c) => this.listObjects(c, url));
      case 'GET /v1/connections/{id}/objects/columns':
        return this.withConnection(id, (c) => this.objectColumns(c, url));
      case 'GET /v1/excel-files':
        return json(200, { items: this.files.map((f) => f.file) } satisfies Schemas['ExcelFileList']);
      case 'POST /v1/excel-files':
        return this.uploadFile(request);
      case 'GET /v1/excel-files/{id}':
        return this.withFile(id, (f) => json(200, f.file));
      case 'DELETE /v1/excel-files/{id}':
        return this.withFile(id, (f) => this.deleteFile(f));
      case 'GET /v1/datasets':
        return this.listDatasets(url);
      case 'POST /v1/datasets':
        return this.createDataset(request);
      case 'GET /v1/datasets/{id}':
        return this.withDataset(id, (d) => json(200, d));
      case 'PUT /v1/datasets/{id}':
        return this.withDataset(id, (d) => this.updateDataset(d, request));
      case 'DELETE /v1/datasets/{id}':
        return this.withDataset(id, (d) => this.deleteDataset(d));
      case 'POST /v1/datasets/{id}/column-refresh':
        return this.withDataset(id, (d) => {
          d.columns_refreshed_at = iso(this.now());
          return json(200, d);
        });
      case 'GET /v1/datasets/{id}/variables':
        return this.withDataset(id, (d) => json(200, { items: this.variablesOf(d.id) } satisfies Schemas['VariableList']));
      case 'POST /v1/datasets/{id}/variables':
        return this.withDataset(id, (d) => this.createVariable(d, request));
      case 'PUT /v1/variables/{id}':
        return this.withVariable(id, (v) => this.updateVariable(v, request));
      case 'DELETE /v1/variables/{id}':
        return this.withVariable(id, (v) => {
          this.variables.splice(this.variables.indexOf(v), 1);
          return empty();
        });
      default:
        this.unexpected.push(route);
        return problem({ type: 'about:blank', title: 'Rota fora da simulação', status: 501, detail: route, code: 'route_not_simulated' });
    }
  }

  // --- Connections ---------------------------------------------------------------------------------------------------

  private withConnection(id: string, action: (connection: StoredConnection) => RouteResponse): RouteResponse {
    const connection = this.connections.find((c) => c.id === id);
    return connection ? action(connection) : problem(ERRORS.NotFound);
  }

  /** `POST /v1/connections`: tests the credential first; saves only if it passes (E3-3). */
  private createConnection(request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const fields: Record<string, string> = {};
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') fields.name = 'Campo obrigatório.';
    const type = CONNECTION_TYPES.find((item) => item === body.type);
    if (type === undefined) fields.type = 'Use postgres ou sqlserver.';
    const credential = readCredential(body.credential, 'credential.', fields);
    if (Object.keys(fields).length > 0 || type === undefined || credential === undefined) {
      return problem({ ...ERRORS.InvalidData, fields });
    }
    if (this.connections.some((c) => sameName(c.name, name))) return problem(ERRORS.ConnectionAlreadyExists);

    const result = this.test(type, credential);
    if (result.error) return problem(TEST_PROBLEMS[result.error.code]);
    const now = this.now();
    const connection: StoredConnection = { id: randomUUID(), name, type, credential, createdAt: now, updatedAt: now, lastTest: result };
    this.connections.push(connection);
    return json(201, this.connectionBody(connection));
  }

  /** `POST /v1/connections/tests`: the result of the test, without saving; a test that fails is still a `200`. */
  private testCredential(request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const fields: Record<string, string> = {};
    const type = CONNECTION_TYPES.find((item) => item === body.type);
    if (type === undefined) fields.type = 'Use postgres ou sqlserver.';
    const credential = readCredential(body.credential, 'credential.', fields);
    if (Object.keys(fields).length > 0 || type === undefined || credential === undefined) {
      return problem({ ...ERRORS.InvalidData, fields });
    }
    return json(200, this.test(type, credential));
  }

  private renameConnection(connection: StoredConnection, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') return problem({ ...ERRORS.InvalidData, fields: { name: 'Campo obrigatório.' } });
    if (this.connections.some((c) => c !== connection && sameName(c.name, name))) return problem(ERRORS.ConnectionAlreadyExists);
    connection.name = name;
    connection.updatedAt = this.now();
    return json(200, this.connectionBody(connection));
  }

  private deleteConnection(connection: StoredConnection): RouteResponse {
    if (this.datasets.some((d) => d.connection_id === connection.id)) return problem(ERRORS.ConnectionInUse);
    this.connections.splice(this.connections.indexOf(connection), 1);
    return empty();
  }

  /** `PUT /v1/connections/{id}/credential`: the five fields again; tested before saving, like the creation. */
  private updateCredential(connection: StoredConnection, request: Request): RouteResponse {
    const fields: Record<string, string> = {};
    const credential = readCredential(readJson(request), '', fields);
    if (credential === undefined) return problem({ ...ERRORS.InvalidData, fields });
    const result = this.test(connection.type, credential);
    if (result.error) return problem(TEST_PROBLEMS[result.error.code]);
    connection.credential = credential;
    connection.lastTest = result;
    connection.updatedAt = this.now();
    return json(200, this.connectionBody(connection));
  }

  /**
   * The test of a credential against the sample database: the address, the database and the user, then the privileges
   * (the write user is not read-only). Only Postgres is simulated; the SQL Server is covered by the backend tests (G3).
   */
  private test(type: ConnectionType, credential: Credential): TestResult {
    const sample = this.sample;
    const fail = (code: TestError['code'], checked: Partial<TestResult> = {}): TestResult => ({
      ok: false,
      tested_at: iso(this.now()),
      duration_ms: 12,
      server_version: null,
      tls: null,
      read_only: null,
      ...checked,
      error: { code, message: TEST_MESSAGES[code] },
    });
    if (type !== 'postgres' || credential.port !== sample.port) return fail('connection_refused');
    if (credential.host.toLowerCase() !== sample.host.toLowerCase()) return fail('host_not_found');
    const user = [sample.readUser, sample.writeUser].find(
      (u) => u.username === credential.username && u.password === credential.password,
    );
    if (credential.database !== sample.database || user === undefined) return fail('authentication_failed');
    const opened = { server_version: SERVER_VERSION, tls: false, duration_ms: 38 };
    if (user === sample.writeUser) return fail('connection_not_read_only', { ...opened, read_only: false });
    return { ok: true, tested_at: iso(this.now()), ...opened, read_only: true, error: null };
  }

  /** The connection as the API answers it: the target without the password (the Admin has `credentials.manage`). */
  private connectionBody(connection: StoredConnection): Connection {
    const { host, port, database, username } = connection.credential;
    return {
      id: connection.id,
      name: connection.name,
      type: connection.type,
      created_at: iso(connection.createdAt),
      updated_at: iso(connection.updatedAt),
      last_test: connection.lastTest,
      target: { host, port, database, username },
    };
  }

  /** The tables and views of the sample database the connection sees, by `schema_name` and `name`, filtered by `search`. */
  private listObjects(connection: StoredConnection, url: URL): RouteResponse {
    const unreachable = this.unreachable(connection);
    if (unreachable) return unreachable;
    const search = (url.searchParams.get('search') ?? '').trim().toLowerCase();
    const items = SAMPLE_OBJECTS.filter((o) => search === '' || o.name.toLowerCase().includes(search)).map(
      ({ schema_name, name, type }): DatabaseObject => ({ schema_name, name, type }),
    );
    return paginate(items, url);
  }

  private objectColumns(connection: StoredConnection, url: URL): RouteResponse {
    const unreachable = this.unreachable(connection);
    if (unreachable) return unreachable;
    const object = this.sampleObject(url.searchParams.get('schema_name') ?? '', url.searchParams.get('name') ?? '');
    return object ? json(200, { items: [...object.columns] } satisfies Schemas['ColumnList']) : problem(ERRORS.NotFound);
  }

  /** `422 connection_failed` when the saved credential no longer opens the sample database. */
  private unreachable(connection: StoredConnection): RouteResponse | undefined {
    const result = this.test(connection.type, connection.credential);
    if (result.error === null || result.error.code === 'connection_not_read_only') return undefined;
    return problem({ ...ERRORS.ConnectionFailed, detail: result.error.message });
  }

  private sampleObject(schemaName: string, name: string) {
    return SAMPLE_OBJECTS.find((o) => o.schema_name === schemaName && o.name === name);
  }

  // --- Excel files ---------------------------------------------------------------------------------------------------

  private withFile(id: string, action: (file: StoredFile) => RouteResponse): RouteResponse {
    const file = this.files.find((f) => f.file.id === id);
    return file ? action(file) : problem(ERRORS.NotFound);
  }

  /**
   * `POST /v1/excel-files` (multipart, field `file`): the sheets and columns of the workbook the test registered (the same
   * bytes). An unknown file is answered as one the backend cannot read (`invalid_file`).
   */
  private uploadFile(request: Request): RouteResponse {
    const upload = readMultipartFile(request, 'file');
    if (upload === undefined) return problem(ERRORS.InvalidDataFile);
    if (upload.data.length > MAX_FILE_BYTES) return problem(ERRORS.FileTooLarge);
    const sha256 = createHash('sha256').update(upload.data).digest('hex');
    const workbook = this.workbooks.get(sha256);
    if (!workbook || !upload.fileName.toLowerCase().endsWith('.xlsx')) return problem(ERRORS.InvalidFile);

    const file: ExcelFile = {
      id: randomUUID(),
      file_name: upload.fileName,
      size_bytes: upload.data.length,
      sha256,
      uploaded_at: iso(this.now()),
      sheets: workbook.sheets.map((sheet) => {
        const rows = Math.max(0, ...sheet.columns.map((c) => c.values.length));
        return {
          name: sheet.name,
          sampled_rows: rows,
          columns: sheet.columns.map((c) => ({
            name: c.header,
            source_type: c.sourceType,
            type: c.type,
            scale: c.type === 'decimal' ? (c.scale ?? 0) : null,
            nullable: Array.from({ length: rows }, (_, index) => c.values[index] ?? null).some(
              (value) => value === null || (typeof value === 'string' && value.trim() === ''),
            ),
          })),
        };
      }),
    };
    this.files.push({ file });
    return json(201, file);
  }

  private deleteFile(stored: StoredFile): RouteResponse {
    if (this.datasets.some((d) => d.excel_file_id === stored.file.id)) return problem(ERRORS.ExcelFileInUse);
    this.files.splice(this.files.indexOf(stored), 1);
    return empty();
  }

  // --- Datasets ------------------------------------------------------------------------------------------------------

  private withDataset(id: string, action: (dataset: Dataset) => RouteResponse): RouteResponse {
    const dataset = this.datasets.find((d) => d.id === id);
    return dataset ? action(dataset) : problem(ERRORS.NotFound);
  }

  private listDatasets(url: URL): RouteResponse {
    const connectionId = url.searchParams.get('connection_id');
    const excelFileId = url.searchParams.get('excel_file_id');
    if (connectionId !== null && !UUID.test(connectionId)) return problem(ERRORS.InvalidDataConnectionId);
    if (excelFileId !== null && !UUID.test(excelFileId)) {
      return problem({ ...ERRORS.InvalidData, fields: { excel_file_id: 'Informe um identificador válido.' } });
    }
    const items = this.datasets.filter(
      (d) => (connectionId === null || d.connection_id === connectionId) && (excelFileId === null || d.excel_file_id === excelFileId),
    );
    return json(200, { items } satisfies Schemas['DatasetList']);
  }

  /**
   * `POST /v1/datasets`: a table or view of a connection, or a sheet of an Excel file; the columns are read now. Free SQL
   * is not run by the simulation: it answers as if the database refused it (`invalid_sql`).
   */
  private createDataset(request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') return problem({ ...ERRORS.InvalidData, fields: { name: 'Campo obrigatório.' } });

    let origin: Pick<Dataset, 'type' | 'connection_id' | 'schema_name' | 'object_name' | 'sql' | 'excel_file_id' | 'sheet' | 'columns'>;
    if (body.type === 'table') {
      const connection = this.connections.find((c) => c.id === body.connection_id);
      if (!connection) return problem(ERRORS.InvalidDataUnknownConnection);
      const unreachable = this.unreachable(connection);
      if (unreachable) return unreachable;
      const schemaName = typeof body.schema_name === 'string' ? body.schema_name : '';
      const objectName = typeof body.object_name === 'string' ? body.object_name : '';
      const object = this.sampleObject(schemaName, objectName);
      if (!object) return problem({ ...ERRORS.UnknownObject, fields: { object_name: `Não existe '${schemaName}.${objectName}'.` } });
      origin = {
        type: 'table',
        connection_id: connection.id,
        schema_name: schemaName,
        object_name: objectName,
        sql: null,
        excel_file_id: null,
        sheet: null,
        columns: [...object.columns],
      };
    } else if (body.type === 'excel') {
      const stored = this.files.find((f) => f.file.id === body.excel_file_id);
      if (!stored) return problem({ ...ERRORS.InvalidData, fields: { excel_file_id: 'Arquivo não encontrado.' } });
      const sheet = stored.file.sheets.find((s) => s.name === body.sheet);
      if (!sheet) return problem({ ...ERRORS.UnknownSheet, fields: { sheet: `Não existe a aba '${String(body.sheet)}'.` } });
      origin = {
        type: 'excel',
        connection_id: null,
        schema_name: null,
        object_name: null,
        sql: null,
        excel_file_id: stored.file.id,
        sheet: sheet.name,
        columns: [...sheet.columns],
      };
    } else if (body.type === 'sql') {
      return problem(ERRORS.InvalidSqlRejectedByDatabase);
    } else {
      return problem({ ...ERRORS.InvalidData, fields: { type: 'Use table, sql ou excel.' } });
    }

    if (this.datasets.some((d) => sameName(d.name, name))) return problem(ERRORS.DatasetAlreadyExists);
    const dataset: Dataset = { id: randomUUID(), name, ...origin, columns_refreshed_at: iso(this.now()) };
    this.datasets.push(dataset);
    return json(201, dataset);
  }

  private updateDataset(dataset: Dataset, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const name = typeof body.name === 'string' ? body.name.trim() : '';
    if (name === '') return problem({ ...ERRORS.InvalidData, fields: { name: 'Campo obrigatório.' } });
    if (this.datasets.some((d) => d !== dataset && sameName(d.name, name))) return problem(ERRORS.DatasetAlreadyExists);
    dataset.name = name;
    return json(200, dataset);
  }

  private deleteDataset(dataset: Dataset): RouteResponse {
    this.datasets.splice(this.datasets.indexOf(dataset), 1);
    for (const variable of this.variablesOf(dataset.id)) this.variables.splice(this.variables.indexOf(variable), 1);
    return empty();
  }

  // --- Variables -----------------------------------------------------------------------------------------------------

  private withVariable(id: string, action: (variable: Variable) => RouteResponse): RouteResponse {
    const variable = this.variables.find((v) => v.id === id);
    return variable ? action(variable) : problem(ERRORS.NotFound);
  }

  private variablesOf(datasetId: string): Variable[] {
    return this.variables.filter((v) => v.dataset_id === datasetId);
  }

  /** `POST /v1/datasets/{id}/variables`: the column must be in the dataset, the name valid and unique, the conversion accepted. */
  private createVariable(dataset: Dataset, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const columnName = typeof body.column === 'string' ? body.column : '';
    const source = dataset.columns.find((c) => c.name === columnName);
    if (!source) return problem({ ...ERRORS.UnknownColumn, fields: { column: `Não existe a coluna '${columnName}'.` } });
    const data = readVariableData(body, source);
    if (isResponse(data)) return data;
    if (this.variablesOf(dataset.id).some((v) => v.name === data.name)) return problem(ERRORS.VariableAlreadyExists);
    const variable: Variable = { id: randomUUID(), dataset_id: dataset.id, column: source.name, ...data };
    this.variables.push(variable);
    return json(201, variable);
  }

  private updateVariable(variable: Variable, request: Request): RouteResponse {
    const body = readJson(request);
    if (body === undefined) return problem(ERRORS.InvalidDataMalformedJson);
    const dataset = this.datasets.find((d) => d.id === variable.dataset_id);
    const source = dataset?.columns.find((c) => c.name === variable.column);
    if (!source) return problem({ ...ERRORS.IncompatibleType, fields: { type: 'A coluna não está mais no dataset.' } });
    const data = readVariableData(body, source);
    if (isResponse(data)) return data;
    if (this.variablesOf(variable.dataset_id).some((v) => v !== variable && v.name === data.name)) {
      return problem(ERRORS.VariableAlreadyExists);
    }
    Object.assign(variable, data);
    return json(200, variable);
  }
}

/** Name, type and scale of a variable over `source`, with the rules of the backend (E3-10), or the `422`. */
function readVariableData(
  body: Record<string, unknown>,
  source: Column,
): Pick<Variable, 'name' | 'type' | 'scale'> | RouteResponse {
  const name = typeof body.name === 'string' ? body.name : '';
  if (!VARIABLE_NAME.test(name)) return problem(ERRORS.InvalidVariableName);
  const type = DATA_TYPES.find((item) => item === body.type);
  if (type === undefined) return problem({ ...ERRORS.InvalidData, fields: { type: 'Tipo desconhecido.' } });
  const accepted =
    source.type !== null &&
    (type === source.type ||
      type === 'text' ||
      (source.type === 'integer' && type === 'decimal') ||
      (source.type === 'date' && type === 'datetime'));
  if (!accepted) {
    return problem({ ...ERRORS.IncompatibleType, fields: { type: `A coluna ${source.name} não pode virar ${type}.` } });
  }
  if (type !== 'decimal') return { name, type, scale: null };
  const scale = body.scale;
  if (typeof scale !== 'number' || !Number.isInteger(scale) || scale < 0 || scale > SCALE_MAX) {
    return problem({ ...ERRORS.InvalidData, fields: { scale: `Informe de 0 a ${SCALE_MAX} casas decimais.` } });
  }
  return { name, type, scale };
}

/** The five credential fields of `value`, or `undefined` with the error of each one in `fields` (`prefix` + field). */
function readCredential(value: unknown, prefix: string, fields: Record<string, string>): Credential | undefined {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    // The creation nests the credential (`credential`); the credential change is the body itself.
    fields[prefix === '' ? 'host' : 'credential'] = 'Informe a credencial.';
    return undefined;
  }
  const data = value as Record<string, unknown>;
  for (const field of CREDENTIAL_FIELDS) {
    const item = data[field];
    const valid =
      field === 'port'
        ? typeof item === 'number' && Number.isInteger(item) && item >= 1 && item <= 65535
        : typeof item === 'string' && item !== '';
    if (!valid) fields[`${prefix}${field}`] = 'Campo obrigatório.';
  }
  if (CREDENTIAL_FIELDS.some((field) => `${prefix}${field}` in fields)) return undefined;
  return {
    host: data.host as string,
    port: data.port as number,
    database: data.database as string,
    username: data.username as string,
    password: data.password as string,
  };
}

/** The file part named `field` of a `multipart/form-data` body: its file name and bytes. */
function readMultipartFile(request: Request, field: string): { fileName: string; data: Buffer } | undefined {
  const boundary = /boundary=(?:"([^"]+)"|([^;]+))/i.exec(request.headers()['content-type'] ?? '');
  const body = request.postDataBuffer();
  if (!boundary || !body) return undefined;
  const delimiter = Buffer.from(`--${boundary[1] ?? boundary[2] ?? ''}`);
  let start = body.indexOf(delimiter);
  while (start !== -1) {
    const next = body.indexOf(delimiter, start + delimiter.length);
    if (next === -1) break;
    const part = body.subarray(start + delimiter.length + 2, next - 2); // without the CRLF after the delimiter and before the next
    const headerEnd = part.indexOf('\r\n\r\n');
    if (headerEnd !== -1) {
      const headers = part.subarray(0, headerEnd).toString('utf8');
      const name = /name="([^"]*)"/i.exec(headers)?.[1];
      const fileName = /filename="([^"]*)"/i.exec(headers)?.[1];
      if (name === field && fileName !== undefined) return { fileName, data: Buffer.from(part.subarray(headerEnd + 4)) };
    }
    start = next;
  }
  return undefined;
}

/** A page of `{items, next_cursor}` by `limit` (1 to 200, default 50) and `cursor` (the position, as text). */
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

/** Names unique in the tenant, ignoring case and the spaces at the ends. */
function sameName(a: string, b: string): boolean {
  return a.trim().toLocaleLowerCase('pt-BR') === b.trim().toLocaleLowerCase('pt-BR');
}

function iso(instant: number): string {
  return new Date(instant).toISOString();
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
  return 'body' in value && 'status' in value && 'contentType' in value;
}

function readJson(request: Request): Record<string, unknown> | undefined {
  try {
    const body: unknown = request.postDataJSON();
    return body !== null && typeof body === 'object' && !Array.isArray(body) ? (body as Record<string, unknown>) : undefined;
  } catch {
    return undefined;
  }
}
