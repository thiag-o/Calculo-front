// Epic 2 · Configurator user without Admin, and single-use reset link (both modes).
import { signIn } from '../support/screens';
import { expect, test } from './support/fixtures';
import {
  openFromMenu,
  linkPath,
  newPasswordField,
  callApi,
  createUser,
  setPasswordByLink,
  newEmail,
  generateResetLink,
  userRow,
  INVALID_LINK_MESSAGE,
  mainNavigation,
  newPassword,
  suffix,
  type User,
} from './support/screens';

const ADMIN_AREAS = ['Usuários', 'Papéis', 'Integração', 'Segurança'];

test.describe('usuário Configurador e link de redefinição', () => {
  test('o Admin cria um Configurador e gera o link; a pessoa define a senha (o link não vale de novo) e entra sem ver Administração', async ({
    page,
    api,
    epic2: epic2,
  }) => {
    const person = { email: newEmail('configurador'), name: `E2E Configurador ${suffix()}` };
    const password = newPassword();
    let user: User | undefined;
    let link = '';

    await test.step('o Admin cria o usuário com o papel Configurador', async () => {
      await signIn(page, api.account('admin'));
      await openFromMenu(page, 'Usuários');

      user = await createUser(page, { ...person, role: 'Configurador' });

      expect(user.roles.map((role) => role.name)).toEqual(['Configurador']);
      const personRow = await userRow(page, person.email);
      await expect(personRow.getByText(person.name, { exact: true })).toBeVisible();
      await expect(personRow.getByRole('list', { name: `Papéis de ${person.name}` })).toHaveText('Configurador');
      await expect(personRow.getByText('Ativo', { exact: true })).toBeVisible();
    });

    await test.step('o Admin gera o link de redefinição, mostrado uma vez só', async () => {
      if (!user) throw new Error('O usuário não foi criado.');
      link = await generateResetLink(page, user);
      // Once the dialog is closed, the link shows nowhere on the screen.
      await expect(page.getByText(link)).toHaveCount(0);
    });

    const otherPage = await epic2.newPage();

    await test.step('a pessoa define a senha pelo link e vai para o login', async () => {
      await setPasswordByLink(otherPage, link, password);
    });

    await test.step('o mesmo link não funciona uma segunda vez', async () => {
      await otherPage.goto(linkPath(link));
      await expect(otherPage.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeVisible();
      await expect(otherPage.getByRole('alert')).toHaveText(INVALID_LINK_MESSAGE);
      await expect(newPasswordField(otherPage)).toHaveCount(0);
    });

    await test.step('a pessoa entra com a nova senha e não vê a Administração', async () => {
      await signIn(otherPage, { email: person.email, password: password });

      const navigation = mainNavigation(otherPage);
      await expect(navigation.getByRole('link', { name: 'Início', exact: true })).toBeVisible();
      await expect(navigation.getByRole('link', { name: 'Administração', exact: true })).toHaveCount(0);
      for (const area of ADMIN_AREAS) {
        await expect(navigation.getByRole('link', { name: area, exact: true })).toHaveCount(0);
      }
      // The Configurator does not have the audit either.
      await expect(navigation.getByRole('link', { name: 'Auditoria', exact: true })).toHaveCount(0);

      // Not even through the address: the route without permission goes back to Home.
      await otherPage.goto('/admin/users');
      await expect(otherPage).toHaveURL(/\/home$/);
      await expect(otherPage.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
      await expect(otherPage.getByRole('heading', { level: 2, name: 'Usuários' })).toHaveCount(0);
    });

    if (api.mode === 'real' && api.apiUrl) {
      await test.step('modo real: a API também recusa a Administração ao Configurador', async () => {
        expect(await callApi(otherPage, api.apiUrl ?? '', 'GET', '/v1/users')).toMatchObject({ status: 403, code: 'no_permission' });
      });
    }
  });
});
