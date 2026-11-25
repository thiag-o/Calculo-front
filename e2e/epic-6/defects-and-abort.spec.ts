// Epic 6 · the defects of the batch (fluxo 5 and roteiro 7): the "Campanha de referência — defeitos" of `prepare-local`
// shows the null key and the repeated key as errors of the batch key, without trace; 2 errors in 8 records pass the default
// limit of 5 %, so the execution ends "Abortada" without CSV; on a copy with the error limit at 0 % (Execução section of
// the workflow), it aborts by the limit the same way, says why and what to do. Both fire with the data month (February 2026).
//
// Real mode, since epic 7 (F132): the backend's pre-validation blocks a batch with a repeated key before calculating
// anything (E7-2), so the defects end "Abortada" by `duplicate_record_key`, with no record calculated; and the limit of 0 %
// is proven on a copy of the "Campanha de referência" (its 2 errors of February, P14 without a product). A trigger that
// repeats a scope already delivered in the same workflow (`409 scope_already_delivered`, E7-6) confirms the overlap. The
// simulated mode keeps the epic 6 simulation, which has no pre-validation (the epic 7 flows are in e2e/epic-7/).
import { suffix } from '../epic-2/support/screens';
import { draftSaved, openOverview, signInForApi } from '../epic-4/support/screens';
import { openEditor } from '../epic-5/support/screens';
import { signIn } from '../support/screens';
import type { Page, Response } from '@playwright/test';
import { CAMPAIGN_WORKFLOW, DEFECTS_WORKFLOW } from './support/campaign';
import { DEFECTS_TOTALS } from './support/expected';
import { expect, test } from './support/fixtures';
import {
  copyWorkflow,
  errorGroups,
  executionPanel,
  expectStatus,
  finishRun,
  keyText,
  openTriggerForDataMonth,
  phase,
  recordsTable,
  submitTrigger,
  total,
  triggerDialog,
  workflowPanel,
} from './support/screens';

/**
 * "Executar lote" in the dialog; when the backend says the scope was already delivered (`409 scope_already_delivered`,
 * epic 7, only in real mode: a database that kept an earlier run of the same workflow and period), it confirms the overlap
 * with a second click, which sends `confirm_overlap`.
 */
async function submitConfirmingOverlap(page: Page): Promise<Response> {
  const first = await submitTrigger(page);
  if (first.status() !== 409) return first;
  expect(((await first.json()) as { code: string }).code, 'o único 409 aceito é o da sobreposição').toBe('scope_already_delivered');
  await expect(triggerDialog(page).getByRole('list', { name: 'Execuções do mesmo escopo', exact: true })).toBeVisible();
  return submitTrigger(page);
}

test('a campanha de defeitos mostra a chave nula e a repetida como erros da chave do lote, sem trace', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('admin'));
  await openOverview(page, DEFECTS_WORKFLOW);
  await openTriggerForDataMonth(page);
  expect((await submitConfirmingOverlap(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, DEFECTS_WORKFLOW);
  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Abortada');

  if (epic6.mode === 'real') {
    // The pre-validation blocked the batch by the repeated key 4/2: nothing calculated, no error group, no CSV.
    await expect(panel).toContainText('duplicate_record_key');
    await expect(panel).toContainText('1 chave se repete no lote. Exemplos:');
    await expect(panel.getByRole('list', { name: 'Chaves repetidas: exemplos' }).first()).toHaveText(keyText({ nota_id: '4', item_seq: '2' }));
    const check = page.getByRole('region', { name: 'Pré-validação', exact: true });
    await expect(check).toContainText('Bloqueada');
    await expect(total(page, 'Lidos')).toHaveText('0');
    await expect(errorGroups(page)).toContainText('Nenhum registro com erro.');
    await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
    return;
  }

  await expect(total(page, 'Lidos')).toHaveText(String(DEFECTS_TOTALS.read));
  await expect(total(page, 'Com erro')).toHaveText(String(DEFECTS_TOTALS.errors));

  const groups = errorGroups(page);
  await expect(groups.getByRole('button', { name: 'Chave do lote, duplicate_record_key: 1 registro. Filtrar os registros', exact: true })).toBeVisible();
  const nullKey = groups.getByRole('button', { name: 'Chave do lote, null_record_key: 1 registro. Filtrar os registros', exact: true });
  const [response] = await Promise.all([
    page.waitForResponse((r) => /\/v1\/executions\/[^/]+\/records$/.test(new URL(r.url()).pathname) && new URL(r.url()).searchParams.get('code') === 'null_record_key'),
    nullKey.click(),
  ]);
  // A group without a node filters by `without_node` and the code (B154).
  expect(new URL(response.url()).searchParams.get('without_node')).toBe('true');
  const row = recordsTable(page).getByRole('row').filter({ hasText: 'null_record_key' });
  await expect(row).toHaveCount(1);
  await expect(row).toContainText(keyText({ nota_id: null, item_seq: '1' }));
  await expect(row).toContainText('Sem trace: o registro não foi calculado');
  await expect(row.getByRole('button')).toHaveCount(0);

  await groups.getByRole('button', { name: /^Chave do lote, duplicate_record_key/ }).click();
  const repeated = recordsTable(page).getByRole('row').filter({ hasText: 'duplicate_record_key' });
  await expect(repeated).toHaveCount(1);
  await expect(repeated).toContainText(keyText({ nota_id: '4', item_seq: '2' }));
  // The limit passed (25 % over 5 %): nothing is delivered.
  await expect(panel).toContainText('error_limit_exceeded');
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
});

test('com o limite de erro em 0%, a execução aborta pelo limite e não entrega CSV', async ({ page, epic6 }) => {
  test.setTimeout(90_000);
  const name = `Defeitos limite zero e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic6.account('admin'));
  // Real mode: a copy of the defects would stop at the pre-validation (repeated key); the campaign reaches the limit.
  await copyWorkflow(page, apiOrigin, epic6.mode === 'real' ? CAMPAIGN_WORKFLOW : DEFECTS_WORKFLOW, name);
  await openOverview(page, name);
  await openEditor(page, name);

  // The Execução section of the workflow panel: the error limit, in percent.
  const saved = draftSaved(page, (definition) => definition.settings.error_limit_percent === '0');
  const limit = workflowPanel(page).getByRole('textbox', { name: 'Limite de erro (%)', exact: true });
  await limit.fill('0');
  await saved;

  // "Executar lote" in the editor bar runs the saved draft.
  await openTriggerForDataMonth(page, page.getByRole('region', { name: `Editor de ${name}`, exact: true }));
  const response = await submitConfirmingOverlap(page);
  expect(response.status(), 'disparar o lote').toBe(202);
  expect(((await response.json()) as { error_limit_percent: string }).error_limit_percent).toBe('0');
  const panel = executionPanel(page, name);
  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Abortada');

  await expect(panel).toContainText('Execução abortada');
  await expect(panel).toContainText('error_limit_exceeded');
  await expect(panel).toContainText('Os erros passaram do limite de erro do workflow. Nada foi entregue.');
  await expect(panel).toContainText('Veja os erros agrupados abaixo');
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
  await expect(panel).toContainText('Execução abortada não entrega CSV');
  // Real mode: where the limit stops the run (the early check of a chunk or the final one) depends on the chunk size.
  if (epic6.mode === 'real') return;
  // The 8 records are calculated in one chunk, so the final check over the errors is what stops the run: the delivery.
  await expect(phase(page, 'Cálculo')).toContainText('concluída');
  await expect(phase(page, 'Entrega')).toContainText('interrompida');
  await expect(errorGroups(page)).toContainText('duplicate_record_key');
});
