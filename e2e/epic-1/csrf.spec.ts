// Epic 1 · a cookie-authenticated mutation without the right X-CSRF-Token is rejected. Real mode only: in the simulation,
// the rejection would be the simulation itself answering, proving nothing about the backend.
import { expect, test } from '../support/fixtures';
import { signIn, waitForModule } from '../support/screens';

interface Result {
  status: number;
  code: unknown;
}

test.describe('CSRF', () => {
  test('sem o X-CSRF-Token (ou com outro valor), logout e troca de tenant são recusados e a sessão continua', async ({ page, api }) => {
    test.skip(api.mode !== 'real', 'Só no modo real (pnpm e2e:real, com E2E_API_URL).');
    const session = await signIn(page, api.account('admin'));

    // From the shell's own browser, with the session cookie (credentials: 'include'), as another script would.
    const call = (method: string, path: string, headers: Record<string, string>, body?: unknown) =>
      page.evaluate(
        async ({ url, method, headers, body }): Promise<Result> => {
          const response = await fetch(url, {
            method,
            credentials: 'include',
            headers,
            body: body === undefined ? undefined : JSON.stringify(body),
          });
          const json: unknown = await response.json().catch(() => null);
          return { status: response.status, code: (json as { code?: unknown } | null)?.code };
        },
        { url: `${api.apiUrl}${path}`, method, headers, body },
      );

    const rejected = { status: 403, code: 'invalid_csrf' };
    expect(await call('DELETE', '/v1/session', {})).toEqual(rejected);
    expect(await call('DELETE', '/v1/session', { 'X-CSRF-Token': 'outro-valor' })).toEqual(rejected);
    expect(
      await call('PUT', '/v1/session/tenant', { 'Content-Type': 'application/json' }, { tenant_id: session.current_tenant.id }),
    ).toEqual(rejected);

    // Nothing changed: the session is still open.
    await page.reload();
    await waitForModule(page, session);
  });
});
