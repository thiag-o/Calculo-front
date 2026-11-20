// Fixture of the epic 4 end-to-end tests, on top of the epic 1 one (e2e/support/fixtures.ts): the same files run in both
// projects of playwright.config.ts.
// - simulated (pnpm e2e): the epic 2 simulation (`Epic2Simulation`) keeps the session, with the Admin and the Auditor of
//   the demonstration tenant, and the workflow simulation (`WorkflowSimulation`) answers the workflow routes, with the
//   "Pontuação de exemplo" of `prepare-local`;
// - real (pnpm e2e:real): the shell talks to the real backend, with the `prepare-local` accounts by role (Admin from
//   E2E_ADMIN_*, Auditor from E2E_AUDITOR_*) and its workflow "Pontuação de exemplo".
import type { Page } from '@playwright/test';
import { Epic2Simulation, type InitialAccount } from '../../epic-2/support/simulation';
import { expect, test as base, type LoginCredentials } from '../../support/fixtures';
import { WorkflowSimulation, type ReceivedMutation } from './simulation';

export { expect };

/** The accounts of the epic 4 flows: the demonstration Admin and the Auditor (only the `.view` permissions). */
export type Epic4Account = 'admin' | 'auditor';

export interface Epic4 {
  account(name: Epic4Account): LoginCredentials;
  /** Another tab of the same browser (same cookies and session), with the same simulated API. */
  newTab(): Promise<Page>;
  /** The mutations the shell sent to the workflow routes; `null` in real mode (the backend does not tell). */
  mutations(): readonly ReceivedMutation[] | null;
}

const SIMULATED_AUDITOR: LoginCredentials = { email: 'auditor@demo.local', password: 'senha-simulada-auditor' };

const ACCOUNTS_HELP = 'credenciais do prepare-local do back, em ../backend/docs/ambientes.md';

function variable(name: string, defaultValue?: string): string {
  const value = process.env[name]?.trim() || defaultValue;
  if (!value) throw new Error(`Modo real: defina ${name} (${ACCOUNTS_HELP}).`);
  return value;
}

export const test = base.extend<{ epic4: Epic4 }>({
  // Without the 200 ms entrance animations of dialogs, selects and menus (the design system turns them off with
  // prefers-reduced-motion): Playwright waits for each element to be still before acting.
  reducedMotion: 'reduce',
  epic4: [
    // Depends on `api`: these routes are added after the epic 1 one and therefore answer before it.
    async ({ page, api, baseURL }, use) => {
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;
      const simulated = api.mode === 'simulated';
      const accounts: InitialAccount[] = [
        { ...api.account('admin'), name: 'Administradora Demonstração', roles: { Demonstração: 'Admin' } },
        { ...SIMULATED_AUDITOR, name: 'Auditor Demonstração', roles: { Demonstração: 'Auditor' } },
      ];
      const session = simulated ? new Epic2Simulation(accounts, shellOrigin) : null;
      const workflows = simulated ? new WorkflowSimulation(shellOrigin) : null;
      const install = async (target: Page) => {
        await session?.install(target);
        await workflows?.install(target);
      };
      await install(page);

      await use({
        account(name) {
          if (name === 'admin') return api.account('admin');
          if (simulated) return SIMULATED_AUDITOR;
          return { email: variable('E2E_AUDITOR_EMAIL', 'auditor@demo.local'), password: variable('E2E_AUDITOR_PASSWORD') };
        },
        async newTab() {
          const tab = await page.context().newPage();
          await install(tab);
          return tab;
        },
        mutations: () => workflows?.mutations ?? null,
      });

      const unexpected = [...(session?.unexpected ?? []), ...(workflows?.unexpected ?? [])];
      if (unexpected.length > 0) throw new Error(`O módulo chamou rotas fora da API simulada: ${unexpected.join(', ')}.`);
    },
    { auto: true },
  ],
});
