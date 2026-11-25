// Epic 7 · the overlap of a scope (fluxo 8, roteiro 7): on a copy of the "Campanha de referência" (its own scope, so the
// runs of epic 6 never meet it), the batch of February 2026 is triggered twice. The second "Executar lote" keeps the dialog
// open with the note of the scope already delivered and the execution of that scope; changing the period takes the note
// away, and with the same period again a second click confirms (`confirm_overlap`). The new execution says which one it
// ran again over, and its CSV comes with `revision` 2.
import { suffix } from '../epic-2/support/screens';
import { csvRows, downloadCsv, setPeriodDates, triggerDialog } from '../epic-6/support/screens';
import { dataMonthDays } from '../epic-6/support/campaign';
import { CAMPAIGN_WORKFLOW, DATA_MONTH } from './support/campaign';
import { expect, test } from './support/fixtures';
import { copyAsAdmin, executionPanel, expectStatus, finishRun, openTriggerFor, openWorkflow, overlapNote, submitTrigger } from './support/screens';

test('o segundo disparo do mesmo período avisa a sobreposição; confirmado, o CSV sai com a revisão 2', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Campanha sobreposição e2e ${suffix()}`;
  await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  await openWorkflow(page, name);

  await openTriggerFor(page);
  const first = await submitTrigger(page);
  expect(first.status(), 'o primeiro disparo').toBe(202);
  const panel = executionPanel(page, name);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Com erros');

  await openWorkflow(page, name);
  const dialog = await openTriggerFor(page);
  const refused = await submitTrigger(page);
  expect(refused.status(), 'o segundo disparo pede a confirmação').toBe(409);
  expect(((await refused.json()) as { code: string }).code).toBe('scope_already_delivered');
  await expect(dialog).toContainText('Este escopo já foi entregue');
  await expect(dialog).toContainText('Executar de novo entrega tudo outra vez, com uma revisão nova.');
  await expect(overlapNote(page).getByRole('listitem')).toHaveCount(1);
  await expect(overlapNote(page).getByRole('listitem')).toContainText('Com erros');
  await expect(overlapNote(page).getByRole('listitem')).toContainText(`por ${epic7.accountName('admin')}`);

  // Another period is another scope: the note goes away, and back to February it is asked again.
  await setPeriodDates(dialog, 'periodo', dataMonthDays(1, 5));
  await expect(overlapNote(page)).toHaveCount(0);
  await setPeriodDates(dialog, 'periodo', DATA_MONTH);
  expect((await submitTrigger(page)).status(), 'o mesmo escopo, de novo sem confirmar').toBe(409);
  await expect(overlapNote(page)).toBeVisible();

  const confirmed = await submitTrigger(page);
  expect(confirmed.status(), 'confirmar a sobreposição').toBe(202);
  expect(confirmed.request().postDataJSON()).toMatchObject({ confirm_overlap: true, parameters: { periodo: DATA_MONTH } });
  await expect(triggerDialog(page)).toHaveCount(0);
  await expect(panel).toContainText(/Executada de novo sobre a execução de \d{2}\/\d{2} às \d{2}:\d{2}/);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Com erros');

  const { text } = await downloadCsv(page, panel);
  const [header, ...lines] = csvRows(text);
  const revision = header!.indexOf('revision');
  expect(lines.length).toBeGreaterThan(0);
  expect(new Set(lines.map((line) => line[revision])), 'cada registro entregue de novo sai com a revisão 2').toEqual(new Set(['2']));
});
