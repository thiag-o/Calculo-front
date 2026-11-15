// Épico 1 · troca de tenant pelo seletor de cliente do menu lateral (os dois modos).
import { expect, test } from '../apoio/fixtures';
import type { Sessao } from '../apoio/contrato';
import { entrar, esperarModulo, respostaDaApi, seletorDeCliente } from '../apoio/telas';

test.describe('troca de tenant', () => {
  test('quem tem dois clientes troca pelo seletor e continua no novo depois de recarregar', async ({ page, api }) => {
    const sessao = await entrar(page, api.conta('doisTenants'));
    // A sessão começa no último tenant usado (ou no primeiro por nome): o teste parte do que a API devolveu.
    const atual = sessao.tenant_atual;
    const outro = sessao.tenants.find((tenant) => tenant.id !== atual.id);
    if (!outro) throw new Error('A conta "doisTenants" precisa pertencer a dois tenants.');

    await seletorDeCliente(page, atual.nome).click();
    const itemAtual = page.getByRole('menuitem', { name: atual.nome, exact: true });
    await expect(itemAtual).toHaveAttribute('aria-disabled', 'true');
    await expect(itemAtual).toHaveAccessibleDescription('Cliente atual');

    const [troca] = await Promise.all([
      respostaDaApi(page, 'PUT', '/v1/sessao/tenant'),
      page.getByRole('menuitem', { name: outro.nome, exact: true }).click(),
    ]);

    // 200 só sai com o X-CSRF-Token certo (a troca exige CSRF, nos dois modos).
    expect(troca.status()).toBe(200);
    const novaSessao = (await troca.json()) as Sessao;
    expect(novaSessao.tenant_atual).toEqual(outro);
    await expect(seletorDeCliente(page, outro.nome)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // O tenant atual fica na sessão do servidor.
    await page.reload();
    await esperarModulo(page, novaSessao);
    await expect(seletorDeCliente(page, outro.nome)).toBeVisible();
  });
});
