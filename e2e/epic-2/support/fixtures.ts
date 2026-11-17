// Fixture of the epic 2 end-to-end tests, on top of the epic 1 one (e2e/support/fixtures.ts): the same files run
// in both projects of playwright.config.ts.
// - simulated (pnpm e2e): the epic 2 simulated API (`Epic2Simulation`) answers every call to `/v1/...`, on all
//   pages of the test, with a single state (the Admin creates a user on one page and the person signs in on another);
// - real (pnpm e2e:real): the shell talks to the real backend, with the `preparar-local` accounts.
import type { BrowserContext, Page, TestInfo } from '@playwright/test';
import { expect, test as base, type E2EApi } from '../../support/fixtures';
import { Epic2Simulation, type InitialAccount } from './simulation';

export { expect };

export interface Epic2 {
  /**
   * The "host app" origin (`http://localhost:5274`): the embed test page's, which
   * `playwright.config.ts` starts next to the shell, in both modes. It is the domain `preparar-local` registers in the backend.
   */
  hostAppOrigin: string;
  /**
   * A page in a new browser (another context, without the test page's cookies), for another person: whoever receives
   * the reset link, the host app. In simulated mode, with the same simulated API.
   */
  newPage(): Promise<Page>;
}

/**
 * The accounts that already exist in the backend, as `preparar-local` creates them (tenants "Demonstração" and "Outra Empresa"). Admin and
 * two tenants use the epic 1 fixture credentials; the Configurator only exists so the user list is realistic.
 */
function initialAccounts(api: E2EApi): InitialAccount[] {
  return [
    { ...api.account('admin'), nome: 'Administradora Demonstração', papeis: { Demonstração: 'Admin' } },
    {
      email: 'configurador@demo.local',
      senha: 'senha-simulada-configurador',
      nome: 'Configurador Demonstração',
      papeis: { Demonstração: 'Configurador' },
    },
    {
      ...api.account('twoTenants'),
      nome: 'Usuário de Dois Tenants',
      papeis: { Demonstração: 'Operador', 'Outra Empresa': 'Admin' },
    },
  ];
}

/** The host app origin, from `metadata.hostAppUrl` in `playwright.config.ts`. */
function hostAppOrigin(testInfo: TestInfo): string {
  const url: unknown = testInfo.config.metadata?.hostAppUrl;
  if (typeof url !== 'string') throw new Error('Defina metadata.hostAppUrl no playwright.config.ts.');
  return new URL(url).origin;
}

export const test = base.extend<{ epic2: Epic2 }>({
  epic2: [
    // Depends on `api`: the epic 2 simulation route is added after the epic 1 one and therefore answers before it.
    async ({ page, api, browser, baseURL }, use, testInfo) => {
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;
      const simulation = api.mode === 'simulated' ? new Epic2Simulation(initialAccounts(api), shellOrigin) : null;
      if (simulation) await simulation.install(page);

      const contexts: BrowserContext[] = [];
      await use({
        hostAppOrigin: hostAppOrigin(testInfo),
        async newPage() {
          const context = await browser.newContext({ baseURL });
          contexts.push(context);
          const newPage = await context.newPage();
          if (simulation) await simulation.install(newPage);
          return newPage;
        },
      });
      await Promise.all(contexts.map((context) => context.close()));

      if (simulation && simulation.unexpected.length > 0) {
        throw new Error(`O módulo chamou rotas fora da API simulada: ${simulation.unexpected.join(', ')}.`);
      }
    },
    { auto: true },
  ],
});
