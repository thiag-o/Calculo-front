// Fixture of the epic 7 end-to-end tests, on top of the epic 1 one (e2e/support/fixtures.ts): the same files run in both
// projects of playwright.config.ts.
// - simulated (pnpm e2e): the epic 2 simulation keeps the session, with the demonstration Admin, Operador, Configurador,
//   Aprovador and Auditor, and the epic 7 simulation (`Epic7Simulation`) answers the catalog, the workflows, the
//   executions, the schedules, the reference files and the bell, with the three workflows of `prepare-local`
//   (campaign.ts); the test moves the executions with `epic7.worker` and fires the schedules with `epic7.scheduler`;
// - real (pnpm e2e:real): the shell talks to the real backend, with a worker and the scheduler running beside it
//   (`uv run fluxo worker` and `uv run fluxo scheduler`), the `prepare-local` accounts and its workflows. What a test
//   creates is removed at the end: the schedules (so they stop firing) and then the copies of the workflows.
import type { BrowserContext, Page } from '@playwright/test';
import { callApi } from '../../epic-2/support/screens';
import { Epic2Simulation, type InitialAccount } from '../../epic-2/support/simulation';
import { deleteCreatedWorkflows } from '../../epic-5/support/created-workflows';
import { expect, test as base, type E2EMode, type LoginCredentials } from '../../support/fixtures';
import { Epic7Simulation, type ReceivedCall, type SimulatedScheduler, type SimulatedWorker } from './simulation';

export { expect };

/** The accounts of the epic 7 flows (fluxo 12 of the global plan): the Admin prepares, the others act by their role. */
export type Epic7Account = 'admin' | 'operator' | 'configurator' | 'approver' | 'auditor';

export interface Epic7 {
  mode: E2EMode;
  account(name: Epic7Account): LoginCredentials;
  /** The name the account shows in the account menu and in the lists: the one `prepare-local` creates, or the simulation's. */
  accountName(name: Epic7Account): string;
  /** The simulated worker (the test moves each execution); `null` in real mode, where the backend's worker runs alone. */
  worker: SimulatedWorker | null;
  /** The simulated scheduler (the test fires each schedule); `null` in real mode, where `fluxo scheduler` runs alone. */
  scheduler: SimulatedScheduler | null;
  /** What the module sent to the simulated routes; `null` in real mode. */
  calls(): readonly ReceivedCall[] | null;
  /**
   * Remembers a schedule the test created on `page` (with its session): in real mode it is removed at the end, before the
   * copies of the workflows.
   */
  trackSchedule(page: Page, apiOrigin: string, id: string): void;
  /**
   * A page in a new browser context (no cookies of the test page), with the same simulated API: another person at the same
   * time (the Admin who prepares, while the test page acts by a role). What it creates is removed with its own session.
   */
  newPage(): Promise<Page>;
}

/** The Admin's name: `prepare-local` creates "Admin Demonstração"; the simulation names it in the feminine. */
const ADMIN_NAME = { real: 'Admin Demonstração', simulated: 'Administradora Demonstração' } as const;

type Other = Exclude<Epic7Account, 'admin'>;

const SIMULATED: Record<Other, LoginCredentials & { name: string; role: string }> = {
  operator: { email: 'operador@demo.local', password: 'senha-simulada-operador', name: 'Operador Demonstração', role: 'Operador' },
  configurator: { email: 'configurador@demo.local', password: 'senha-simulada-configurador', name: 'Configurador Demonstração', role: 'Configurador' },
  approver: { email: 'aprovador@demo.local', password: 'senha-simulada-aprovador', name: 'Aprovador Demonstração', role: 'Aprovador' },
  auditor: { email: 'auditor@demo.local', password: 'senha-simulada-auditor', name: 'Auditor Demonstração', role: 'Auditor' },
};

/** The real-mode variables of each account (the `prepare-local` accounts, in ../backend/docs/ambientes.md). */
const REAL: Record<Other, { email: string; defaultEmail: string; password: string }> = {
  operator: { email: 'E2E_OPERATOR_EMAIL', defaultEmail: 'operador@demo.local', password: 'E2E_OPERATOR_PASSWORD' },
  configurator: { email: 'E2E_CONFIGURATOR_EMAIL', defaultEmail: 'configurador@demo.local', password: 'E2E_CONFIGURATOR_PASSWORD' },
  approver: { email: 'E2E_APPROVER_EMAIL', defaultEmail: 'aprovador@demo.local', password: 'E2E_APPROVER_PASSWORD' },
  auditor: { email: 'E2E_AUDITOR_EMAIL', defaultEmail: 'auditor@demo.local', password: 'E2E_AUDITOR_PASSWORD' },
};

function variable(name: string, defaultValue?: string): string {
  const value = process.env[name]?.trim() || defaultValue;
  if (!value) throw new Error(`Modo real: defina ${name} (credenciais do prepare-local do back, em ../backend/docs/ambientes.md).`);
  return value;
}

/** Removes the schedules a test created, with the page's session; returns what failed (a 404 is already gone). */
async function deleteSchedules(schedules: readonly { page: Page; apiOrigin: string; id: string }[]): Promise<string[]> {
  const failures: string[] = [];
  for (const { page, apiOrigin, id } of schedules) {
    const result = await callApi(page, apiOrigin, 'DELETE', `/v1/schedules/${id}`).catch((error: unknown) => ({ status: 0, code: String(error) }));
    if (result.status !== 204 && result.status !== 404) failures.push(`agendamento ${id}: ${result.status} ${String(result.code)}`);
  }
  return failures;
}

export const test = base.extend<{ epic7: Epic7 }>({
  // Without the 200 ms entrance animations of dialogs, selects and menus (the design system turns them off with
  // prefers-reduced-motion): Playwright waits for each element to be still before acting.
  reducedMotion: 'reduce',
  epic7: [
    // Depends on `api`: these routes are added after the epic 1 one and therefore answer before it.
    async ({ page, api, baseURL, browser }, use) => {
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;
      const simulated = api.mode === 'simulated';
      const accounts: InitialAccount[] = [
        { ...api.account('admin'), name: ADMIN_NAME.simulated, roles: { Demonstração: 'Admin' } },
        ...Object.values(SIMULATED).map(({ email, password, name, role }) => ({ email, password, name, roles: { Demonstração: role } })),
      ];
      const session = simulated ? new Epic2Simulation(accounts, shellOrigin) : null;
      const simulation = simulated ? new Epic7Simulation(shellOrigin) : null;
      await session?.install(page);
      await simulation?.install(page);

      const schedules: { page: Page; apiOrigin: string; id: string }[] = [];
      const contexts: BrowserContext[] = [];
      const pages: Page[] = [page];
      await use({
        mode: api.mode,
        account(name) {
          if (name === 'admin') return api.account('admin');
          if (simulated) return { email: SIMULATED[name].email, password: SIMULATED[name].password };
          const names = REAL[name];
          return { email: variable(names.email, names.defaultEmail), password: variable(names.password) };
        },
        accountName: (name) => (name === 'admin' ? ADMIN_NAME[api.mode] : SIMULATED[name].name),
        worker: simulation?.worker ?? null,
        scheduler: simulation?.scheduler ?? null,
        calls: () => simulation?.calls ?? null,
        trackSchedule: (on, apiOrigin, id) => schedules.push({ page: on, apiOrigin, id }),
        async newPage() {
          const context = await browser.newContext({ baseURL, reducedMotion: 'reduce' });
          contexts.push(context);
          const other = await context.newPage();
          await session?.install(other);
          await simulation?.install(other);
          pages.push(other);
          return other;
        },
      });

      // Real mode keeps what a run leaves in the database: the schedules first (a workflow with schedules cannot be deleted,
      // `409 workflow_has_schedules`), then the copies. A copy that was executed stays (`409 workflow_has_executions`): it is
      // recognizable by the " e2e " in its name. Each removal uses the session of the page that created it.
      if (!simulated) {
        const left = [...(await deleteSchedules(schedules))];
        for (const each of pages) left.push(...(await deleteCreatedWorkflows(each)).filter((failure) => !failure.includes('409 workflow_has_executions')));
        if (left.length > 0) throw new Error(`Não foi possível apagar o que o teste criou: ${left.join('; ')}.`);
      }
      await Promise.all(contexts.map((context) => context.close()));

      const unexpected = [...(session?.unexpected ?? []), ...(simulation?.unexpected ?? [])];
      if (unexpected.length > 0) throw new Error(`O módulo chamou rotas fora da API simulada: ${unexpected.join(', ')}.`);
    },
    { auto: true },
  ],
});
