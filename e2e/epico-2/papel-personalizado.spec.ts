// Épico 2 · papel personalizado; o Admin fixo não pode ser editado nem removido (os dois modos).
import { entrar, respostaDaApi } from '../apoio/telas';
import type { Esquemas } from '../apoio/contrato';
import { expect, test } from './apoio/fixtures';
import { abrirNoMenu, chamarApi, enviar, linha, sufixo } from './apoio/telas';

const MOTIVO_PAPEL_FIXO = 'Tem todas as permissões e não pode ser editado nem removido';

test.describe('papel personalizado', () => {
  test('o Admin cria um papel com as permissões escolhidas e o remove; o Admin fixo fica travado', async ({ page, api }) => {
    const nome = `E2E Leitura ${sufixo()}`;
    await entrar(page, api.conta('admin'));
    const [listaInicial] = await Promise.all([respostaDaApi(page, 'GET', '/v1/papeis'), abrirNoMenu(page, 'Papéis')]);
    const papeis = ((await listaInicial.json()) as Esquemas['ListaPapeis']).itens;
    const tabela = page.getByRole('table', { name: 'Papéis do tenant' });

    await test.step('o Admin aparece travado, sem editar nem remover', async () => {
      const linhaAdmin = tabela.getByRole('row').filter({ has: page.getByText('Admin', { exact: true }) });
      await expect(linhaAdmin).toHaveCount(1);
      await expect(linhaAdmin.getByText('Fixo', { exact: true })).toBeVisible();
      await expect(linhaAdmin.getByText(MOTIVO_PAPEL_FIXO)).toBeVisible();
      await expect(linhaAdmin.getByRole('img', { name: 'Admin travado' })).toBeVisible();
      await expect(linhaAdmin.getByRole('button')).toHaveCount(0);
    });

    let criado: Esquemas['Papel'] | undefined;
    await test.step('o Admin cria um papel só de leitura', async () => {
      await page.getByRole('button', { name: 'Novo papel' }).first().click();
      const dialogo = page.getByRole('dialog', { name: 'Novo papel' });
      await dialogo.getByRole('textbox', { name: 'Nome', exact: true }).fill(nome);
      await dialogo.getByRole('checkbox', { name: 'Ver workflows', exact: true }).check();
      await dialogo.getByRole('checkbox', { name: 'Ver auditoria', exact: true }).check();
      await expect(dialogo.getByText(/^2 de \d+ marcadas$/)).toBeVisible();

      const resposta = await enviar(page, 'POST', '/v1/papeis', dialogo.getByRole('button', { name: 'Salvar' }));

      expect(resposta.status()).toBe(201);
      criado = (await resposta.json()) as Esquemas['Papel'];
      expect(criado).toMatchObject({ nome, fixo: false, total_usuarios: 0 });
      expect([...criado.permissoes].sort()).toEqual(['auditoria.ver', 'workflows.ver']);
      await expect(dialogo).toBeHidden();
      const linhaPapel = linha(tabela, nome);
      await expect(linhaPapel.getByText('2 permissões', { exact: true })).toBeVisible();
      await expect(linhaPapel.getByRole('button', { name: `Mais ações para ${nome}` })).toBeVisible();
    });

    if (api.modo === 'real' && api.apiUrl) {
      await test.step('modo real: a API recusa alterar e remover o Admin', async () => {
        const admin = papeis.find((papel) => papel.fixo);
        if (!admin) throw new Error('O tenant não tem o papel Admin.');
        const recusa = { status: 409, codigo: 'papel_fixo' };
        const apiUrl = api.apiUrl ?? '';
        expect(await chamarApi(page, apiUrl, 'PUT', `/v1/papeis/${admin.id}`, { nome: 'Admin', permissoes: [] })).toMatchObject(recusa);
        expect(await chamarApi(page, apiUrl, 'DELETE', `/v1/papeis/${admin.id}`)).toMatchObject(recusa);
      });
    }

    await test.step('o Admin remove o papel criado, com confirmação', async () => {
      if (!criado) throw new Error('O papel não foi criado.');
      await linha(tabela, nome).getByRole('button', { name: `Mais ações para ${nome}` }).click();
      await page.getByRole('menuitem', { name: 'Remover papel' }).click();
      const dialogo = page.getByRole('dialog', { name: 'Remover papel' });
      await expect(dialogo).toContainText(`O papel ${nome} deixa de existir neste tenant.`);

      const resposta = await enviar(page, 'DELETE', `/v1/papeis/${criado.id}`, dialogo.getByRole('button', { name: 'Remover papel' }));

      expect(resposta.status()).toBe(204);
      await expect(dialogo).toBeHidden();
      await expect(linha(tabela, nome)).toHaveCount(0);
    });
  });
});
