// Epic 3 · the credential never comes back to the front: after the connection is saved, no API response carries the
// password (Playwright reads every response body), the detail shows the target without it, "Trocar credencial" starts
// with the password empty, and nothing in the page or in the browser storage keeps it (both modes).
import type { Page, Response } from '@playwright/test';
import { suffix } from '../epic-2/support/screens';
import { signIn, apiResponse } from '../support/screens';
import { expect, test } from './support/fixtures';
import {
  connectionsTable,
  openCatalog,
  rowNamed,
  saveConnection,
  startNewConnection,
  type Connection,
} from './support/screens';

interface RecordedResponse {
  route: string;
  status: number;
  body: string;
}

/**
 * Every API response the page receives (`/v1/...` outside the shell, except the preflights), with the whole body. The bodies
 * are read as they arrive; `settle()` waits for all of them and fails if one could not be read, so none goes unchecked.
 */
function recordApiResponses(page: Page, shellOrigin: string) {
  const reads: Promise<RecordedResponse>[] = [];
  page.on('response', (response: Response) => {
    const url = new URL(response.url());
    const method = response.request().method();
    if (!url.pathname.startsWith('/v1/') || url.origin === shellOrigin || method === 'OPTIONS') return;
    const route = `${method} ${url.pathname}`;
    reads.push(
      response.body().then(
        (body) => ({ route, status: response.status(), body: body.toString('utf8') }),
        (error: unknown) => {
          throw new Error(`Não foi possível ler a resposta de ${route}: ${String(error)}`);
        },
      ),
    );
  });
  return {
    async settle(): Promise<RecordedResponse[]> {
      return Promise.all(reads);
    },
  };
}

/** The password as it would appear in a JSON body (escaped) and as it is. */
function passwordForms(password: string): string[] {
  return [...new Set([password, JSON.stringify(password).slice(1, -1)])];
}

test.describe('a credencial nunca volta para o front', () => {
  test('depois de salvar, nenhuma resposta da API traz a senha, e a tela e o navegador não a guardam', async ({
    page,
    api,
    epic3,
    baseURL,
  }) => {
    const credential = epic3.readCredential;
    const name = `Exemplo senha e2e ${suffix()}`;
    const recorder = recordApiResponses(page, new URL(baseURL ?? 'http://localhost:5173').origin);
    await signIn(page, api.account('admin'));
    await openCatalog(page, 'Conexões');

    const dialog = await startNewConnection(page, name, credential);
    const response = await saveConnection(page, dialog);
    expect(response.status(), 'salvar a conexão').toBe(201);
    // Control of the check below: the password goes to the API (only write), in the same text the bodies are searched for.
    expect(passwordForms(credential.password).some((form) => (response.request().postData() ?? '').includes(form))).toBe(true);
    const connection = (await response.json()) as Connection;
    await expect(dialog).toBeHidden();

    // The detail: the target without the password, and the test of the saved connection.
    const [detail] = await Promise.all([
      apiResponse(page, 'GET', `/v1/connections/${connection.id}`),
      rowNamed(connectionsTable(page), name).getByRole('button', { name, exact: true }).click(),
    ]);
    expect(detail.status(), 'abrir a conexão').toBe(200);
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    await expect(page.getByRole('definition').filter({ hasText: credential.username })).toBeVisible();
    const [tested] = await Promise.all([
      apiResponse(page, 'POST', `/v1/connections/${connection.id}/test`),
      page.getByRole('button', { name: 'Testar', exact: true }).click(),
    ]);
    expect(tested.status(), 'testar a conexão salva').toBe(200);
    await expect(page.getByText('Resultado do teste')).toBeVisible();

    // "Trocar credencial": the target comes filled in; the password, empty.
    await page.getByRole('button', { name: `Mais ações para ${name}` }).click();
    await page.getByRole('menuitem', { name: 'Trocar credencial' }).click();
    const credentialDialog = page.getByRole('dialog', { name: 'Trocar credencial' });
    await expect(credentialDialog.getByRole('textbox', { name: 'Usuário', exact: true })).toHaveValue(credential.username);
    await expect(credentialDialog.getByLabel('Senha', { exact: true })).toHaveValue('');
    await credentialDialog.getByRole('button', { name: 'Cancelar' }).click();
    await expect(credentialDialog).toBeHidden();

    // Opening the connection again from a fresh page (the address of the detail), then the list. The bodies read so far
    // are settled first: a reload drops the bodies of the previous page.
    await recorder.settle();
    const [reloaded] = await Promise.all([apiResponse(page, 'GET', `/v1/connections/${connection.id}`), page.reload()]);
    expect(reloaded.status(), 'abrir a conexão de novo').toBe(200);
    await expect(page.getByRole('heading', { level: 2, name, exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Voltar para Conexões' }).click();
    await expect(rowNamed(connectionsTable(page), name)).toHaveCount(1);

    const responses = await recorder.settle();
    const routes = new Set(responses.map((item) => item.route));
    for (const expected of [
      'POST /v1/connections',
      'GET /v1/connections',
      `GET /v1/connections/${connection.id}`,
      `POST /v1/connections/${connection.id}/test`,
    ]) {
      expect(routes, `a resposta de ${expected} foi lida`).toContain(expected);
    }
    const forms = passwordForms(credential.password);
    const leaks = responses.filter((item) => forms.some((form) => item.body.includes(form))).map((item) => item.route);
    expect(leaks, 'respostas da API com a senha').toEqual([]);

    // Nothing on screen, in the fields or in the browser storage has the password.
    await expect(page.getByText(credential.password)).toHaveCount(0);
    const kept = await page.evaluate(
      (forms) => {
        const places: string[] = [];
        const has = (text: string | null) => text !== null && forms.some((form) => text.includes(form));
        if (has(document.documentElement.outerHTML)) places.push('página');
        for (const input of Array.from(document.querySelectorAll('input, textarea'))) {
          if (has((input as HTMLInputElement | HTMLTextAreaElement).value)) places.push('campo');
        }
        for (const storage of [window.localStorage, window.sessionStorage]) {
          for (let index = 0; index < storage.length; index += 1) {
            const key = storage.key(index);
            if (key !== null && (has(key) || has(storage.getItem(key)))) places.push('armazenamento');
          }
        }
        if (has(document.cookie)) places.push('cookie');
        return places;
      },
      forms,
    );
    expect(kept, 'lugares do navegador com a senha').toEqual([]);
  });
});
