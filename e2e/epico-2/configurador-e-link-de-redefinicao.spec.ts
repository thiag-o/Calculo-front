// Épico 2 · usuário Configurador sem Administração e link de redefinição de uso único (os dois modos).
import { entrar } from '../apoio/telas';
import { expect, test } from './apoio/fixtures';
import {
  abrirNoMenu,
  caminhoDoLink,
  campoNovaSenha,
  chamarApi,
  criarUsuario,
  definirSenhaPeloLink,
  emailNovo,
  gerarLinkDeRedefinicao,
  linhaDoUsuario,
  MENSAGEM_LINK_INVALIDO,
  navegacaoPrincipal,
  senhaNova,
  sufixo,
  type Usuario,
} from './apoio/telas';

const AREAS_DA_ADMINISTRACAO = ['Usuários', 'Papéis', 'Integração', 'Segurança'];

test.describe('usuário Configurador e link de redefinição', () => {
  test('o Admin cria um Configurador e gera o link; a pessoa define a senha (o link não vale de novo) e entra sem ver Administração', async ({
    page,
    api,
    epico2,
  }) => {
    const pessoa = { email: emailNovo('configurador'), nome: `E2E Configurador ${sufixo()}` };
    const senha = senhaNova();
    let usuario: Usuario | undefined;
    let link = '';

    await test.step('o Admin cria o usuário com o papel Configurador', async () => {
      await entrar(page, api.conta('admin'));
      await abrirNoMenu(page, 'Usuários');

      usuario = await criarUsuario(page, { ...pessoa, papel: 'Configurador' });

      expect(usuario.papeis.map((papel) => papel.nome)).toEqual(['Configurador']);
      const linhaPessoa = await linhaDoUsuario(page, pessoa.email);
      await expect(linhaPessoa.getByText(pessoa.nome, { exact: true })).toBeVisible();
      await expect(linhaPessoa.getByRole('list', { name: `Papéis de ${pessoa.nome}` })).toHaveText('Configurador');
      await expect(linhaPessoa.getByText('Ativo', { exact: true })).toBeVisible();
    });

    await test.step('o Admin gera o link de redefinição, mostrado uma vez só', async () => {
      if (!usuario) throw new Error('O usuário não foi criado.');
      link = await gerarLinkDeRedefinicao(page, usuario);
      // Fechado o diálogo, o link não aparece em lugar nenhum da tela.
      await expect(page.getByText(link)).toHaveCount(0);
    });

    const pagina = await epico2.novaPagina();

    await test.step('a pessoa define a senha pelo link e vai para o login', async () => {
      await definirSenhaPeloLink(pagina, link, senha);
    });

    await test.step('o mesmo link não funciona uma segunda vez', async () => {
      await pagina.goto(caminhoDoLink(link));
      await expect(pagina.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeVisible();
      await expect(pagina.getByRole('alert')).toHaveText(MENSAGEM_LINK_INVALIDO);
      await expect(campoNovaSenha(pagina)).toHaveCount(0);
    });

    await test.step('a pessoa entra com a nova senha e não vê a Administração', async () => {
      await entrar(pagina, { email: pessoa.email, senha });

      const navegacao = navegacaoPrincipal(pagina);
      await expect(navegacao.getByRole('link', { name: 'Início', exact: true })).toBeVisible();
      await expect(navegacao.getByRole('group', { name: 'Administração' })).toHaveCount(0);
      for (const area of AREAS_DA_ADMINISTRACAO) {
        await expect(navegacao.getByRole('link', { name: area, exact: true })).toHaveCount(0);
      }
      // O Configurador também não tem a auditoria.
      await expect(navegacao.getByRole('link', { name: 'Auditoria', exact: true })).toHaveCount(0);

      // Nem pelo endereço: a rota sem permissão volta ao Início.
      await pagina.goto('/administracao/usuarios');
      await expect(pagina).toHaveURL(/\/inicio$/);
      await expect(pagina.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
      await expect(pagina.getByRole('heading', { level: 2, name: 'Usuários' })).toHaveCount(0);
    });

    if (api.modo === 'real' && api.apiUrl) {
      await test.step('modo real: a API também recusa a Administração ao Configurador', async () => {
        expect(await chamarApi(pagina, api.apiUrl ?? '', 'GET', '/v1/usuarios')).toMatchObject({ status: 403, codigo: 'sem_permissao' });
      });
    }
  });
});
