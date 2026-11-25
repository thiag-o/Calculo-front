// Epic 7 · the bell (fluxo 11, roteiro 12): the alerts of an execution aborted (the defects, blocked by the repeated key),
// of an execution with errors (the campaign of February 2026) and of a scheduled execution that went on with the alert of
// the pre-validation (the empties, scheduled: no one decides, E7-3). Opening one marks it read and opens the execution;
// "Marcar todos como lidos" marks the others. Each workflow is a copy (its own scope and its own name in the alerts); the
// executions and the schedule are prepared through the API, as the Admin.
import type { Page } from '@playwright/test';
import { callApi, suffix } from '../epic-2/support/screens';
import { copyWorkflow, workflowId } from '../epic-6/support/screens';
import type { Schemas } from '../support/contract';
import { signInForApi } from '../epic-4/support/screens';
import { CAMPAIGN_WORKFLOW, DATA_MONTH, DATA_MONTH_FIXED, DEFECTS_WORKFLOW, EMPTIES_ALERT, EMPTIES_WORKFLOW, nextMinute } from './support/campaign';
import { expect, test, type Epic7 } from './support/fixtures';
import { alertItem, alertsPopover, bellButton, executionPanel, expectStatus, untilShown, REAL_SCHEDULE_TIMEOUT } from './support/screens';

/** The saved revision of a workflow, through the API. */
async function revisionOf(page: Page, apiOrigin: string, id: string): Promise<number> {
  const draft = await callApi(page, apiOrigin, 'GET', `/v1/workflows/${id}/draft`);
  return (draft.body as Schemas['Draft']).revision;
}

/** "Executar lote" of a copy with the data month, through the API; the simulated worker takes it to the end. */
async function triggerThroughApi(page: Page, epic7: Epic7, apiOrigin: string, name: string): Promise<void> {
  const id = await workflowId(page, apiOrigin, name);
  const created = await callApi(page, apiOrigin, 'POST', `/v1/workflows/${id}/executions`, {
    revision: await revisionOf(page, apiOrigin, id),
    parameters: { periodo: DATA_MONTH },
    confirm_overlap: false,
  } satisfies Schemas['NewExecution']);
  expect(created.status, `disparar ${name} pela API (${String(created.code)})`).toBe(202);
  epic7.worker?.finish((created.body as Schemas['Execution']).id);
}

/** A daily schedule of a copy for the next minute, through the API; the simulated scheduler fires it. */
async function scheduleThroughApi(page: Page, epic7: Epic7, apiOrigin: string, name: string, schedule: string): Promise<void> {
  const id = await workflowId(page, apiOrigin, name);
  const created = await callApi(page, apiOrigin, 'POST', `/v1/workflows/${id}/schedules`, {
    revision: await revisionOf(page, apiOrigin, id),
    name: schedule,
    enabled: true,
    recurrence: { kind: 'daily', time: nextMinute() },
    parameters: { periodo: DATA_MONTH_FIXED },
  } satisfies Schemas['ScheduleData']);
  expect(created.status, `agendar ${name} pela API (${String(created.code)})`).toBe(201);
  epic7.trackSchedule(page, apiOrigin, (created.body as Schemas['Schedule']).id);
  if (epic7.scheduler && epic7.worker) {
    epic7.scheduler.fire(schedule);
    epic7.worker.finish();
  }
}

/** The unread count in the name of the bell ("Alertas, 3 não lidos"). */
async function unread(page: Page): Promise<number> {
  const label = (await bellButton(page).getAttribute('aria-label')) ?? '';
  const match = /Alertas, (\d+) não lidos?/.exec(label);
  return match ? Number(match[1]) : 0;
}

test('o sino mostra os alertas de uma execução abortada, de uma com erros e de uma agendada que seguiu com alerta; abrir um e marcar todos como lidos', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 600_000 : 120_000);
  const id = suffix();
  const aborted = `Defeitos no sino e2e ${id}`;
  const withErrors = `Campanha no sino e2e ${id}`;
  const scheduled = `Vazios no sino e2e ${id}`;
  const schedule = 'Vazios de fevereiro';
  const apiOrigin = await signInForApi(page, epic7.account('admin'));
  await copyWorkflow(page, apiOrigin, DEFECTS_WORKFLOW, aborted);
  await copyWorkflow(page, apiOrigin, CAMPAIGN_WORKFLOW, withErrors);
  await copyWorkflow(page, apiOrigin, EMPTIES_WORKFLOW, scheduled);
  await triggerThroughApi(page, epic7, apiOrigin, aborted);
  await triggerThroughApi(page, epic7, apiOrigin, withErrors);
  await scheduleThroughApi(page, epic7, apiOrigin, scheduled, schedule);

  const abortedAlert = alertItem(page, `${aborted}: A chave do registro se repete no lote.`);
  const errorsAlert = alertItem(page, new RegExp(`^.*${withErrors}: \\d+ registros? com erro\\. O CSV tem só os registros sem erro\\.`));
  const preValidationAlert = alertItem(page, `${scheduled}: a execução agendada seguiu com campos vazios acima do limite (${EMPTIES_ALERT.variable}).`);
  await untilShown(
    page,
    epic7,
    async () => {
      await bellButton(page).click();
      await expect(preValidationAlert).toBeVisible({ timeout: 5_000 });
      await expect(abortedAlert).toBeVisible({ timeout: 1_000 });
      await expect(errorsAlert).toBeVisible({ timeout: 1_000 });
    },
    REAL_SCHEDULE_TIMEOUT,
  );
  await expect(abortedAlert).toContainText('Execução abortada');
  await expect(errorsAlert).toContainText('Execução com erros');
  await expect(preValidationAlert).toContainText('Alerta na pré-validação');
  for (const alert of [abortedAlert, errorsAlert, preValidationAlert]) await expect(alert).toContainText('não lido');

  // Opening an alert marks it read and opens its execution.
  await page.keyboard.press('Escape');
  await expect(alertsPopover(page)).toHaveCount(0);
  const before = await unread(page);
  expect(before, 'os três alertas, sem ler').toBeGreaterThanOrEqual(3);
  await bellButton(page).click();
  const [read] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/v1/notifications/read'),
    abortedAlert.getByRole('button', { name: 'Abrir execução', exact: true }).click(),
  ]);
  expect(read.status(), 'marcar o alerta como lido').toBe(204);
  expect(read.request().postDataJSON()).toEqual({ ids: [expect.any(String)] });
  const panel = executionPanel(page, aborted);
  await expectStatus(page, epic7, panel, 'Abortada');
  if (epic7.mode === 'simulated') await expect.poll(() => unread(page)).toBe(before - 1);
  await bellButton(page).click();
  await expect(abortedAlert).not.toContainText('não lido');
  await expect(errorsAlert).toContainText('não lido');

  // "Marcar todos como lidos": nothing left unread.
  const [all] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/v1/notifications/read'),
    alertsPopover(page).getByRole('button', { name: 'Marcar todos como lidos', exact: true }).click(),
  ]);
  expect(all.request().postDataJSON()).toEqual({ all: true });
  for (const alert of [abortedAlert, errorsAlert, preValidationAlert]) await expect(alert).not.toContainText('não lido');
  if (epic7.mode === 'simulated') {
    await expect(bellButton(page)).toHaveAttribute('aria-label', 'Alertas, nenhum não lido');
    await expect(alertsPopover(page).getByRole('button', { name: 'Marcar todos como lidos', exact: true })).toHaveAttribute('aria-disabled', 'true');
  }
});
