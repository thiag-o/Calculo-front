// Epic 7 · the schedules (fluxos 4, 5 and 9, roteiro 6 and 8), each on its own copy of the "Campanha de referência" (its
// own scope, so the runs of epic 6 never meet it):
// - a daily schedule with the fixed period of February 2026, marked for the next minute, fires by itself: the execution
//   shows "Agendada · <nome>", with the parameters resolved, and ends;
// - a schedule with the relative "Mês anterior" resolves the period by the marked hour (the month before it: no record,
//   because the data are of February 2026);
// - a schedule over a period already delivered does not run ("Não executou"), and the bell says so; its link opens the
//   Agendamentos tab.
// The scheduler fires by itself: in simulated mode the test plays it at the marked hour (`epic7.scheduler`), in real mode
// `fluxo scheduler` does it within the next minute (up to 3 min, global plan), in the time zone E2E_BUSINESS_TIMEZONE.
import { suffix } from '../epic-2/support/screens';
import { mainNavigation } from '../epic-2/support/screens';
import { CAMPAIGN_WORKFLOW, DATA_MONTH, nextMinute, periodText, previousMonthOf } from './support/campaign';
import { expect, test } from './support/fixtures';
import {
  alertItem,
  alertsPopover,
  bellButton,
  copyAsAdmin,
  createSchedule,
  executionPanel,
  executionRow,
  expectStatus,
  finishRun,
  openSchedules,
  openWorkflowItem,
  scheduleRow,
  schedulesTable,
  summaryValue,
  untilShown,
  waitForTrigger,
  workflowTabs,
} from './support/screens';

test('um agendamento diário com o período fixo de fevereiro dispara sozinho e a execução aparece como Agendada', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 420_000 : 90_000);
  const name = `Campanha agendada e2e ${suffix()}`;
  const schedule = 'Fechamento de fevereiro';
  await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  await openSchedules(page, name);
  await expect(schedulesTable(page)).toContainText('Nenhum agendamento');

  const time = nextMinute();
  const saved = await createSchedule(page, epic7, { name: schedule, time, period: DATA_MONTH });
  expect(saved.parameters).toEqual({ periodo: { kind: 'fixed', value: DATA_MONTH } });
  expect(saved.recurrence).toEqual({ kind: 'daily', time });
  const row = scheduleRow(page, schedule);
  await expect(row).toContainText(`Todo dia às ${time}`);
  await expect(row).toContainText(`periodo: ${periodText(DATA_MONTH)}`);
  await expect(row).toContainText(/Revisão \d+/);
  await expect(row.getByRole('switch', { name: `${schedule} ativo` })).toHaveAttribute('aria-checked', 'true');

  await waitForTrigger(page, epic7, schedule, 'Disparou');
  await scheduleRow(page, schedule).getByRole('button', { name: new RegExp(`^Abrir a execução de .*, do agendamento ${schedule}$`) }).click();
  const panel = executionPanel(page, name);
  await expect(summaryValue(page, 'Disparado por')).toContainText(`Agendada · ${schedule} em `);
  await expect(summaryValue(page, 'periodo')).toHaveText(periodText(DATA_MONTH));
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Com erros');

  // The list of the workflow says who triggered it: the schedule, by name.
  await openWorkflowItem(page, name, 'Execuções');
  await expect(executionRow(page, `Agendada · ${schedule}`)).toContainText('Com erros');
});

test('um agendamento com o período relativo Mês anterior resolve o período pelo horário marcado', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 420_000 : 90_000);
  const name = `Campanha agendada relativa e2e ${suffix()}`;
  const schedule = 'Fechamento mensal';
  await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  await openSchedules(page, name);

  const saved = await createSchedule(page, epic7, { name: schedule, time: nextMinute(), period: 'previous_month' });
  expect(saved.parameters).toEqual({ periodo: { kind: 'relative', value: 'previous_month' } });
  await expect(scheduleRow(page, schedule)).toContainText('periodo: Mês anterior');
  expect(saved.next_run_at, 'o próximo disparo').not.toBeNull();
  const marked = new Date(saved.next_run_at!);

  await waitForTrigger(page, epic7, schedule, 'Disparou');
  await scheduleRow(page, schedule).getByRole('button', { name: new RegExp(`do agendamento ${schedule}$`) }).click();
  const panel = executionPanel(page, name);
  // The "agora" of the scheduled execution is the marked hour, and the relative is resolved by it.
  await expect(summaryValue(page, 'periodo')).toHaveText(periodText(previousMonthOf(marked)));
  await expect(summaryValue(page, 'Disparado por')).toContainText(`Agendada · ${schedule} em `);
  finishRun(epic7);
  // The data are of February 2026: the month before the marked hour has no record, and an empty batch is delivered.
  await expectStatus(page, epic7, panel, 'Entregue');
});

test('um agendamento com o período já entregue não executa, e o sino avisa', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 600_000 : 120_000);
  const name = `Campanha agendada sobreposta e2e ${suffix()}`;
  const delivered = 'Entrega de fevereiro';
  const skipped = 'Fevereiro de novo';
  await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  await openSchedules(page, name);

  await createSchedule(page, epic7, { name: delivered, time: nextMinute(), period: DATA_MONTH });
  await waitForTrigger(page, epic7, delivered, 'Disparou');
  finishRun(epic7);

  await createSchedule(page, epic7, { name: skipped, time: nextMinute(), period: DATA_MONTH });
  await waitForTrigger(page, epic7, skipped, 'Não executou');
  await expect(scheduleRow(page, skipped).getByRole('button', { name: /^Abrir a execução/ })).toHaveCount(0);

  // The bell has the alert of the skipped schedule; its link opens the Agendamentos tab of the workflow.
  const detail = `${skipped} (${name}): o escopo já foi entregue. Para entregar de novo, use Executar lote.`;
  await untilShown(page, epic7, async () => {
    await bellButton(page).click();
    await expect(alertItem(page, detail)).toBeVisible({ timeout: 5_000 });
  });
  const alert = alertItem(page, detail);
  await expect(alert).toContainText('Agendamento não executou');
  await expect(alert).toContainText('não lido');
  await alert.getByRole('button', { name: 'Abrir agendamentos', exact: true }).click();
  await expect(alertsPopover(page)).toHaveCount(0);
  await expect(workflowTabs(page).getByRole('tab', { name: 'Agendamentos', exact: true })).toHaveAttribute('aria-selected', 'true');
  await expect(mainNavigation(page).getByRole('link', { name: 'Execuções', exact: true })).toBeVisible();
  await expect(scheduleRow(page, skipped)).toContainText('Não executou');
});
