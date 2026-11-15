// Playwright (raiz do repositório). Dois projetos que usam os mesmos arquivos de teste em e2e/:
// - simulado: API simulada por fixture (page.route); roda no portão do front.
// - real: back de verdade (E2E_API_URL) + casca; roda no teste de integração do checkpoint.
import { defineConfig, devices } from '@playwright/test';

const cascaUrl = process.env.E2E_CASCA_URL ?? 'http://localhost:5173';

// No modo real, o casca que o Playwright sobe fala com a mesma API dos testes: E2E_API_URL vira o VITE_API_URL dele.
// Sem E2E_API_URL, o casca segue o próprio VITE_API_URL (ou o padrão http://localhost:8000).
const apiUrl = process.env.E2E_API_URL?.trim().replace(/\/+$/, '');

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
    // Um casca já aberto é reaproveitado com o VITE_API_URL que tiver; a fixture reprova se ele chamar outra API.
    reuseExistingServer: !process.env.CI,
    env: apiUrl ? { VITE_API_URL: apiUrl } : {},
  },
});
