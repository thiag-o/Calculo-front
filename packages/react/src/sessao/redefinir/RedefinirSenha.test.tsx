import '@testing-library/jest-dom/vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { API, json, problema, requisicao, rotasChamadas, simularFetch, type FetchSimulado } from '../api.test.apoio';
import { RedefinirSenha } from '..';
import { MENSAGEM_LINK_INVALIDO, MENSAGEM_SENHA_SALVA, mensagemPrazo } from './mensagensRedefinicao';

const TOKEN = 'tok-redefinicao-123';
/** Mínimo diferente do padrão (12): a tela mostra o que a API diz, não um número fixo. */
const linkValido = { senha_minima: 10, expira_em: new Date(2026, 10, 17, 14, 30).toISOString() };

let fetchSimulado: FetchSimulado;

beforeEach(() => {
  fetchSimulado = simularFetch();
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function semConteudo(): Response {
  return new Response(null, { status: 204 });
}

/** Sem opções, abre com o token do link; `{ token: undefined }` abre sem token. */
function renderizar({ token }: { token?: string | null } = { token: TOKEN }) {
  const onSalvar = vi.fn();
  const usuario = userEvent.setup();
  const tela = render(<RedefinirSenha apiUrl={API} tema="claro" token={token} onSalvar={onSalvar} />);
  return { onSalvar, usuario, ...tela };
}

const campoSenha = () => screen.getByLabelText('Nova senha', { selector: 'input' });
const campoConfirmacao = () => screen.getByLabelText('Repita a nova senha', { selector: 'input' });
const botaoSalvar = () => screen.getByRole('button', { name: 'Salvar' });

/** Abre a tela com o link válido e espera o formulário. */
async function abrirFormulario() {
  fetchSimulado.mockResolvedValueOnce(json(linkValido));
  const resultado = renderizar();
  await screen.findByLabelText('Nova senha', { selector: 'input' });
  return resultado;
}

async function preencher(usuario: ReturnType<typeof userEvent.setup>, senha: string, confirmacao = senha) {
  await usuario.type(campoSenha(), senha);
  await usuario.type(campoConfirmacao(), confirmacao);
}

describe('<RedefinirSenha> ao abrir', () => {
  it('verifica o link com o token no corpo e, enquanto isso, mostra o carregando sem formulário', async () => {
    let responder: (resposta: Response) => void = () => {};
    fetchSimulado.mockImplementation(() => new Promise<Response>((resolver) => (responder = resolver)));
    const { container } = renderizar();

    expect(container.querySelector('.fc-raiz')).toHaveAttribute('data-theme', 'light');
    expect(screen.getByRole('heading', { level: 1, name: 'Nova senha' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('Verificando o link');
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();

    await waitFor(() => expect(fetchSimulado).toHaveBeenCalledTimes(1));
    expect(rotasChamadas(fetchSimulado)).toEqual(['POST /v1/redefinicao/verificacao']);
    const req = requisicao(fetchSimulado);
    // O token não vai na URL (não aparece em log de acesso).
    expect(req.url).not.toContain(TOKEN);
    expect(await req.json()).toEqual({ token: TOKEN });

    responder(json(linkValido));
    expect(await screen.findByLabelText('Nova senha', { selector: 'input' })).toBeInTheDocument();
    expect(screen.queryByText('Verificando o link')).not.toBeInTheDocument();
  });

  it('mostra a senha mínima exata do link, a regra do e-mail e o prazo, com o foco na nova senha', async () => {
    await abrirFormulario();

    expect(screen.getByRole('region', { name: 'Nova senha' })).toBeInTheDocument();
    expect(campoSenha()).toHaveAccessibleDescription('Pelo menos 10 caracteres. Não pode conter o seu e-mail.');
    expect(screen.getByText(/Este link vale até 17\/11 às 14:30\./)).toBeInTheDocument();
    expect(campoSenha()).toHaveFocus();
    expect(campoSenha()).toHaveAttribute('type', 'password');
    expect(campoSenha()).toHaveAttribute('autocomplete', 'new-password');
    expect(campoConfirmacao()).toHaveAttribute('type', 'password');
    expect(campoConfirmacao()).toHaveAttribute('autocomplete', 'new-password');
    expect(botaoSalvar()).toBeEnabled();
  });

  it('link_invalido: diz que o link não vale mais e não mostra o formulário', async () => {
    fetchSimulado.mockResolvedValueOnce(problema(410, 'link_invalido'));
    renderizar();

    expect(await screen.findByRole('alert')).toHaveTextContent(MENSAGEM_LINK_INVALIDO);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Salvar' })).not.toBeInTheDocument();
    // A mensagem é da tela, não o texto do servidor.
    expect(screen.queryByText(/Texto do servidor/)).not.toBeInTheDocument();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sem token', undefined],
    ['token nulo', null],
    ['token vazio', ''],
  ])('%s: mostra o link inválido sem consultar a API', (_caso, token) => {
    renderizar({ token });

    expect(screen.getByRole('alert')).toHaveTextContent(MENSAGEM_LINK_INVALIDO);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    expect(fetchSimulado).not.toHaveBeenCalled();
  });

  it('outra falha da verificação: mostra o erro e "Tentar de novo" consulta de novo', async () => {
    fetchSimulado.mockResolvedValueOnce(problema(415, 'tipo_conteudo_invalido')).mockResolvedValueOnce(json(linkValido));
    const { usuario } = renderizar();

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent('Não foi possível verificar o link');
    expect(alerta).toHaveTextContent('Texto do servidor para tipo_conteudo_invalido.');
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();

    await usuario.click(screen.getByRole('button', { name: 'Tentar de novo' }));

    expect(await screen.findByLabelText('Nova senha', { selector: 'input' })).toBeInTheDocument();
    expect(rotasChamadas(fetchSimulado)).toEqual(['POST /v1/redefinicao/verificacao', 'POST /v1/redefinicao/verificacao']);
  });
});

describe('<RedefinirSenha> ao salvar', () => {
  it('com sucesso, envia o token e a nova senha (sem tirar espaços), mostra a confirmação e chama o onSalvar', async () => {
    const { usuario, onSalvar } = await abrirFormulario();
    fetchSimulado.mockResolvedValueOnce(semConteudo());

    await preencher(usuario, ' senha nova 1 ');
    await usuario.click(botaoSalvar());

    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    expect(rotasChamadas(fetchSimulado)).toEqual(['POST /v1/redefinicao/verificacao', 'POST /v1/redefinicao']);
    expect(await requisicao(fetchSimulado, 1).json()).toEqual({ token: TOKEN, nova_senha: ' senha nova 1 ' });

    const confirmacao = screen.getByRole('status');
    expect(confirmacao).toHaveTextContent(MENSAGEM_SENHA_SALVA);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    // O botão sumiu: o foco vai para a mensagem.
    expect(confirmacao.parentElement).toHaveFocus();
  });

  it('envia pelo Enter no campo de confirmação', async () => {
    const { usuario, onSalvar } = await abrirFormulario();
    fetchSimulado.mockResolvedValueOnce(semConteudo());

    await preencher(usuario, 'senha-segura', 'senha-segura{Enter}');

    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
  });

  it('campos vazios: não envia, marca os dois e foca a nova senha', async () => {
    const { usuario, onSalvar } = await abrirFormulario();

    await usuario.click(botaoSalvar());

    expect(campoSenha()).toHaveAttribute('aria-invalid', 'true');
    expect(campoSenha()).toHaveAccessibleDescription(/^Informe a nova senha/);
    expect(campoConfirmacao()).toHaveAttribute('aria-invalid', 'true');
    expect(campoConfirmacao()).toHaveAccessibleDescription('Repita a nova senha');
    expect(campoSenha()).toHaveFocus();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('senha menor que o mínimo do link: não envia e diz o mínimo, contando caracteres e não unidades UTF-16', async () => {
    const { usuario } = await abrirFormulario();

    // 9 caracteres fora do plano básico: 18 unidades UTF-16, mas 9 caracteres para o servidor.
    const curta = '𝔸'.repeat(9);
    await preencher(usuario, curta);
    await usuario.click(botaoSalvar());

    expect(campoSenha()).toHaveAttribute('aria-invalid', 'true');
    expect(campoSenha()).toHaveAccessibleDescription(/^Use pelo menos 10 caracteres/);
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('confirmação diferente: não envia e marca a confirmação', async () => {
    const { usuario } = await abrirFormulario();

    await preencher(usuario, 'senha-segura', 'senha-segurx');
    await usuario.click(botaoSalvar());

    expect(campoSenha()).not.toHaveAttribute('aria-invalid');
    expect(campoConfirmacao()).toHaveAttribute('aria-invalid', 'true');
    expect(campoConfirmacao()).toHaveAccessibleDescription('As senhas estão diferentes. Digite a mesma senha nos dois campos');
    expect(campoConfirmacao()).toHaveFocus();
    expect(fetchSimulado).toHaveBeenCalledTimes(1);
  });

  it('enquanto salva, o botão fica carregando e não envia de novo', async () => {
    const { usuario, onSalvar } = await abrirFormulario();
    let responder: (resposta: Response) => void = () => {};
    fetchSimulado.mockImplementationOnce(() => new Promise<Response>((resolver) => (responder = resolver)));

    await preencher(usuario, 'senha-segura');
    await usuario.click(botaoSalvar());

    await waitFor(() => expect(botaoSalvar()).toHaveAttribute('aria-busy', 'true'));
    await usuario.click(botaoSalvar());
    await usuario.keyboard('{Enter}');
    expect(fetchSimulado).toHaveBeenCalledTimes(2);

    responder(semConteudo());
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
  });

  it('senha_invalida: põe a regra que o servidor recusou (ex.: o e-mail) no campo da nova senha', async () => {
    const { usuario, onSalvar } = await abrirFormulario();
    fetchSimulado.mockResolvedValueOnce(
      problema(422, 'senha_invalida', { campos: { nova_senha: 'A senha não pode conter o seu e-mail.' } }),
    );

    await preencher(usuario, 'ana@exemplo.com-1');
    await usuario.click(botaoSalvar());

    await waitFor(() => expect(campoSenha()).toHaveAttribute('aria-invalid', 'true'));
    expect(campoSenha()).toHaveAccessibleDescription(/^A senha não pode conter o seu e-mail\./);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('senha_invalida sem o erro do campo: mostra a mensagem do servidor numa nota', async () => {
    const { usuario } = await abrirFormulario();
    fetchSimulado.mockResolvedValueOnce(problema(422, 'senha_invalida'));

    await preencher(usuario, 'senha-segura');
    await usuario.click(botaoSalvar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Texto do servidor para senha_invalida.');
    expect(campoSenha()).toBeInTheDocument();
  });

  it('link_invalido no envio (venceu enquanto a pessoa digitava): troca o formulário pela mensagem e foca nela', async () => {
    const { usuario, onSalvar } = await abrirFormulario();
    fetchSimulado.mockResolvedValueOnce(problema(410, 'link_invalido'));

    await preencher(usuario, 'senha-segura');
    await usuario.click(botaoSalvar());

    const alerta = await screen.findByRole('alert');
    expect(alerta).toHaveTextContent(MENSAGEM_LINK_INVALIDO);
    expect(screen.queryByLabelText('Nova senha', { selector: 'input' })).not.toBeInTheDocument();
    expect(alerta.parentElement).toHaveFocus();
    expect(onSalvar).not.toHaveBeenCalled();
  });

  it('sem conexão: diz que não falou com o servidor e deixa tentar de novo', async () => {
    const { usuario, onSalvar } = await abrirFormulario();
    fetchSimulado.mockRejectedValueOnce(new TypeError('Failed to fetch')).mockResolvedValueOnce(semConteudo());

    await preencher(usuario, 'senha-segura');
    await usuario.click(botaoSalvar());

    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível falar com o servidor.');

    await usuario.click(botaoSalvar());
    await waitFor(() => expect(onSalvar).toHaveBeenCalledTimes(1));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
});

describe('mensagemPrazo', () => {
  it('dia e hora no fuso local', () => {
    expect(mensagemPrazo(new Date(2026, 0, 5, 9, 7).toISOString())).toBe('Este link vale até 05/01 às 09:07.');
  });

  it('sem data válida, nada', () => {
    expect(mensagemPrazo('não é data')).toBeUndefined();
  });
});
