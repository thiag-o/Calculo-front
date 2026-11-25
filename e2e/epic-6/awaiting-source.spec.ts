// Epic 6 · an execution waiting for its source (brief of F105; E6-8): with the batch source down in the middle of the
// calculation, the execution goes to `awaiting_source` ("Aguardando fonte", the phase "aguardando a fonte" and the time
// of the next attempt), keeps what it already calculated and, with the source back, goes on until the end. And the panel
// refresh stops on an error (ADR 0067): the last data stays on screen with "Tentar de novo", which brings it back.
// Simulated mode only: taking a real source down is not something a test can do to the shared environment.
import { openOverview } from '../epic-4/support/screens';
import { signIn } from '../support/screens';
import { CAMPAIGN_WORKFLOW } from './support/campaign';
import { WHOLE_MONTH } from './support/expected';
import { expect, test } from './support/fixtures';
import { executionPanel, expectStatus, finishRun, openTriggerForDataMonth, phase, phases, stepRun, submitTrigger, total } from './support/screens';

test.beforeEach(({ epic6 }) => {
  test.skip(epic6.mode === 'real', 'Derrubar uma fonte de verdade não cabe no ambiente compartilhado; o modo real fica com o roteiro manual e os testes do back.');
});

test('com a fonte fora do ar, a execução aguarda a fonte e depois volta a andar até o fim', async ({ page, epic6 }) => {
  const worker = epic6.worker!;
  await signIn(page, epic6.account('admin'));
  await openOverview(page, CAMPAIGN_WORKFLOW);
  await openTriggerForDataMonth(page);
  expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);

  stepRun(epic6);
  stepRun(epic6);
  stepRun(epic6);
  const progress = phases(page).getByRole('progressbar', { name: 'Registros calculados' });
  await expect(progress).toHaveAttribute('aria-valuetext', '25 de 58 registros · 43%');

  worker.sourceDown();
  stepRun(epic6);
  await expectStatus(page, epic6, panel, 'Aguardando fonte');
  await expect(phase(page, 'Cálculo')).toContainText('aguardando a fonte');
  await expect(panel).toContainText('Uma fonte está fora do ar. A próxima tentativa é em');
  // What was calculated before the source went down stays.
  await expect(progress).toHaveAttribute('aria-valuetext', '25 de 58 registros · 43%');
  await expect(total(page, 'Lidos')).toHaveText('25');

  // Another attempt while it is still down: it keeps waiting.
  stepRun(epic6);
  await expectStatus(page, epic6, panel, 'Aguardando fonte');

  worker.sourceUp();
  stepRun(epic6);
  await expectStatus(page, epic6, panel, 'Calculando');
  await expect(phase(page, 'Cálculo')).toContainText('em andamento');
  await expect(panel).not.toContainText('Aguardando a fonte');

  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Com erros');
  await expect(total(page, 'Lidos')).toHaveText(String(WHOLE_MONTH.read));
});

test('uma atualização do painel que falha para a atualização automática; Tentar de novo volta a ler', async ({ page, epic6 }) => {
  const worker = epic6.worker!;
  await signIn(page, epic6.account('admin'));
  await openOverview(page, CAMPAIGN_WORKFLOW);
  await openTriggerForDataMonth(page);
  expect((await submitTrigger(page)).status(), 'disparar o lote').toBe(202);
  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);

  stepRun(epic6);
  await expectStatus(page, epic6, panel, 'Calculando');
  worker.failNextRead();
  await expect(panel).toContainText('Não foi possível atualizar a execução');
  // The last data stays on screen.
  await expect(phase(page, 'Carga')).toContainText('em andamento');

  finishRun(epic6);
  const reads = worker.reads();
  await panel.getByRole('button', { name: 'Tentar de novo', exact: true }).click();
  await expectStatus(page, epic6, panel, 'Com erros');
  await expect(panel).not.toContainText('Não foi possível atualizar a execução');
  // One read for "Tentar de novo" and none after the final state: the refresh had stopped and stops again.
  expect(worker.reads()).toBe(reads + 1);
});
