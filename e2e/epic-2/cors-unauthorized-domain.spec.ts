// Epic 2 · a call from an unauthorized domain is rejected by CORS. Real mode only: in the simulation, the rejection would be
// the simulation itself answering, proving nothing about the backend.
import type { Schemas } from '../support/contract';
import { signIn } from '../support/screens';
import { expect, test } from './support/fixtures';
import { callApi, suffix } from './support/screens';

/** An origin no tenant authorized. Its page is served by the test itself (there is no server). */
const ORIGIN_NOT_AUTHORIZED = 'http://hospedeiro-nao-autorizado.e2e.local';

test.describe('CORS da incorporação', () => {
  test('com um token válido, a chamada de um domínio não autorizado é recusada', async ({ page, api, playwright }) => {
    test.skip(api.mode !== 'real', 'Só no modo real (pnpm e2e:real, com E2E_API_URL).');
    const apiUrl = api.apiUrl ?? '';

    // The Admin creates a key through the shell (cookie and CSRF, as the screen would).
    await signIn(page, api.account('admin'));
    const creation = await callApi(page, apiUrl, 'POST', '/v1/api-keys', { name: `E2E CORS ${suffix()}` });
    expect(creation.status, 'criar a chave').toBe(201);
    const apiKey = creation.body as Schemas['CreatedApiKey'];

    // The host app backend, outside the browser, exchanges the key for a token.
    const hostApp = await playwright.request.newContext({ baseURL: apiUrl });
    try {
      const exchange = await hostApp.post('/v1/embed/sessions', {
        headers: { Authorization: `ApiKey ${apiKey.key}` },
        data: { external_id: 'e2e-cors', email: 'e2e-cors@e2e.local', name: 'Pessoa do teste de CORS', roles: [] },
      });
      expect(exchange.status(), 'trocar a chave por um token').toBe(201);
      const { token } = (await exchange.json()) as Schemas['EmbedToken'];

      // The module on a page of an unauthorized origin: the browser does not deliver the response (CORS).
      const otherPage = await page.context().newPage();
      await otherPage.route(`${ORIGIN_NOT_AUTHORIZED}/**`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Hospedeiro</title>' }),
      );
      await otherPage.goto(`${ORIGIN_NOT_AUTHORIZED}/`);
      const fromBrowser = await otherPage.evaluate(
        async ({ url, token }) => {
          try {
            const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            return { delivered: true, status: response.status };
          } catch (error) {
            return { delivered: false, error: String(error) };
          }
        },
        { url: `${apiUrl}/v1/session`, token },
      );
      expect(fromBrowser, 'o navegador barra a resposta para a origem não autorizada').toMatchObject({ delivered: false });
      await otherPage.close();

      // With that origin, the API rejects the token (403 origin_not_authorized) and does not open CORS to it.
      const direct = await hostApp.get('/v1/session', {
        headers: { Authorization: `Bearer ${token}`, Origin: ORIGIN_NOT_AUTHORIZED },
      });
      expect(direct.status()).toBe(403);
      expect(((await direct.json()) as Schemas['Problem']).code).toBe('origin_not_authorized');
      expect(direct.headers()['access-control-allow-origin']).not.toBe(ORIGIN_NOT_AUTHORIZED);
    } finally {
      await hostApp.dispose();
      // The key does not stay valid after the test.
      const revocation = await callApi(page, apiUrl, 'DELETE', `/v1/api-keys/${apiKey.id}`);
      expect(revocation.status, 'revogar a chave do teste').toBe(204);
    }
  });
});
