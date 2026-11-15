// Ações e localizadores das telas do épico 1, pelo que o usuário vê (papéis e rótulos acessíveis).
import type { Page, Response } from '@playwright/test';
import type { Problema, Sessao } from './contrato';
import { expect, type Credenciais } from './fixtures';

export const campoEmail = (page: Page) => page.getByRole('textbox', { name: 'E-mail' });
export const campoSenha = (page: Page) => page.getByLabel('Senha', { exact: true });
export const botaoEntrar = (page: Page) => page.getByRole('button', { name: 'Entrar', exact: true });
export const avisoDoLogin = (page: Page) => page.getByRole('alert');
export const menuDaConta = (page: Page, nome: string) => page.getByRole('button', { name: `${nome}: opções da conta` });
export const seletorDeCliente = (page: Page, atual: string) =>
  page.getByRole('button', { name: `Trocar cliente. Atual: ${atual}`, exact: true });

/** A resposta de `MÉTODO caminho` da API (qualquer origem que não seja o casca). */
export function respostaDaApi(page: Page, metodo: string, caminho: string): Promise<Response> {
  return page.waitForResponse(
    (resposta) => resposta.request().method() === metodo && new URL(resposta.url()).pathname === caminho,
  );
}

/** Preenche o login e envia; devolve a resposta do `POST /v1/sessao`. Espera estar na tela de login. */
export async function enviarLogin(page: Page, { email, senha }: Credenciais): Promise<Response> {
  await campoEmail(page).fill(email);
  await campoSenha(page).fill(senha);
  const [resposta] = await Promise.all([respostaDaApi(page, 'POST', '/v1/sessao'), botaoEntrar(page).click()]);
  return resposta;
}

/** Abre `/entrar`, faz o login com sucesso e espera o módulo. Devolve a sessão criada. */
export async function entrar(page: Page, credenciais: Credenciais): Promise<Sessao> {
  await page.goto('/entrar');
  const resposta = await enviarLogin(page, credenciais);
  expect(resposta.status(), 'o login deveria dar certo').toBe(200);
  const sessao = (await resposta.json()) as Sessao;
  await esperarModulo(page, sessao);
  return sessao;
}

/** O módulo aberto na tela Início, com quem está logado no menu lateral. */
export async function esperarModulo(page: Page, sessao: Sessao): Promise<void> {
  await expect(page).toHaveURL(/\/inicio$/);
  await expect(page.getByRole('heading', { level: 1, name: 'Início' })).toBeVisible();
  await expect(menuDaConta(page, sessao.usuario.nome)).toBeVisible();
}

/** A tela de login à vista (e não o módulo). */
export async function esperarLogin(page: Page): Promise<void> {
  await expect(page).toHaveURL(/\/entrar$/);
  await expect(botaoEntrar(page)).toBeVisible();
  await expect(campoEmail(page)).toBeVisible();
}

/** O corpo problem+json de uma resposta de erro. */
export async function corpoProblema(resposta: Response): Promise<Problema> {
  return (await resposta.json()) as Problema;
}
