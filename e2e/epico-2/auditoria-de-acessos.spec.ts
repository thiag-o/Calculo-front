// Épico 2 · o Auditor vê logins, falhas, bloqueios e redefinições na auditoria de acessos (os dois modos).
import type { Locator } from '@playwright/test';
import type { Sessao } from '../apoio/contrato';
import { entrar, enviarLogin, esperarModulo } from '../apoio/telas';
import { expect, test } from './apoio/fixtures';
import {
  abrirNoMenu,
  criarUsuario,
  definirSenhaPeloLink,
  emailNovo,
  filtrarAcessos,
  gerarLinkDeRedefinicao,
  navegacaoPrincipal,
  senhaNova,
  sufixo,
} from './apoio/telas';

/** Regra do back (G4): a 5ª falha seguida bloqueia o e-mail; a tentativa seguinte já vem recusada. */
const FALHAS_ATE_BLOQUEAR = 5;

/** A linha do evento na lista filtrada, pelo e-mail de quem fez (coluna Quem) ou por um texto do detalhe. */
function evento(tabela: Locator, rotulo: string, texto: string): Locator {
  return tabela.getByRole('row').filter({ has: tabela.page().getByText(rotulo, { exact: true }) }).filter({ hasText: texto });
}

test.describe('auditoria de acessos', () => {
  test('o Auditor vê os logins, as falhas, o bloqueio e as redefinições de senha dos membros do tenant', async ({ page, api, epico2 }) => {
    const auditor = { email: emailNovo('auditor'), nome: `E2E Auditor ${sufixo()}`, senha: senhaNova() };
    // Membro sem senha, que erra o login até ser bloqueado. Só os e-mails de membros aparecem na auditoria.
    const bloqueado = { email: emailNovo('bloqueado'), nome: `E2E Bloqueado ${sufixo()}` };
    let link = '';

    await test.step('o Admin cria o Auditor e um membro, e gera o link do Auditor', async () => {
      await entrar(page, api.conta('admin'));
      await abrirNoMenu(page, 'Usuários');
      const usuarioAuditor = await criarUsuario(page, { email: auditor.email, nome: auditor.nome, papel: 'Auditor' });
      await criarUsuario(page, { ...bloqueado, papel: 'Operador' });
      link = await gerarLinkDeRedefinicao(page, usuarioAuditor);
    });

    const pagina = await epico2.novaPagina();

    await test.step('o Auditor define a senha pelo link', async () => {
      await definirSenhaPeloLink(pagina, link, auditor.senha);
    });

    await test.step('o outro membro erra o login até ser bloqueado', async () => {
      const credenciais = { email: bloqueado.email, senha: 'senha-que-nao-confere' };
      for (let tentativa = 1; tentativa <= FALHAS_ATE_BLOQUEAR; tentativa += 1) {
        expect((await enviarLogin(pagina, credenciais)).status(), `tentativa ${tentativa}`).toBe(401);
      }
      expect((await enviarLogin(pagina, credenciais)).status(), 'tentativa depois do bloqueio').toBe(423);
    });

    await test.step('o Auditor entra e abre a Auditoria', async () => {
      // A página já está no login (o link levou a ele, e o bloqueio não sai dele): entra por ali mesmo, sem o `entrar`,
      // que abriria /entrar de novo e recarregaria o casca inteiro à toa (cerca de 1 s no Vite dev).
      const resposta = await enviarLogin(pagina, { email: auditor.email, senha: auditor.senha });
      expect(resposta.status(), 'o login do Auditor').toBe(200);
      await esperarModulo(pagina, (await resposta.json()) as Sessao);
      // O Auditor vê a Auditoria, mas não a Administração.
      await expect(navegacaoPrincipal(pagina).getByRole('group', { name: 'Administração' })).toHaveCount(0);
      await abrirNoMenu(pagina, 'Auditoria');
    });

    await test.step('o login do Auditor', async () => {
      const tabela = await filtrarAcessos(pagina, 'Login');
      await expect(evento(tabela, 'Login', auditor.email)).toHaveCount(1);
    });

    await test.step('as falhas e o bloqueio do outro membro', async () => {
      const falhas = await filtrarAcessos(pagina, 'Falha de login');
      await expect(evento(falhas, 'Falha de login', bloqueado.email)).toHaveCount(FALHAS_ATE_BLOQUEAR);

      const bloqueios = await filtrarAcessos(pagina, 'Login bloqueado');
      await expect(evento(bloqueios, 'Login bloqueado', bloqueado.email)).toHaveCount(1);
      await expect(evento(bloqueios, 'Login bloqueado', bloqueado.email)).toContainText('Bloqueado até');
    });

    await test.step('o link gerado pelo Admin e a senha redefinida pelo Auditor', async () => {
      // Quem gera é o Admin; o detalhe diz para quem.
      const gerados = await filtrarAcessos(pagina, 'Link de redefinição gerado');
      await expect(evento(gerados, 'Link de redefinição gerado', `Link de redefinição para ${auditor.email}`)).toHaveCount(1);

      const redefinidas = await filtrarAcessos(pagina, 'Senha redefinida');
      await expect(evento(redefinidas, 'Senha redefinida', auditor.email)).toHaveCount(1);
    });
  });
});
