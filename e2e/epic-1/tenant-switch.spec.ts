// Epic 1 · tenant switch through the tenant selector in the sidebar (both modes).
import { expect, test } from '../support/fixtures';
import type { Session } from '../support/contract';
import { signIn, waitForModule, apiResponse, tenantSelector } from '../support/screens';

test.describe('troca de tenant', () => {
  test('quem tem dois clientes troca pelo seletor e continua no novo depois de recarregar', async ({ page, api }) => {
    const session = await signIn(page, api.account('twoTenants'));
    // The session starts in the last tenant used (or the first by name): the test starts from what the API returned.
    const current = session.tenant_atual;
    const other = session.tenants.find((tenant) => tenant.id !== current.id);
    if (!other) throw new Error('A conta "twoTenants" precisa pertencer a dois tenants.');

    await tenantSelector(page, current.nome).click();
    const currentItem = page.getByRole('menuitem', { name: current.nome, exact: true });
    await expect(currentItem).toHaveAttribute('aria-disabled', 'true');
    await expect(currentItem).toHaveAccessibleDescription('Cliente atual');

    const [switching] = await Promise.all([
      apiResponse(page, 'PUT', '/v1/sessao/tenant'),
      page.getByRole('menuitem', { name: other.nome, exact: true }).click(),
    ]);

    // 200 only with the right X-CSRF-Token (the switch requires CSRF, in both modes).
    expect(switching.status()).toBe(200);
    const newSession = (await switching.json()) as Session;
    expect(newSession.tenant_atual).toEqual(other);
    await expect(tenantSelector(page, other.nome)).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);

    // The current tenant is kept in the server session.
    await page.reload();
    await waitForModule(page, newSession);
    await expect(tenantSelector(page, other.nome)).toBeVisible();
  });
});
