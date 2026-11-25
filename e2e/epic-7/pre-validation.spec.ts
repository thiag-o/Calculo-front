// Epic 7 · the pre-validation (fluxos 6 and 7, roteiro 9 and 10): the "Campanha de referência — vazios" (a copy of it, so
// the runs of other tests never cross its scope) stops in "Aguardando decisão", with the alert of `quantidade` (2 of 9
// records empty, 22,22 % over the limit of 1 %) and the empty row counted; Prosseguir goes on to the end. Run again over
// the same period, the overlap is confirmed and Cancelar cancels it in the alert. The "Campanha de referência — defeitos"
// (a copy) is blocked by the repeated key, without calculating anything.
import { suffix } from '../epic-2/support/screens';
import { DEFECTS_WORKFLOW, EMPTIES_ALERT, EMPTIES_WORKFLOW } from './support/campaign';
import { expect, test } from './support/fixtures';
import {
  copyAsAdmin,
  decisionNote,
  executionPanel,
  expectStatus,
  finishRun,
  keyText,
  openTriggerFor,
  openWorkflow,
  pairValue,
  panelStatus,
  phase,
  preValidationBox,
  sourcesSection,
  submitTrigger,
  total,
  triggerConfirmingOverlap,
} from './support/screens';

/** "22,22%": the percent of the API ("22.22") as the panel writes it. */
const percent = (value: string) => `${value.replace('.', ',').replace(/,?0+$/, '')}%`;

test('a campanha de vazios para em Aguardando decisão com o alerta de quantidade; Prosseguir conclui, e outra execução é cancelada no alerta', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Campanha vazios e2e ${suffix()}`;
  await copyAsAdmin(page, epic7, EMPTIES_WORKFLOW, name);
  await openWorkflow(page, name);

  await openTriggerFor(page);
  expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, name);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Aguardando decisão');

  const note = decisionNote(page);
  await expect(note).toContainText('A pré-validação encontrou campos vazios acima do limite.');
  await expect(note.getByRole('list', { name: 'Campos vazios acima do limite' })).toHaveText(
    `${EMPTIES_ALERT.variable}: ${percent(EMPTIES_ALERT.percent)} vazios, limite ${percent(EMPTIES_ALERT.alertPercent)}`,
  );
  await expect(note).toContainText(/Sem resposta até \d{2}\/\d{2} às \d{2}:\d{2}, a execução é cancelada\./);
  await expect(phase(page, 'Pré-validação')).toContainText('aguardando decisão');
  await expect(phase(page, 'Cálculo')).toContainText('a fazer');

  const check = preValidationBox(page);
  await expect(check).toContainText('Com alerta');
  await expect(pairValue(check, 'Registros')).toHaveText(String(EMPTIES_ALERT.records));
  await expect(pairValue(check, 'Linhas vazias')).toHaveText(String(EMPTIES_ALERT.emptyRows));
  await expect(pairValue(check, 'Chaves nulas')).toHaveText('0');
  await expect(pairValue(check, 'Chaves repetidas')).toHaveText('0');
  await expect(check.getByRole('list', { name: 'Vazios por variável' }).getByRole('listitem').filter({ hasText: EMPTIES_ALERT.variable })).toContainText(
    `${EMPTIES_ALERT.empty} vazios · ${percent(EMPTIES_ALERT.percent)}`,
  );

  // Prosseguir: the execution goes back to the queue and calculates.
  const [proceed] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && /^\/v1\/executions\/[^/]+\/proceed$/.test(new URL(r.url()).pathname)),
    note.getByRole('button', { name: 'Prosseguir', exact: true }).click(),
  ]);
  expect(proceed.status(), 'prosseguir').toBe(202);
  finishRun(epic7);
  await expect(panelStatus(panel)).toHaveText(/^(Entregue|Com erros)$/, epic7.mode === 'real' ? { timeout: 120_000 } : { timeout: 10_000 });
  await expect(decisionNote(page)).toHaveCount(0);
  await expect(pairValue(preValidationBox(page), 'Decisão')).toContainText(`Prosseguir · ${epic7.accountName('admin')} em `);
  // The empty row is read and ignored (`empty_row`); the counts of the Fonte blocks come with the calculation.
  await expect(total(page, 'Ignorados')).toHaveText(String(EMPTIES_ALERT.emptyRows));
  await expect(sourcesSection(page)).toContainText('Nota');

  // The same period again: the overlap is confirmed, and Cancelar in the alert cancels the new execution.
  await openWorkflow(page, name);
  await openTriggerFor(page);
  const again = await triggerConfirmingOverlap(page);
  expect(again.overlap_of, 'a execução confirmada aponta a anterior').not.toBeNull();
  await expect(panel).toContainText(/Executada de novo sobre a execução de \d{2}\/\d{2} às \d{2}:\d{2}/);
  finishRun(epic7, again.id);
  await expectStatus(page, epic7, panel, 'Aguardando decisão');
  await decisionNote(page).getByRole('button', { name: 'Cancelar', exact: true }).click();
  const confirm = page.getByRole('dialog', { name: 'Cancelar execução', exact: true });
  await confirm.getByRole('button', { name: 'Cancelar execução', exact: true }).click();
  await expectStatus(page, epic7, panel, 'Cancelada');
  await expect(pairValue(preValidationBox(page), 'Decisão')).toContainText(`Cancelar · ${epic7.accountName('admin')} em `);
  await expect(phase(page, 'Pré-validação')).toContainText('interrompida');
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
});

test('a campanha de defeitos é bloqueada na pré-validação pela chave repetida, sem calcular nada', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 240_000 : 60_000);
  const name = `Campanha defeitos bloqueada e2e ${suffix()}`;
  await copyAsAdmin(page, epic7, DEFECTS_WORKFLOW, name);
  await openWorkflow(page, name);
  await openTriggerFor(page);
  expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, name);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Abortada');

  await expect(panel).toContainText('Execução abortada');
  await expect(panel).toContainText('duplicate_record_key');
  await expect(panel).toContainText('1 chave se repete no lote. Exemplos:');
  await expect(panel.getByRole('list', { name: 'Chaves repetidas: exemplos' }).first()).toHaveText(keyText({ nota_id: '4', item_seq: '2' }));
  await expect(phase(page, 'Pré-validação')).toContainText('interrompida');
  await expect(phase(page, 'Cálculo')).toContainText('a fazer');

  const check = preValidationBox(page);
  await expect(check).toContainText('Bloqueada');
  await expect(pairValue(check, 'Registros')).toHaveText('8');
  await expect(pairValue(check, 'Chaves repetidas')).toHaveText('1');
  await expect(pairValue(check, 'Chaves nulas')).toHaveText('1');
  // Nothing was calculated: no total, no error group, no CSV.
  await expect(total(page, 'Lidos')).toHaveText('0');
  await expect(page.getByRole('region', { name: 'Erros agrupados', exact: true })).toContainText('Nenhum registro com erro.');
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
});
