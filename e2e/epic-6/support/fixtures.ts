// Fixture of the epic 6 end-to-end tests, on top of the epic 1 one (e2e/support/fixtures.ts): the same files run in both
// projects of playwright.config.ts.
// - simulated (pnpm e2e): the epic 2 simulation keeps the session, with the demonstration Admin, Operador, Aprovador and
//   Auditor, and the epic 6 simulation (`Epic6Simulation`) answers the catalog, the workflows and the executions, with
//   the two workflows of `prepare-local` (campaign.ts); the test moves the executions with `epic6.worker`;
// - real (pnpm e2e:real): the shell talks to the real backend, with a worker running beside it (`uv run fluxo worker`),
//   the `prepare-local` accounts (E2E_ADMIN_*, E2E_OPERATOR_*, E2E_APPROVER_*, E2E_AUDITOR_*) and its workflows.
import { Epic2Simulation, type InitialAccount } from '../../epic-2/support/simulation';
import { deleteCreatedWorkflows } from '../../epic-5/support/created-workflows';
import { expect, test as base, type E2EMode, type LoginCredentials } from '../../support/fixtures';
import { Epic6Simulation, type ReceivedCall, type SimulatedWorker } from './simulation';

export { expect };

/** The accounts of the epic 6 flows: the Admin builds and triggers, the Operador triggers and follows, the others read. */
export type Epic6Account = 'admin' | 'operator' | 'approver' | 'auditor';

export interface Epic6 {
  mode: E2EMode;
  account(name: Epic6Account): LoginCredentials;
  /** The simulated worker (the test moves each execution); `null` in real mode, where the backend's worker runs alone. */
  worker: SimulatedWorker | null;
  /** What the module sent to the workflow, catalog and execution routes; `null` in real mode. */
  calls(): readonly ReceivedCall[] | null;
}

type Other = Exclude<Epic6Account, 'admin'>;

const SIMULATED: Record<Other, LoginCredentials & { name: string; role: string }> = {
  operator: { email: 'operador@demo.local', password: 'senha-simulada-operador', name: 'Operador Demonstração', role: 'Operador' },
  approver: { email: 'aprovador@demo.local', password: 'senha-simulada-aprovador', name: 'Aprovador Demonstração', role: 'Aprovador' },
  auditor: { email: 'auditor@demo.local', password: 'senha-simulada-auditor', name: 'Auditor Demonstração', role: 'Auditor' },
};

/** The real-mode variables of each account (the `prepare-local` accounts, in ../backend/docs/ambientes.md). */
const REAL: Record<Other, { email: string; defaultEmail: string; password: string }> = {
  operator: { email: 'E2E_OPERATOR_EMAIL', defaultEmail: 'operador@demo.local', password: 'E2E_OPERATOR_PASSWORD' },
  approver: { email: 'E2E_APPROVER_EMAIL', defaultEmail: 'aprovador@demo.local', password: 'E2E_APPROVER_PASSWORD' },
  auditor: { email: 'E2E_AUDITOR_EMAIL', defaultEmail: 'auditor@demo.local', password: 'E2E_AUDITOR_PASSWORD' },
};

function variable(name: string, defaultValue?: string): string {
  const value = process.env[name]?.trim() || defaultValue;
  if (!value) throw new Error(`Modo real: defina ${name} (credenciais do prepare-local do back, em ../backend/docs/ambientes.md).`);
  return value;
}

export const test = base.extend<{ epic6: Epic6 }>({
  // Without the 200 ms entrance animations of dialogs, selects and menus (the design system turns them off with
  // prefers-reduced-motion): Playwright waits for each element to be still before acting.
  reducedMotion: 'reduce',
  epic6: [
    // Depends on `api`: these routes are added after the epic 1 one and therefore answer before it.
    async ({ page, api, baseURL }, use) => {
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;
      const simulated = api.mode === 'simulated';
      const accounts: InitialAccount[] = [
        { ...api.account('admin'), name: 'Administradora Demonstração', roles: { Demonstração: 'Admin' } },
        ...Object.values(SIMULATED).map(({ email, password, name, role }) => ({ email, password, name, roles: { Demonstração: role } })),
      ];
      const session = simulated ? new Epic2Simulation(accounts, shellOrigin) : null;
      const executions = simulated ? new Epic6Simulation(shellOrigin) : null;
      await session?.install(page);
      await executions?.install(page);

      await use({
        mode: api.mode,
        account(name) {
          if (name === 'admin') return api.account('admin');
          if (simulated) return { email: SIMULATED[name].email, password: SIMULATED[name].password };
          const names = REAL[name];
          return { email: variable(names.email, names.defaultEmail), password: variable(names.password) };
        },
        worker: executions?.worker ?? null,
        calls: () => executions?.calls ?? null,
      });

      // Real mode keeps what a run leaves in the database: the copies of the workflows the test created are deleted here
      // (their executions stay, as the backend keeps them).
      if (!simulated) {
        const left = await deleteCreatedWorkflows(page);
        if (left.length > 0) throw new Error(`Não foi possível apagar os workflows criados pelo teste: ${left.join('; ')}.`);
      }

      const unexpected = [...(session?.unexpected ?? []), ...(executions?.unexpected ?? [])];
      if (unexpected.length > 0) throw new Error(`O módulo chamou rotas fora da API simulada: ${unexpected.join(', ')}.`);
    },
    { auto: true },
  ],
});
