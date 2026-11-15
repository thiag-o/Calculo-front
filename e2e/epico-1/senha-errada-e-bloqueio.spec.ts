// Épico 1 · senha errada e bloqueio do login (os dois modos).
import { expect, test } from '../apoio/fixtures';
import { avisoDoLogin, campoSenha, corpoProblema, enviarLogin, esperarLogin, esperarModulo } from '../apoio/telas';
import type { Sessao } from '../apoio/contrato';

/** Regra do back (G4): a 5ª falha seguida bloqueia o e-mail; a tentativa seguinte já vem recusada. */
const FALHAS_ATE_BLOQUEAR = 5;
const FUSO = 'America/Sao_Paulo';

const MENSAGEM_CREDENCIAIS_INVALIDAS = 'E-mail ou senha incorretos. Confira os dados e tente de novo.';

test.use({ timezoneId: FUSO });

/** "Tente de novo às HH:MM" (e " de DD/MM" se o desbloqueio cair em outro dia), no fuso do navegador do teste. */
function textoDoDesbloqueio(desbloqueiaEm: string): string {
  const quando = new Date(desbloqueiaEm);
  const hora = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit', timeZone: FUSO }).format(quando);
  const dia = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', timeZone: FUSO });
  const outroDia = dia.format(quando) !== dia.format(new Date());
  const sufixo = outroDia ? ` de ${dia.format(quando).slice(0, 5)}` : '';
  return `Tente de novo às ${hora}${sufixo}.`;
}

test.describe('senha errada e bloqueio', () => {
  test('senha errada mostra a mensagem genérica e deixa tentar de novo', async ({ page, api }) => {
    const conta = api.conta('admin');
    await page.goto('/entrar');

    const recusa = await enviarLogin(page, { email: conta.email, senha: `${conta.senha}-errada` });

    expect(recusa.status()).toBe(401);
    expect((await corpoProblema(recusa)).codigo).toBe('credenciais_invalidas');
    await expect(avisoDoLogin(page)).toHaveText(MENSAGEM_CREDENCIAIS_INVALIDAS);
    await esperarLogin(page);
    // A mensagem não acusa um campo só (não revela se o e-mail existe).
    await expect(campoSenha(page)).not.toHaveAttribute('aria-invalid', 'true');

    const sucesso = await enviarLogin(page, conta);

    expect(sucesso.status()).toBe(200);
    await esperarModulo(page, (await sucesso.json()) as Sessao);
  });

  test('cinco erros seguidos bloqueiam o e-mail e a tela diz quando tentar de novo', async ({ page, api }) => {
    // E-mail novo a cada rodada: no modo real o bloqueio dura 15 minutos e não pode atingir as contas dos outros testes.
    const credenciais = { email: api.emailSemConta(), senha: 'senha-que-nao-confere' };
    await page.goto('/entrar');

    for (let tentativa = 1; tentativa <= FALHAS_ATE_BLOQUEAR; tentativa += 1) {
      const recusa = await enviarLogin(page, credenciais);
      expect(recusa.status(), `tentativa ${tentativa}`).toBe(401);
      await expect(avisoDoLogin(page)).toHaveText(MENSAGEM_CREDENCIAIS_INVALIDAS);
    }

    const bloqueio = await enviarLogin(page, credenciais);

    expect(bloqueio.status()).toBe(423);
    const corpo = await corpoProblema(bloqueio);
    expect(corpo.codigo).toBe('login_bloqueado');
    const desbloqueiaEm = (corpo as { desbloqueia_em?: unknown }).desbloqueia_em;
    expect(typeof desbloqueiaEm).toBe('string');
    await expect(avisoDoLogin(page)).toHaveText(
      `O login deste e-mail foi bloqueado depois de várias tentativas erradas. ${textoDoDesbloqueio(desbloqueiaEm as string)}`,
    );
    await esperarLogin(page);
  });
});
