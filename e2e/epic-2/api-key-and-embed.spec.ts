// Epic 2 · API key and embedding: the Admin creates the key (shown once) and registers the domain; the "host app"
// (the shell's embed test page, on another origin: http://localhost:5274) exchanges the key for a token and opens
// the embedded module, with tabs and no sidebar; with the key revoked, the exchange fails (both modes).
import type { Page } from '@playwright/test';
import type { Schemas } from '../support/contract';
import { signIn, apiResponse } from '../support/screens';
import { expect, test } from './support/fixtures';
import { openFromMenu, submit, row, suffix } from './support/screens';

const KEY_SHOWN_ONCE_NOTICE = 'Copie a chave agora: ela não será mostrada de novo.';
const TEST_PAGE = '/embed-test.html';

const apiKeysTable = (page: Page) => page.getByRole('table', { name: 'Chaves de API do tenant' });
const authorizedDomainsTable = (page: Page) => page.getByRole('table', { name: 'Domínios autorizados do tenant' });

/** Deletes the domain through the screen, with confirmation. */
async function deleteAuthorizedDomain(page: Page, origin: string): Promise<void> {
  await row(authorizedDomainsTable(page), origin).getByRole('button', { name: `Mais ações para ${origin}` }).click();
  await page.getByRole('menuitem', { name: 'Remover domínio' }).click();
  const dialog = page.getByRole('dialog', { name: 'Remover domínio' });
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.startsWith('/v1/dominios-autorizados/')),
    dialog.getByRole('button', { name: 'Remover domínio' }).click(),
  ]);
  expect(response.status(), 'remover o domínio').toBe(204);
  await expect(row(authorizedDomainsTable(page), origin)).toHaveCount(0);
}

/**
 * On the embed test page: exchanges the key for a token (the host app backend's role) and mounts the whole module
 * (`<FluxoCalculo token>`), the page's default option.
 */
async function exchangeApiKeyForToken(hostApp: Page, apiKey: string, roles: string) {
  await hostApp.getByRole('textbox', { name: 'Chave de API' }).fill(apiKey);
  await hostApp.getByRole('textbox', { name: 'Papéis (nomes, separados por vírgula)' }).fill(roles);
  return submit(hostApp, 'POST', '/v1/incorporacao/sessoes', hostApp.getByRole('button', { name: /^Obter token e montar/ }));
}

test.describe('chave de API e incorporação', () => {
  test('o hospedeiro troca a chave por um token e abre o módulo incorporado; com a chave revogada, a troca falha', async ({
    page,
    api,
    epic2: epic2,
  }) => {
    const apiKeyName = `E2E Hospedeiro ${suffix()}`;
    const origin = epic2.hostAppOrigin;
    // Real mode: `preparar-local` already registers the host app origin. The test deletes it and registers it again through the screen and,
    // at the end, leaves it as it found it.
    let authorizedDomainAlreadyExists = false;
    let apiKey = '';
    let createdApiKey: Schemas['ChaveApiCriada'] | undefined;

    await signIn(page, api.account('admin'));
    await openFromMenu(page, 'Integração');

    await test.step('o Admin cria a chave de API, mostrada uma vez só', async () => {
      await page.getByRole('button', { name: 'Nova chave de API' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Nova chave de API' });
      await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(apiKeyName);

      const response = await submit(page, 'POST', '/v1/chaves-api', dialog.getByRole('button', { name: 'Salvar' }));

      expect(response.status()).toBe(201);
      createdApiKey = (await response.json()) as Schemas['ChaveApiCriada'];
      await expect(dialog.getByText(KEY_SHOWN_ONCE_NOTICE)).toBeVisible();
      apiKey = await dialog.getByRole('textbox', { name: 'Chave', exact: true }).inputValue();
      expect(apiKey).toBe(createdApiKey.chave);

      await page.keyboard.press('Escape');
      await expect(dialog).toBeHidden();
      // In the list, only the start of the key; the full key no longer shows.
      const apiKeyRow = row(apiKeysTable(page), apiKeyName);
      await expect(apiKeyRow.getByText(`${createdApiKey.prefixo}…`, { exact: true })).toBeVisible();
      await expect(apiKeyRow.getByText('Ativa', { exact: true })).toBeVisible();
      await expect(apiKeyRow.getByText('Nunca usada', { exact: true })).toBeVisible();
      await expect(page.getByText(apiKey)).toHaveCount(0);
    });

    await test.step('o Admin cadastra a origem do hospedeiro como domínio autorizado', async () => {
      await expect(authorizedDomainsTable(page)).not.toHaveAttribute('aria-busy', 'true');
      // Real mode: registered by `preparar-local` (or by an interrupted previous run).
      authorizedDomainAlreadyExists = (await row(authorizedDomainsTable(page), origin).count()) > 0;
      if (authorizedDomainAlreadyExists) await deleteAuthorizedDomain(page, origin);

      await page.getByRole('button', { name: 'Novo domínio' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Novo domínio' });
      await dialog.getByRole('textbox', { name: 'Origem' }).fill(origin);

      const response = await submit(page, 'POST', '/v1/dominios-autorizados', dialog.getByRole('button', { name: 'Salvar' }));

      expect(response.status()).toBe(201);
      await expect(dialog).toBeHidden();
      await expect(row(authorizedDomainsTable(page), origin)).toHaveCount(1);
    });

    const hostApp = await epic2.newPage();

    await test.step('o hospedeiro troca a chave por um token e abre o módulo incorporado, com abas e sem menu lateral', async () => {
      await hostApp.goto(`${origin}${TEST_PAGE}`);
      expect(new URL(hostApp.url()).origin, 'o hospedeiro fica fora da origem do casca').not.toBe(new URL(page.url()).origin);

      const exchange = await exchangeApiKeyForToken(hostApp, apiKey, 'Auditor');

      expect(exchange.status()).toBe(201);
      // The module tabs, from the Auditor role's permissions; nothing of the shell layout.
      const tabs = hostApp.getByRole('navigation', { name: 'Telas do Fluxo de Cálculo' });
      await expect(tabs.getByRole('link', { name: 'Início', exact: true })).toBeVisible();
      await expect(tabs.getByRole('link', { name: 'Auditoria', exact: true })).toBeVisible();
      await expect(tabs.getByRole('link', { name: 'Administração', exact: true })).toHaveCount(0);
      await expect(hostApp.getByRole('complementary', { name: 'Menu lateral' })).toHaveCount(0);
      await expect(hostApp.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);
      await expect(hostApp.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();

      // Switching tabs uses the token (Bearer) of the authorized origin and does not touch the host app URL.
      const [accessEvents] = await Promise.all([
        apiResponse(hostApp, 'GET', '/v1/auditoria/acessos'),
        tabs.getByRole('link', { name: 'Auditoria', exact: true }).click(),
      ]);
      expect(accessEvents.status()).toBe(200);
      expect(await accessEvents.request().headerValue('authorization')).toMatch(/^Bearer /);
      await expect(hostApp.getByRole('heading', { level: 2, name: 'Acessos' })).toBeVisible();
      expect(new URL(hostApp.url()).pathname).toBe(TEST_PAGE);
    });

    await test.step('o Admin revoga a chave', async () => {
      if (!createdApiKey) throw new Error('A chave não foi criada.');
      const apiKeyRow = row(apiKeysTable(page), apiKeyName);
      await apiKeyRow.getByRole('button', { name: `Mais ações para a chave ${apiKeyName}` }).click();
      await page.getByRole('menuitem', { name: 'Revogar chave' }).click();
      const dialog = page.getByRole('dialog', { name: 'Revogar chave' });

      const response = await submit(page, 'DELETE', `/v1/chaves-api/${createdApiKey.id}`, dialog.getByRole('button', { name: 'Revogar chave' }));

      expect(response.status()).toBe(204);
      await expect(dialog).toBeHidden();
      await expect(apiKeyRow.getByText('Revogada', { exact: true })).toBeVisible();
      // The earlier exchange was recorded as the key's last use.
      await expect(apiKeyRow.getByText('Nunca usada', { exact: true })).toHaveCount(0);
    });

    await test.step('com a chave revogada, a troca por token falha', async () => {
      const exchange = await exchangeApiKeyForToken(hostApp, apiKey, 'Auditor');

      expect(exchange.status()).toBe(401);
      expect(((await exchange.json()) as Schemas['Problema']).codigo).toBe('chave_invalida');
      await expect(hostApp.getByRole('alert')).toHaveText('A API respondeu 401 (chave_invalida).');
      await expect(hostApp.getByRole('navigation', { name: 'Telas do Fluxo de Cálculo' })).toHaveCount(0);
    });

    await test.step('o Admin remove o domínio cadastrado no teste (se ele não existia antes)', async () => {
      if (!authorizedDomainAlreadyExists) await deleteAuthorizedDomain(page, origin);
    });
  });
});
