// Épico 2 · chamada de um domínio não autorizado é recusada pelo CORS. Só no modo real: na simulação, a recusa seria a
// própria simulação respondendo, sem provar nada do back.
import type { Esquemas } from '../apoio/contrato';
import { entrar } from '../apoio/telas';
import { expect, test } from './apoio/fixtures';
import { chamarApi, sufixo } from './apoio/telas';

/** Uma origem que nenhum tenant autorizou. A página dela é servida pelo próprio teste (não há servidor). */
const ORIGEM_NAO_AUTORIZADA = 'http://hospedeiro-nao-autorizado.e2e.local';

test.describe('CORS da incorporação', () => {
  test('com um token válido, a chamada de um domínio não autorizado é recusada', async ({ page, api, playwright }) => {
    test.skip(api.modo !== 'real', 'Só no modo real (pnpm e2e:real, com E2E_API_URL).');
    const apiUrl = api.apiUrl ?? '';

    // O Admin cria uma chave pelo casca (cookie e CSRF, como a tela faria).
    await entrar(page, api.conta('admin'));
    const criacao = await chamarApi(page, apiUrl, 'POST', '/v1/chaves-api', { nome: `E2E CORS ${sufixo()}` });
    expect(criacao.status, 'criar a chave').toBe(201);
    const chave = criacao.corpo as Esquemas['ChaveApiCriada'];

    // O backend do hospedeiro, fora do navegador, troca a chave por um token.
    const hospedeiro = await playwright.request.newContext({ baseURL: apiUrl });
    try {
      const troca = await hospedeiro.post('/v1/incorporacao/sessoes', {
        headers: { Authorization: `Chave ${chave.chave}` },
        data: { id_externo: 'e2e-cors', email: 'e2e-cors@e2e.local', nome: 'Pessoa do teste de CORS', papeis: [] },
      });
      expect(troca.status(), 'trocar a chave por um token').toBe(201);
      const { token } = (await troca.json()) as Esquemas['TokenIncorporacao'];

      // O módulo numa página de uma origem não autorizada: o navegador não entrega a resposta (CORS).
      const pagina = await page.context().newPage();
      await pagina.route(`${ORIGEM_NAO_AUTORIZADA}/**`, (route) =>
        route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Hospedeiro</title>' }),
      );
      await pagina.goto(`${ORIGEM_NAO_AUTORIZADA}/`);
      const doNavegador = await pagina.evaluate(
        async ({ url, token }) => {
          try {
            const resposta = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            return { entregue: true, status: resposta.status };
          } catch (erro) {
            return { entregue: false, erro: String(erro) };
          }
        },
        { url: `${apiUrl}/v1/sessao`, token },
      );
      expect(doNavegador, 'o navegador barra a resposta para a origem não autorizada').toMatchObject({ entregue: false });
      await pagina.close();

      // Com essa origem, a API recusa o token (403 origem_nao_autorizada) e não libera o CORS para ela.
      const direta = await hospedeiro.get('/v1/sessao', {
        headers: { Authorization: `Bearer ${token}`, Origin: ORIGEM_NAO_AUTORIZADA },
      });
      expect(direta.status()).toBe(403);
      expect(((await direta.json()) as Esquemas['Problema']).codigo).toBe('origem_nao_autorizada');
      expect(direta.headers()['access-control-allow-origin']).not.toBe(ORIGEM_NAO_AUTORIZADA);
    } finally {
      await hospedeiro.dispose();
      // A chave não fica valendo depois do teste.
      const revogacao = await chamarApi(page, apiUrl, 'DELETE', `/v1/chaves-api/${chave.id}`);
      expect(revogacao.status, 'revogar a chave do teste').toBe(204);
    }
  });
});
