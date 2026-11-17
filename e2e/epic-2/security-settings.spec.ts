// Epic 2 · tenant security settings: the Admin changes the session inactivity and the minimum password; a value out of
// range is rejected; the change shows in the audit (both modes).
import type { Locator, Page, Request } from '@playwright/test';
import type { Schemas } from '../support/contract';
import { signIn, apiResponse } from '../support/screens';
import { expect, test } from './support/fixtures';
import { openFromMenu, callApi, submit, filterAccessEvents } from './support/screens';

const INACTIVITY = 'Inatividade da sessão (minutos)';
const MIN_PASSWORD_LENGTH = 'Tamanho mínimo da senha (caracteres)';
const SAVED_MESSAGE = 'Parâmetros de segurança salvos.';

const field = (page: Page, label: string): Locator => page.getByRole('textbox', { name: label, exact: true });

/** A new value within the bounds: one more (or one less, if already at the maximum). */
function otherValue(parameter: Schemas['ParametroSeguranca']): number {
  return parameter.valor < parameter.maximo ? parameter.valor + 1 : parameter.valor - 1;
}

/** Fills both fields, saves and confirms in the dialog, which lists what changes. */
async function save(page: Page, inactivity: number, minPasswordLength: number, confirmation: readonly string[]) {
  await field(page, INACTIVITY).fill(String(inactivity));
  await field(page, MIN_PASSWORD_LENGTH).fill(String(minPasswordLength));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const dialog = page.getByRole('dialog', { name: 'Salvar parâmetros de segurança' });
  const updates = dialog.getByRole('list', { name: 'Parâmetros alterados' });
  for (const text of confirmation) await expect(updates).toContainText(text);

  const response = await submit(page, 'PUT', '/v1/configuracoes/seguranca', dialog.getByRole('button', { name: 'Salvar', exact: true }));

  expect(response.status(), 'salvar os parâmetros').toBe(200);
  await expect(dialog).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: SAVED_MESSAGE })).toBeVisible();
  return (await response.json()) as Schemas['ConfiguracaoSeguranca'];
}

test.describe('configuração de segurança', () => {
  test('o Admin muda a inatividade e a senha mínima; fora do limite é recusado; a mudança fica na auditoria', async ({ page, api }) => {
    const session = await signIn(page, api.account('admin'));
    const [query] = await Promise.all([apiResponse(page, 'GET', '/v1/configuracoes/seguranca'), openFromMenu(page, 'Segurança')]);
    expect(query.status()).toBe(200);
    // In real mode the tenant may not be at the defaults: the test starts from what the API returned and goes back to it at the end.
    const original = (await query.json()) as Schemas['ConfiguracaoSeguranca'];
    const inactivity = { from: original.inatividade_minutos.valor, to: otherValue(original.inatividade_minutos) };
    const minPasswordLength = { from: original.senha_minima.valor, to: otherValue(original.senha_minima) };

    await test.step('o Admin muda a inatividade da sessão e a senha mínima', async () => {
      await expect(field(page, INACTIVITY)).toHaveValue(String(inactivity.from));
      await expect(field(page, MIN_PASSWORD_LENGTH)).toHaveValue(String(minPasswordLength.from));

      const saved = await save(page, inactivity.to, minPasswordLength.to, [
        `de ${inactivity.from.toLocaleString('pt-BR')} minutos para ${inactivity.to.toLocaleString('pt-BR')} minutos`,
        `de ${minPasswordLength.from} caracteres para ${minPasswordLength.to} caracteres`,
      ]);

      expect(saved.inatividade_minutos.valor).toBe(inactivity.to);
      expect(saved.senha_minima.valor).toBe(minPasswordLength.to);
      await expect(field(page, INACTIVITY)).toHaveValue(String(inactivity.to));
      await expect(field(page, MIN_PASSWORD_LENGTH)).toHaveValue(String(minPasswordLength.to));
    });

    await test.step('um valor fora dos limites é recusado e nada é enviado', async () => {
      const submissions: Request[] = [];
      const count = (request: Request) => {
        if (request.method() === 'PUT' && new URL(request.url()).pathname === '/v1/configuracoes/seguranca') submissions.push(request);
      };
      page.on('request', count);
      const { minimo: min, maximo: max } = original.inatividade_minutos;

      await field(page, INACTIVITY).fill(String(min - 1));
      await page.getByRole('button', { name: 'Salvar', exact: true }).click();

      await expect(field(page, INACTIVITY)).toHaveAttribute('aria-invalid', 'true');
      await expect(field(page, INACTIVITY)).toHaveAccessibleDescription(
        new RegExp(`^Informe um valor de ${min.toLocaleString('pt-BR')} a ${max.toLocaleString('pt-BR')}\\.`),
      );
      await expect(page.getByRole('dialog', { name: 'Salvar parâmetros de segurança' })).toHaveCount(0);
      page.off('request', count);
      expect(submissions, 'a tela não envia o valor fora do limite').toHaveLength(0);

      if (api.mode === 'real' && api.apiUrl) {
        // The API rejects it on its own too, without saving anything.
        const outside = await callApi(page, api.apiUrl, 'PUT', '/v1/configuracoes/seguranca', {
          inatividade_minutos: min - 1,
          duracao_maxima_dias: original.duracao_maxima_dias.valor,
          senha_minima: minPasswordLength.to,
          validade_link_horas: original.validade_link_horas.valor,
          validade_token_minutos: original.validade_token_minutos.valor,
        });
        expect(outside).toMatchObject({ status: 422, codigo: 'valor_fora_do_limite' });
      }
    });

    await test.step('a mudança aparece na auditoria de acessos', async () => {
      await openFromMenu(page, 'Auditoria');
      const table = await filterAccessEvents(page, 'Segurança alterada');

      // The most recent event (the first row after the header) is this change's, with the old and new value of
      // each changed field in the detail.
      const event = table.getByRole('row').nth(1);
      await expect(event.getByText('Segurança alterada', { exact: true })).toBeVisible();
      await expect(event).toContainText(`inatividade_minutos: ${inactivity.from} → ${inactivity.to}`);
      await expect(event).toContainText(`senha_minima: ${minPasswordLength.from} → ${minPasswordLength.to}`);
      await expect(event.getByText(session.usuario.email, { exact: true })).toBeVisible();
    });

    await test.step('o Admin volta os valores de antes', async () => {
      await openFromMenu(page, 'Segurança');
      await expect(field(page, INACTIVITY)).toHaveValue(String(inactivity.to));

      const saved = await save(page, inactivity.from, minPasswordLength.from, [
        `de ${inactivity.to.toLocaleString('pt-BR')} minutos para ${inactivity.from.toLocaleString('pt-BR')} minutos`,
      ]);

      expect(saved.inatividade_minutos.valor).toBe(inactivity.from);
      expect(saved.senha_minima.valor).toBe(minPasswordLength.from);
    });
  });
});
