// Actions and locators of the epic 2 screens (Admin, Audit, new password), by what the user sees.
// The sign-in and module ones are in e2e/support/screens.ts.
import { randomUUID } from 'node:crypto';
import type { Locator, Page, Response } from '@playwright/test';
import type { Schemas } from '../../support/contract';
import { waitForSignIn, apiResponse } from '../../support/screens';
import { expect } from './fixtures';

export type User = Schemas['User'];

/** Messages of the new password screen (session/reset-password/resetPasswordMessages.ts). */
export const INVALID_LINK_MESSAGE = 'Este link não vale mais: já foi usado ou venceu. Peça ao administrador um link novo.';

/** A new suffix on each call, for the names the test creates (in real mode, the database keeps previous runs). */
export function suffix(): string {
  return randomUUID().slice(0, 8);
}

/** Um e-mail novo a cada chamada. */
export function newEmail(who: string): string {
  return `e2e-${who}-${randomUUID()}@e2e.local`;
}

/** A new password (46 characters): meets the minimum password even with the Security test changing it at the same time. */
export function newPassword(): string {
  return `Senha E2E ${randomUUID()}`;
}

export const mainNavigation = (page: Page) => page.getByRole('navigation', { name: 'Navegação principal' });

/** The Admin and Audit screens: the title (h2) the screen shows. */
const SCREENS = {
  Usuários: 'Usuários',
  Papéis: 'Papéis',
  Integração: 'Chaves de API',
  Segurança: 'Segurança',
  Auditoria: 'Acessos',
} as const;

/** The Admin areas: internal tabs of the screen opened by the "Administração" sidebar item. */
const ADMIN_AREAS: readonly (keyof typeof SCREENS)[] = ['Usuários', 'Papéis', 'Integração', 'Segurança'];

/**
 * Opens a screen through the shell sidebar and waits for its title. Auditoria is a sidebar item; an Admin area is a tab
 * of the screen the "Administração" item opens.
 */
export async function openFromMenu(page: Page, item: keyof typeof SCREENS): Promise<void> {
  if (ADMIN_AREAS.includes(item)) {
    await mainNavigation(page).getByRole('link', { name: 'Administração', exact: true }).click();
    await expect(page.getByRole('heading', { level: 1, name: 'Administração', exact: true })).toBeVisible();
    await page.getByRole('tablist', { name: 'Administração' }).getByRole('tab', { name: item, exact: true }).click();
  } else {
    await mainNavigation(page).getByRole('link', { name: item, exact: true }).click();
  }
  await expect(page.getByRole('heading', { level: 2, name: SCREENS[item], exact: true })).toBeVisible();
}

/** The table row that contains the text. */
export function row(table: Locator, text: string): Locator {
  return table.getByRole('row').filter({ hasText: text });
}

export const usersTable = (page: Page) => page.getByRole('table', { name: 'Usuários do tenant' });

/**
 * The user row in the list. The list is paginated by name: in real mode, with previous runs in the database, the user
 * may be on a following page ("Carregar mais usuários").
 */
export async function userRow(page: Page, email: string): Promise<Locator> {
  const wanted = row(usersTable(page), email);
  const loadMore = page.getByRole('button', { name: 'Carregar mais usuários' });
  await expect(usersTable(page)).not.toHaveAttribute('aria-busy', 'true');
  await expect(async () => {
    if ((await wanted.count()) === 0 && (await loadMore.isVisible())) await loadMore.click();
    await expect(wanted).toHaveCount(1, { timeout: 1_000 });
  }).toPass();
  return wanted;
}

/** "Novo usuário" on the Users screen: e-mail, name and one role. Returns the created user (`201` response). */
export async function createUser(page: Page, data: { email: string; name: string; role: string }): Promise<User> {
  await page.getByRole('button', { name: 'Novo usuário' }).first().click();
  const dialog = page.getByRole('dialog', { name: 'Novo usuário' });
  await dialog.getByRole('textbox', { name: 'E-mail' }).fill(data.email);
  await dialog.getByRole('textbox', { name: 'Nome', exact: true }).fill(data.name);
  await dialog.getByRole('checkbox', { name: data.role, exact: true }).check();

  const response = await submit(page, 'POST', '/v1/users', dialog.getByRole('button', { name: 'Salvar' }));
  expect(response.status(), 'criar o usuário').toBe(201);
  await expect(dialog).toBeHidden();
  return (await response.json()) as User;
}

/**
 * "Gerar link de redefinição" in the user row menu: confirms, generates and reads the link, shown only once. Closes the
 * dialog and returns the link.
 */
export async function generateResetLink(page: Page, user: User): Promise<string> {
  const row = await userRow(page, user.email);
  await row.getByRole('button', { name: `Mais ações para ${user.name}` }).click();
  await page.getByRole('menuitem', { name: 'Gerar link de redefinição' }).click();
  const dialog = page.getByRole('dialog', { name: 'Link de redefinição' });

  const response = await submit(
    page,
    'POST',
    `/v1/users/${user.id}/password-reset`,
    dialog.getByRole('button', { name: 'Gerar link de redefinição' }),
  );
  expect(response.status(), 'gerar o link').toBe(201);
  await expect(dialog.getByText('Copie o link agora: ele não será mostrado de novo.')).toBeVisible();
  const link = await dialog.getByRole('textbox', { name: 'Link' }).inputValue();
  expect(link).toBe(((await response.json()) as Schemas['ResetLink']).link);

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  return link;
}

/** The reset link address in the test shell (the backend builds the link with its shell URL). */
export function linkPath(link: string): string {
  const url = new URL(link);
  expect(url.pathname, 'o link leva à tela de nova senha do casca').toBe('/reset-password');
  return `${url.pathname}${url.search}`;
}

/** The "Nova senha" field of the reset screen (the screen section is also called "Nova senha"). */
export const newPasswordField = (page: Page) => page.getByRole('textbox', { name: 'Nova senha', exact: true });

/** Opens the reset link, sets the password and waits for the shell to lead to sign-in. */
export async function setPasswordByLink(page: Page, link: string, password: string): Promise<void> {
  await page.goto(linkPath(link));
  await expect(page.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeVisible();
  await newPasswordField(page).fill(password);
  await page.getByRole('textbox', { name: 'Repita a nova senha', exact: true }).fill(password);

  const response = await submit(page, 'POST', '/v1/password-reset', page.getByRole('button', { name: 'Salvar' }));
  expect(response.status(), 'trocar a senha pelo link').toBe(204);
  await waitForSignIn(page);
}

/** Clicks and returns the response of the `METHOD path` the click triggers. */
export async function submit(page: Page, method: string, path: string, button: Locator): Promise<Response> {
  const [response] = await Promise.all([apiResponse(page, method, path), button.click()]);
  return response;
}

/** Picks a type in the "Tipo de evento" filter of Audit › Access and waits for the filtered list. */
export async function filterAccessEvents(page: Page, typeLabel: string): Promise<Locator> {
  await page.getByRole('combobox', { name: 'Tipo de evento' }).click();
  const [response] = await Promise.all([
    page.waitForResponse((r) => {
      const url = new URL(r.url());
      return r.request().method() === 'GET' && url.pathname === '/v1/audit/access-events' && url.searchParams.has('type');
    }),
    page.getByRole('option', { name: typeLabel, exact: true }).click(),
  ]);
  expect(response.status(), `filtrar por ${typeLabel}`).toBe(200);
  const table = page.getByRole('table', { name: 'Eventos de acesso do tenant' });
  await expect(table).not.toHaveAttribute('aria-busy', 'true');
  return table;
}

/** Result of a call made from inside the browser. */
export interface CallResult {
  status: number;
  code: unknown;
  body: unknown;
}

/**
 * Calls the API from inside the shell's browser, with the session cookie and the `X-CSRF-Token` from the `fc_csrf` cookie, as the
 * module would. Serves the real-mode checks (the rejection comes from the backend, not from the screen).
 */
export function callApi(
  page: Page,
  apiUrl: string,
  method: string,
  path: string,
  body?: unknown,
): Promise<CallResult> {
  return page.evaluate(
    async ({ url, method, body }): Promise<CallResult> => {
      const csrf = document.cookie
        .split(';')
        .map((pair) => pair.trim().split('='))
        .find(([name]) => name === 'fc_csrf')?.[1];
      const headers: Record<string, string> = {};
      if (csrf && method !== 'GET') headers['X-CSRF-Token'] = csrf;
      if (body !== undefined) headers['Content-Type'] = 'application/json';
      const response = await fetch(url, {
        method,
        credentials: 'include',
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      });
      const json: unknown = await response.json().catch(() => null);
      return { status: response.status, code: (json as { code?: unknown } | null)?.code, body: json };
    },
    { url: `${apiUrl}${path}`, method, body },
  );
}
