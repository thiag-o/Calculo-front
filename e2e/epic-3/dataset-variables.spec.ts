// Epic 3 · dataset with business names: the Admin creates a dataset from the itens_nf table of the sample database and
// sees its columns with types; in a dataset, gives a business name and a type to two columns (variables) (both modes).
import { submit, suffix } from '../epic-2/support/screens';
import { expect, test } from './support/fixtures';
import {
  ITEMS_TABLE_COLUMNS,
  createConnectionThroughApi,
  createTableDatasetThroughApi,
  createVariable,
  datasetsTable,
  expectColumnTypes,
  objectOption,
  openCatalog,
  openDataset,
  rowNamed,
  signInForApi,
  startNewDataset,
  typeLabel,
  waitForDatasetDetail,
  type Dataset,
} from './support/screens';

test.describe('dataset e variáveis', () => {
  test('o Admin cria um dataset da tabela itens_nf e vê as colunas com tipos', async ({ page, api, epic3 }) => {
    const run = suffix();
    const connectionName = `Exemplo e2e ${run}`;
    const datasetName = `Itens de nota e2e ${run}`;
    const apiOrigin = await signInForApi(page, api.account('admin'));
    // The connection is the preparation; its screen flow is in sample-connection.spec.ts.
    await createConnectionThroughApi(page, apiOrigin, connectionName, epic3.readCredential);

    await openCatalog(page, 'Datasets');
    const dialog = await startNewDataset(page, connectionName);
    await objectOption(dialog, 'public.itens_nf', 'Tabela').check();
    const name = dialog.getByRole('textbox', { name: 'Nome', exact: true });
    await expect(name, 'o nome começa com o da tabela').toHaveValue('itens_nf');
    await name.fill(datasetName);

    const response = await submit(page, 'POST', '/v1/datasets', dialog.getByRole('button', { name: 'Salvar' }));
    expect(response.status(), 'criar o dataset').toBe(201);
    const dataset = (await response.json()) as Dataset;
    expect(dataset).toMatchObject({ type: 'table', schema_name: 'public', object_name: 'itens_nf' });

    // The new dataset opens with the columns read from the table; it is in the tenant list, with its origin.
    await expectColumnTypes(await waitForDatasetDetail(page, dataset), ITEMS_TABLE_COLUMNS);
    await page.getByRole('button', { name: 'Voltar para datasets' }).click();
    await expect(rowNamed(datasetsTable(page), datasetName)).toContainText(new RegExp(`${connectionName}\\s*public\\.itens_nf`));
  });

  test('o Admin dá nome de negócio e tipo a duas colunas do dataset (variáveis)', async ({ page, api, epic3 }) => {
    const run = suffix();
    const apiOrigin = await signInForApi(page, api.account('admin'));
    // The connection and the dataset are the preparation; their screen flows are in the test above.
    const connection = await createConnectionThroughApi(page, apiOrigin, `Exemplo e2e ${run}`, epic3.readCredential);
    const dataset = await createTableDatasetThroughApi(page, apiOrigin, `Itens de nota e2e ${run}`, connection, 'itens_nf');

    await openCatalog(page, 'Datasets');
    await openDataset(page, dataset);
    const variables = page.getByRole('table', { name: `Variáveis do dataset ${dataset.name}` });
    await expect(variables.getByText('Nenhuma variável ainda')).toBeVisible();

    // The column's own type: a decimal with the column's 2 places.
    const unitPrice = await createVariable(page, dataset, {
      column: 'valor_unitario',
      columnLabel: typeLabel('decimal', 2),
      name: 'preco_unitario',
    });
    expect(unitPrice).toMatchObject({ column: 'valor_unitario', name: 'preco_unitario', type: 'decimal', scale: 2 });

    // A conversion the column accepts: the integer product id becomes a text code.
    const product = await createVariable(page, dataset, {
      column: 'produto_id',
      columnLabel: typeLabel('integer'),
      name: 'codigo_produto',
      type: 'Texto',
    });
    expect(product).toMatchObject({ column: 'produto_id', name: 'codigo_produto', type: 'text', scale: null });

    await expect(page.getByText('2 variáveis', { exact: true })).toBeVisible();
    for (const [variable, column, type] of [
      ['preco_unitario', 'valor_unitario', typeLabel('decimal', 2)],
      ['codigo_produto', 'produto_id', typeLabel('text')],
    ] as const) {
      const row = rowNamed(variables, variable);
      await expect(row.getByRole('cell').nth(1), `a coluna de ${variable}`).toHaveText(column);
      await expect(row.getByRole('cell').nth(2), `o tipo de ${variable}`).toHaveText(type);
    }
  });
});
