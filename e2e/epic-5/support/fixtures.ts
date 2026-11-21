// Fixture of the epic 5 end-to-end tests, on top of the epic 1 one (e2e/support/fixtures.ts): the same files run in both
// projects of playwright.config.ts.
// - simulated (pnpm e2e): the epic 2 simulation (`Epic2Simulation`) keeps the session, with the demonstration Admin,
//   Aprovador and Auditor, and the campaign simulation (`CampaignSimulation`) answers the catalog and the workflow routes,
//   with the "Campanha de referência" of `prepare-local` and its catalog (campaign.ts);
// - real (pnpm e2e:real): the shell talks to the real backend, with the `prepare-local` accounts (E2E_ADMIN_*,
//   E2E_APPROVER_*, E2E_AUDITOR_*), its workflow "Campanha de referência" and the campaign data of the backend (B98, B100).
import { Epic2Simulation, type InitialAccount } from '../../epic-2/support/simulation';
import { expect, test as base, type E2EMode, type LoginCredentials } from '../../support/fixtures';
import { CampaignSimulation, type ReceivedCall } from './simulation';

export { expect };

/** The accounts of the epic 5 flows: the Admin builds, the Aprovador runs without editing, the Auditor only reads. */
export type Epic5Account = 'admin' | 'approver' | 'auditor';

export interface Epic5 {
  mode: E2EMode;
  account(name: Epic5Account): LoginCredentials;
  /** What the shell sent to the workflow and catalog routes; `null` in real mode (the backend does not tell). */
  calls(): readonly ReceivedCall[] | null;
}

const SIMULATED: Record<Exclude<Epic5Account, 'admin'>, LoginCredentials & { name: string; role: string }> = {
  approver: { email: 'aprovador@demo.local', password: 'senha-simulada-aprovador', name: 'Aprovador Demonstração', role: 'Aprovador' },
  auditor: { email: 'auditor@demo.local', password: 'senha-simulada-auditor', name: 'Auditor Demonstração', role: 'Auditor' },
};

/** The real-mode variables of each account (the `prepare-local` accounts, in ../backend/docs/ambientes.md). */
const REAL: Record<Exclude<Epic5Account, 'admin'>, { email: string; defaultEmail: string; password: string }> = {
  approver: { email: 'E2E_APPROVER_EMAIL', defaultEmail: 'aprovador@demo.local', password: 'E2E_APPROVER_PASSWORD' },
  auditor: { email: 'E2E_AUDITOR_EMAIL', defaultEmail: 'auditor@demo.local', password: 'E2E_AUDITOR_PASSWORD' },
};

function variable(name: string, defaultValue?: string): string {
  const value = process.env[name]?.trim() || defaultValue;
  if (!value) throw new Error(`Modo real: defina ${name} (credenciais do prepare-local do back, em ../backend/docs/ambientes.md).`);
  return value;
}

export const test = base.extend<{ epic5: Epic5 }>({
  // Without the 200 ms entrance animations of dialogs, selects and menus (the design system turns them off with
  // prefers-reduced-motion): Playwright waits for each element to be still before acting.
  reducedMotion: 'reduce',
  epic5: [
    // Depends on `api`: these routes are added after the epic 1 one and therefore answer before it.
    async ({ page, api, baseURL }, use) => {
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;
      const simulated = api.mode === 'simulated';
      const accounts: InitialAccount[] = [
        { ...api.account('admin'), name: 'Administradora Demonstração', roles: { Demonstração: 'Admin' } },
        ...Object.values(SIMULATED).map(({ email, password, name, role }) => ({ email, password, name, roles: { Demonstração: role } })),
      ];
      const session = simulated ? new Epic2Simulation(accounts, shellOrigin) : null;
      const campaign = simulated ? new CampaignSimulation(shellOrigin) : null;
      await session?.install(page);
      await campaign?.install(page);

      await use({
        mode: api.mode,
        account(name) {
          if (name === 'admin') return api.account('admin');
          if (simulated) return { email: SIMULATED[name].email, password: SIMULATED[name].password };
          const names = REAL[name];
          return { email: variable(names.email, names.defaultEmail), password: variable(names.password) };
        },
        calls: () => campaign?.calls ?? null,
      });

      const unexpected = [...(session?.unexpected ?? []), ...(campaign?.unexpected ?? [])];
      if (unexpected.length > 0) throw new Error(`O módulo chamou rotas fora da API simulada: ${unexpected.join(', ')}.`);
    },
    { auto: true },
  ],
});
