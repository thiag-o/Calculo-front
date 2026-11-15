// Épico 1 · login no app casca (os dois modos).
import { expect, test } from '../apoio/fixtures';
import { campoEmail, entrar, esperarLogin, esperarModulo } from '../apoio/telas';

test.describe('login', () => {
  test('sem sessão, o casca leva ao login; com e-mail e senha certos, abre o módulo no Início', async ({ page, api }) => {
    await page.goto('/inicio');
    await esperarLogin(page);
    await expect(campoEmail(page)).toBeFocused();

    const sessao = await entrar(page, api.conta('admin'));

    expect(sessao.usuario.email.toLowerCase()).toBe(api.conta('admin').email.toLowerCase());
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início' })).toBeVisible();
    // O login emite o cookie fc_csrf, que o front lê para as próximas mutações.
    const cookies = await page.context().cookies();
    expect(cookies.map((cookie) => cookie.name)).toContain('fc_csrf');
  });

  test('a sessão sobrevive a recarregar a página', async ({ page, api }) => {
    const sessao = await entrar(page, api.conta('admin'));

    await page.reload();

    await esperarModulo(page, sessao);
  });
});
