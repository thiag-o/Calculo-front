// Epic 7 · the reference file (fluxos 1 to 3, roteiro 2 to 5): on a copy of the "Campanha de referência", the Admin opens
// Testes, uploads the campaign's `expected.csv` and runs "Simular" with the data month (February 2026): the simulation
// compares every record of the file, "100% iguais", and delivers no CSV. The same file with one `pontos` changed and one
// line removed gives 1 different (expected × obtained, with the trace of the record) and 1 out of the file. A file with an
// unknown column and a number with a comma shows the errors by line and column, and nothing is saved.
// Real mode: the file is the backend's (FLUXO_BACKEND_DIR/tests/fixtures/reference_campaign/expected.csv, B184).
import { suffix } from '../epic-2/support/screens';
import { CAMPAIGN_WORKFLOW } from './support/campaign';
import { truncatedPercent } from './support/engine';
import { expect, test } from './support/fixtures';
import { REFERENCE_FILE_NAME, brokenFile, campaignReferenceFile, changedFile, recordCount } from './support/reference-file';
import {
  comparisonCount,
  comparisonSection,
  comparisonTable,
  copyAsAdmin,
  executionPanel,
  expectStatus,
  finishRun,
  keyText,
  openWorkflowItem,
  phase,
  referenceFileRow,
  referenceFilesTable,
  simulate,
  traceDrawer,
  uploadReferenceFile,
} from './support/screens';

/** A number of the API ("23.34") as the screen writes it ("23,34"). */
function brazilian(value: string): string {
  const decimals = value.split('.')[1]?.length ?? 0;
  return Number(value).toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

/** "96,55% iguais · 56 de 58 registros", from the counts (the percent truncated as the API does, E7-11). */
function summaryText(equal: number, compared: number): string {
  const percent = truncatedPercent(equal, compared).replace(/\.?0+$/, '');
  return `${brazilian(percent)}% iguais · ${equal.toLocaleString('pt-BR')} de ${compared.toLocaleString('pt-BR')} registros`;
}

test('o arquivo de referência da campanha, simulado com fevereiro de 2026, dá 100% iguais e não entrega CSV', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Campanha referência e2e ${suffix()}`;
  await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  const file = campaignReferenceFile(epic7.mode);
  const records = recordCount(file);

  await openWorkflowItem(page, name, 'Testes');
  await expect(page.getByRole('heading', { level: 1, name: 'Testes', exact: true })).toBeVisible();
  await expect(referenceFilesTable(page)).toContainText('Nenhum arquivo de referência');

  const upload = await uploadReferenceFile(page, REFERENCE_FILE_NAME, file);
  expect(upload.status(), 'enviar o arquivo de referência').toBe(201);
  await expect(page.getByText(`Arquivo ${REFERENCE_FILE_NAME} enviado, com ${records} registros.`, { exact: true })).toBeVisible();
  const row = referenceFileRow(page, REFERENCE_FILE_NAME);
  await expect(row).toContainText('Chave: nota_id, item_seq');
  await expect(row.getByRole('cell').nth(1)).toHaveText(records.toLocaleString('pt-BR'));
  await expect(row).toContainText('Nenhuma simulação ainda');

  const simulation = await simulate(page, REFERENCE_FILE_NAME);
  expect(simulation.mode).toBe('simulation');
  expect(simulation.reference_file?.name).toBe(REFERENCE_FILE_NAME);
  const panel = executionPanel(page, name);
  await expect(comparisonSection(page)).toContainText('O resumo aparece quando a simulação terminar');
  finishRun(epic7);
  // The campaign has 2 records with an error in the month (P14 without a product): the simulation does not abort by the
  // limit and ends "Com erros" (E7-11); those records are in the file with the status `error`, so they are equal too.
  await expectStatus(page, epic7, panel, 'Com erros');
  await expect(comparisonSection(page)).toContainText(summaryText(records, records));
  await expect(comparisonCount(page, 'Iguais')).toHaveText(records.toLocaleString('pt-BR'));
  for (const label of ['Diferentes', 'Status diferente', 'Fora do resultado', 'Fora do arquivo']) {
    await expect(comparisonCount(page, label)).toHaveText('0');
  }
  await expect(comparisonTable(page)).toContainText('Nenhuma divergência');
  await expect(phase(page, 'Comparação')).toContainText('concluída');
  const download = panel.getByRole('button', { name: 'Baixar CSV', exact: true });
  await expect(download).toBeDisabled();
  await expect(panel).toContainText('A simulação não entrega arquivo');

  // The list of the Testes screen links the last comparison.
  await openWorkflowItem(page, name, 'Testes');
  await expect(referenceFileRow(page, REFERENCE_FILE_NAME).getByRole('button', { name: `100% iguais, abrir a simulação de ${REFERENCE_FILE_NAME}`, exact: true })).toBeVisible();
});

test('um pontos mudado e uma linha a menos dão 1 diferente e 1 fora do arquivo, com o trace do registro', async ({ page, epic7 }) => {
  test.setTimeout(epic7.mode === 'real' ? 300_000 : 90_000);
  const name = `Campanha diferenças e2e ${suffix()}`;
  await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  const changed = changedFile(campaignReferenceFile(epic7.mode));
  const fileName = 'expected-alterado.csv';

  await openWorkflowItem(page, name, 'Testes');
  expect((await uploadReferenceFile(page, fileName, changed.text)).status(), 'enviar o arquivo alterado').toBe(201);
  await expect(referenceFileRow(page, fileName).getByRole('cell').nth(1)).toHaveText(changed.records.toLocaleString('pt-BR'));
  await simulate(page, fileName);
  const panel = executionPanel(page, name);
  finishRun(epic7);
  await expectStatus(page, epic7, panel, 'Com erros');

  // The lines of the file (one less) plus the record out of it: compared = equal + 1 different + 1 out of the file.
  const compared = changed.records + 1;
  await expect(comparisonSection(page)).toContainText(summaryText(compared - 2, compared));
  await expect(comparisonCount(page, 'Diferentes')).toHaveText('1');
  await expect(comparisonCount(page, 'Fora do arquivo')).toHaveText('1');
  await expect(comparisonCount(page, 'Status diferente')).toHaveText('0');
  await expect(comparisonCount(page, 'Fora do resultado')).toHaveText('0');

  // The divergences (the default filter): the different one with expected × obtained, and the one out of the file.
  const different = comparisonTable(page).getByRole('row').filter({ hasText: 'diferente' }).filter({ hasText: keyText(changed.changedKey) });
  await expect(different).toHaveCount(1);
  await expect(different).toContainText('pontos');
  await expect(different).toContainText(`esperado ${brazilian(changed.expected)}`);
  await expect(different).toContainText(`obtido ${brazilian(changed.obtained)}`);
  const missing = comparisonTable(page).getByRole('row').filter({ hasText: 'fora do arquivo' });
  await expect(missing).toHaveCount(1);
  await expect(missing).toContainText(keyText(changed.removedKey));
  await expect(missing).toContainText('O registro calculado não está no arquivo.');

  // The key of the different record opens its trace.
  await different.getByRole('button', { name: `Abrir o trace de ${keyText(changed.changedKey)}`, exact: true }).click();
  await expect(traceDrawer(page)).toBeVisible();
  await expect(traceDrawer(page)).toContainText('pontos');
  await traceDrawer(page).getByRole('button', { name: 'Fechar', exact: true }).click();
  await expect(traceDrawer(page)).toHaveCount(0);
});

test('um arquivo com uma coluna desconhecida e um número com vírgula mostra os erros por linha e coluna, e nada é gravado', async ({ page, epic7 }) => {
  const name = `Campanha arquivo com erros e2e ${suffix()}`;
  await copyAsAdmin(page, epic7, CAMPAIGN_WORKFLOW, name);
  const broken = brokenFile(campaignReferenceFile(epic7.mode));
  const fileName = 'expected-com-erros.csv';

  await openWorkflowItem(page, name, 'Testes');
  const response = await uploadReferenceFile(page, fileName, broken.text);
  expect(response.status(), 'o arquivo com erros é recusado').toBe(422);
  expect(((await response.json()) as { code: string }).code).toBe('invalid_reference_file');

  await expect(page.getByText(`Não foi possível enviar ${fileName}`, { exact: true })).toBeVisible();
  await expect(page.getByText('O arquivo tem erros. Corrija o que está abaixo e envie de novo.', { exact: true })).toBeVisible();
  const errors = page.getByRole('list', { name: 'Erros do arquivo', exact: true });
  await expect(errors.getByRole('listitem').filter({ hasText: /^Cabeçalho/ })).toContainText('observacao');
  await expect(errors.getByRole('listitem').filter({ hasText: new RegExp(`^${broken.where}`) })).toHaveCount(1);
  // Nothing saved: the list stays empty.
  await expect(referenceFilesTable(page)).toContainText('Nenhum arquivo de referência');
  await page.reload();
  await expect(referenceFilesTable(page)).toContainText('Nenhum arquivo de referência');
});
