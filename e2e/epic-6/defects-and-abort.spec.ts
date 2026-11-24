// Epic 6 · the defects of the batch (fluxo 5 and roteiro 7): the "Campanha de referência — defeitos" of `prepare-local`
// shows the null key and the repeated key as errors of the batch key, without trace, and ends "Com erros" (under the
// limit); on a copy with the error limit at 0 % (Execução section of the workflow), the execution aborts by the limit,
// says why and what to do, and has no CSV.
import { suffix } from '../epic-2/support/screens';
import { draftSaved, openOverview, signInForApi } from '../epic-4/support/screens';
import { openEditor } from '../epic-5/support/screens';
import { signIn } from '../support/screens';
import { DEFECTS_WORKFLOW } from './support/campaign';
import { DEFECTS_TOTALS } from './support/expected';
import { expect, test } from './support/fixtures';
import {
  copyWorkflow,
  errorGroups,
  executionPanel,
  expectStatus,
  finishRun,
  keyText,
  openTrigger,
  phase,
  recordsTable,
  submitTrigger,
  total,
  workflowPanel,
} from './support/screens';

test('a campanha de defeitos mostra a chave nula e a repetida como erros da chave do lote, sem trace', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('admin'));
  await openOverview(page, DEFECTS_WORKFLOW);
  await openTrigger(page);
  expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, DEFECTS_WORKFLOW);
  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Com erros');
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
  await expect(repeated).toContainText(keyText({ nota_id: '1', item_seq: '1' }));
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeEnabled();
});

test('com o limite de erro em 0%, a execução aborta pelo limite e não entrega CSV', async ({ page, epic6 }) => {
  test.setTimeout(90_000);
  const name = `Defeitos limite zero e2e ${suffix()}`;
  const apiOrigin = await signInForApi(page, epic6.account('admin'));
  await copyWorkflow(page, apiOrigin, DEFECTS_WORKFLOW, name);
  await openOverview(page, name);
  await openEditor(page, name);

  // The Execução section of the workflow panel: the error limit, in percent.
  const saved = draftSaved(page, (definition) => definition.settings.error_limit_percent === '0');
  const limit = workflowPanel(page).getByRole('textbox', { name: 'Limite de erro (%)', exact: true });
  await limit.fill('0');
  await saved;

  // "Executar lote" in the editor bar runs the saved draft.
  await openTrigger(page, page.getByRole('region', { name: `Editor de ${name}`, exact: true }));
  const response = await submitTrigger(page);
  expect(response.status(), 'disparar o lote').toBe(202);
  expect(((await response.json()) as { error_limit_percent: string }).error_limit_percent).toBe('0');
  const panel = executionPanel(page, name);
  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Abortada');

  await expect(panel).toContainText('Execução abortada');
  await expect(panel).toContainText('error_limit_exceeded');
  await expect(panel).toContainText('Os erros passaram do limite de erro do workflow. Nada foi entregue.');
  await expect(panel).toContainText('Veja os erros agrupados abaixo');
  await expect(phase(page, 'Cálculo')).toContainText('interrompida');
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
  await expect(panel).toContainText('Execução abortada não entrega CSV');
  await expect(errorGroups(page)).toContainText('duplicate_record_key');
});
