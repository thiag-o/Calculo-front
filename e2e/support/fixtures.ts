// End-to-end test fixture: the same test files run in both projects of playwright.config.ts.
// - simulated (pnpm e2e): the simulated API (`SimulatedApi`) is turned on for every page, with the accounts below;
// - real (pnpm e2e:real): the shell talks to the real backend at E2E_API_URL, with the `prepare-local` accounts.
import { randomUUID } from 'node:crypto';
import { test as base, expect, type Page, type TestInfo } from '@playwright/test';
import { contractResponses } from './contract-schema';
import { SimulatedApi, type SimulatedAccount } from './simulated-api';

export { expect };

export type E2EMode = 'simulated' | 'real';

/** Accounts the tests use. `admin`: a single tenant. `twoTenants`: belongs to two tenants. */
export type AccountName = 'admin' | 'twoTenants';

export interface LoginCredentials {
  email: string;
  password: string;
}

export interface E2EApi {
  mode: E2EMode;
  /** API address (without `/v1`) in real mode; `undefined` in simulated mode. */
  apiUrl: string | undefined;
  /** E-mail and password of an account. In real mode, they come from the E2E_* variables (see `REAL_ACCOUNTS`). */
  account(name: AccountName): LoginCredentials;
  /** An e-mail without an account, new on each call: locking it does not disturb another test or the next run. */
  emailWithoutAccount(): string;
}

// Simulation accounts, in the format of the backend's `prepare-local` (tenants "Demonstração" and "Outra Empresa").
const DEMO = { id: '7d0c1f6e-0000-4000-8000-000000000001', name: 'Demonstração' };
const OTHER_COMPANY = { id: '7d0c1f6e-0000-4000-8000-000000000002', name: 'Outra Empresa' };

const SIMULATED_ACCOUNTS: Record<AccountName, SimulatedAccount> = {
  admin: {
    id: '7d0c1f6e-0000-4000-8000-0000000000a1',
    email: 'admin@demo.local',
    password: 'senha-simulada-admin',
    name: 'Administradora Demonstração',
    tenants: [{ tenant: DEMO, permissions: ['users.manage', 'workflows.view', 'audit.view'] }],
  },
  twoTenants: {
    id: '7d0c1f6e-0000-4000-8000-0000000000a2',
    email: 'dois.tenants@demo.local',
    password: 'senha-simulada-dois-tenants',
    name: 'Usuário de Dois Tenants',
    tenants: [
      { tenant: OTHER_COMPANY, permissions: ['workflows.view'] },
      { tenant: DEMO, permissions: ['workflows.view', 'executions.view'] },
    ],
  },
};

/**
 * Real-mode account variables (the credentials the backend's `prepare-local` prints and documents in
 * `../backend/docs/ambientes.md`). The Admin e-mail has the backend plan's default; the passwords are required.
 */
const REAL_ACCOUNTS: Record<AccountName, { email: string; password: string; emailPattern?: string }> = {
  admin: { email: 'E2E_ADMIN_EMAIL', password: 'E2E_ADMIN_PASSWORD', emailPattern: 'admin@demo.local' },
  twoTenants: { email: 'E2E_TWO_TENANTS_EMAIL', password: 'E2E_TWO_TENANTS_PASSWORD' },
};

const ACCOUNTS_HELP = 'credenciais do prepare-local do back, em ../backend/docs/ambientes.md';

function variable(name: string, help: string, defaultValue?: string): string {
  const value = process.env[name]?.trim() || defaultValue;
  if (!value) throw new Error(`Modo real: defina ${name} (${help}).`);
  return value;
}

export function projectMode(testInfo: TestInfo): E2EMode {
  const mode: unknown = testInfo.project.metadata?.mode;
  if (mode !== 'simulated' && mode !== 'real') {
    throw new Error(`Projeto "${testInfo.project.name}" sem metadata.mode 'simulated' ou 'real' no playwright.config.ts.`);
  }
  return mode;
}

function realApiUrl(): string {
  return variable('E2E_API_URL', 'endereço da API do back, sem o /v1; o playwright.config.ts o repassa ao casca como VITE_API_URL').replace(/\/+$/, '');
}

/**
 * Checks every answer of the page to a validated route (contract-schema.ts) against the contract's schema, whatever
 * simulation gave it. Returns the function that waits for the bodies read and gives the violations.
 */
function checkContractResponses(page: Page, shellOrigin: string): () => Promise<string[]> {
  const contract = contractResponses();
  if (!contract.checked) return async () => [];
  const pending: Promise<string[]>[] = [];
  page.on('response', (response) => {
    const url = new URL(response.url());
    const method = response.request().method();
    if (url.origin === shellOrigin || !contract.covers(method, url.pathname)) return;
    pending.push(
      response
        .body()
        .then((body) => {
          const text = body.toString('utf-8');
          let json: unknown;
          try {
            json = JSON.parse(text);
          } catch {
            json = text;
          }
          return contract.violations(method, url.pathname, response.status(), response.headers()['content-type'] ?? '', json) ?? [];
        })
        // A body Playwright no longer holds (the page navigated away) is not checked.
        .catch(() => []),
    );
  });
  return async () => (await Promise.all(pending)).flat();
}

function emailWithoutAccount(): string {
  return `e2e-sem-conta-${randomUUID()}@e2e.local`;
}

export const test = base.extend<{ api: E2EApi }>({
  api: [
    async ({ page, baseURL }, use, testInfo) => {
      const mode = projectMode(testInfo);
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;

      if (mode === 'simulated') {
        const simulated = new SimulatedApi(Object.values(SIMULATED_ACCOUNTS));
        await simulated.install(page, shellOrigin);
        const checks = checkContractResponses(page, shellOrigin);
        await use({
          mode,
          apiUrl: undefined,
          account: (name) => ({ email: SIMULATED_ACCOUNTS[name].email, password: SIMULATED_ACCOUNTS[name].password }),
          emailWithoutAccount,
        });
        if (simulated.unexpected.length > 0) {
          throw new Error(`O casca chamou rotas fora da API simulada: ${simulated.unexpected.join(', ')}.`);
        }
        const violations = await checks();
        if (violations.length > 0) {
          throw new Error(`A API simulada respondeu fora do contrato:\n${violations.join('\n')}`);
        }
        return;
      }

      // Real mode: the shell must talk to the same API as E2E_API_URL. The shell Playwright starts already receives
      // E2E_API_URL as VITE_API_URL; an already open (reused) shell may point to another one.
      const apiUrl = realApiUrl();
      const apiOrigin = new URL(apiUrl).origin;
      const otherOrigins = new Set<string>();
      page.on('request', (request) => {
        const url = new URL(request.url());
        if (url.pathname.startsWith('/v1/') && url.origin !== shellOrigin && url.origin !== apiOrigin) {
          otherOrigins.add(url.origin);
        }
      });
      await use({
        mode,
        apiUrl,
        account: (name) => {
          const names = REAL_ACCOUNTS[name];
          return { email: variable(names.email, ACCOUNTS_HELP, names.emailPattern), password: variable(names.password, ACCOUNTS_HELP) };
        },
        emailWithoutAccount,
      });
      if (otherOrigins.size > 0) {
        throw new Error(
          `O casca chamou a API em ${[...otherOrigins].join(', ')}, mas E2E_API_URL é ${apiOrigin}. ` +
            'Feche o casca já aberto (o Playwright sobe outro com VITE_API_URL = E2E_API_URL) ou suba-o com VITE_API_URL igual a E2E_API_URL.',
        );
      }
    },
    { auto: true },
  ],
});
