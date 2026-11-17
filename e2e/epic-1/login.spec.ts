// Epic 1 · sign-in in the shell app (both modes).
import { expect, test } from '../support/fixtures';
import { emailField, signIn, waitForSignIn, waitForModule } from '../support/screens';

test.describe('login', () => {
  test('sem sessão, o casca leva ao login; com e-mail e senha certos, abre o módulo no Início', async ({ page, api }) => {
    await page.goto('/home');
    await waitForSignIn(page);
    await expect(emailField(page)).toBeFocused();

    const session = await signIn(page, api.account('admin'));

    expect(session.usuario.email.toLowerCase()).toBe(api.account('admin').email.toLowerCase());
    await expect(page.getByRole('navigation', { name: 'Navegação principal' }).getByRole('link', { name: 'Início' })).toBeVisible();
    // Sign-in issues the fc_csrf cookie, which the front reads for the next mutations.
    const cookies = await page.context().cookies();
    expect(cookies.map((cookie) => cookie.name)).toContain('fc_csrf');
  });

  test('a sessão sobrevive a recarregar a página', async ({ page, api }) => {
    const session = await signIn(page, api.account('admin'));

    await page.reload();

    await waitForModule(page, session);
  });
});
