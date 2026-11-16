// Playwright (raiz do repositório). Dois projetos que usam os mesmos arquivos de teste em e2e/:
// - simulado: API simulada por fixture (page.route); roda no portão do front.
// - real: back de verdade (E2E_API_URL) + casca; roda no teste de integração do checkpoint.
// O `pnpm e2e:real` roda com 2 workers (no script do package.json): nesta máquina, 6 navegadores, o Vite dev e a API
// juntos saturam CPU e memória, e os logins estouram o tempo limite (decisão da sessão global, F39). A API sozinha
// atende 6 logins paralelos em menos de 1,5 s. O `pnpm e2e` (simulado) segue com o paralelismo padrão.
import { defineConfig, devices } from '@playwright/test';

const cascaUrl = process.env.E2E_CASCA_URL ?? 'http://localhost:5173';

// O "hospedeiro" dos testes de incorporação: a página de teste do casca (apps/casca/vite.incorporacao.config.ts), numa
// origem diferente da do casca. É a origem que o `preparar-local` do back cadastra como domínio autorizado; o back trata
// a origem do casca (FLUXO_CORS_ORIGENS) com a política de CORS do casca, que não aceita `Authorization`.
const hospedeiroUrl = 'http://localhost:5274';

// No modo real, o casca e a página de teste que o Playwright sobe falam com a mesma API dos testes: E2E_API_URL vira o
// VITE_API_URL deles. Sem E2E_API_URL, os dois seguem o próprio VITE_API_URL (ou o padrão http://localhost:8000).
const apiUrl = process.env.E2E_API_URL?.trim().replace(/\/+$/, '');
const envVite: Record<string, string> = apiUrl ? { VITE_API_URL: apiUrl } : {};

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? 'github' : 'list',
  use: { baseURL: cascaUrl, trace: 'retain-on-failure' },
  // Lido pelas fixtures (testInfo.config.metadata).
  metadata: { hospedeiroUrl },
  projects: [
    { name: 'simulado', use: { ...devices['Desktop Chrome'] }, metadata: { modo: 'simulado' } },
    // Só no real, 60 s de tempo limite por teste e por `expect` (decisão da sessão global, D8 da F39): o fluxo longo da
    // auditoria (8 logins com argon2, 2 usuários, o link e 5 filtros) chegou a 33 s sozinho, com esta máquina carregada.
    // O simulado fica com os padrões (30 s e 5 s).
    {
      name: 'real',
      use: { ...devices['Desktop Chrome'] },
      metadata: { modo: 'real' },
      timeout: 60_000,
      expect: { timeout: 60_000 },
    },
  ],
  webServer: [
    {
      command: 'pnpm --filter casca dev',
      url: cascaUrl,
      // Um casca já aberto é reaproveitado com o VITE_API_URL que tiver; a fixture reprova se ele chamar outra API.
      reuseExistingServer: !process.env.CI,
      env: envVite,
    },
    {
      // A página de teste de incorporação, nos dois modos. BROWSER=none: o Vite não abre o navegador (`server.open`).
      command: 'pnpm --filter casca exec vite --config vite.incorporacao.config.ts',
      url: `${hospedeiroUrl}/teste-incorporacao.html`,
      reuseExistingServer: !process.env.CI,
      env: { ...envVite, BROWSER: 'none' },
    },
  ],
});
