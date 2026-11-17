// Actions and locators of the epic 1 screens, by what the user sees (accessible roles and labels).
import type { Page, Response } from '@playwright/test';
import type { Problem, Session } from './contract';
import { expect, type LoginCredentials } from './fixtures';

export const emailField = (page: Page) => page.getByRole('textbox', { name: 'E-mail' });
export const passwordField = (page: Page) => page.getByLabel('Senha', { exact: true });
export const signInButton = (page: Page) => page.getByRole('button', { name: 'Entrar', exact: true });
export const signInNotice = (page: Page) => page.getByRole('alert');
export const accountMenu = (page: Page, name: string) => page.getByRole('button', { name: `${name}: opções da conta` });
export const tenantSelector = (page: Page, current: string) =>
  page.getByRole('button', { name: `Trocar cliente. Atual: ${current}`, exact: true });

/** The API response to `METHOD path` (any origin other than the shell). */
export function apiResponse(page: Page, method: string, path: string): Promise<Response> {
  return page.waitForResponse(
    (response) => response.request().method() === method && new URL(response.url()).pathname === path,
  );
}

/** Fills in the sign-in form and submits; returns the `POST /v1/session` response. Expects to be on the sign-in screen. */
export async function submitSignIn(page: Page, { email, password: password }: LoginCredentials): Promise<Response> {
  await emailField(page).fill(email);
  await passwordField(page).fill(password);
  const [response] = await Promise.all([apiResponse(page, 'POST', '/v1/session'), signInButton(page).click()]);
  return response;
}

/** Opens `/sign-in`, signs in successfully and waits for the module. Returns the created session. */
export async function signIn(page: Page, credentials: LoginCredentials): Promise<Session> {
  await page.goto('/sign-in');
  const response = await submitSignIn(page, credentials);
  expect(response.status(), 'o login deveria dar certo').toBe(200);
  const session = (await response.json()) as Session;
  await waitForModule(page, session);
  return session;
}

/** The module open on the Home screen, with whoever is signed in shown in the sidebar. */
export async function waitForModule(page: Page, session: Session): Promise<void> {
  await expect(page).toHaveURL(/\/home$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect(accountMenu(page, session.user.name)).toBeVisible();
}

/** The sign-in screen in view (and not the module). */
export async function waitForSignIn(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/sign-in$/);
  await expect(signInButton(page)).toBeVisible();
  await expect(emailField(page)).toBeVisible();
}

/** The problem+json body of an error response. */
export async function problemBody(response: Response): Promise<Problem> {
  return (await response.json()) as Problem;
}
