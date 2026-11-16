// Ações e localizadores das telas do épico 2 (Administração, Auditoria, nova senha), pelo que o usuário vê.
// As do login e do módulo estão em e2e/apoio/telas.ts.
import { randomUUID } from 'node:crypto';
import type { Locator, Page, Response } from '@playwright/test';
import type { Esquemas } from '../../apoio/contrato';
import { esperarLogin, respostaDaApi } from '../../apoio/telas';
import { expect } from './fixtures';

export type Usuario = Esquemas['Usuario'];

/** Mensagens da tela de nova senha (sessao/redefinir/mensagensRedefinicao.ts). */
export const MENSAGEM_LINK_INVALIDO = 'Este link não vale mais: já foi usado ou venceu. Peça ao administrador um link novo.';

/** Um sufixo novo a cada chamada, para os nomes que o teste cria (no modo real, o banco guarda as rodadas anteriores). */
export function sufixo(): string {
  return randomUUID().slice(0, 8);
}

/** Um e-mail novo a cada chamada. */
export function emailNovo(quem: string): string {
  return `e2e-${quem}-${randomUUID()}@e2e.local`;
}

/** Uma senha nova (46 caracteres): cumpre a senha mínima mesmo com o teste de Segurança mexendo nela ao mesmo tempo. */
export function senhaNova(): string {
  return `Senha E2E ${randomUUID()}`;
}

export const navegacaoPrincipal = (page: Page) => page.getByRole('navigation', { name: 'Navegação principal' });

/** As telas da Administração e da Auditoria: o item do menu lateral e o título que a tela mostra. */
const TELAS = {
  Usuários: 'Usuários',
  Papéis: 'Papéis',
  Integração: 'Chaves de API',
  Segurança: 'Segurança',
  Auditoria: 'Acessos',
} as const;

/** Abre uma tela pelo item do menu lateral do casca e espera o título dela. */
export async function abrirNoMenu(page: Page, item: keyof typeof TELAS): Promise<void> {
  await navegacaoPrincipal(page).getByRole('link', { name: item, exact: true }).click();
  await expect(page.getByRole('heading', { level: 2, name: TELAS[item], exact: true })).toBeVisible();
}

/** A linha de uma tabela que contém o texto. */
export function linha(tabela: Locator, texto: string): Locator {
  return tabela.getByRole('row').filter({ hasText: texto });
}

export const tabelaUsuarios = (page: Page) => page.getByRole('table', { name: 'Usuários do tenant' });

/**
 * A linha do usuário na lista. A lista é paginada por nome: no modo real, com as rodadas anteriores no banco, o usuário
 * pode estar numa página seguinte ("Carregar mais usuários").
 */
export async function linhaDoUsuario(page: Page, email: string): Promise<Locator> {
  const procurada = linha(tabelaUsuarios(page), email);
  const carregarMais = page.getByRole('button', { name: 'Carregar mais usuários' });
  await expect(tabelaUsuarios(page)).not.toHaveAttribute('aria-busy', 'true');
  await expect(async () => {
    if ((await procurada.count()) === 0 && (await carregarMais.isVisible())) await carregarMais.click();
    await expect(procurada).toHaveCount(1, { timeout: 1_000 });
  }).toPass();
  return procurada;
}

/** "Novo usuário" na tela Usuários: e-mail, nome e um papel. Devolve o usuário criado (resposta `201`). */
export async function criarUsuario(page: Page, dados: { email: string; nome: string; papel: string }): Promise<Usuario> {
  await page.getByRole('button', { name: 'Novo usuário' }).first().click();
  const dialogo = page.getByRole('dialog', { name: 'Novo usuário' });
  await dialogo.getByRole('textbox', { name: 'E-mail' }).fill(dados.email);
  await dialogo.getByRole('textbox', { name: 'Nome', exact: true }).fill(dados.nome);
  await dialogo.getByRole('checkbox', { name: dados.papel, exact: true }).check();

  const resposta = await enviar(page, 'POST', '/v1/usuarios', dialogo.getByRole('button', { name: 'Salvar' }));
  expect(resposta.status(), 'criar o usuário').toBe(201);
  await expect(dialogo).toBeHidden();
  return (await resposta.json()) as Usuario;
}

/**
 * "Gerar link de redefinição" no menu da linha do usuário: confirma, gera e lê o link, mostrado uma vez só. Fecha o
 * diálogo e devolve o link.
 */
export async function gerarLinkDeRedefinicao(page: Page, usuario: Usuario): Promise<string> {
  const linhaUsuario = await linhaDoUsuario(page, usuario.email);
  await linhaUsuario.getByRole('button', { name: `Mais ações para ${usuario.nome}` }).click();
  await page.getByRole('menuitem', { name: 'Gerar link de redefinição' }).click();
  const dialogo = page.getByRole('dialog', { name: 'Link de redefinição' });

  const resposta = await enviar(
    page,
    'POST',
    `/v1/usuarios/${usuario.id}/redefinicao`,
    dialogo.getByRole('button', { name: 'Gerar link de redefinição' }),
  );
  expect(resposta.status(), 'gerar o link').toBe(201);
  await expect(dialogo.getByText('Copie o link agora: ele não será mostrado de novo.')).toBeVisible();
  const link = await dialogo.getByRole('textbox', { name: 'Link' }).inputValue();
  expect(link).toBe(((await resposta.json()) as Esquemas['LinkRedefinicao']).link);

  await page.keyboard.press('Escape');
  await expect(dialogo).toBeHidden();
  return link;
}

/** O endereço do link de redefinição no casca do teste (o back monta o link com a URL do casca dele). */
export function caminhoDoLink(link: string): string {
  const url = new URL(link);
  expect(url.pathname, 'o link leva à tela de nova senha do casca').toBe('/redefinir');
  return `${url.pathname}${url.search}`;
}

/** O campo "Nova senha" da tela de redefinição (a seção da tela também se chama "Nova senha"). */
export const campoNovaSenha = (page: Page) => page.getByRole('textbox', { name: 'Nova senha', exact: true });

/** Abre o link de redefinição, define a senha e espera o casca levar ao login. */
export async function definirSenhaPeloLink(page: Page, link: string, senha: string): Promise<void> {
  await page.goto(caminhoDoLink(link));
  await expect(page.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeVisible();
  await campoNovaSenha(page).fill(senha);
  await page.getByRole('textbox', { name: 'Repita a nova senha', exact: true }).fill(senha);

  const resposta = await enviar(page, 'POST', '/v1/redefinicao', page.getByRole('button', { name: 'Salvar' }));
  expect(resposta.status(), 'trocar a senha pelo link').toBe(204);
  await esperarLogin(page);
}

/** Clica e devolve a resposta de `MÉTODO caminho` que o clique provoca. */
export async function enviar(page: Page, metodo: string, caminho: string, botao: Locator): Promise<Response> {
  const [resposta] = await Promise.all([respostaDaApi(page, metodo, caminho), botao.click()]);
  return resposta;
}

/** Escolhe um tipo no filtro "Tipo de evento" da Auditoria › Acessos e espera a lista filtrada. */
export async function filtrarAcessos(page: Page, rotuloTipo: string): Promise<Locator> {
  await page.getByRole('combobox', { name: 'Tipo de evento' }).click();
  const [resposta] = await Promise.all([
    page.waitForResponse((r) => {
      const url = new URL(r.url());
      return r.request().method() === 'GET' && url.pathname === '/v1/auditoria/acessos' && url.searchParams.has('tipo');
    }),
    page.getByRole('option', { name: rotuloTipo, exact: true }).click(),
  ]);
  expect(resposta.status(), `filtrar por ${rotuloTipo}`).toBe(200);
  const tabela = page.getByRole('table', { name: 'Eventos de acesso do tenant' });
  await expect(tabela).not.toHaveAttribute('aria-busy', 'true');
  return tabela;
}

/** Resultado de uma chamada feita de dentro do navegador. */
export interface ResultadoChamada {
  status: number;
  codigo: unknown;
  corpo: unknown;
}

/**
 * Chama a API de dentro do navegador do casca, com o cookie da sessão e o `X-CSRF-Token` do cookie `fc_csrf`, como o
 * módulo faria. Serve às conferências do modo real (a recusa vem do back, não da tela).
 */
export function chamarApi(
  page: Page,
  apiUrl: string,
  metodo: string,
  caminho: string,
  corpo?: unknown,
): Promise<ResultadoChamada> {
  return page.evaluate(
    async ({ url, metodo, corpo }): Promise<ResultadoChamada> => {
      const csrf = document.cookie
        .split(';')
        .map((par) => par.trim().split('='))
        .find(([nome]) => nome === 'fc_csrf')?.[1];
      const cabecalhos: Record<string, string> = {};
      if (csrf && metodo !== 'GET') cabecalhos['X-CSRF-Token'] = csrf;
      if (corpo !== undefined) cabecalhos['Content-Type'] = 'application/json';
      const resposta = await fetch(url, {
        method: metodo,
        credentials: 'include',
        headers: cabecalhos,
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      const json: unknown = await resposta.json().catch(() => null);
      return { status: resposta.status, codigo: (json as { codigo?: unknown } | null)?.codigo, corpo: json };
    },
    { url: `${apiUrl}${caminho}`, metodo, corpo },
  );
}
