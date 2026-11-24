// Epic 6 · by role (fluxo 8 and roteiro 10): the Operador triggers "Executar lote" and follows the execution, cancels while
// it runs and downloads the CSV, without the records and the trace (no `traces.view`); the Aprovador sees the lists and the
// panel but neither triggers nor cancels; the Auditor sees the records and the trace but neither triggers nor cancels.
// The executions the Aprovador and the Auditor look at are triggered first by the Admin, through the API.
import type { Page } from '@playwright/test';
import { callApi } from '../epic-2/support/screens';
import { openOverview, signInForApi } from '../epic-4/support/screens';
import { BLOCKS } from '../epic-5/support/campaign';
import type { Schemas } from '../support/contract';
import { accountMenu, signIn, waitForSignIn } from '../support/screens';
import { CAMPAIGN_WORKFLOW } from './support/campaign';
import { expect, test, type Epic6 } from './support/fixtures';
import {
  errorGroups,
  executionPanel,
  executionsTable,
  expectStatus,
  finishRun,
  keyText,
  openExecutions,
  openTrigger,
  recordsSection,
  recordsTable,
  submitTrigger,
  traceDrawer,
  workflowId,
} from './support/screens';

type Execution = Schemas['Execution'];

/** The link of an execution in a list: "<workflow>, execução <8 first characters of the id>". */
const executionLink = (page: Page, execution: Execution) =>
  executionsTable(page).getByRole('button', { name: `${execution.workflow_name}, execução ${execution.id.slice(0, 8)}`, exact: true });

/** "Executar lote" of the campaign through the API, as the Admin (with the default period). */
async function triggerThroughApi(page: Page, apiOrigin: string): Promise<Execution> {
  const id = await workflowId(page, apiOrigin, CAMPAIGN_WORKFLOW);
  const draft = await callApi(page, apiOrigin, 'GET', `/v1/workflows/${id}/draft`);
  const revision = (draft.body as Schemas['Draft']).revision;
  const created = await callApi(page, apiOrigin, 'POST', `/v1/workflows/${id}/executions`, { revision, parameters: {} } satisfies Schemas['NewExecution']);
  expect(created.status, `disparar o lote pela API (${String(created.code)})`).toBe(202);
  return created.body as Execution;
}

/**
 * The Admin leaves two executions of the campaign: one finished "Com erros" and one still in the queue (in real mode the
 * worker runs it too), and signs out.
 */
async function prepareExecutions(page: Page, epic6: Epic6): Promise<{ finished: Execution; queued: Execution }> {
  const apiOrigin = await signInForApi(page, epic6.account('admin'));
  const finished = await triggerThroughApi(page, apiOrigin);
  finishRun(epic6, finished.id);
  const queued = await triggerThroughApi(page, apiOrigin);
  await accountMenu(page, 'Administradora Demonstração').click();
  await page.getByRole('menuitem', { name: 'Sair', exact: true }).click();
  await waitForSignIn(page);
  return { finished, queued };
}

test('o Operador dispara, acompanha, baixa o CSV e não vê o trace', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('operator'));
  await openOverview(page, CAMPAIGN_WORKFLOW);
  await expect(page.getByRole('button', { name: 'Ver execuções', exact: true })).toBeVisible();
  await openTrigger(page);
  expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);
  if (epic6.worker) await expect(panel.getByRole('button', { name: 'Cancelar execução', exact: true })).toBeEnabled();

  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Com erros');
  await expect(panel.getByRole('button', { name: 'Cancelar execução', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeEnabled();
  // Without `traces.view`: the error groups are only read, and there are no records nor trace.
  await expect(errorGroups(page)).toContainText('no_match');
  await expect(errorGroups(page).getByRole('button')).toHaveCount(0);
  await expect(recordsSection(page)).toHaveCount(0);

  await page.getByRole('button', { name: 'Voltar para execuções', exact: true }).click();
  const row = executionsTable(page).getByRole('row').filter({ hasText: 'Operador Demonstração' }).first();
  await expect(row).toContainText('Com erros');
  await expect(row).toContainText(CAMPAIGN_WORKFLOW);
});

test('o Aprovador vê as execuções e o painel, mas não dispara nem cancela', async ({ page, epic6 }) => {
  const { finished, queued } = await prepareExecutions(page, epic6);
  await signIn(page, epic6.account('approver'));

  await openOverview(page, CAMPAIGN_WORKFLOW);
  await expect(page.getByRole('heading', { level: 1, name: CAMPAIGN_WORKFLOW, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Executar lote', exact: true })).toHaveCount(0);
  await page.getByRole('button', { name: 'Ver execuções', exact: true }).click();
  await expect(executionsTable(page)).toHaveAccessibleName('Execuções do workflow');
  await expect(executionLink(page, finished)).toBeVisible();
  await expect(page.getByRole('button', { name: 'Executar lote', exact: true })).toHaveCount(0);

  await openExecutions(page);
  await executionLink(page, queued).click();
  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);
  await expect(panel).toBeVisible();
  if (epic6.worker) await expectStatus(page, epic6, panel, 'Na fila');
  await expect(panel.getByRole('button', { name: 'Cancelar execução', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Voltar para execuções', exact: true }).click();
  await executionLink(page, finished).click();
  await expectStatus(page, epic6, panel, 'Com erros');
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeEnabled();
  await expect(errorGroups(page).getByRole('button')).toHaveCount(0);
  await expect(recordsSection(page)).toHaveCount(0);
});

test('o Auditor vê os registros e o trace, mas não dispara nem cancela', async ({ page, epic6 }) => {
  const { finished, queued } = await prepareExecutions(page, epic6);
  await signIn(page, epic6.account('auditor'));

  await openOverview(page, CAMPAIGN_WORKFLOW);
  await expect(page.getByRole('heading', { level: 1, name: CAMPAIGN_WORKFLOW, exact: true })).toBeVisible();
  await expect(page.getByRole('button', { name: 'Executar lote', exact: true })).toHaveCount(0);

  await openExecutions(page);
  await executionLink(page, queued).click();
  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);
  await expect(panel).toBeVisible();
  await expect(panel.getByRole('button', { name: 'Cancelar execução', exact: true })).toHaveCount(0);

  await page.getByRole('button', { name: 'Voltar para execuções', exact: true }).click();
  await executionLink(page, finished).click();
  await expectStatus(page, epic6, panel, 'Com erros');
  await errorGroups(page).getByRole('button', { name: `${BLOCKS.product}, no_match: 2 registros. Filtrar os registros`, exact: true }).click();
  await expect(recordsTable(page).getByRole('row').filter({ hasText: 'no_match' })).toHaveCount(2);
  await recordsTable(page).getByRole('button', { name: `Abrir o trace de ${keyText({ nota_id: '5', item_seq: '3' })}`, exact: true }).click();
  await expect(traceDrawer(page)).toContainText('no_match');
  await expect(traceDrawer(page)).toContainText(BLOCKS.product);
});
