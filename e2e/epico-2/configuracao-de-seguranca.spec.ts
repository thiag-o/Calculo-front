// Épico 2 · configuração de segurança do tenant: o Admin muda a inatividade da sessão e a senha mínima; um valor fora
// dos limites é recusado; a mudança aparece na auditoria (os dois modos).
import type { Locator, Page, Request } from '@playwright/test';
import type { Esquemas } from '../apoio/contrato';
import { entrar, respostaDaApi } from '../apoio/telas';
import { expect, test } from './apoio/fixtures';
import { abrirNoMenu, chamarApi, enviar, filtrarAcessos } from './apoio/telas';

const INATIVIDADE = 'Inatividade da sessão (minutos)';
const SENHA_MINIMA = 'Tamanho mínimo da senha (caracteres)';
const MENSAGEM_SALVO = 'Parâmetros de segurança salvos.';

const campo = (page: Page, rotulo: string): Locator => page.getByRole('textbox', { name: rotulo, exact: true });

/** Um valor novo dentro dos limites: um a mais (ou um a menos, se já está no máximo). */
function outroValor(parametro: Esquemas['ParametroSeguranca']): number {
  return parametro.valor < parametro.maximo ? parametro.valor + 1 : parametro.valor - 1;
}

/** Preenche os dois campos, salva e confirma no diálogo, que lista o que muda. */
async function salvar(page: Page, inatividade: number, senhaMinima: number, confirmacao: readonly string[]) {
  await campo(page, INATIVIDADE).fill(String(inatividade));
  await campo(page, SENHA_MINIMA).fill(String(senhaMinima));
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  const dialogo = page.getByRole('dialog', { name: 'Salvar parâmetros de segurança' });
  const alteracoes = dialogo.getByRole('list', { name: 'Parâmetros alterados' });
  for (const texto of confirmacao) await expect(alteracoes).toContainText(texto);

  const resposta = await enviar(page, 'PUT', '/v1/configuracoes/seguranca', dialogo.getByRole('button', { name: 'Salvar', exact: true }));

  expect(resposta.status(), 'salvar os parâmetros').toBe(200);
  await expect(dialogo).toBeHidden();
  await expect(page.getByRole('status').filter({ hasText: MENSAGEM_SALVO })).toBeVisible();
  return (await resposta.json()) as Esquemas['ConfiguracaoSeguranca'];
}

test.describe('configuração de segurança', () => {
  test('o Admin muda a inatividade e a senha mínima; fora do limite é recusado; a mudança fica na auditoria', async ({ page, api }) => {
    const sessao = await entrar(page, api.conta('admin'));
    const [consulta] = await Promise.all([respostaDaApi(page, 'GET', '/v1/configuracoes/seguranca'), abrirNoMenu(page, 'Segurança')]);
    expect(consulta.status()).toBe(200);
    // No modo real o tenant pode não estar nos padrões: o teste parte do que a API devolveu e volta a ele no fim.
    const original = (await consulta.json()) as Esquemas['ConfiguracaoSeguranca'];
    const inatividade = { de: original.inatividade_minutos.valor, para: outroValor(original.inatividade_minutos) };
    const senhaMinima = { de: original.senha_minima.valor, para: outroValor(original.senha_minima) };

    await test.step('o Admin muda a inatividade da sessão e a senha mínima', async () => {
      await expect(campo(page, INATIVIDADE)).toHaveValue(String(inatividade.de));
      await expect(campo(page, SENHA_MINIMA)).toHaveValue(String(senhaMinima.de));

      const salva = await salvar(page, inatividade.para, senhaMinima.para, [
        `de ${inatividade.de.toLocaleString('pt-BR')} minutos para ${inatividade.para.toLocaleString('pt-BR')} minutos`,
        `de ${senhaMinima.de} caracteres para ${senhaMinima.para} caracteres`,
      ]);

      expect(salva.inatividade_minutos.valor).toBe(inatividade.para);
      expect(salva.senha_minima.valor).toBe(senhaMinima.para);
      await expect(campo(page, INATIVIDADE)).toHaveValue(String(inatividade.para));
      await expect(campo(page, SENHA_MINIMA)).toHaveValue(String(senhaMinima.para));
    });

    await test.step('um valor fora dos limites é recusado e nada é enviado', async () => {
      const envios: Request[] = [];
      const contar = (requisicao: Request) => {
        if (requisicao.method() === 'PUT' && new URL(requisicao.url()).pathname === '/v1/configuracoes/seguranca') envios.push(requisicao);
      };
      page.on('request', contar);
      const { minimo, maximo } = original.inatividade_minutos;

      await campo(page, INATIVIDADE).fill(String(minimo - 1));
      await page.getByRole('button', { name: 'Salvar', exact: true }).click();

      await expect(campo(page, INATIVIDADE)).toHaveAttribute('aria-invalid', 'true');
      await expect(campo(page, INATIVIDADE)).toHaveAccessibleDescription(
        new RegExp(`^Informe um valor de ${minimo.toLocaleString('pt-BR')} a ${maximo.toLocaleString('pt-BR')}\\.`),
      );
      await expect(page.getByRole('dialog', { name: 'Salvar parâmetros de segurança' })).toHaveCount(0);
      page.off('request', contar);
      expect(envios, 'a tela não envia o valor fora do limite').toHaveLength(0);

      if (api.modo === 'real' && api.apiUrl) {
        // A API recusa sozinha também, sem gravar nada.
        const fora = await chamarApi(page, api.apiUrl, 'PUT', '/v1/configuracoes/seguranca', {
          inatividade_minutos: minimo - 1,
          duracao_maxima_dias: original.duracao_maxima_dias.valor,
          senha_minima: senhaMinima.para,
          validade_link_horas: original.validade_link_horas.valor,
          validade_token_minutos: original.validade_token_minutos.valor,
        });
        expect(fora).toMatchObject({ status: 422, codigo: 'valor_fora_do_limite' });
      }
    });

    await test.step('a mudança aparece na auditoria de acessos', async () => {
      await abrirNoMenu(page, 'Auditoria');
      const tabela = await filtrarAcessos(page, 'Segurança alterada');

      // O evento mais recente (a primeira linha depois do cabeçalho) é o desta mudança, com o valor antigo e o novo de
      // cada campo alterado no detalhe.
      const evento = tabela.getByRole('row').nth(1);
      await expect(evento.getByText('Segurança alterada', { exact: true })).toBeVisible();
      await expect(evento).toContainText(`inatividade_minutos: ${inatividade.de} → ${inatividade.para}`);
      await expect(evento).toContainText(`senha_minima: ${senhaMinima.de} → ${senhaMinima.para}`);
      await expect(evento.getByText(sessao.usuario.email, { exact: true })).toBeVisible();
    });

    await test.step('o Admin volta os valores de antes', async () => {
      await abrirNoMenu(page, 'Segurança');
      await expect(campo(page, INATIVIDADE)).toHaveValue(String(inatividade.para));

      const salva = await salvar(page, inatividade.de, senhaMinima.de, [
        `de ${inatividade.para.toLocaleString('pt-BR')} minutos para ${inatividade.de.toLocaleString('pt-BR')} minutos`,
      ]);

      expect(salva.inatividade_minutos.valor).toBe(inatividade.de);
      expect(salva.senha_minima.valor).toBe(senhaMinima.de);
    });
  });
});
