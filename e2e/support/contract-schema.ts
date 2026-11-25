// Checks the simulated API's answers against the backend contract's schemas (../backend/contracts/openapi.yaml), so a
// simulation that leaves the contract fails `pnpm e2e` (F112: the simulated trace had `row_key: {}` where the backend
// sends `null`, and the "Calcular" panel only broke in real mode). Validated: the routes of `VALIDATED_ROUTES`.
// The contract comes from FLUXO_BACKEND_DIR when set (worktree mode; missing, it fails), otherwise from ../backend, as in
// `pnpm generate:api` and contract-examples.spec.ts. Without the backend next to it (the front CI), nothing is checked.
import { existsSync, readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/** The routes whose answers are checked: method and the contract's path. */
const VALIDATED_ROUTES: ReadonlyArray<{ method: string; path: string }> = [
  { method: 'GET', path: '/v1/workflows/{id}/draft' },
  { method: 'PUT', path: '/v1/workflows/{id}/draft' },
  { method: 'POST', path: '/v1/workflows/{id}/draft/previews' },
  { method: 'POST', path: '/v1/workflows/{id}/draft/unit-runs' },
  // Epic 6 (F105): the trigger and every execution route the panel, the list and the trace drawer read.
  { method: 'POST', path: '/v1/workflows/{id}/executions' },
  { method: 'GET', path: '/v1/executions' },
  { method: 'GET', path: '/v1/executions/{id}' },
  { method: 'GET', path: '/v1/executions/{id}/definition' },
  { method: 'POST', path: '/v1/executions/{id}/cancel' },
  { method: 'GET', path: '/v1/executions/{id}/output' },
  { method: 'GET', path: '/v1/executions/{id}/records' },
  { method: 'GET', path: '/v1/executions/{id}/records/{result_key}' },
];

/**
 * The routes that answer with a draft (`Draft`): the backend reads a definition of version 1 to 3 as 4 and answers
 * always in 4, with `parameters` and the new `settings` fields. The schema accepts the four versions (it also types
 * what the editor sends), so the answer of these routes is held to the current one here.
 */
const DRAFT_ROUTES: ReadonlySet<string> = new Set(['GET /v1/workflows/{id}/draft', 'PUT /v1/workflows/{id}/draft']);

/** What a draft answer's definition lacks to be in version 4 (empty: it is in 4). */
function versionViolations(name: string, body: unknown): string[] {
  const definition = isObject(body) && isObject(body.definition) ? body.definition : undefined;
  if (!definition) return [];
  const settings = isObject(definition.settings) ? definition.settings : {};
  const problems: string[] = [];
  if (definition.schema_version !== 4) problems.push(`${name}: /definition/schema_version deve ser 4, e não ${String(definition.schema_version)}`);
  if (!Array.isArray(definition.parameters)) problems.push(`${name}: /definition/parameters deve vir sempre (a gravação o escreve)`);
  // The settings may be absent: the real API still serves the legacy form (D44, B193), and the editor reads their defaults.
  // Present, they must be text.
  for (const key of ['error_limit_percent', 'trace_level', 'pre_validation_alert_percent']) {
    if (key in settings && typeof settings[key] !== 'string') problems.push(`${name}: /definition/settings/${key} deve ser texto`);
  }
  return problems;
}

const BACKEND_DIR = process.env.FLUXO_BACKEND_DIR;
const CONTRACT = resolve(
  BACKEND_DIR ? resolve(BACKEND_DIR) : resolve(dirname(fileURLToPath(import.meta.url)), '..', '..', '..', 'backend'),
  'contracts',
  'openapi.yaml',
);

/** The key the contract is added under in Ajv: its `#/...` references resolve inside it. */
const CONTRACT_KEY = 'openapi.json';

type JsonObject = Record<string, unknown>;

interface ValidateFunction {
  (data: unknown): boolean;
  errors?: ReadonlyArray<{ instancePath: string; message?: string }> | null;
}

interface Ajv {
  addSchema(schema: unknown, key: string): Ajv;
  compile(schema: unknown): ValidateFunction;
}

/**
 * The type generator's own dependencies (openapi-typescript → @redocly/openapi-core → its YAML reader and its Ajv, which
 * reads JSON Schema 2020-12, the dialect of OpenAPI 3.1), so as not to add a dependency just for the tests.
 */
function generatorDependencies() {
  const fromGenerator = createRequire(createRequire(import.meta.url).resolve('openapi-typescript'));
  const fromCore = createRequire(fromGenerator.resolve('@redocly/openapi-core'));
  const { parseYaml } = fromGenerator('@redocly/openapi-core') as { parseYaml: (text: string) => unknown };
  const Ajv2020 = fromCore('@redocly/ajv/dist/2020') as { default: new (options: JsonObject) => Ajv };
  return { parseYaml, Ajv2020: Ajv2020.default };
}

const isObject = (value: unknown): value is JsonObject => value !== null && typeof value === 'object' && !Array.isArray(value);

/** The contract's `#/...` references made absolute to `CONTRACT_KEY` (a response schema compiled outside it). */
function absoluteRefs(schema: unknown): unknown {
  if (Array.isArray(schema)) return schema.map(absoluteRefs);
  if (!isObject(schema)) return schema;
  return Object.fromEntries(
    Object.entries(schema).map(([name, value]) => [name, name === '$ref' && typeof value === 'string' && value.startsWith('#') ? `${CONTRACT_KEY}${value}` : absoluteRefs(value)]),
  );
}

/** A `$ref` of the contract (`#/components/responses/NotFound`) followed to its object. */
function follow(contract: JsonObject, value: unknown): unknown {
  if (!isObject(value) || typeof value.$ref !== 'string' || !value.$ref.startsWith('#/')) return value;
  const target = value.$ref
    .slice(2)
    .split('/')
    .reduce<unknown>((node, part) => (isObject(node) ? node[part.replace(/~1/g, '/').replace(/~0/g, '~')] : undefined), contract);
  return follow(contract, target);
}

/** The path of the contract as a pattern of the real path (`{id}` is one segment). */
function pathPattern(path: string): RegExp {
  return new RegExp(`^${path.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{[^}]+\}/g, '[^/]+')}$`);
}

export interface ContractResponses {
  /** The contract was found: the answers are checked. */
  readonly checked: boolean;
  /** The route of this call is one of the checked ones. */
  covers(method: string, pathname: string): boolean;
  /**
   * The violations of one answer, in pt-BR (empty: it follows the contract), or `null` when the route is not checked.
   * A status or a content type that the route does not declare is a violation too.
   */
  violations(method: string, pathname: string, status: number, contentType: string, body: unknown): string[] | null;
}

function load(): ContractResponses {
  if (!existsSync(CONTRACT)) {
    if (BACKEND_DIR) throw new Error(`FLUXO_BACKEND_DIR está definida, mas o contrato não foi encontrado em ${CONTRACT}.`);
    return { checked: false, covers: () => false, violations: () => null };
  }
  const { parseYaml, Ajv2020 } = generatorDependencies();
  const contract = parseYaml(readFileSync(CONTRACT, 'utf-8')) as JsonObject;
  // Not strict: OpenAPI keywords (`discriminator`, `example`) are annotations; the formats (`uuid`, `date-time`) are not
  // checked, as they are only descriptions in this contract.
  const ajv = new Ajv2020({ strict: false, allErrors: true, validateFormats: false });
  ajv.addSchema(contract, CONTRACT_KEY);
  const paths = isObject(contract.paths) ? contract.paths : {};
  const validators = new Map<string, ValidateFunction>();

  const validatorOf = (route: string, status: string, contentType: string, schema: unknown): ValidateFunction => {
    const key = `${route} ${status} ${contentType}`;
    let validate = validators.get(key);
    if (!validate) {
      validate = ajv.compile(absoluteRefs(schema));
      validators.set(key, validate);
    }
    return validate;
  };

  const routes = VALIDATED_ROUTES.map(({ method, path }) => {
    const operation = follow(contract, (paths[path] as JsonObject | undefined)?.[method.toLowerCase()]);
    if (!isObject(operation) || !isObject(operation.responses)) throw new Error(`O contrato não tem ${method} ${path}.`);
    return { method, path, pattern: pathPattern(path), responses: operation.responses };
  });

  const routeOf = (method: string, pathname: string) => routes.find((candidate) => candidate.method === method && candidate.pattern.test(pathname));

  return {
    checked: true,
    covers: (method, pathname) => routeOf(method, pathname) !== undefined,
    violations(method, pathname, status, contentType, body) {
      const route = routeOf(method, pathname);
      if (!route) return null;
      const name = `${method} ${route.path} ${status}`;
      const response = follow(contract, route.responses[String(status)]);
      if (!isObject(response)) return [`${name}: o contrato não declara a resposta ${status}.`];
      const media = contentType.split(';')[0]!.trim().toLowerCase();
      const content = isObject(response.content) ? follow(contract, response.content[media]) : undefined;
      if (!isObject(content) || content.schema === undefined) return [`${name}: o contrato não declara o tipo ${media || '(nenhum)'}.`];
      const validate = validatorOf(route.path, String(status), media, content.schema);
      const violations = validate(body)
        ? []
        : (validate.errors ?? []).map((error) => `${name}: ${error.instancePath || '(corpo)'} ${error.message ?? 'inválido'}`);
      return status === 200 && DRAFT_ROUTES.has(`${method} ${route.path}`) ? [...violations, ...versionViolations(name, body)] : violations;
    },
  };
}

let loaded: ContractResponses | undefined;

/** The contract's responses, read once per worker. */
export function contractResponses(): ContractResponses {
  loaded ??= load();
  return loaded;
}
