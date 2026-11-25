// Epic 6 · cancelling an execution (fluxo 6 and roteiro 8): in the middle of the calculation, "Cancelar execução" asks
// for confirmation, the panel says the cancel was asked and the button waits with the reason; the worker stops at the end
// of the chunk under way and the execution ends "Cancelada", without CSV. A queued one is cancelled at once. Simulated
// mode only: the campaign is too small for a real worker to be caught in the middle (the real cancel is in the manual
// script, on the synthetic batch, and in the backend's tests).
import type { Locator, Page } from '@playwright/test';
import { openOverview } from '../epic-4/support/screens';
import { signIn } from '../support/screens';
import { CAMPAIGN_WORKFLOW } from './support/campaign';
import { expect, test } from './support/fixtures';
import { executionPanel, expectStatus, openTriggerForDataMonth, phase, phases, stepRun, submitTriggerConfirmingOverlap } from './support/screens';

/** "Cancelar execução" and the confirmation; returns the `POST …/cancel` response. */
async function cancelExecution(page: Page, panel: Locator) {
  await panel.getByRole('button', { name: 'Cancelar execução', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Cancelar execução', exact: true });
  await expect(dialog).toContainText('Os registros já calculados não são entregues e a execução não gera CSV.');
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/executions\/[^/]+\/cancel$/.test(new URL(r.url()).pathname)),
    dialog.getByRole('button', { name: 'Cancelar execução', exact: true }).click(),
  ]);
  await expect(dialog).toHaveCount(0);
  return response;
}

test.beforeEach(({ epic6 }) => {
  test.skip(epic6.mode === 'real', 'O lote da campanha termina antes de dar tempo de cancelar; o cancelamento real é do roteiro manual, com o lote sintético.');
});

test('cancelar no meio do cálculo para no fim do chunk e a execução termina Cancelada, sem CSV', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('admin'));
  await openOverview(page, CAMPAIGN_WORKFLOW);
  await openTriggerForDataMonth(page);
  expect((await submitTriggerConfirmingOverlap(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);

  // Carga, the batch counted and the first chunk calculated.
  stepRun(epic6);
  stepRun(epic6);
  stepRun(epic6);
  await expect(phases(page).getByRole('progressbar', { name: 'Registros calculados' })).toHaveAttribute('aria-valuetext', '25 de 58 registros · 43%');

  const response = await cancelExecution(page, panel);
  expect(response.status(), 'pedir o cancelamento').toBe(202);
  await expect(panel).toContainText('Cancelamento pedido');
  await expect(panel.getByRole('button', { name: 'Cancelar execução', exact: true })).toBeDisabled();
  await expect(panel).toContainText('O cancelamento já foi pedido');

  // The worker stops at the end of the chunk under way.
  stepRun(epic6);
  await expectStatus(page, epic6, panel, 'Cancelada');
  await expect(phase(page, 'Cálculo')).toContainText('interrompida');
  await expect(panel.getByRole('button', { name: 'Cancelar execução', exact: true })).toHaveCount(0);
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
  await expect(panel).toContainText('Execução cancelada não entrega CSV');
});

test('uma execução na fila é cancelada na hora', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('admin'));
  await openOverview(page, CAMPAIGN_WORKFLOW);
  await openTriggerForDataMonth(page);
  expect((await submitTriggerConfirmingOverlap(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);
  await expectStatus(page, epic6, panel, 'Na fila');

  const response = await cancelExecution(page, panel);
  expect(((await response.json()) as { status: string }).status).toBe('cancelled');
  await expectStatus(page, epic6, panel, 'Cancelada');
  await expect(phase(page, 'Carga')).toContainText('interrompida');
  await expect(phase(page, 'Cálculo')).toContainText('a fazer');
});
