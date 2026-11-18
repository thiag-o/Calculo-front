// Fixture of the epic 3 end-to-end tests, on top of the epic 2 one (e2e/epic-2/support/fixtures.ts), which keeps the
// session and the accounts: the same files run in both projects of playwright.config.ts.
// - simulated (pnpm e2e): the catalog simulation (`CatalogSimulation`) answers the catalog routes, with the backend's
//   sample database (`postgres-sample`) and the Excel files the test registers;
// - real (pnpm e2e:real): the backend connects to its `postgres-sample`, with the users given by the E2E_SAMPLE_*
//   variables (README, "Testes ponta a ponta no modo real").
import { randomUUID } from 'node:crypto';
import { expect, test as base } from '../../epic-2/support/fixtures';
import { CatalogSimulation, type SampleDatabase } from './simulation';
import { createWorkbook, type SheetSpec, type Workbook } from './workbook';

export { expect };

/** A credential of the sample database, as typed in the "Nova conexão" form. */
export interface SampleCredential {
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export interface Epic3 {
  /** `exemplo_leitura`: only SELECT; the connection with it is saved. */
  readCredential: SampleCredential;
  /** `exemplo_escrita`: may write; the connection with it is refused (`connection_not_read_only`). */
  writeCredential: SampleCredential;
  /**
   * An .xlsx with these sheets, ready to send. In simulated mode, the simulation answers its upload with the types each
   * column declares; in real mode, the backend infers them.
   */
  workbook(fileName: string, sheets: readonly SheetSpec[]): Workbook;
}

/** The simulated sample database: the address and the users of `postgres-sample`, with passwords of the simulation. */
function simulatedSample(): SampleDatabase {
  const run = randomUUID().slice(0, 8);
  return {
    host: '127.0.0.1',
    port: 5434,
    database: 'exemplo',
    readUser: { username: 'exemplo_leitura', password: `senha-simulada-leitura-${run}` },
    writeUser: { username: 'exemplo_escrita', password: `senha-simulada-escrita-${run}` },
  };
}

const SAMPLE_HELP = 'banco de exemplo postgres-sample do back; credenciais em ../backend/docs/ambientes.md';

function variable(name: string, defaultValue?: string): string {
  const value = process.env[name]?.trim() || defaultValue;
  if (!value) throw new Error(`Modo real: defina ${name} (${SAMPLE_HELP}).`);
  return value;
}

/**
 * The real sample database, from the E2E_SAMPLE_* variables. The address is the one the API (not the browser) uses to
 * reach `postgres-sample`; the defaults are the backend's local ones. The passwords are required.
 */
function realSample(): SampleDatabase {
  const port = Number(variable('E2E_SAMPLE_PORT', '5434'));
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Modo real: E2E_SAMPLE_PORT precisa ser uma porta (1 a 65535).');
  return {
    host: variable('E2E_SAMPLE_HOST', '127.0.0.1'),
    port,
    database: variable('E2E_SAMPLE_DATABASE', 'exemplo'),
    readUser: { username: variable('E2E_SAMPLE_READ_USER', 'exemplo_leitura'), password: variable('E2E_SAMPLE_READ_PASSWORD') },
    writeUser: { username: variable('E2E_SAMPLE_WRITE_USER', 'exemplo_escrita'), password: variable('E2E_SAMPLE_WRITE_PASSWORD') },
  };
}

function credentialOf(sample: SampleDatabase, user: SampleDatabase['readUser']): SampleCredential {
  return { host: sample.host, port: sample.port, database: sample.database, username: user.username, password: user.password };
}

export const test = base.extend<{ epic3: Epic3 }>({
  // The trace of a failure without the screencast and the DOM snapshots (it keeps the actions, the network, the console
  // and the sources; the error-context.md keeps the page snapshot). Measured in F35, with 6 workers: the screenshots and
  // snapshots of every action took a test from 9 s to 23 s, and made it hit the 30 s timeout. Fixed here (not an
  // option), so it wins over `use.trace` of the config; a worker of its own runs the epic 3 tests.
  trace: [{ mode: 'retain-on-failure', screenshots: false, snapshots: false }, { scope: 'worker' }],
  // Without the 200 ms entrance animations of dialogs, selects and menus (the design system turns them off with
  // prefers-reduced-motion): Playwright waits for each element to be still before acting.
  reducedMotion: 'reduce',
  epic3: [
    // Depends on `epic2`: the catalog route is added after the epic 2 one and therefore answers before it.
    async ({ page, api, epic2, baseURL }, use) => {
      void epic2;
      const shellOrigin = new URL(baseURL ?? 'http://localhost:5173').origin;
      const sample = api.mode === 'simulated' ? simulatedSample() : realSample();
      const simulation = api.mode === 'simulated' ? new CatalogSimulation(sample, shellOrigin) : null;
      if (simulation) await simulation.install(page);

      await use({
        readCredential: credentialOf(sample, sample.readUser),
        writeCredential: credentialOf(sample, sample.writeUser),
        workbook(fileName, sheets) {
          const workbook = createWorkbook(fileName, sheets);
          simulation?.registerWorkbook(workbook);
          return workbook;
        },
      });

      if (simulation && simulation.unexpected.length > 0) {
        throw new Error(`O módulo chamou rotas do catálogo fora da API simulada: ${simulation.unexpected.join(', ')}.`);
      }
    },
    { auto: true },
  ],
});
