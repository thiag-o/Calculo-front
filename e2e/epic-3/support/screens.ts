// Actions and locators of the epic 3 screens (Catalog: Conexões, Datasets, Arquivos), by what the user sees.
// The sign-in ones are in e2e/support/screens.ts; the menu and the generic ones in e2e/epic-2/support/screens.ts.
import type { Locator, Page, Response } from '@playwright/test';
import type { Schemas } from '../../support/contract';
import { callApi, mainNavigation, submit } from '../../epic-2/support/screens';
import type { LoginCredentials } from '../../support/fixtures';
import { apiResponse, signIn } from '../../support/screens';
import { expect, type SampleCredential } from './fixtures';
import type { Workbook } from './workbook';

export type Connection = Schemas['Connection'];
export type Dataset = Schemas['Dataset'];
export type ExcelFile = Schemas['ExcelFile'];
type DataType = Schemas['DataType'];

/** The Catalog tabs and the title (h2) of each list. */
const TAB_TITLES = { Conexões: 'Conexões', Datasets: 'Datasets', Arquivos: 'Arquivos' } as const;
export type CatalogTab = keyof typeof TAB_TITLES;

/** Name of each `DataType` on screen (catalog/columns/dataTypes.ts). */
const TYPE_LABELS: Readonly<Record<DataType, string>> = {
  text: 'Texto',
  integer: 'Inteiro',
  decimal: 'Decimal',
  date: 'Data',
  datetime: 'Data e hora',
  boolean: 'Booleano',
};

/** "Inteiro", "Decimal (2 casas)", "Decimal (1 casa)": the type as the columns and variables tables show it. */
export function typeLabel(type: DataType, scale?: number | null): string {
  if (type !== 'decimal' || scale === null || scale === undefined) return TYPE_LABELS[type];
  return `${TYPE_LABELS[type]} (${scale} ${scale === 1 ? 'casa' : 'casas'})`;
}

/** The columns of `public.itens_nf` of the sample database (docker/postgres-sample/init.sql in the backend), in order. */
export const ITEMS_TABLE_COLUMNS = [
  ['id', typeLabel('integer')],
  ['nota_fiscal_id', typeLabel('integer')],
  ['produto_id', typeLabel('integer')],
  ['quantidade', typeLabel('decimal', 3)],
  ['valor_unitario', typeLabel('decimal', 2)],
  ['desconto_percentual', typeLabel('decimal', 2)],
  ['valor_total', typeLabel('decimal', 2)],
] as const;

/** The columns of the view `public.vw_itens_campanha` of the sample database, in order. */
export const CAMPAIGN_VIEW_COLUMNS = [
  ['item_id', typeLabel('integer')],
  ['numero_nota', typeLabel('integer')],
  ['cliente', typeLabel('text')],
  ['emissao', typeLabel('date')],
  ['codigo_produto', typeLabel('text')],
  ['descricao_produto', typeLabel('text')],
  ['categoria', typeLabel('text')],
  ['quantidade', typeLabel('decimal', 3)],
  ['valor_unitario', typeLabel('decimal', 2)],
  ['desconto_percentual', typeLabel('decimal', 2)],
  ['valor_total', typeLabel('decimal', 2)],
] as const;

/** Opens the Catalog through the shell sidebar and then the tab; waits for the tab's list title. */
export async function openCatalog(page: Page, tab: CatalogTab): Promise<void> {
  await mainNavigation(page).getByRole('link', { name: 'Catálogo', exact: true }).click();
  await expect(page.getByRole('heading', { level: 1, name: 'Catálogo', exact: true })).toBeVisible();
  await openCatalogTab(page, tab);
}

/** Changes the Catalog tab and waits for the list title. */
export async function openCatalogTab(page: Page, tab: CatalogTab): Promise<void> {
  await page.getByRole('tablist', { name: 'Catálogo' }).getByRole('tab', { name: tab, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: TAB_TITLES[tab], exact: true })).toBeVisible();
}

export const connectionsTable = (page: Page) => page.getByRole('table', { name: 'Conexões do tenant' });
export const datasetsTable = (page: Page) => page.getByRole('table', { name: 'Datasets do tenant' });

/** The table row whose first cell is exactly `name` (a column name like `id` would match many rows by text). */
export function rowNamed(table: Locator, name: string): Locator {
  return table.getByRole('row').filter({ has: table.page().getByRole('cell', { name, exact: true }) });
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Checks all the columns of a columns table, in order (catalog/columns/ColumnsTable: Nome, Tipo de origem, Tipo,
 * Anulável): each row has the name, a source type (whatever the source calls it), the type on screen and the nullable
 * flag (and, in the dataset detail, the variable column after it). One assertion for the whole table, retried until it
 * holds.
 */
export async function expectColumnTypes(table: Locator, expected: readonly (readonly [name: string, type: string])[]): Promise<void> {
  const rows = table.getByRole('row').filter({ has: table.page().getByRole('cell') });
  await expect(rows, 'as colunas, em ordem, com os tipos').toHaveText(
    expected.map(([name, type]) => new RegExp(`^${escapeRegExp(name)}.+${escapeRegExp(type)}(Sim|Não)`)),
  );
}

/** Fills host, port, database, user and password of a connection form. */
export async function fillCredential(form: Locator, credential: SampleCredential): Promise<void> {
  await form.getByRole('textbox', { name: 'Host', exact: true }).fill(credential.host);
  await form.getByRole('textbox', { name: 'Porta', exact: true }).fill(String(credential.port));
  await form.getByRole('textbox', { name: 'Banco', exact: true }).fill(credential.database);
  await form.getByRole('textbox', { name: 'Usuário', exact: true }).fill(credential.username);
  await form.getByLabel('Senha', { exact: true }).fill(credential.password);
}

/** Opens "Nova conexão" (Postgres, the default type) and fills the name and the credential. Returns the dialog. */
export async function startNewConnection(page: Page, name: string, credential: SampleCredential): Promise<Locator> {
  await page.getByRole('button', { name: 'Nova conexão' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova conexão' });
  await expect(dialog.getByRole('combobox', { name: 'Tipo' })).toContainText('PostgreSQL');
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(name);
  await fillCredential(dialog, credential);
  return dialog;
}

/** "Testar" in a connection form: returns the `POST /v1/connections/tests` result. */
export async function testCredential(page: Page, dialog: Locator): Promise<Schemas['ConnectionTestResult']> {
  const response = await submit(page, 'POST', '/v1/connections/tests', dialog.getByRole('button', { name: 'Testar', exact: true }));
  expect(response.status(), 'testar a credencial').toBe(200);
  return (await response.json()) as Schemas['ConnectionTestResult'];
}

/** "Salvar" in "Nova conexão": returns the `POST /v1/connections` response (the dialog closes only on success). */
export function saveConnection(page: Page, dialog: Locator): Promise<Response> {
  return submit(page, 'POST', '/v1/connections', dialog.getByRole('button', { name: 'Salvar', exact: true }));
}

/** Creates a connection to the sample database through "Nova conexão", without testing first. Expects to be on Conexões. */
export async function createConnection(page: Page, name: string, credential: SampleCredential): Promise<Connection> {
  const dialog = await startNewConnection(page, name, credential);
  const response = await saveConnection(page, dialog);
  expect(response.status(), 'criar a conexão').toBe(201);
  await expect(dialog).toBeHidden();
  await expect(rowNamed(connectionsTable(page), name)).toHaveCount(1);
  return (await response.json()) as Connection;
}

/**
 * Signs in and returns the API origin the shell talks to (from the `POST /v1/session` response): the real API in real
 * mode, the address the simulation intercepts in simulated mode.
 */
export async function signInForApi(page: Page, credentials: LoginCredentials): Promise<string> {
  const [response] = await Promise.all([apiResponse(page, 'POST', '/v1/session'), signIn(page, credentials)]);
  return new URL(response.url()).origin;
}

/**
 * Creates a connection to the sample database straight through the API, from inside the shell (session cookie and
 * CSRF token): the preparation of the tests whose flow starts after the connection exists. The screen flow of "Nova
 * conexão" is in sample-connection.spec.ts.
 */
export async function createConnectionThroughApi(
  page: Page,
  apiOrigin: string,
  name: string,
  credential: SampleCredential,
): Promise<Connection> {
  const body: Schemas['NewConnection'] = { name, type: 'postgres', credential };
  const result = await callApi(page, apiOrigin, 'POST', '/v1/connections', body);
  expect(result.status, `criar a conexão pela API (${String(result.code)})`).toBe(201);
  return result.body as Connection;
}

/** Creates a dataset of a table of the sample database straight through the API: the preparation of the variables test. */
export async function createTableDatasetThroughApi(
  page: Page,
  apiOrigin: string,
  name: string,
  connection: Connection,
  objectName: string,
): Promise<Dataset> {
  const body: Schemas['NewTableDataset'] = { name, type: 'table', connection_id: connection.id, schema_name: 'public', object_name: objectName };
  const result = await callApi(page, apiOrigin, 'POST', '/v1/datasets', body);
  expect(result.status, `criar o dataset pela API (${String(result.code)})`).toBe(201);
  return result.body as Dataset;
}

/** Opens a dataset from the list of the Datasets tab (by its name) and waits for its detail. Returns the columns table. */
export async function openDataset(page: Page, dataset: Dataset): Promise<Locator> {
  await rowNamed(datasetsTable(page), dataset.name).getByRole('button', { name: dataset.name, exact: true }).click();
  return waitForDatasetDetail(page, dataset);
}

/** Picks an option of a select (Radix Select: the trigger is a combobox, the options are in a list). */
export async function choose(page: Page, select: Locator, option: string): Promise<void> {
  await select.click();
  await page.getByRole('option', { name: option, exact: true }).click();
  await expect(select).toContainText(option);
}

/** The table or view `schema.name` in the "Tabela ou view" picker of "Novo dataset". */
export const objectOption = (dialog: Locator, qualifiedName: string, kind: 'Tabela' | 'View') =>
  dialog.getByRole('radio', { name: `${qualifiedName} ${kind}`, exact: true });

/** Opens "Novo dataset" on the Datasets tab and chooses the connection. Returns the dialog. */
export async function startNewDataset(page: Page, connectionName: string): Promise<Locator> {
  await page.getByRole('button', { name: 'Novo dataset' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Novo dataset' });
  await choose(page, dialog.getByRole('combobox', { name: 'Conexão' }), connectionName);
  return dialog;
}

/** The dataset detail (`/catalog/datasets/:id`): its title (h2) and the columns table. */
export async function waitForDatasetDetail(page: Page, dataset: Dataset): Promise<Locator> {
  await expect(page).toHaveURL(new RegExp(`/catalog/datasets/${dataset.id}$`));
  await expect(page.getByRole('heading', { level: 2, name: dataset.name, exact: true })).toBeVisible();
  return page.getByRole('table', { name: `Colunas do dataset ${dataset.name}` });
}

/** Sends the workbook through "Enviar arquivo" (the file picker, as a person would). Returns the stored file (`201`). */
export async function uploadWorkbook(page: Page, workbook: Workbook): Promise<ExcelFile> {
  const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Enviar arquivo' }).click()]);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'POST' && new URL(r.url()).pathname === '/v1/excel-files'),
    chooser.setFiles({
      name: workbook.fileName,
      mimeType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      buffer: workbook.bytes,
    }),
  ]);
  expect(response.status(), `enviar ${workbook.fileName}`).toBe(201);
  return (await response.json()) as ExcelFile;
}

/**
 * Creates a variable through "Nova variável": the column and the business name. The type starts as the column's own
 * (and a decimal, with the column's places): `type` chooses another one the column accepts.
 */
export async function createVariable(
  page: Page,
  dataset: Dataset,
  data: { column: string; columnLabel: string; name: string; type?: string },
): Promise<Schemas['Variable']> {
  await page.getByRole('button', { name: 'Nova variável' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Nova variável' });
  await choose(page, dialog.getByRole('combobox', { name: 'Coluna' }), `${data.column} · ${data.columnLabel}`);
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(data.name);
  if (data.type !== undefined) await choose(page, dialog.getByRole('combobox', { name: 'Tipo' }), data.type);

  const response = await submit(page, 'POST', `/v1/datasets/${dataset.id}/variables`, dialog.getByRole('button', { name: 'Salvar' }));
  expect(response.status(), `criar a variável ${data.name}`).toBe(201);
  await expect(dialog).toBeHidden();
  return (await response.json()) as Schemas['Variable'];
}
