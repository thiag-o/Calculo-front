// Epic 3 · connection to the sample database: the Admin registers the Postgres connection with the read-only user,
// tests it and saves it; the connection shows the tables, the view and the columns with types; the connection with the
// user that may write (exemplo_escrita) is refused and nothing is saved (both modes).
import { suffix } from '../epic-2/support/screens';
import { signIn } from '../support/screens';
import { expect, test } from './support/fixtures';
import {
  CAMPAIGN_VIEW_COLUMNS,
  ITEMS_TABLE_COLUMNS,
  connectionsTable,
  createConnectionThroughApi,
  expectColumnTypes,
  objectOption,
  openCatalog,
  rowNamed,
  saveConnection,
  signInForApi,
  startNewConnection,
  startNewDataset,
  testCredential,
  type Connection,
} from './support/screens';

const NOT_READ_ONLY_MESSAGE = 'O usuário do banco pode alterar dados. Use um usuário só de leitura.';

test.describe('conexão Postgres de exemplo', () => {
  test('o Admin cadastra a conexão com o usuário de leitura: testa e salva', async ({ page, api, epic3 }) => {
    const name = `Exemplo e2e ${suffix()}`;
    await signIn(page, api.account('admin'));
    await openCatalog(page, 'Conexões');

    const dialog = await startNewConnection(page, name, epic3.readCredential);
    const result = await testCredential(page, dialog);
    expect(result, 'o teste passa com o usuário só de leitura').toMatchObject({ ok: true, read_only: true, error: null });
    await expect(dialog.getByText('Resultado do teste')).toBeVisible();
    await expect(dialog.getByText('ok', { exact: true })).toBeVisible();
    await expect(dialog.getByRole('term').filter({ hasText: 'Somente leitura' })).toBeVisible();

    const response = await saveConnection(page, dialog);
    expect(response.status(), 'salvar a conexão').toBe(201);
    const connection = (await response.json()) as Connection;
    expect(connection.last_test?.ok, 'a API testou de novo ao salvar').toBe(true);
    await expect(dialog).toBeHidden();
    const row = rowNamed(connectionsTable(page), name);
    await expect(row).toContainText('PostgreSQL');
    await expect(row.getByText('ok', { exact: true })).toBeVisible();
  });

  test('a conexão de exemplo mostra as tabelas e a view, com as colunas e os tipos', async ({ page, api, epic3 }) => {
    const name = `Exemplo e2e ${suffix()}`;
    const apiOrigin = await signInForApi(page, api.account('admin'));
    // The connection is the preparation; its screen flow is the test above.
    await createConnectionThroughApi(page, apiOrigin, name, epic3.readCredential);

    // The tables and the view the read user sees are browsed in "Novo dataset".
    await openCatalog(page, 'Datasets');
    const dialog = await startNewDataset(page, name);
    await expect(objectOption(dialog, 'public.itens_nf', 'Tabela')).toBeVisible();
    await expect(objectOption(dialog, 'public.notas_fiscais', 'Tabela')).toBeVisible();
    await expect(objectOption(dialog, 'public.produtos', 'Tabela')).toBeVisible();
    await expect(objectOption(dialog, 'public.vw_itens_campanha', 'View')).toBeVisible();

    // The filter asks the API by part of the name.
    await dialog.getByRole('searchbox', { name: 'Filtrar por nome' }).fill('itens');
    await expect(objectOption(dialog, 'public.produtos', 'Tabela')).toBeHidden();

    await objectOption(dialog, 'public.itens_nf', 'Tabela').check();
    await expectColumnTypes(dialog.getByRole('table', { name: 'Colunas de public.itens_nf' }), ITEMS_TABLE_COLUMNS);
    await objectOption(dialog, 'public.vw_itens_campanha', 'View').check();
    await expectColumnTypes(dialog.getByRole('table', { name: 'Colunas de public.vw_itens_campanha' }), CAMPAIGN_VIEW_COLUMNS);
  });

  test('a conexão com o usuário que pode gravar (exemplo_escrita) é recusada e nada é salvo', async ({ page, api, epic3 }) => {
    const name = `Exemplo escrita e2e ${suffix()}`;
    await signIn(page, api.account('admin'));
    await openCatalog(page, 'Conexões');

    const dialog = await startNewConnection(page, name, epic3.writeCredential);
    const result = await testCredential(page, dialog);
    expect(result, 'o teste não passa: o usuário pode gravar').toMatchObject({
      ok: false,
      read_only: false,
      error: { code: 'connection_not_read_only' },
    });
    await expect(dialog.getByText('falhou', { exact: true })).toBeVisible();
    await expect(dialog.getByText(NOT_READ_ONLY_MESSAGE)).toBeVisible();

    const response = await saveConnection(page, dialog);
    expect(response.status(), 'salvar com o usuário de escrita').toBe(422);
    const body = (await response.json()) as { code: string; privileges?: string[] };
    expect(body.code).toBe('connection_not_read_only');
    expect(body.privileges?.length ?? 0, 'a API diz o que impede o somente leitura').toBeGreaterThan(0);

    // The dialog stays open with the reason and the privileges found.
    const privileges = dialog.getByRole('list', { name: 'Privilégios encontrados' });
    await expect(privileges.getByRole('listitem')).toHaveCount(body.privileges?.length ?? 0);

    await dialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(dialog).toBeHidden();
    await expect(connectionsTable(page)).not.toHaveAttribute('aria-busy', 'true');
    await expect(rowNamed(connectionsTable(page), name), 'a conexão recusada não foi salva').toHaveCount(0);
  });
});
