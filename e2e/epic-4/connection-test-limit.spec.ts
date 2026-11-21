// Epic 4 · script 10: the limit of "Testar" on a saved connection (E4-16). Past `FLUXO_CONNECTION_TEST_LIMIT_PER_MIN` tests in a
// minute, the API answers `429 too_many_connection_tests` with `Retry-After`; the detail shows the wait (the
// `CooldownNotice` text, beside the button and in the live region) and the button works again when the time is up. With the
// limit not reached, no notice shows. Both modes: in simulated mode this test applies a small limit to the test route itself
// (the catalog simulation has none); in real mode the backend's limit is the one in FLUXO_CONNECTION_TEST_LIMIT_PER_MIN.
import type { Locator, Page, Response } from '@playwright/test';
import { suffix } from '../epic-2/support/screens';
import { EXAMPLES } from '../support/contract';
import { expect, test } from '../epic-3/support/fixtures';
import { connectionsTable, createConnectionThroughApi, openCatalog, rowNamed, signInForApi, type Connection } from '../epic-3/support/screens';
import { apiResponse } from '../support/screens';

/** Simulated mode: tests accepted before the 429, and the wait it announces (short, so the test is quick). */
const SIMULATED_LIMIT = 3;
const SIMULATED_RETRY_SECONDS = 2;
/** The backend's local value (`.env.example`); real mode reads FLUXO_CONNECTION_TEST_LIMIT_PER_MIN when it is set. */
const DEFAULT_REAL_LIMIT = 10;
/** The longest wait the contract allows (`retry_after_seconds`, 1 to 60). */
const MAX_WAIT_SECONDS = 60;

const WAIT_TEXT = 'Muitos testes de conexão seguidos. Tente de novo em';
const RELEASED_TEXT = 'Já é possível testar de novo.';

function realLimit(): number {
  const value = Number(process.env.FLUXO_CONNECTION_TEST_LIMIT_PER_MIN?.trim() || DEFAULT_REAL_LIMIT);
  if (!Number.isInteger(value) || value < 1 || value > 1000) {
    throw new Error('FLUXO_CONNECTION_TEST_LIMIT_PER_MIN precisa ser um inteiro de 1 a 1000 (o mesmo valor da API do modo real).');
  }
  return value;
}

/**
 * Simulated mode only: the test route of the saved connection lets `limit` tests through to the simulation and then answers
 * `429` with `Retry-After`, until the wait is over (then it counts again). Added after the simulations' routes, so it answers first.
 */
async function limitConnectionTests(page: Page, limit: number, waitSeconds: number): Promise<void> {
  let accepted = 0;
  let releasedAt = 0;
  await page.route('**/v1/connections/*/test', async (route) => {
    const request = route.request();
    if (request.method() !== 'POST') return route.fallback();
    if (releasedAt > 0 && Date.now() >= releasedAt) {
      accepted = 0;
      releasedAt = 0;
    }
    if (accepted < limit) {
      accepted += 1;
      return route.fallback();
    }
    if (releasedAt === 0) releasedAt = Date.now() + waitSeconds * 1000;
    await route.fulfill({
      status: 429,
      headers: {
        'access-control-allow-origin': request.headers().origin ?? '*',
        'access-control-allow-credentials': 'true',
        vary: 'Origin',
        'content-type': 'application/problem+json',
        'retry-after': String(waitSeconds),
      },
      body: JSON.stringify({ ...EXAMPLES.TooManyConnectionTests, retry_after_seconds: waitSeconds }),
    });
  });
}

async function openConnection(page: Page, connection: Connection): Promise<Locator> {
  await openCatalog(page, 'Conexões');
  await Promise.all([
    apiResponse(page, 'GET', `/v1/connections/${connection.id}`),
    rowNamed(connectionsTable(page), connection.name).getByRole('button', { name: connection.name, exact: true }).click(),
  ]);
  await expect(page.getByRole('heading', { level: 2, name: connection.name, exact: true })).toBeVisible();
  return page.getByRole('button', { name: 'Testar', exact: true });
}

/** Clicks "Testar" and returns the `POST /v1/connections/:id/test` response. */
async function pressTest(page: Page, connection: Connection, button: Locator): Promise<Response> {
  const [response] = await Promise.all([apiResponse(page, 'POST', `/v1/connections/${connection.id}/test`), button.click()]);
  return response;
}

test.describe('limite de testes de conexão', () => {
  // Serialized: the tests share the admin's limit window. The file also has its own project, last (playwright.config.ts).
  test.describe.configure({ mode: 'serial' });

  test('com o limite não atingido, nenhum aviso de espera aparece', async ({ page, api, epic3 }) => {
    const apiOrigin = await signInForApi(page, api.account('admin'));
    const connection = await createConnectionThroughApi(page, apiOrigin, `Limite livre e2e ${suffix()}`, epic3.readCredential);
    if (api.mode === 'simulated') await limitConnectionTests(page, SIMULATED_LIMIT, SIMULATED_RETRY_SECONDS);
    const button = await openConnection(page, connection);

    const response = await pressTest(page, connection, button);
    expect(response.status(), 'um teste só, abaixo do limite').toBe(200);
    await expect(page.getByText('Resultado do teste')).toBeVisible();
    await expect(button).not.toHaveAttribute('aria-disabled', 'true');
    await expect(page.getByText(new RegExp(WAIT_TEXT))).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: /\S/ })).toHaveCount(0);
  });

  test('além do limite, mostra a espera do Retry-After e o botão volta depois do tempo', async ({ page, api, epic3 }) => {
    // Real mode may wait up to a whole minute for the window to slide.
    if (api.mode === 'real') test.setTimeout(60_000 + (MAX_WAIT_SECONDS + 30) * 1000);
    const limit = api.mode === 'simulated' ? SIMULATED_LIMIT : realLimit();

    const apiOrigin = await signInForApi(page, api.account('admin'));
    const connection = await createConnectionThroughApi(page, apiOrigin, `Limite e2e ${suffix()}`, epic3.readCredential);
    if (api.mode === 'simulated') await limitConnectionTests(page, limit, SIMULATED_RETRY_SECONDS);
    const button = await openConnection(page, connection);

    // Tests up to the limit; the 429 comes at the latest on test number limit + 1 (earlier if the minute already had tests).
    let refused: Response | undefined;
    for (let attempt = 0; attempt <= limit && !refused; attempt += 1) {
      const response = await pressTest(page, connection, button);
      if (response.status() === 429) refused = response;
      else expect(response.status(), `o teste ${attempt + 1} dentro do limite`).toBe(200);
    }
    if (!refused) throw new Error(`Nenhum 429 depois de ${limit + 1} testes: o limite da API é outro? (FLUXO_CONNECTION_TEST_LIMIT_PER_MIN)`);

    const body = (await refused.json()) as { code: string; retry_after_seconds: number };
    expect(body.code).toBe('too_many_connection_tests');
    const wait = body.retry_after_seconds;
    expect(wait, 'o tempo de espera do contrato').toBeGreaterThanOrEqual(1);
    expect(wait).toBeLessThanOrEqual(MAX_WAIT_SECONDS);
    expect(refused.headers()['retry-after'], 'o cabeçalho Retry-After diz o mesmo tempo').toBe(String(wait));

    // The wait shows beside the button (its disabled reason) and, once, in the live region that announces it.
    await expect(button).toHaveAttribute('aria-disabled', 'true');
    await expect(button).toHaveAccessibleDescription(new RegExp(`^${WAIT_TEXT} \\d+ s\\.$`));
    await expect(page.getByRole('status').filter({ hasText: `${WAIT_TEXT} ${wait} s.` })).toBeVisible();
    // No generic error beside it: the wait is the only notice about the refusal.
    await expect(page.getByRole('alert')).toHaveCount(0);

    // Time passes: the notice goes, the live region says it is released, and "Testar" is accepted again.
    await expect(button).not.toHaveAttribute('aria-disabled', 'true', { timeout: (wait + 10) * 1000 });
    await expect(page.getByText(new RegExp(WAIT_TEXT))).toHaveCount(0);
    await expect(page.getByRole('status').filter({ hasText: RELEASED_TEXT })).toBeVisible();
    const again = await pressTest(page, connection, button);
    expect(again.status(), 'depois do tempo, o teste é aceito').toBe(200);
  });
});
