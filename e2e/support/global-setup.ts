// Opens the shell once, before the tests, and waits for the sign-in screen: the first visit is paid here, out of the
// tests' timeout, and a shell that does not render fails here, once, instead of in every test. Playwright serves the
// shell built (`vite preview`, playwright.config.ts); a reused `pnpm dev` server needs it most: on the first visit Vite
// transforms the modules and, when it finds dependencies of the linked @fluxo/react, optimizes them and reloads the page
// (5 to 8 s of each test of the first wave, measured in F35). Works in both modes and never calls the API: every
// `/v1/...` call is answered here as if there were no session, so the shell shows the sign-in screen.
import { chromium, type FullConfig } from '@playwright/test';
import { EXAMPLES } from './contract';
import { API_ROUTES, isApiCall } from './simulated-api';

export default async function globalSetup(config: FullConfig): Promise<void> {
  const baseURL = config.projects[0]?.use.baseURL;
  if (!baseURL) return;
  const origin = new URL(baseURL).origin;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage();
    // In both modes, the API answers here as if there were no session (401 no_session), without being called.
    await page.route(API_ROUTES, (route) => {
      if (!isApiCall(route, origin)) return route.fallback();
      const cors = { 'access-control-allow-origin': origin, 'access-control-allow-credentials': 'true' };
      if (route.request().method() === 'OPTIONS') {
        return route.fulfill({
          status: 204,
          headers: {
            ...cors,
            'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE',
            'access-control-allow-headers': 'content-type, x-csrf-token',
          },
        });
      }
      return route.fulfill({
        status: 401,
        headers: cors,
        contentType: 'application/problem+json',
        body: JSON.stringify(EXAMPLES.NoSession),
      });
    });
    await page.goto(new URL('/sign-in', baseURL).toString());
    // The screen ready (after the reload of a dependency optimization, if there was one).
    await page.getByRole('button', { name: 'Entrar', exact: true }).waitFor({ timeout: 60_000 });
  } finally {
    await browser.close();
  }
}
