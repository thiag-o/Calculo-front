// Epic 3 · Excel file: the Admin sends a spreadsheet with two sheets, chooses the sheet and sees the inferred types of
// its columns; the chosen sheet becomes a dataset with the same columns (both modes). The .xlsx is written by the test
// (support/workbook.ts); in real mode the backend reads it and infers the types.
import { submit, suffix } from '../epic-2/support/screens';
import { signIn } from '../support/screens';
import { expect, test } from './support/fixtures';
import { expectColumnTypes, openCatalog, typeLabel, uploadWorkbook, waitForDatasetDetail, type Dataset } from './support/screens';
import type { SheetSpec } from './support/workbook';

/** "Vendas": one column per inferred type. */
const SALES: SheetSpec = {
  name: 'Vendas',
  columns: [
    { header: 'codigo', values: ['A-001', 'A-002', 'A-003', 'A-004'], type: 'text', sourceType: 'str' },
    { header: 'quantidade', values: [3, 10, 7, 1], type: 'integer', sourceType: 'int' },
    { header: 'valor', values: [10.25, 3.5, 99.9, 12], type: 'decimal', scale: 2, sourceType: 'float' },
    {
      header: 'emissao',
      values: [{ date: '2026-01-05' }, { date: '2026-01-12' }, { date: '2026-02-03' }, { date: '2026-02-10' }],
      type: 'date',
      sourceType: 'datetime',
    },
    { header: 'ativo', values: [true, false, true, true], type: 'boolean', sourceType: 'bool' },
  ],
};

/** "Metas": date with time, an empty cell (nullable) and a column of mixed values, which falls back to text. */
const TARGETS: SheetSpec = {
  name: 'Metas',
  columns: [
    { header: 'vendedor', values: ['Ana', 'Bruno', 'Carla'], type: 'text', sourceType: 'str' },
    { header: 'meta', values: [100, 250, 80], type: 'integer', sourceType: 'int' },
    {
      header: 'registrado_em',
      values: [{ dateTime: '2026-01-05T09:30:00' }, { dateTime: '2026-01-06T14:15:00' }, { dateTime: '2026-01-07T18:00:00' }],
      type: 'datetime',
      sourceType: 'datetime',
    },
    { header: 'observacao', values: ['ok', null, 'revisar'], type: 'text', sourceType: 'str' },
    { header: 'regiao', values: [1, 'Sul', 3], type: 'text', sourceType: 'mixed' },
  ],
};

/** The labels the columns table should show for each column of the sheet. */
function expectedTypes(sheet: SheetSpec): [string, string][] {
  return sheet.columns.map((column) => [column.header, typeLabel(column.type, column.scale)]);
}

test.describe('arquivo Excel', () => {
  test('o Admin envia uma planilha, escolhe a aba e vê os tipos inferidos; a aba vira um dataset', async ({ page, api, epic3 }) => {
    const run = suffix();
    const workbook = epic3.workbook(`vendas-e2e-${run}.xlsx`, [SALES, TARGETS]);
    await signIn(page, api.account('admin'));
    await openCatalog(page, 'Arquivos');

    const file = await uploadWorkbook(page, workbook);
    expect(file.sheets.map((sheet) => sheet.name), 'as abas do arquivo').toEqual(['Vendas', 'Metas']);
    expect(file.sha256, 'o SHA-256 do arquivo enviado').toBe(workbook.sha256);

    // The file just sent opens, with one tab per sheet; the first is chosen.
    await expect(page).toHaveURL(new RegExp(`/catalog/files/${file.id}$`));
    await expect(page.getByRole('heading', { level: 2, name: workbook.fileName, exact: true })).toBeVisible();
    const sheets = page.getByRole('tablist', { name: `Abas de ${workbook.fileName}` });
    await expect(sheets.getByRole('tab')).toHaveText(['Vendas', 'Metas']);
    await expect(sheets.getByRole('tab', { name: 'Vendas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('4 linhas lidas para inferir os tipos')).toBeVisible();
    await expectColumnTypes(page.getByRole('table', { name: 'Colunas da aba Vendas' }), expectedTypes(SALES));

    // Choosing the other sheet shows its columns.
    await sheets.getByRole('tab', { name: 'Metas' }).click();
    await expect(sheets.getByRole('tab', { name: 'Metas' })).toHaveAttribute('aria-selected', 'true');
    await expect(page.getByText('3 linhas lidas para inferir os tipos')).toBeVisible();
    const targetColumns = page.getByRole('table', { name: 'Colunas da aba Metas' });
    await expectColumnTypes(targetColumns, expectedTypes(TARGETS));
    await expect(targetColumns.getByRole('row').filter({ hasText: 'observacao' }).getByRole('cell').nth(3), 'célula vazia: anulável').toHaveText(
      'Sim',
    );

    // The chosen sheet becomes a dataset with the same columns and types.
    await page.getByRole('button', { name: 'Novo dataset' }).click();
    const dialog = page.getByRole('dialog', { name: 'Novo dataset' });
    const name = dialog.getByRole('textbox', { name: 'Nome', exact: true });
    await expect(name, 'o nome começa com o da aba').toHaveValue('Metas');
    await name.fill(`Metas e2e ${run}`);
    const response = await submit(page, 'POST', '/v1/datasets', dialog.getByRole('button', { name: 'Salvar' }));
    expect(response.status(), 'criar o dataset da aba').toBe(201);
    const dataset = (await response.json()) as Dataset;
    expect(dataset).toMatchObject({ type: 'excel', excel_file_id: file.id, sheet: 'Metas' });

    const columns = await waitForDatasetDetail(page, dataset);
    await expectColumnTypes(columns, expectedTypes(TARGETS));
  });
});
