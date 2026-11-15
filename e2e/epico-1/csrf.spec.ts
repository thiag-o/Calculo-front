// Épico 1 · mutação autenticada por cookie sem o X-CSRF-Token certo é recusada. Só no modo real: na simulação, a
// recusa seria a própria simulação respondendo, sem provar nada do back.
import { expect, test } from '../apoio/fixtures';
import { entrar, esperarModulo } from '../apoio/telas';

interface Resultado {
  status: number;
  codigo: unknown;
}

test.describe('CSRF', () => {
  test('sem o X-CSRF-Token (ou com outro valor), logout e troca de tenant são recusados e a sessão continua', async ({ page, api }) => {
    test.skip(api.modo !== 'real', 'Só no modo real (pnpm e2e:real, com E2E_API_URL).');
    const sessao = await entrar(page, api.conta('admin'));

    // Do próprio navegador do casca, com o cookie de sessão (credentials: 'include'), como faria outro script.
    const chamar = (metodo: string, caminho: string, cabecalhos: Record<string, string>, corpo?: unknown) =>
      page.evaluate(
        async ({ url, metodo, cabecalhos, corpo }): Promise<Resultado> => {
          const resposta = await fetch(url, {
            method: metodo,
            credentials: 'include',
            headers: cabecalhos,
            body: corpo === undefined ? undefined : JSON.stringify(corpo),
          });
          const json: unknown = await resposta.json().catch(() => null);
          return { status: resposta.status, codigo: (json as { codigo?: unknown } | null)?.codigo };
        },
        { url: `${api.apiUrl}${caminho}`, metodo, cabecalhos, corpo },
      );

    const recusado = { status: 403, codigo: 'csrf_invalido' };
    expect(await chamar('DELETE', '/v1/sessao', {})).toEqual(recusado);
    expect(await chamar('DELETE', '/v1/sessao', { 'X-CSRF-Token': 'outro-valor' })).toEqual(recusado);
    expect(
      await chamar('PUT', '/v1/sessao/tenant', { 'Content-Type': 'application/json' }, { tenant_id: sessao.tenant_atual.id }),
    ).toEqual(recusado);

    // Nada mudou: a sessão segue aberta.
    await page.reload();
    await esperarModulo(page, sessao);
  });
});
