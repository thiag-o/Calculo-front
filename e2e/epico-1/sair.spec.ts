// Épico 1 · sair (os dois modos).
import { expect, test } from '../apoio/fixtures';
import { entrar, esperarLogin, menuDaConta, respostaDaApi } from '../apoio/telas';

test.describe('sair', () => {
  test('"Sair" no menu da conta encerra a sessão e volta ao login', async ({ page, api }) => {
    const sessao = await entrar(page, api.conta('admin'));

    await menuDaConta(page, sessao.usuario.nome).click();
    const [saida] = await Promise.all([
      respostaDaApi(page, 'DELETE', '/v1/sessao'),
      page.getByRole('menuitem', { name: 'Sair' }).click(),
    ]);

    // 204 só sai com o X-CSRF-Token certo (o DELETE exige CSRF, nos dois modos).
    expect(saida.status()).toBe(204);
    await esperarLogin(page);
    const cookies = await page.context().cookies();
    expect(cookies.map((cookie) => cookie.name)).not.toContain('fc_csrf');

    // A sessão acabou de fato: abrir o módulo de novo leva ao login.
    await page.goto('/inicio');
    await esperarLogin(page);
  });
});
