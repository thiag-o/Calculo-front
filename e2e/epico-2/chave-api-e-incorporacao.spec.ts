// Épico 2 · chave de API e incorporação: o Admin cria a chave (mostrada uma vez) e cadastra o domínio; o "hospedeiro"
// (a página de teste de incorporação do casca) troca a chave por um token e abre o módulo incorporado, com abas e sem
// menu lateral; com a chave revogada, a troca falha (os dois modos).
import type { Page } from '@playwright/test';
import type { Esquemas } from '../apoio/contrato';
import { entrar, respostaDaApi } from '../apoio/telas';
import { expect, test } from './apoio/fixtures';
import { abrirNoMenu, enviar, linha, sufixo } from './apoio/telas';

const AVISO_CHAVE_UMA_VEZ = 'Copie a chave agora: ela não será mostrada de novo.';
const PAGINA_DE_TESTE = '/teste-incorporacao.html';

const tabelaChaves = (page: Page) => page.getByRole('table', { name: 'Chaves de API do tenant' });
const tabelaDominios = (page: Page) => page.getByRole('table', { name: 'Domínios autorizados do tenant' });

/** Remove o domínio pela tela, com confirmação. */
async function removerDominio(page: Page, origem: string): Promise<void> {
  await linha(tabelaDominios(page), origem).getByRole('button', { name: `Mais ações para ${origem}` }).click();
  await page.getByRole('menuitem', { name: 'Remover domínio' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Remover domínio' });
  const [resposta] = await Promise.all([
    page.waitForResponse((r) => r.request().method() === 'DELETE' && new URL(r.url()).pathname.startsWith('/v1/dominios-autorizados/')),
    dialogo.getByRole('button', { name: 'Remover domínio' }).click(),
  ]);
  expect(resposta.status(), 'remover o domínio').toBe(204);
  await expect(linha(tabelaDominios(page), origem)).toHaveCount(0);
}

/**
 * Na página de teste de incorporação: troca a chave por um token (o papel do backend do hospedeiro) e monta o módulo
 * inteiro (`<FluxoCalculo token>`), a opção padrão da página.
 */
async function trocarChavePorToken(hospedeiro: Page, chave: string, papeis: string) {
  await hospedeiro.getByRole('textbox', { name: 'Chave de API' }).fill(chave);
  await hospedeiro.getByRole('textbox', { name: 'Papéis (nomes, separados por vírgula)' }).fill(papeis);
  return enviar(hospedeiro, 'POST', '/v1/incorporacao/sessoes', hospedeiro.getByRole('button', { name: /^Obter token e montar/ }));
}

test.describe('chave de API e incorporação', () => {
  test('o hospedeiro troca a chave por um token e abre o módulo incorporado; com a chave revogada, a troca falha', async ({
    page,
    api,
    epico2,
  }) => {
    const nomeChave = `E2E Hospedeiro ${sufixo()}`;
    const origem = epico2.origemCasca;
    let chave = '';
    let chaveCriada: Esquemas['ChaveApiCriada'] | undefined;

    await entrar(page, api.conta('admin'));
    await abrirNoMenu(page, 'Integração');

    await test.step('o Admin cria a chave de API, mostrada uma vez só', async () => {
      await page.getByRole('button', { name: 'Nova chave de API' }).first().click();
      const dialogo = page.getByRole('dialog', { name: 'Nova chave de API' });
      await dialogo.getByRole('textbox', { name: 'Nome', exact: true }).fill(nomeChave);

      const resposta = await enviar(page, 'POST', '/v1/chaves-api', dialogo.getByRole('button', { name: 'Salvar' }));

      expect(resposta.status()).toBe(201);
      chaveCriada = (await resposta.json()) as Esquemas['ChaveApiCriada'];
      await expect(dialogo.getByText(AVISO_CHAVE_UMA_VEZ)).toBeVisible();
      chave = await dialogo.getByRole('textbox', { name: 'Chave', exact: true }).inputValue();
      expect(chave).toBe(chaveCriada.chave);

      await page.keyboard.press('Escape');
      await expect(dialogo).toBeHidden();
      // Na lista, só o começo da chave; a chave inteira não aparece mais.
      const linhaChave = linha(tabelaChaves(page), nomeChave);
      await expect(linhaChave.getByText(`${chaveCriada.prefixo}…`, { exact: true })).toBeVisible();
      await expect(linhaChave.getByText('Ativa', { exact: true })).toBeVisible();
      await expect(linhaChave.getByText('Nunca usada', { exact: true })).toBeVisible();
      await expect(page.getByText(chave)).toHaveCount(0);
    });

    await test.step('o Admin cadastra a origem do hospedeiro como domínio autorizado', async () => {
      await expect(tabelaDominios(page)).not.toHaveAttribute('aria-busy', 'true');
      // Modo real: uma rodada anterior interrompida pode ter deixado o domínio cadastrado.
      if ((await linha(tabelaDominios(page), origem).count()) > 0) await removerDominio(page, origem);

      await page.getByRole('button', { name: 'Novo domínio' }).first().click();
      const dialogo = page.getByRole('dialog', { name: 'Novo domínio' });
      await dialogo.getByRole('textbox', { name: 'Origem' }).fill(origem);

      const resposta = await enviar(page, 'POST', '/v1/dominios-autorizados', dialogo.getByRole('button', { name: 'Salvar' }));

      expect(resposta.status()).toBe(201);
      await expect(dialogo).toBeHidden();
      await expect(linha(tabelaDominios(page), origem)).toHaveCount(1);
    });

    const hospedeiro = await epico2.novaPagina();

    await test.step('o hospedeiro troca a chave por um token e abre o módulo incorporado, com abas e sem menu lateral', async () => {
      await hospedeiro.goto(PAGINA_DE_TESTE);

      const troca = await trocarChavePorToken(hospedeiro, chave, 'Auditor');

      expect(troca.status()).toBe(201);
      // As abas do módulo, pelas permissões do papel Auditor; nada do layout do casca.
      const abas = hospedeiro.getByRole('navigation', { name: 'Telas do Fluxo de Cálculo' });
      await expect(abas.getByRole('link', { name: 'Início', exact: true })).toBeVisible();
      await expect(abas.getByRole('link', { name: 'Auditoria', exact: true })).toBeVisible();
      await expect(abas.getByRole('link', { name: 'Administração', exact: true })).toHaveCount(0);
      await expect(hospedeiro.getByRole('complementary', { name: 'Menu lateral' })).toHaveCount(0);
      await expect(hospedeiro.getByRole('navigation', { name: 'Navegação principal' })).toHaveCount(0);
      await expect(hospedeiro.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();

      // Trocar de aba usa o token (Bearer) da origem autorizada e não mexe na URL do hospedeiro.
      const [acessos] = await Promise.all([
        respostaDaApi(hospedeiro, 'GET', '/v1/auditoria/acessos'),
        abas.getByRole('link', { name: 'Auditoria', exact: true }).click(),
      ]);
      expect(acessos.status()).toBe(200);
      expect(await acessos.request().headerValue('authorization')).toMatch(/^Bearer /);
      await expect(hospedeiro.getByRole('heading', { level: 2, name: 'Acessos' })).toBeVisible();
      expect(new URL(hospedeiro.url()).pathname).toBe(PAGINA_DE_TESTE);
    });

    await test.step('o Admin revoga a chave', async () => {
      if (!chaveCriada) throw new Error('A chave não foi criada.');
      const linhaChave = linha(tabelaChaves(page), nomeChave);
      await linhaChave.getByRole('button', { name: `Mais ações para a chave ${nomeChave}` }).click();
      await page.getByRole('menuitem', { name: 'Revogar chave' }).click();
      const dialogo = page.getByRole('dialog', { name: 'Revogar chave' });

      const resposta = await enviar(page, 'DELETE', `/v1/chaves-api/${chaveCriada.id}`, dialogo.getByRole('button', { name: 'Revogar chave' }));

      expect(resposta.status()).toBe(204);
      await expect(dialogo).toBeHidden();
      await expect(linhaChave.getByText('Revogada', { exact: true })).toBeVisible();
      // A troca de antes ficou registrada como o último uso da chave.
      await expect(linhaChave.getByText('Nunca usada', { exact: true })).toHaveCount(0);
    });

    await test.step('com a chave revogada, a troca por token falha', async () => {
      const troca = await trocarChavePorToken(hospedeiro, chave, 'Auditor');

      expect(troca.status()).toBe(401);
      expect(((await troca.json()) as Esquemas['Problema']).codigo).toBe('chave_invalida');
      await expect(hospedeiro.getByRole('alert')).toHaveText('A API respondeu 401 (chave_invalida).');
      await expect(hospedeiro.getByRole('navigation', { name: 'Telas do Fluxo de Cálculo' })).toHaveCount(0);
    });

    await test.step('o Admin remove o domínio cadastrado no teste', async () => {
      await removerDominio(page, origem);
    });
  });
});
