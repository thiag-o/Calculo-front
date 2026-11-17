// Epic 2 · the Auditor sees sign-ins, failures, locks and password resets in the access audit (both modes).
import type { Locator } from '@playwright/test';
import type { Session } from '../support/contract';
import { signIn, submitSignIn, waitForModule } from '../support/screens';
import { expect, test } from './support/fixtures';
import {
  openFromMenu,
  createUser,
  setPasswordByLink,
  newEmail,
  filterAccessEvents,
  generateResetLink,
  mainNavigation,
  newPassword,
  suffix,
} from './support/screens';

/** Backend rule (G4): the 5th consecutive failure locks the e-mail; the next attempt is already rejected. */
const FAILURES_UNTIL_LOCK = 5;

/** The event row in the filtered list, by the e-mail of who did it (Quem column) or by a text of the detail. */
function event(table: Locator, label: string, text: string): Locator {
  return table.getByRole('row').filter({ has: table.page().getByText(label, { exact: true }) }).filter({ hasText: text });
}

test.describe('auditoria de acessos', () => {
  test('o Auditor vê os logins, as falhas, o bloqueio e as redefinições de senha dos membros do tenant', async ({ page, api, epic2: epic2 }) => {
    const auditor = { email: newEmail('auditor'), name: `E2E Auditor ${suffix()}`, password: newPassword() };
    // Member without a password, who fails sign-in until locked. Only members' e-mails show up in the audit.
    const locked = { email: newEmail('bloqueado'), name: `E2E Bloqueado ${suffix()}` };
    let link = '';

    await test.step('o Admin cria o Auditor e um membro, e gera o link do Auditor', async () => {
      await signIn(page, api.account('admin'));
      await openFromMenu(page, 'Usuários');
      const auditorUser = await createUser(page, { email: auditor.email, name: auditor.name, role: 'Auditor' });
      await createUser(page, { ...locked, role: 'Operador' });
      link = await generateResetLink(page, auditorUser);
    });

    const otherPage = await epic2.newPage();

    await test.step('o Auditor define a senha pelo link', async () => {
      await setPasswordByLink(otherPage, link, auditor.password);
    });

    await test.step('o outro membro erra o login até ser bloqueado', async () => {
      const credentials = { email: locked.email, password: 'senha-que-nao-confere' };
      for (let attempt = 1; attempt <= FAILURES_UNTIL_LOCK; attempt += 1) {
        expect((await submitSignIn(otherPage, credentials)).status(), `tentativa ${attempt}`).toBe(401);
      }
      expect((await submitSignIn(otherPage, credentials)).status(), 'tentativa depois do bloqueio').toBe(423);
    });

    await test.step('o Auditor entra e abre a Auditoria', async () => {
      // The page is already on sign-in (the link led there, and the lock keeps it there): sign in right there, without `signIn`,
      // which would open /sign-in again and reload the whole shell for nothing (about 1 s on the Vite dev server).
      const response = await submitSignIn(otherPage, { email: auditor.email, password: auditor.password });
      expect(response.status(), 'o login do Auditor').toBe(200);
      await waitForModule(otherPage, (await response.json()) as Session);
      // The Auditor sees the Audit, but not the Admin.
      await expect(mainNavigation(otherPage).getByRole('group', { name: 'Administração' })).toHaveCount(0);
      await openFromMenu(otherPage, 'Auditoria');
    });

    await test.step('o login do Auditor', async () => {
      const table = await filterAccessEvents(otherPage, 'Login');
      await expect(event(table, 'Login', auditor.email)).toHaveCount(1);
    });

    await test.step('as falhas e o bloqueio do outro membro', async () => {
      const failures = await filterAccessEvents(otherPage, 'Falha de login');
      await expect(event(failures, 'Falha de login', locked.email)).toHaveCount(FAILURES_UNTIL_LOCK);

      const locks = await filterAccessEvents(otherPage, 'Login bloqueado');
      await expect(event(locks, 'Login bloqueado', locked.email)).toHaveCount(1);
      await expect(event(locks, 'Login bloqueado', locked.email)).toContainText('Bloqueado até');
    });

    await test.step('o link gerado pelo Admin e a senha redefinida pelo Auditor', async () => {
      // The Admin generates it; the detail says for whom.
      const generated = await filterAccessEvents(otherPage, 'Link de redefinição gerado');
      await expect(event(generated, 'Link de redefinição gerado', `Link de redefinição para ${auditor.email}`)).toHaveCount(1);

      const passwordResets = await filterAccessEvents(otherPage, 'Senha redefinida');
      await expect(event(passwordResets, 'Senha redefinida', auditor.email)).toHaveCount(1);
    });
  });
});
