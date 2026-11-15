// Playwright (raiz do repositório). Dois projetos que usam os mesmos arquivos de teste em e2e/:
// - simulado: API simulada por fixture (page.route); roda no portão do front.
// - real: back de verdade (E2E_API_URL) + casca; roda no teste de integração do checkpoint.
import { defineConfig, devices } from '@playwright/test';

const cascaUrl = process.env.E2E_CASCA_URL ?? 'http://localhost:5173';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: cascaUrl, trace: 'retain-on-failure' },
  projects: [
    { name: 'simulado', use: { ...devices['Desktop Chrome'] }, metadata: { modo: 'simulado' } },
    { name: 'real', use: { ...devices['Desktop Chrome'] }, metadata: { modo: 'real' } },
  ],
  webServer: {
    command: 'pnpm --filter casca dev',
    url: cascaUrl,
    reuseExistingServer: !process.env.CI,
  },
});
