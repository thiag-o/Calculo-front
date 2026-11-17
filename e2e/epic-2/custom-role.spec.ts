// Epic 2 · custom role; the fixed Admin cannot be edited or deleted (both modes).
import { signIn, apiResponse } from '../support/screens';
import type { Schemas } from '../support/contract';
import { expect, test } from './support/fixtures';
import { openFromMenu, callApi, submit, row, suffix } from './support/screens';

const FIXED_ROLE_REASON = 'Tem todas as permissões e não pode ser editado nem removido';

test.describe('papel personalizado', () => {
  test('o Admin cria um papel com as permissões escolhidas e o remove; o Admin fixo fica travado', async ({ page, api }) => {
    const name = `E2E Leitura ${suffix()}`;
    await signIn(page, api.account('admin'));
    const [initialList] = await Promise.all([apiResponse(page, 'GET', '/v1/papeis'), openFromMenu(page, 'Papéis')]);
    const roles = ((await initialList.json()) as Schemas['ListaPapeis']).itens;
    const table = page.getByRole('table', { name: 'Papéis do tenant' });

    await test.step('o Admin aparece travado, sem editar nem remover', async () => {
      const adminRow = table.getByRole('row').filter({ has: page.getByText('Admin', { exact: true }) });
      await expect(adminRow).toHaveCount(1);
      await expect(adminRow.getByText('Fixo', { exact: true })).toBeVisible();
      await expect(adminRow.getByText(FIXED_ROLE_REASON)).toBeVisible();
      await expect(adminRow.getByRole('img', { name: 'Admin travado' })).toBeVisible();
      await expect(adminRow.getByRole('button')).toHaveCount(0);
    });

    let created: Schemas['Papel'] | undefined;
    await test.step('o Admin cria um papel só de leitura', async () => {
      await page.getByRole('button', { name: 'Novo papel' }).first().click();
      const dialog = page.getByRole('dialog', { name: 'Novo papel' });
      await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(name);
      await dialog.getByRole('checkbox', { name: 'Ver workflows', exact: true }).check();
      await dialog.getByRole('checkbox', { name: 'Ver auditoria', exact: true }).check();
      await expect(dialog.getByText(/^2 de \d+ marcadas$/)).toBeVisible();

      const response = await submit(page, 'POST', '/v1/papeis', dialog.getByRole('button', { name: 'Salvar' }));

      expect(response.status()).toBe(201);
      created = (await response.json()) as Schemas['Papel'];
      expect(created).toMatchObject({ nome: name, fixo: false, total_usuarios: 0 });
      expect([...created.permissoes].sort()).toEqual(['auditoria.ver', 'workflows.ver']);
      await expect(dialog).toBeHidden();
      const roleRow = row(table, name);
      await expect(roleRow.getByText('2 permissões', { exact: true })).toBeVisible();
      await expect(roleRow.getByRole('button', { name: `Mais ações para ${name}` })).toBeVisible();
    });

    if (api.mode === 'real' && api.apiUrl) {
      await test.step('modo real: a API recusa alterar e remover o Admin', async () => {
        const admin = roles.find((role) => role.fixo);
        if (!admin) throw new Error('O tenant não tem o papel Admin.');
        const rejection = { status: 409, codigo: 'papel_fixo' };
        const apiUrl = api.apiUrl ?? '';
        expect(await callApi(page, apiUrl, 'PUT', `/v1/papeis/${admin.id}`, { nome: 'Admin', permissoes: [] })).toMatchObject(rejection);
        expect(await callApi(page, apiUrl, 'DELETE', `/v1/papeis/${admin.id}`)).toMatchObject(rejection);
      });
    }

    await test.step('o Admin remove o papel criado, com confirmação', async () => {
      if (!created) throw new Error('O papel não foi criado.');
      await row(table, name).getByRole('button', { name: `Mais ações para ${name}` }).click();
      await page.getByRole('menuitem', { name: 'Remover papel' }).click();
      const dialog = page.getByRole('dialog', { name: 'Remover papel' });
      await expect(dialog).toContainText(`O papel ${name} deixa de existir neste tenant.`);

      const response = await submit(page, 'DELETE', `/v1/papeis/${created.id}`, dialog.getByRole('button', { name: 'Remover papel' }));

      expect(response.status()).toBe(204);
      await expect(dialog).toBeHidden();
      await expect(row(table, name)).toHaveCount(0);
    });
  });
});
