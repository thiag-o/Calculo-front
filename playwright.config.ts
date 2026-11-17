// Playwright (repository root). Two projects that use the same test files in e2e/:
// - simulated: API simulated by a fixture (page.route); runs at the front gate.
// - real: real backend (E2E_API_URL) + shell; runs in the checkpoint integration test.
// `pnpm e2e:real` runs with 2 workers (in the package.json script): on this machine, 6 browsers, the Vite dev server and the API
// together saturate CPU and memory, and the sign-ins time out (global session decision, F39). The API alone
// serves 6 parallel sign-ins in under 1.5 s. `pnpm e2e` (simulated) keeps the default parallelism.
import { defineConfig, devices } from '@playwright/test';

const shellUrl = process.env.E2E_SHELL_URL ?? 'http://localhost:5173';

// The "host app" of the embedding tests: the shell's embed test page (apps/shell/vite.embed.config.ts), on an
// origin different from the shell's. It is the origin the backend's `prepare-local` registers as an authorized domain; the backend treats
// the shell origin (FLUXO_CORS_ORIGINS) with the shell CORS policy, which does not accept `Authorization`.
const hostAppUrl = 'http://localhost:5274';

// In real mode, the shell and the test page Playwright starts talk to the same API as the tests: E2E_API_URL becomes their
// VITE_API_URL. Without E2E_API_URL, both follow their own VITE_API_URL (or the default http://localhost:8000).
const apiUrl = process.env.E2E_API_URL?.trim().replace(/\/+$/, '');
const viteEnv: Record<string, string> = apiUrl ? { VITE_API_URL: apiUrl } : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: shellUrl, trace: 'retain-on-failure' },
  // Lido pelas fixtures (testInfo.config.metadata).
  metadata: { hostAppUrl },
  projects: [
    { name: 'simulated', use: { ...devices['Desktop Chrome'] }, metadata: { mode: 'simulated' } },
    // Real only: 60 s timeout per test and per `expect` (global session decision, D8 of F39): the long audit
    // flow (8 sign-ins with argon2, 2 users, the link and 5 filters) took 33 s alone, with this machine loaded.
    // The simulated project keeps the defaults (30 s and 5 s).
    {
      name: 'real',
      use: { ...devices['Desktop Chrome'] },
      metadata: { mode: 'real' },
      timeout: 60_000,
      expect: { timeout: 60_000 },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter shell dev',
      url: shellUrl,
      // An already open shell is reused with whatever VITE_API_URL it has; the fixture fails if it calls another API.
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
