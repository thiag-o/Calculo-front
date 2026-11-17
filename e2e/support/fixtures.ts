// End-to-end test fixture: the same test files run in both projects of playwright.config.ts.
// - simulated (pnpm e2e): the simulated API (`SimulatedApi`) is turned on for every page, with the accounts below;
// - real (pnpm e2e:real): the shell talks to the real backend at E2E_API_URL, with the `preparar-local` accounts.
import { randomUUID } from 'node:crypto';
import { test as base, expect, type TestInfo } from '@playwright/test';
import { SimulatedApi, type SimulatedAccount } from './simulated-api';

export { expect };

export type E2EMode = 'simulated' | 'real';

/** Accounts the tests use. `admin`: a single tenant. `twoTenants`: belongs to two tenants. */
export type AccountName = 'admin' | 'twoTenants';

export interface LoginCredentials {
  email: string;
  senha: string;
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

// Simulation accounts, in the format of the backend's `preparar-local` (tenants "Demonstração" and "Outra Empresa").
const DEMO = { id: '7d0c1f6e-0000-4000-8000-000000000001', nome: 'Demonstração' };
const OTHER_COMPANY = { id: '7d0c1f6e-0000-4000-8000-000000000002', nome: 'Outra Empresa' };

const SIMULATED_ACCOUNTS: Record<AccountName, SimulatedAccount> = {
  admin: {
    id: '7d0c1f6e-0000-4000-8000-0000000000a1',
    email: 'admin@demo.local',
    senha: 'senha-simulada-admin',
    nome: 'Administradora Demonstração',
    tenants: [{ tenant: DEMO, permissoes: ['usuarios.gerenciar', 'workflows.ver', 'auditoria.ver'] }],
  },
  twoTenants: {
    id: '7d0c1f6e-0000-4000-8000-0000000000a2',
    email: 'dois.tenants@demo.local',
    senha: 'senha-simulada-dois-tenants',
    nome: 'Usuário de Dois Tenants',
    tenants: [
      { tenant: OTHER_COMPANY, permissoes: ['workflows.ver'] },
      { tenant: DEMO, permissoes: ['workflows.ver', 'execucoes.ver'] },
    ],
  },
};

/**
 * Real-mode account variables (the credentials the backend's `preparar-local` prints and documents in
 * `../backend/docs/ambientes.md`). The Admin e-mail has the backend plan's default; the passwords are required.
 */
const REAL_ACCOUNTS: Record<AccountName, { email: string; senha: string; emailPattern?: string }> = {
  admin: { email: 'E2E_ADMIN_EMAIL', senha: 'E2E_ADMIN_SENHA', emailPattern: 'admin@demo.local' },
  twoTenants: { email: 'E2E_DOIS_TENANTS_EMAIL', senha: 'E2E_DOIS_TENANTS_SENHA' },
};

const ACCOUNTS_HELP = 'credenciais do preparar-local do back, em ../backend/docs/ambientes.md';

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
        await use({
          mode,
          apiUrl: undefined,
          account: (name) => ({ email: SIMULATED_ACCOUNTS[name].email, senha: SIMULATED_ACCOUNTS[name].senha }),
          emailWithoutAccount,
        });
        if (simulated.unexpected.length > 0) {
          throw new Error(`O casca chamou rotas fora da API simulada: ${simulated.unexpected.join(', ')}.`);
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
          return { email: variable(names.email, ACCOUNTS_HELP, names.emailPattern), senha: variable(names.senha, ACCOUNTS_HELP) };
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
