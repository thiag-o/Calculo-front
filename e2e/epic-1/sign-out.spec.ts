// Epic 1 · sign-out (both modes).
import { expect, test } from '../support/fixtures';
import { signIn, waitForSignIn, accountMenu, apiResponse } from '../support/screens';

test.describe('sair', () => {
  test('"Sair" no menu da conta encerra a sessão e volta ao login', async ({ page, api }) => {
    const session = await signIn(page, api.account('admin'));

    await accountMenu(page, session.usuario.nome).click();
    const [output] = await Promise.all([
      apiResponse(page, 'DELETE', '/v1/sessao'),
      page.getByRole('menuitem', { name: 'Sair' }).click(),
    ]);

    // 204 only with the right X-CSRF-Token (the DELETE requires CSRF, in both modes).
    expect(output.status()).toBe(204);
    await waitForSignIn(page);
    const cookies = await page.context().cookies();
    expect(cookies.map((cookie) => cookie.name)).not.toContain('fc_csrf');

    // The session really ended: opening the module again leads to sign-in.
    await page.goto('/home');
    await waitForSignIn(page);
  });
});
