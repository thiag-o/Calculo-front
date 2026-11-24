// Epic 6 · "Executar lote" on the "Campanha de referência" (roteiro 4 and 5): with a fixed period, the panel follows the
// phases Carga → Cálculo → Entrega until "Entregue", shows the resolved period and the totals, and "Baixar CSV" brings the
// file with the expected values; with the default "Mês anterior", the execution resolves the period itself and reads the
// whole data month, ending "Com erros" (2 records without a product, under the limit) with the CSV of the others.
import { openOverview } from '../epic-4/support/screens';
import { signIn } from '../support/screens';
import { CAMPAIGN_WORKFLOW, DATA_MONTH, periodText } from './support/campaign';
import { CSV_MONTH_RECORDS, CSV_RECORDS, FIRST_DAYS, FIRST_DAYS_TOTALS, WHOLE_MONTH, type ExpectedTotals } from './support/expected';
import { expect, test } from './support/fixtures';
import {
  csvRows,
  downloadCsv,
  executionPanel,
  expectStatus,
  finishRun,
  fixPeriod,
  openTrigger,
  phase,
  phases,
  resolvedParameter,
  stepRun,
  submitTrigger,
  total,
} from './support/screens';
import type { Page } from '@playwright/test';

const CSV_HEADER = ['result_key', 'revision', 'run_id', 'workflow_version', 'status', 'nota_id', 'item_seq', 'pontos', 'elegivel', '_warnings'];

async function expectTotals(page: Page, expected: ExpectedTotals): Promise<void> {
  await expect(total(page, 'Lidos')).toHaveText(String(expected.read));
  await expect(total(page, 'Ok')).toHaveText(String(expected.ok));
  await expect(total(page, 'Com avisos')).toHaveText(String(expected.warnings));
  await expect(total(page, 'Com erro')).toHaveText(String(expected.errors));
  await expect(total(page, 'Ignorados')).toHaveText(String(expected.ignored));
  await expect(total(page, 'Filtrados')).toHaveText(String(expected.filtered));
}

/** The CSV line of a record: the key, the status, the outputs and the warnings (the hash and the run id apart). */
function csvLine(rows: readonly string[][], key: readonly [string, string]): string[] | undefined {
  return rows.find((row) => row[5] === key[0] && row[6] === key[1]);
}

test('com um período fixo, o painel acompanha as fases até Entregue e o CSV traz os valores esperados', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('admin'));
  await openOverview(page, CAMPAIGN_WORKFLOW);

  const dialog = await openTrigger(page);
  // The default is relative: shown by its label, the execution resolves it.
  await expect(dialog.getByRole('group', { name: 'periodo', exact: true })).toContainText('Mês anterior');
  await fixPeriod(dialog, 'periodo', FIRST_DAYS);
  const response = await submitTrigger(page);
  expect(response.status(), 'disparar o lote').toBe(202);
  expect(response.request().postDataJSON()).toMatchObject({ parameters: { periodo: FIRST_DAYS } });
  const id = ((await response.json()) as { id: string }).id;
  await expect(page).toHaveURL(new RegExp(`/executions/${id}$`));

  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);
  await expect(panel).toBeVisible();
  await expect(resolvedParameter(page, 'periodo')).toHaveText(periodText(FIRST_DAYS));
  await expect(panel.getByRole('button', { name: 'Baixar CSV', exact: true })).toBeDisabled();
  await expect(panel).toContainText('O CSV fica disponível quando a execução terminar');

  if (epic6.worker) {
    await test.step('as fases, uma a uma, como o worker avança', async () => {
      await expectStatus(page, epic6, panel, 'Na fila');
      await expect(phase(page, 'Carga')).toContainText('a fazer');

      stepRun(epic6);
      await expectStatus(page, epic6, panel, 'Calculando');
      await expect(phase(page, 'Carga')).toContainText('em andamento');
      await expect(phases(page)).toContainText('Contando os registros do lote');

      stepRun(epic6);
      await expect(phase(page, 'Carga')).toContainText('concluída');
      await expect(phase(page, 'Cálculo')).toContainText('em andamento');
      await expect(phases(page).getByRole('progressbar', { name: 'Registros calculados' })).toHaveAttribute('aria-valuetext', '0 de 11 registros · 0%');

      stepRun(epic6);
      await expect(phase(page, 'Cálculo')).toContainText('concluída');
      await expect(phase(page, 'Entrega')).toContainText('em andamento');
      await expect(phases(page).getByRole('progressbar', { name: 'Registros calculados' })).toHaveAttribute('aria-valuetext', '11 de 11 registros · 100%');
    });
  }
  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Entregue');
  for (const label of ['Carga', 'Cálculo', 'Entrega'] as const) await expect(phase(page, label)).toContainText('concluída');
  await expectTotals(page, FIRST_DAYS_TOTALS);
  await expect(page.getByRole('region', { name: 'Erros agrupados', exact: true })).toContainText('Nenhum registro com erro.');
  await expect(panel).toContainText(`${FIRST_DAYS_TOTALS.rows} linhas · disponível até`);

  const { download, text } = await downloadCsv(page, panel);
  expect(download.suggestedFilename()).toBe(`execution-${id}.csv`);
  await expect(panel.getByRole('status').filter({ hasText: 'CSV baixado' })).toHaveText(`CSV baixado: execution-${id}.csv`);
  const rows = csvRows(text);
  expect(rows[0]).toEqual(CSV_HEADER);
  expect(rows.slice(1)).toHaveLength(FIRST_DAYS_TOTALS.rows);
  for (const row of rows.slice(1)) {
    expect(row[0], 'result_key').toMatch(/^[0-9a-f]{64}$/);
    expect(row[2], 'run_id').toBe(id);
  }
  for (const expected of CSV_RECORDS) {
    const line = csvLine(rows, expected.key);
    expect(line, `a linha ${expected.key.join('/')} no CSV`).toBeDefined();
    expect(line!.slice(4)).toEqual([expected.status, ...expected.key, expected.pontos, expected.elegivel, expected.warnings]);
  }
});

test('com o padrão Mês anterior, a execução resolve o período e lê o mês inteiro dos dados', async ({ page, epic6 }) => {
  await signIn(page, epic6.account('admin'));
  await openOverview(page, CAMPAIGN_WORKFLOW);

  await openTrigger(page);
  const response = await submitTrigger(page);
  expect(response.status(), 'disparar o lote').toBe(202);
  // The default goes by name: the request does not carry it, the execution resolves and freezes it.
  expect(response.request().postDataJSON()).toEqual(expect.objectContaining({ parameters: {} }));
  const execution = (await response.json()) as { id: string; parameters: Record<string, unknown> };
  expect(execution.parameters.periodo).toEqual(DATA_MONTH);

  const panel = executionPanel(page, CAMPAIGN_WORKFLOW);
  await expect(resolvedParameter(page, 'periodo')).toHaveText(periodText(DATA_MONTH));
  finishRun(epic6);
  await expectStatus(page, epic6, panel, 'Com erros');
  await expectTotals(page, WHOLE_MONTH);

  const { text } = await downloadCsv(page, panel);
  const rows = csvRows(text).slice(1);
  expect(rows).toHaveLength(WHOLE_MONTH.rows);
  // The records with an error are not delivered.
  expect(csvLine(rows, ['5', '3']), 'o 5/3 (erro) fora do CSV').toBeUndefined();
  for (const expected of [...CSV_RECORDS, ...CSV_MONTH_RECORDS]) {
    expect(csvLine(rows, expected.key)?.slice(4), `a linha ${expected.key.join('/')}`).toEqual([
      expected.status,
      ...expected.key,
      expected.pontos,
      expected.elegivel,
      expected.warnings,
    ]);
  }
});
