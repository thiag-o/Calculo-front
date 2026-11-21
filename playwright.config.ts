// Playwright (repository root). Two projects that use the same test files in e2e/:
// - simulated: API simulated by a fixture (page.route); runs at the front gate.
// - real: real backend (E2E_API_URL) + shell; runs in the checkpoint integration test.
// `pnpm e2e:real` runs with 2 workers (in the package.json script): on this machine, 6 browsers, the Vite dev server and the API
// together saturate CPU and memory, and the sign-ins time out (global session decision, F39, measured before F35 served the
// shell built instead of through the dev server). The API alone
// serves 6 parallel sign-ins in under 1.5 s. `pnpm e2e` (simulated) keeps the default parallelism.
import { defineConfig, devices } from '@playwright/test';
import { e2ePorts } from './scripts/e2e-ports.mjs';

// With FLUXO_TEST_ISOLATION_ID, the shell and the embed page use their own ports (scripts/e2e-ports.mjs), so that
// several worktrees can run `pnpm e2e` at the same time. Real mode (`e2e:real`) is unchanged.
const ports = e2ePorts();

const shellUrl = process.env.E2E_SHELL_URL ?? `http://localhost:${ports.shellPort}`;
const shellPort = new URL(shellUrl).port || '80';

// Where the e2e build of the shell goes, relative to apps/shell (inside node_modules/, ignored by git and by the linters).
// With FLUXO_TEST_ISOLATION_ID, the build dir and Playwright's outputDir also carry the id, so that parallel runs in the
// same checkout do not share (nor empty) each other's build or artifacts. The id is sanitized to be a safe path segment.
const isolationId = process.env.FLUXO_TEST_ISOLATION_ID?.trim().replace(/[^A-Za-z0-9._-]/g, '_');
const SHELL_E2E_DIR = isolationId
  ? `../../node_modules/.cache/e2e-shell-${isolationId}`
  : '../../node_modules/.cache/e2e-shell';
const outputDir = isolationId ? `test-results/${isolationId}` : 'test-results';

// The "host app" of the embedding tests: the shell's embed test page (apps/shell/vite.embed.config.ts), on an
// origin different from the shell's. It is the origin the backend's `prepare-local` registers as an authorized domain; the backend treats
// the shell origin (FLUXO_CORS_ORIGINS) with the shell CORS policy, which does not accept `Authorization`.
const hostAppUrl = `http://localhost:${ports.hostAppPort}`;

// In real mode, the shell and the test page Playwright starts talk to the same API as the tests: E2E_API_URL becomes their
// VITE_API_URL. Without E2E_API_URL, both follow their own VITE_API_URL (or the default http://localhost:8000).
const apiUrl = process.env.E2E_API_URL?.trim().replace(/\/+$/, '');
const viteEnv: Record<string, string> = apiUrl ? { VITE_API_URL: apiUrl } : {};

// The spec that runs in its own project, serialized and last (see the projects below).
const LIMIT_SPEC = '**/epic-4/connection-test-limit.spec.ts';

export default defineConfig({
  testDir: './e2e',
  outputDir,
  // Opens the shell once, out of the tests' timeout, without calling the API (e2e/support/global-setup.ts).
  globalSetup: './e2e/support/global-setup.ts',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: shellUrl, trace: 'retain-on-failure' },
  // Lido pelas fixtures (testInfo.config.metadata).
  metadata: { hostAppUrl },
  projects: [
    {
      name: 'simulated',
      use: { ...devices['Desktop Chrome'] },
      metadata: { mode: 'simulated' },
      testIgnore: LIMIT_SPEC,
      // Selecting `simulated` also runs `simulated-limit`, after it (a teardown runs even if the tests before it fail).
      teardown: 'simulated-limit',
    },
    // Real only: 60 s timeout per test and per `expect` (global session decision, D8 of F39): the long audit
    // flow (8 sign-ins with argon2, 2 users, the link and 5 filters) took 33 s alone, with this machine loaded.
    // The simulated project keeps the defaults (30 s and 5 s).
    {
      name: 'real',
      use: { ...devices['Desktop Chrome'] },
      metadata: { mode: 'real' },
      timeout: 60_000,
      expect: { timeout: 60_000 },
      testIgnore: LIMIT_SPEC,
      teardown: 'real-limit',
    },
    // The "Testar" limit test (epic 4, script 10) uses up the admin's limit window (60 s per tenant and user) and would make
    // other tests take a 429. So it has its own projects, which run alone, after all the others (see `teardown` above).
    {
      name: 'simulated-limit',
      use: { ...devices['Desktop Chrome'] },
      metadata: { mode: 'simulated' },
      testMatch: LIMIT_SPEC,
    },
    {
      name: 'real-limit',
      use: { ...devices['Desktop Chrome'] },
      metadata: { mode: 'real' },
      timeout: 60_000,
      expect: { timeout: 60_000 },
      testMatch: LIMIT_SPEC,
    },
  ],
  webServer: [
    {
      // The shell built (one minified bundle) and served by `vite preview`, on the dev server's port. Measured in F35:
      // through the dev server, each test's first page (a new browser context, without cache) fetched 41 unbundled
      // modules (zod alone is 2.3 MB) and, with 6 workers, opening /sign-in took 11 to 18 s of the test's 30 s. Built
      // here (not by `pnpm build`) so that VITE_API_URL is the one of this run; out of the repository's dist/.
      command:
        `pnpm --filter shell exec vite build --outDir ${SHELL_E2E_DIR} --emptyOutDir --logLevel warn` +
        ` && pnpm --filter shell exec vite preview --outDir ${SHELL_E2E_DIR} --port ${shellPort} --strictPort`,
      url: shellUrl,
      // The build runs before the server answers (about 10 s alone, more with the machine busy).
      timeout: 180_000,
      // An already open shell (even `pnpm dev`) is reused with whatever VITE_API_URL it has; the fixture fails if it
      // calls another API.
      reuseExistingServer: !process.env.CI,
      env: viteEnv,
    },
    {
      // The embed test page, in both modes. BROWSER=none: Vite does not open the browser (`server.open`).
      command: 'pnpm --filter shell exec vite --config vite.embed.config.ts',
      url: `${hostAppUrl}/embed-test.html`,
      reuseExistingServer: !process.env.CI,
      env: { ...viteEnv, BROWSER: 'none' },
    },
  ],
});
