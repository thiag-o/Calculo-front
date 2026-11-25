// Epic 7 · by role (fluxo 12, roteiro 13): the Operador schedules and decides on the alert of the batch; the Configurador
// uploads the reference file and simulates; the Aprovador simulates and sees the diff, without scheduling; the Auditor sees
// all of it (the files, the comparison, the schedules and the bell) without changing anything. The Admin prepares, in a
// browser of their own (`epic7.newPage()`), the copies of the workflows and what each role looks at.
import type { Page } from '@playwright/test';
import { callApi, mainNavigation, suffix } from '../epic-2/support/screens';
import { signInForApi } from '../epic-4/support/screens';
import { copyWorkflow, workflowId } from '../epic-6/support/screens';
import type { Schemas } from '../support/contract';
import { signIn } from '../support/screens';
import { CAMPAIGN_WORKFLOW, DATA_MONTH_FIXED, EMPTIES_WORKFLOW, farTime } from './support/campaign';
import { expect, test, type Epic7 } from './support/fixtures';
import { REFERENCE_FILE_NAME, campaignReferenceFile, changedFile } from './support/reference-file';
import {
  alertsPopover,
  bellButton,
  comparisonSection,
  comparisonTable,
  createSchedule,
  decisionNote,
  executionPanel,
  expectStatus,
  finishRun,
  openSchedules,
  openTriggerFor,
  openWorkflowItem,
  panelStatus,
  referenceFileRow,
  scheduleRow,
  simulate,
  submitTrigger,
  uploadReferenceFile,
} from './support/screens';

/** The Admin, in a browser of their own, with the API origin for the preparations. */
async function adminPage(epic7: Epic7): Promise<{ admin: Page; apiOrigin: string }> {
  const admin = await epic7.newPage();
  const apiOrigin = await signInForApi(admin, epic7.account('admin'));
  return { admin, apiOrigin };
}

/** The upload area exists only with `test_cases.edit`. */
const uploadArea = (page: Page) => page.getByRole('group', { name: 'Área para soltar o arquivo de referência', exact: true });

test('o Operador agenda e decide o alerta do lote, sem enviar arquivo de referência', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Vazios do Operador e2e ${suffix()}`;
  const { admin, apiOrigin } = await adminPage(epic7);
  await copyWorkflow(admin, apiOrigin, EMPTIES_WORKFLOW, name);

  await signIn(page, epic7.account('operator'));
  await openSchedules(page, name);
  await createSchedule(page, epic7, { name: 'Vazios do Operador', time: farTime(), period: 'previous_month' });
  await expect(scheduleRow(page, 'Vazios do Operador').getByRole('button', { name: 'Mais ações para Vazios do Operador', exact: true })).toBeVisible();

  // Inside the workflow, the sidebar is its menu: back to its Visão geral.
  await mainNavigation(page).getByRole('link', { name: 'Visão geral', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name, exact: true })).toBeVisible();
  await openTriggerFor(page);
  expect((await submitTrigger(page)).status(), 'o Operador dispara o lote').toBe(202);
  const panel = executionPanel(page, name);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Aguardando decisão');
  await decisionNote(page).getByRole('button', { name: 'Prosseguir', exact: true }).click();
  finishRun(epic7);
  await expect(panelStatus(panel)).toHaveText(/^(Entregue|Com erros)$/, epic7.mode === 'real' ? { timeout: 120_000 } : { timeout: 10_000 });

  // Testes: the list, without the upload (no `test_cases.edit`) and without "Simular" (no `simulations.run`).
  await openWorkflowItem(page, name, 'Testes');
  await expect(page.getByText('Quem edita os testes deste workflow ainda não enviou nenhum arquivo.', { exact: true })).toBeVisible();
  await expect(uploadArea(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Enviar arquivo', exact: true })).toHaveCount(0);
});

test('o Configurador envia o arquivo de referência e simula, sem agendar', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Campanha do Configurador e2e ${suffix()}`;
  const { admin, apiOrigin } = await adminPage(epic7);
  await copyWorkflow(admin, apiOrigin, CAMPAIGN_WORKFLOW, name);

  await signIn(page, epic7.account('configurator'));
  await openWorkflowItem(page, name, 'Testes');
  expect((await uploadReferenceFile(page, REFERENCE_FILE_NAME, campaignReferenceFile(epic7.mode))).status(), 'o Configurador envia o arquivo').toBe(201);
  await simulate(page, REFERENCE_FILE_NAME);
  const panel = executionPanel(page, name);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Com erros');
  await expect(comparisonSection(page)).toContainText('100% iguais');
  await expect(comparisonTable(page)).toContainText('Nenhuma divergência');

  await openSchedules(page, name);
  await expect(page.getByRole('button', { name: 'Novo agendamento', exact: true })).toHaveCount(0);
  await expect(page.getByText('Quem agenda lotes no tenant ainda não agendou este workflow.', { exact: true })).toBeVisible();
});

test('o Aprovador simula e vê o diff, sem enviar arquivo nem agendar', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Campanha do Aprovador e2e ${suffix()}`;
  const changed = changedFile(campaignReferenceFile(epic7.mode));
  const fileName = 'expected-alterado.csv';
  const { admin, apiOrigin } = await adminPage(epic7);
  await copyWorkflow(admin, apiOrigin, CAMPAIGN_WORKFLOW, name);
  await openWorkflowItem(admin, name, 'Testes');
  expect((await uploadReferenceFile(admin, fileName, changed.text)).status(), 'o Admin envia o arquivo').toBe(201);

  await signIn(page, epic7.account('approver'));
  await openWorkflowItem(page, name, 'Testes');
  await expect(referenceFileRow(page, fileName)).toBeVisible();
  await expect(uploadArea(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Mais ações para o arquivo ${fileName}`, exact: true })).toHaveCount(0);
  await simulate(page, fileName);
  const panel = executionPanel(page, name);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Com erros');
  await expect(comparisonTable(page).getByRole('row').filter({ hasText: 'diferente' })).toHaveCount(1);
  await expect(comparisonTable(page).getByRole('row').filter({ hasText: 'fora do arquivo' })).toHaveCount(1);

  await openSchedules(page, name);
  await expect(page.getByRole('button', { name: 'Novo agendamento', exact: true })).toHaveCount(0);
});

test('o Auditor vê os arquivos, a comparação, os agendamentos e o sino, sem mudar nada', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Campanha do Auditor e2e ${suffix()}`;
  const schedule = 'Conferência do Auditor';
  const { admin, apiOrigin } = await adminPage(epic7);
  await copyWorkflow(admin, apiOrigin, CAMPAIGN_WORKFLOW, name);
  await openWorkflowItem(admin, name, 'Testes');
  expect((await uploadReferenceFile(admin, REFERENCE_FILE_NAME, campaignReferenceFile(epic7.mode))).status(), 'o Admin envia o arquivo').toBe(201);
  await simulate(admin, REFERENCE_FILE_NAME);
  finishRun(epic7);
  await expectStatus(admin, epic7, executionPanel(admin, name), 'Com erros');
  const id = await workflowId(admin, apiOrigin, name);
  const draft = await callApi(admin, apiOrigin, 'GET', `/v1/workflows/${id}/draft`);
  const created = await callApi(admin, apiOrigin, 'POST', `/v1/workflows/${id}/schedules`, {
    revision: (draft.body as Schemas['Draft']).revision,
    name: schedule,
    enabled: true,
    recurrence: { kind: 'daily', time: farTime() },
    parameters: { periodo: DATA_MONTH_FIXED },
  } satisfies Schemas['ScheduleData']);
  expect(created.status, `agendar pela API (${String(created.code)})`).toBe(201);
  epic7.trackSchedule(admin, apiOrigin, (created.body as Schemas['Schedule']).id);

  await signIn(page, epic7.account('auditor'));
  await openWorkflowItem(page, name, 'Testes');
  const row = referenceFileRow(page, REFERENCE_FILE_NAME);
  await expect(uploadArea(page)).toHaveCount(0);
  await expect(page.getByRole('button', { name: `Simular com ${REFERENCE_FILE_NAME}`, exact: true })).toHaveCount(0);
  await row.getByRole('button', { name: `100% iguais, abrir a simulação de ${REFERENCE_FILE_NAME}`, exact: true }).click();
  const panel = executionPanel(page, name);
  await expect(comparisonSection(page)).toContainText('100% iguais');
  await expect(comparisonTable(page)).toContainText('Nenhuma divergência');
  await expect(panel.getByRole('button', { name: 'Cancelar execução', exact: true })).toHaveCount(0);

  await openSchedules(page, name);
  const scheduled = scheduleRow(page, schedule);
  await expect(scheduled).toContainText('Ativo');
  await expect(scheduled.getByRole('switch')).toHaveCount(0);
  await expect(scheduled.getByRole('button', { name: `Mais ações para ${schedule}`, exact: true })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Novo agendamento', exact: true })).toHaveCount(0);

  await bellButton(page).click();
  await expect(alertsPopover(page)).toBeVisible();
});
