// Epic 6 · the standalone <Workflows> and <Executions> (ADR 0070), each mounted alone on the host app page (the shell's embed test
// page, another origin, with a Bearer token): <Workflows> lists the workflows, opens the Overview, "Executar lote" opens the
// panel of the new execution and goes back; <Executions> lists the executions, opens the panel and goes back to the list.
// The host app role is the Operador (workflows.view, executions.view, executions.trigger).
import type { Page } from '@playwright/test';
import { callApi, submit } from '../epic-2/support/screens';
import { signInForApi } from '../epic-4/support/screens';
import type { Schemas } from '../support/contract';
import { CAMPAIGN_WORKFLOW } from './support/campaign';
import { expect, test } from './support/fixtures';
import { executionPanel, executionsTable, expectStatus, finishRun, openTrigger, submitTrigger } from './support/screens';

const TEST_PAGE = '/embed-test.html';

/** On the embed test page: exchanges the key for a token and mounts only the screen `mount` (the "O que montar" option). */
async function mountStandalone(hostApp: Page, hostAppOrigin: string, apiKey: string, mount: 'workflows' | 'executions'): Promise<void> {
  await hostApp.goto(`${hostAppOrigin}${TEST_PAGE}`);
  await hostApp.getByRole('textbox', { name: 'Chave de API' }).fill(apiKey);
  await hostApp.getByRole('textbox', { name: 'Papéis (nomes, separados por vírgula)' }).fill('Operador');
  await hostApp.getByRole('combobox', { name: 'O que montar' }).selectOption(mount);
  const exchange = await submit(hostApp, 'POST', '/v1/embed/sessions', hostApp.getByRole('button', { name: /^Obter token e montar/ }));
  expect(exchange.status(), 'trocar a chave pelo token').toBe(201);
}

test('o <Workflows> e o <Executions> avulsos, incorporados, listam, abrem o painel, executam o lote e voltam', async ({ page, epic6 }) => {
  test.setTimeout(120_000);
  const apiOrigin = await signInForApi(page, epic6.account('admin'));
  const origin = epic6.hostAppOrigin;

  // The Admin prepares the host app: an API key and the authorized domain (`prepare-local` registers it in real mode).
  const created = await callApi(page, apiOrigin, 'POST', '/v1/api-keys', { name: `E2E Avulsos ${Date.now()}` } satisfies Schemas['NewApiKey']);
  expect(created.status, `criar a chave pela API (${String(created.code)})`).toBe(201);
  const apiKey = created.body as Schemas['CreatedApiKey'];
  const domains = await callApi(page, apiOrigin, 'GET', '/v1/authorized-domains');
  let addedDomain: string | null = null;
  if (!(domains.body as Schemas['AuthorizedDomainList']).items.some((domain) => domain.origin === origin)) {
    const added = await callApi(page, apiOrigin, 'POST', '/v1/authorized-domains', { origin } satisfies Schemas['NewAuthorizedDomain']);
    expect(added.status, `cadastrar o domínio pela API (${String(added.code)})`).toBe(201);
    addedDomain = (added.body as Schemas['AuthorizedDomain']).id;
  }

  try {
    const hostApp = await epic6.newHostPage();
    let executionId = '';

    await test.step('<Workflows>: lista, Visão geral, Executar lote abre o painel e voltar leva à Visão geral', async () => {
      await mountStandalone(hostApp, origin, apiKey.key, 'workflows');
      const region = hostApp.getByRole('region', { name: 'Workflows', exact: true });
      await region.getByRole('searchbox', { name: 'Filtrar por nome' }).fill(CAMPAIGN_WORKFLOW);
      await region.getByRole('list', { name: 'Workflows' }).getByRole('button', { name: CAMPAIGN_WORKFLOW, exact: true }).click();
      await expect(hostApp.getByRole('heading', { level: 1, name: CAMPAIGN_WORKFLOW, exact: true })).toBeVisible();

      await openTrigger(hostApp, region);
      const response = await submitTrigger(hostApp);
      expect(response.status(), 'disparar o lote').toBe(202);
      expect(await response.request().headerValue('authorization')).toMatch(/^Bearer /);
      executionId = ((await response.json()) as { id: string }).id;

      const panel = executionPanel(hostApp, CAMPAIGN_WORKFLOW);
      await expect(panel).toBeVisible();
      finishRun(epic6, executionId);
      await expectStatus(hostApp, epic6, panel, 'Com erros');

      await hostApp.getByRole('button', { name: 'Voltar para a visão geral', exact: true }).click();
      await expect(hostApp.getByRole('heading', { level: 1, name: CAMPAIGN_WORKFLOW, exact: true })).toBeVisible();
    });

    await test.step('<Executions>: lista, painel de uma execução e voltar leva à lista', async () => {
      await mountStandalone(hostApp, origin, apiKey.key, 'executions');
      const region = hostApp.getByRole('region', { name: 'Execuções', exact: true });
      await expect(region.getByRole('heading', { level: 1, name: 'Execuções', exact: true })).toBeVisible();
      await expect(hostApp.getByRole('complementary', { name: 'Menu lateral' })).toHaveCount(0);

      await executionsTable(hostApp)
        .getByRole('button', { name: `${CAMPAIGN_WORKFLOW}, execução ${executionId.slice(0, 8)}`, exact: true })
        .click();
      const panel = executionPanel(hostApp, CAMPAIGN_WORKFLOW);
      await expect(panel).toBeVisible();
      await expectStatus(hostApp, epic6, panel, 'Com erros');

      await hostApp.getByRole('button', { name: 'Voltar para execuções', exact: true }).click();
      await expect(executionsTable(hostApp)).toBeVisible();
      expect(new URL(hostApp.url()).pathname, 'a página do hospedeiro não muda de endereço').toBe(TEST_PAGE);
    });
  } finally {
    await revoke(page, apiOrigin, apiKey.id, addedDomain);
  }
});

/** Leaves the host app as it was found: revokes the key and removes the domain the test registered. */
async function revoke(page: Page, apiOrigin: string, apiKeyId: string, addedDomain: string | null): Promise<void> {
  await callApi(page, apiOrigin, 'DELETE', `/v1/api-keys/${apiKeyId}`);
  if (addedDomain !== null) await callApi(page, apiOrigin, 'DELETE', `/v1/authorized-domains/${addedDomain}`);
}
